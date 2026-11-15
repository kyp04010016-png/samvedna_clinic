import { collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateMarginPercent } from './invoiceNo';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  fetchSqlEngineStatus,
  hydrateAppFromSqlDatabase,
  startRealtimeSqlSyncBridge,
  syncAllDataToSqlNow,
} from './sqlSyncBridge';
import { isDomainOrHostingEnvironment, purgeAllDummyAccounts } from './domainPrivacy';

export async function autoBootstrapDomainDatabaseIfNeeded(): Promise<void> {
  const bootstrapFlagKey = 'sandana_domain_auto_bootstrapped_v2';
  try {
    if (isDomainOrHostingEnvironment()) {
      // Automatically purge all test/dummy accounts on live domain/hosting
      purgeAllDummyAccounts().catch(() => {});
    }

    const clinicSnap = await getDoc(doc(db, 'settings', 'clinic'));
    const batchesSnap = await getDocs(collection(db, 'batches'));
    if (!clinicSnap.exists() || batchesSnap.empty) {
      // First check if SQL database already has records to hydrate from
      const sqlStatus = await fetchSqlEngineStatus();
      if (sqlStatus && sqlStatus.totalRows > 0) {
        await hydrateAppFromSqlDatabase().catch(() => {});
      } else {
        await seedInitialClinicData();
      }
      try {
        localStorage.setItem(bootstrapFlagKey, new Date().toISOString());
      } catch {
        // ignore storage errors
      }
    }
    startRealtimeSqlSyncBridge();
    await syncAllDataToSqlNow(false).catch(() => {});
  } catch {
    startRealtimeSqlSyncBridge();
  }
}

export async function seedInitialClinicData(): Promise<void> {
  const defaultMapUrl =
    'https://www.google.com/maps/search/?api=1&query=Sandana+Clinic+42+MG+Healthcare+Road+Anna+Nagar+Chennai+600040';

  // 1. Seed settings/clinic with defaultMarginPercent: 20, Razorpay, Google Maps & OTP Config
  try {
    const settingsRef = doc(db, 'settings', 'clinic');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        name: 'Sandana Clinic + Dudrucs',
        address: '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
        phone: '+91 98400 11223',
        gstNo: '33AABCS1429B1Z5',
        upiId: 'sandanaclinic@okaxis',
        upiName: 'Dudrucs Medical Store',
        razorpayEnabled: true,
        razorpayKeyId: 'rzp_test_SandanaDudrucs99',
        razorpayMerchantName: 'Sandana Clinic & Dudrucs Pharmacy',
        razorpayThemeColor: '#0284C7',
        razorpayMode: 'live',
        razorpayMethods: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        clinicName: 'Sandana Clinic',
        clinicAddress: '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
        clinicPhone: '+91 98400 11223',
        clinicTimings: 'Mon - Sat: 09:00 AM - 09:00 PM | Sun: 10:00 AM - 02:00 PM',
        medicalName: 'Dudrucs',
        medicalPhone: '919840011224',
        defaultMarginPercent: 20,
        googleMapUrl: defaultMapUrl,
        otpConfig: {
          enabled: true,
          phpOtpEndpoint: '/otp.php',
          fast2smsApiKey: '',
          msg91AuthKey: '',
          msg91TemplateId: '',
          emailJsServiceId: '',
          emailJsTemplateId: '',
          emailJsPublicKey: '',
          customWebhookUrl: '',
          showInstantOtpOnScreen: true,
        },
      });
    } else {
      const existingData = settingsSnap.data();
      if (
        typeof existingData.defaultMarginPercent !== 'number' ||
        !existingData.gstNo ||
        !existingData.googleMapUrl
      ) {
        await setDoc(
          settingsRef,
          {
            defaultMarginPercent: existingData.defaultMarginPercent ?? 20,
            gstNo: existingData.gstNo || '33AABCS1429B1Z5',
            googleMapUrl: existingData.googleMapUrl || defaultMapUrl,
          },
          { merge: true }
        );
      }
    }

    // 1B. Seed settings/site if empty
    const siteRef = doc(db, 'settings', 'site');
    const siteSnap = await getDoc(siteRef);
    if (!siteSnap.exists()) {
      await setDoc(siteRef, {
        sliderImages: [
          'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1400&q=80',
        ],
        socialLinks: {
          fb: 'https://facebook.com',
          insta: 'https://instagram.com',
          whatsapp: '919840011224',
          googleMapUrl: defaultMapUrl,
        },
        googleMapUrl: defaultMapUrl,
        clinicInfo:
          'Sandana Clinic & Dudrucs Pharmacy offers specialist outpatient care, OTP-verified digital appointments, and 100% genuine FIFO batch-tracked medicines.',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/clinic');
  }

  // 2. Seed counters/invoice and counters/batch
  try {
    const invCounterRef = doc(db, 'counters', 'invoice');
    const invSnap = await getDoc(invCounterRef);
    if (!invSnap.exists()) {
      await setDoc(invCounterRef, { lastNumber: 0 });
    }
    const batchCounterRef = doc(db, 'counters', 'batch');
    const batchSnap = await getDoc(batchCounterRef);
    if (!batchSnap.exists()) {
      await setDoc(batchCounterRef, { lastNumber: 105 });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'counters');
  }

  // 3. Seed doctors with individual Login ID & Password if empty
  try {
    const docsSnap = await getDocs(collection(db, 'doctors'));
    if (docsSnap.empty) {
      const sampleDoctors = [
        {
          id: 'doc_sandana_1',
          uid: 'doc_sandana_1',
          name: 'Dr. S. Sandana Krishnan',
          specialization: 'Senior General Physician & Diabetologist',
          qualification: 'MBBS, MD (Internal Medicine)',
          email: 'dr.sandana@sandanaclinic.com',
          loginId: 'dr.sandana@sandanaclinic.com',
          staffKey: 'Sandana@123',
          phone: '9840011223',
          experience: '18+ Years Experience',
          consultationFee: 350,
          regNo: 'TNMC Reg. #68421',
          languages: 'Tamil, English, Hindi',
          photoUrl: '',
          availableSlots: ['09:30', '10:00', '10:30', '11:00', '11:30', '17:30', '18:00', '18:30'],
          availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          isActive: true,
        },
        {
          id: 'doc_sandana_2',
          uid: 'doc_sandana_2',
          name: 'Dr. Priya Ramanathan',
          specialization: 'Consultant Pediatrician & Neonatologist',
          qualification: 'MBBS, DCH, DNB (Pediatrics)',
          email: 'dr.priya@sandanaclinic.com',
          loginId: 'dr.priya@sandanaclinic.com',
          staffKey: 'Priya@123',
          phone: '9840011225',
          experience: '12+ Years Experience',
          consultationFee: 300,
          regNo: 'TNMC Reg. #79104',
          languages: 'Tamil, English, Telugu',
          photoUrl: '',
          availableSlots: ['10:00', '10:30', '11:00', '12:00', '16:30', '17:00', '17:30'],
          availableDays: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
          isActive: true,
        },
        {
          id: 'doc_sandana_3',
          uid: 'doc_sandana_3',
          name: 'Dr. Arvind Narayanan',
          specialization: 'Orthopedic, Spine & Joint Replacement Surgeon',
          qualification: 'MBBS, MS (Ortho)',
          email: 'dr.arvind@sandanaclinic.com',
          loginId: 'dr.arvind@sandanaclinic.com',
          staffKey: 'Arvind@123',
          phone: '9840011228',
          experience: '14+ Years Experience',
          consultationFee: 400,
          regNo: 'TNMC Reg. #74219',
          languages: 'Tamil, English',
          photoUrl: '',
          availableSlots: ['16:30', '17:00', '17:30', '18:00', '19:30'],
          availableDays: ['Tue', 'Thu', 'Sat'],
          isActive: true,
        },
      ];
      for (const d of sampleDoctors) {
        const { id, ...docData } = d;
        await setDoc(doc(db, 'doctors', id), docData, { merge: true });
        await setDoc(
          doc(db, 'users', id),
          {
            uid: id,
            doctorId: id,
            name: d.name,
            email: d.email,
            phone: d.phone,
            role: 'doctor',
            specialization: d.specialization,
            staffKey: d.staffKey,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'doctors');
  }

  // 4. Seed Marg-style Medicine Master & Batches if batches collection is empty
  try {
    const batchesSnap = await getDocs(collection(db, 'batches'));
    if (batchesSnap.empty) {
      // Clear any legacy non-Marg medicine docs so schema is 100% consistent
      const existingMeds = await getDocs(collection(db, 'medicines'));
      for (const mDoc of existingMeds.docs) {
        const d = mDoc.data();
        if (!('genericName' in d) || !('scheduleType' in d)) {
          await deleteDoc(doc(db, 'medicines', mDoc.id));
        }
      }

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];

      // Dates for FIFO & Expiry alerts demonstration (current date ~ 2026-10-25)
      const soonExpiryDate = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0]; // within 90 days
      const farExpiryDate = '2027-12-31';
      const midExpiryDate = '2027-06-30';

      const masterMedicines = [
        {
          name: 'Dolo 650 Tablet',
          brand: 'Dolo',
          genericName: 'Paracetamol 650mg',
          manufacturer: 'Micro Labs Ltd',
          hsnCode: '30049099',
          unit: 'strip' as const,
          gstPercent: 12 as const,
          scheduleType: 'OTC' as const,
          reorderLevel: 15,
          createdAt: nowIso,
          batches: [
            {
              batchNo: 'B101',
              expiryDate: midExpiryDate,
              costPrice: 22,
              mrp: 34,
              sellPrice: 30,
              stock: 85,
              supplierName: 'Chennai Pharma Distributors',
            },
            {
              batchNo: 'B102',
              expiryDate: farExpiryDate,
              costPrice: 23,
              mrp: 35,
              sellPrice: 32,
              stock: 120,
              supplierName: 'Chennai Pharma Distributors',
            },
          ],
        },
        {
          name: 'Augmentin 625 Duo',
          brand: 'Augmentin',
          genericName: 'Amoxycillin 500mg + Clavulanic Acid 125mg',
          manufacturer: 'GlaxoSmithKline (GSK)',
          hsnCode: '30041000',
          unit: 'strip' as const,
          gstPercent: 12 as const,
          scheduleType: 'H' as const,
          reorderLevel: 10,
          createdAt: nowIso,
          batches: [
            {
              batchNo: 'B103',
              expiryDate: soonExpiryDate, // Expiring within 90 days!
              costPrice: 155,
              mrp: 223,
              sellPrice: 200,
              stock: 18,
              supplierName: 'Apex Medico Agencies',
            },
          ],
        },
        {
          name: 'Pan-D Capsule PR',
          brand: 'Pan-D',
          genericName: 'Pantoprazole 40mg + Domperidone 30mg',
          manufacturer: 'Alkem Laboratories',
          hsnCode: '30049034',
          unit: 'strip' as const,
          gstPercent: 12 as const,
          scheduleType: 'H' as const,
          reorderLevel: 12,
          createdAt: nowIso,
          batches: [
            {
              batchNo: 'B104',
              expiryDate: farExpiryDate,
              costPrice: 140,
              mrp: 210,
              sellPrice: 185,
              stock: 7, // Low stock (< 10 and < reorderLevel 12)
              supplierName: 'Sri Murugan Pharma',
            },
          ],
        },
        {
          name: 'Benadryl Cough Formula 150ml',
          brand: 'Benadryl',
          genericName: 'Diphenhydramine + Ammonium Chloride',
          manufacturer: 'JNTL Consumer Health',
          hsnCode: '30049061',
          unit: 'bottle' as const,
          gstPercent: 12 as const,
          scheduleType: 'OTC' as const,
          reorderLevel: 10,
          createdAt: nowIso,
          batches: [
            {
              batchNo: 'B105',
              expiryDate: farExpiryDate,
              costPrice: 98,
              mrp: 145,
              sellPrice: 130,
              stock: 40,
              supplierName: 'Chennai Pharma Distributors',
            },
          ],
        },
        {
          name: 'ORS Electrolyte Sample Sachet (₹1 Test)',
          brand: 'Dudrucs Care',
          genericName: 'Oral Rehydration Salts IP',
          manufacturer: 'Dudrucs Healthcare',
          hsnCode: '30049099',
          unit: 'tablet' as const,
          gstPercent: 5 as const,
          scheduleType: 'OTC' as const,
          reorderLevel: 10,
          createdAt: nowIso,
          batches: [
            {
              batchNo: 'B100-TEST',
              expiryDate: farExpiryDate,
              costPrice: 0.7,
              mrp: 1.5,
              sellPrice: 1,
              stock: 250,
              supplierName: 'Dudrucs Direct',
            },
          ],
        },
      ];

      for (const item of masterMedicines) {
        const { batches, ...medicineData } = item;
        const medRef = await addDoc(collection(db, 'medicines'), medicineData);
        for (const b of batches) {
          const marginPercent = calculateMarginPercent(b.costPrice, b.sellPrice);
          await addDoc(collection(db, 'batches'), {
            medicineId: medRef.id,
            medicineName: medicineData.name,
            batchNo: b.batchNo,
            barcode: `890${b.batchNo.replace(/[^0-9A-Z]/gi, '')}`,
            expiryDate: b.expiryDate,
            costPrice: b.costPrice,
            mrp: b.mrp,
            sellPrice: b.sellPrice,
            marginPercent,
            stock: b.stock,
            supplierName: b.supplierName,
            purchaseDate: todayDate,
            createdAt: nowIso,
          });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batches');
  }

  // 5. Seed approved feedback if empty
  try {
    const fbSnap = await getDocs(collection(db, 'feedback'));
    if (fbSnap.empty) {
      const sampleFeedback = [
        {
          patientName: 'Meenakshi Sundaram',
          rating: 5,
          comment: 'Very clean clinic and minimal waiting time. Dr. Karthikeyan explained my diabetes care plan clearly, and Dudrucs pharmacy had all medicines ready with batch-verified billing.',
          doctorId: '',
          isApproved: true,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          patientName: 'Aravind Rajagopal',
          rating: 5,
          comment: 'Booked an evening pediatric slot online in under a minute. Reception token system and digital pharmacy receipt made the visit super smooth.',
          doctorId: '',
          isApproved: true,
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ];
      for (const fb of sampleFeedback) {
        await addDoc(collection(db, 'feedback'), fb);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'feedback');
  }
}
