import {
  initSqlEngineFromEnv,
  upsertSqlRecord,
  generateMySqlDump,
  generatePhpMysqlConnectorFile,
  getSqlTableCounts
} from '../src/db/sqlEngine.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  await initSqlEngineFromEnv();

  // 1. Seed Clinic Settings
  await upsertSqlRecord('settings', 'clinic', {
    clinicName: 'Sandana Clinic',
    medicalName: 'Dudrucs Medical Store',
    clinicPhone: '+91 98400 11223',
    medicalPhone: '+91 98400 99887',
    clinicEmail: 'kyp04010016@gmail.com',
    clinicAddress: '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
    clinicTimings: 'Mon - Sat: 08:30 AM - 09:30 PM | Sun: 09:00 AM - 02:00 PM',
    googleMapUrl: 'https://maps.google.com/?q=Anna+Nagar+Chennai',
    gstNo: '33AABCS1429B1Z8',
    dlNo: 'TN/CHN/20B/04128, TN/CHN/21B/04129',
    upiId: 'sandanaclinic@upi',
    upiName: 'Sandana Clinic & Dudrucs',
    enableUpiQr: true,
    enableRazorpay: true,
    websiteContent: 'Comprehensive outpatient multi-specialty healthcare, instant digital appointments, FIFO batch-tracked pharmacy with Marg ERP integration.'
  });

  // 2. Seed Default Counters
  await upsertSqlRecord('counters', 'invoice', { lastNumber: 100 });
  await upsertSqlRecord('counters', 'batch', { lastNumber: 200 });
  await upsertSqlRecord('counters', 'appointment', { lastNumber: 50 });

  // 3. Seed Default Admin & Staff Users
  await upsertSqlRecord('users', 'admin_1', {
    name: 'Administrator',
    email: 'kyp04010016@gmail.com',
    phone: '9840011223',
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  await upsertSqlRecord('users', 'reception_1', {
    name: 'Reception Desk',
    email: 'reception@sandanaclinic.com',
    phone: '9840011224',
    role: 'reception',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  await upsertSqlRecord('users', 'pharmacist_1', {
    name: 'Chief Pharmacist (Dudrucs)',
    email: 'pharmacy@sandanaclinic.com',
    phone: '9840099887',
    role: 'pharmacy',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // 4. Seed Doctors
  const defaultDoctors = [
    {
      id: 'doc_1',
      name: 'Dr. R. Sandana Krishnan',
      specialization: 'General Medicine & Diabetology',
      qualification: 'MBBS, MD (Internal Medicine)',
      experience: '18+ Years',
      consultationFee: 400,
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400',
      availableSlots: ['09:00 AM', '10:00 AM', '11:00 AM', '05:00 PM', '06:00 PM', '07:30 PM'],
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      languages: 'English, Tamil, Hindi',
      bio: 'Senior Consultant Physician specializing in diabetes management, hypertension, viral fevers, and preventive health.',
      isActive: true
    },
    {
      id: 'doc_2',
      name: 'Dr. S. Kavitha',
      specialization: 'Obstetrics & Gynaecology',
      qualification: 'MBBS, DGO, DNB (OBG)',
      experience: '14+ Years',
      consultationFee: 500,
      photoUrl: 'https://images.unsplash.com/photo-1594824813511-2098020a562f?auto=format&fit=crop&q=80&w=400',
      availableSlots: ['10:00 AM', '11:30 AM', '04:30 PM', '06:30 PM'],
      availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
      languages: 'English, Tamil',
      bio: 'Expert in antenatal care, high-risk pregnancy, PCOS/PCOD care, and women health wellness.',
      isActive: true
    },
    {
      id: 'doc_3',
      name: 'Dr. M. Arun Kumar',
      specialization: 'Pediatrics & Neonatology',
      qualification: 'MBBS, MD (Pediatrics), DCH',
      experience: '11+ Years',
      consultationFee: 400,
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=400',
      availableSlots: ['09:30 AM', '11:00 AM', '05:30 PM', '07:00 PM'],
      availableDays: ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday'],
      languages: 'English, Tamil, Telugu',
      bio: 'Specialist in child immunization, infant nutrition, childhood infections, and growth monitoring.',
      isActive: true
    },
    {
      id: 'doc_4',
      name: 'Dr. Priya Nair',
      specialization: 'ENT Specialist & Surgeon',
      qualification: 'MBBS, MS (ENT), DNB',
      experience: '9+ Years',
      consultationFee: 450,
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
      availableSlots: ['11:00 AM', '12:30 PM', '06:00 PM', '08:00 PM'],
      availableDays: ['Tuesday', 'Thursday', 'Saturday'],
      languages: 'English, Tamil, Malayalam',
      bio: 'Expert in sinusitis, allergy management, ear infections, throat disorders, and tonsillitis.',
      isActive: true
    },
    {
      id: 'doc_5',
      name: 'Dr. Rajesh Verma',
      specialization: 'Dermatologist & Cosmetologist',
      qualification: 'MBBS, MD (DVL)',
      experience: '15+ Years',
      consultationFee: 500,
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400',
      availableSlots: ['04:00 PM', '05:30 PM', '07:00 PM', '08:30 PM'],
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      languages: 'English, Hindi, Tamil',
      bio: 'Specialist in skin infections, psoriasis, acne therapy, hair loss treatments, and clinical dermatology.',
      isActive: true
    }
  ];

  for (const doc of defaultDoctors) {
    await upsertSqlRecord('doctors', doc.id, doc);
  }

  // 5. Seed Core Marg ERP Pharmacy Medicines & Batches
  const defaultMedicines = [
    {
      id: 'med_dolo650',
      name: 'Dolo 650 Tablet',
      brand: 'Micro Labs',
      genericName: 'Paracetamol 650mg',
      manufacturer: 'Micro Labs Ltd',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'OTC',
      reorderLevel: 25,
      batch: {
        id: 'batch_dolo_01',
        batchNo: 'DL-65022',
        expiryDate: '2027-08-31',
        costPrice: 22.50,
        mrp: 34.00,
        sellPrice: 30.00,
        stock: 140,
        supplierName: 'Micro Healthcare Distributers'
      }
    },
    {
      id: 'med_augmentin625',
      name: 'Augmentin 625 Duo',
      brand: 'GSK',
      genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
      manufacturer: 'GlaxoSmithKline Pharmaceuticals',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'Schedule H',
      reorderLevel: 15,
      batch: {
        id: 'batch_aug_01',
        batchNo: 'AUG-8891',
        expiryDate: '2026-12-31',
        costPrice: 155.00,
        mrp: 223.00,
        sellPrice: 199.00,
        stock: 65,
        supplierName: 'Apex Pharma Agency'
      }
    },
    {
      id: 'med_pand',
      name: 'Pan-D Capsule',
      brand: 'Alkem',
      genericName: 'Pantoprazole 40mg + Domperidone 30mg SR',
      manufacturer: 'Alkem Laboratories Ltd',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'Schedule H',
      reorderLevel: 20,
      batch: {
        id: 'batch_pand_01',
        batchNo: 'PND-4010',
        expiryDate: '2027-05-31',
        costPrice: 135.00,
        mrp: 199.00,
        sellPrice: 175.00,
        stock: 90,
        supplierName: 'Southern Pharma Distributors'
      }
    },
    {
      id: 'med_azithral500',
      name: 'Azithral 500 Tablet',
      brand: 'Alembic',
      genericName: 'Azithromycin 500mg',
      manufacturer: 'Alembic Pharmaceuticals Ltd',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'Schedule H',
      reorderLevel: 15,
      batch: {
        id: 'batch_azith_01',
        batchNo: 'AZT-5512',
        expiryDate: '2027-03-31',
        costPrice: 85.00,
        mrp: 132.00,
        sellPrice: 118.00,
        stock: 75,
        supplierName: 'Metro Pharma Wholesale'
      }
    },
    {
      id: 'med_montairlc',
      name: 'Montair LC Tablet',
      brand: 'Cipla',
      genericName: 'Montelukast 10mg + Levocetirizine 5mg',
      manufacturer: 'Cipla Ltd',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'Schedule H',
      reorderLevel: 15,
      batch: {
        id: 'batch_mont_01',
        batchNo: 'MLC-9023',
        expiryDate: '2027-06-30',
        costPrice: 165.00,
        mrp: 245.00,
        sellPrice: 215.00,
        stock: 80,
        supplierName: 'Cipla Depot Chennai'
      }
    },
    {
      id: 'med_ascorills',
      name: 'Ascoril LS Syrup (100ml)',
      brand: 'Glenmark',
      genericName: 'Levosalbutamol + Ambroxol + Guaiphenesin',
      manufacturer: 'Glenmark Pharmaceuticals',
      hsnCode: '30049099',
      unit: 'bottle',
      gstPercent: 12,
      scheduleType: 'Schedule H',
      reorderLevel: 20,
      batch: {
        id: 'batch_ascor_01',
        batchNo: 'ASC-3310',
        expiryDate: '2027-04-30',
        costPrice: 78.00,
        mrp: 118.00,
        sellPrice: 105.00,
        stock: 55,
        supplierName: 'Apex Pharma Agency'
      }
    },
    {
      id: 'med_shelcal500',
      name: 'Shelcal 500 Tablet',
      brand: 'Torrent',
      genericName: 'Calcium 500mg + Vitamin D3 250 IU',
      manufacturer: 'Torrent Pharmaceuticals Ltd',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'OTC',
      reorderLevel: 20,
      batch: {
        id: 'batch_shel_01',
        batchNo: 'SHL-2022',
        expiryDate: '2027-10-31',
        costPrice: 88.00,
        mrp: 131.00,
        sellPrice: 115.00,
        stock: 120,
        supplierName: 'Southern Pharma Distributors'
      }
    },
    {
      id: 'med_telma40',
      name: 'Telma 40 Tablet',
      brand: 'Glenmark',
      genericName: 'Telmisartan 40mg',
      manufacturer: 'Glenmark Pharmaceuticals',
      hsnCode: '30049099',
      unit: 'strip',
      gstPercent: 12,
      scheduleType: 'Schedule H',
      reorderLevel: 15,
      batch: {
        id: 'batch_tel_01',
        batchNo: 'TLM-7711',
        expiryDate: '2027-09-30',
        costPrice: 95.00,
        mrp: 150.00,
        sellPrice: 130.00,
        stock: 85,
        supplierName: 'Metro Pharma Wholesale'
      }
    }
  ];

  for (const med of defaultMedicines) {
    const { batch, ...medData } = med;
    await upsertSqlRecord('medicines', med.id, medData);
    await upsertSqlRecord('batches', batch.id, {
      ...batch,
      medicineId: med.id,
      medicineName: med.name
    });
  }

  // 6. Seed Sample Feedback
  await upsertSqlRecord('feedback', 'fb_1', {
    patientName: 'Ramesh Sundaram',
    rating: 5,
    comment: 'Exceptional diagnosis by Dr. Sandana Krishnan. The instant queue token system saved us over 45 minutes of waiting time.',
    approved: 1,
    createdAt: new Date().toISOString()
  });

  await upsertSqlRecord('feedback', 'fb_2', {
    patientName: 'Meenakshi Raman',
    rating: 5,
    comment: 'Dudrucs pharmacy provided all prescribed medicines with valid batch and clear GST invoice. Very polite staff and quick UPI payment.',
    approved: 1,
    createdAt: new Date().toISOString()
  });

  console.log('Seeded SQLite successfully. Counts:', getSqlTableCounts());

  // 7. Generate Full MySQL Dump (.sql)
  const mysqlDump = generateMySqlDump('sandana_dudrucs_mysql');
  fs.writeFileSync(path.resolve(process.cwd(), 'public/database.sql'), mysqlDump, 'utf-8');
  fs.writeFileSync(path.resolve(process.cwd(), 'database.sql'), mysqlDump, 'utf-8');
  console.log('Exported database.sql (public/database.sql & database.sql)');

  // 8. Generate PHP Connector
  const phpConnector = generatePhpMysqlConnectorFile({
    host: 'localhost',
    port: 3306,
    database: 'sandana_dudrucs_mysql',
    user: 'root',
    password: ''
  });
  fs.writeFileSync(path.resolve(process.cwd(), 'public/mysql_api.php'), phpConnector, 'utf-8');
  console.log('Exported public/mysql_api.php');

  // 9. Generate db_connect.php helper for simple direct PHP integration
  const dbConnectPhp = `<?php
/**
 * Sandana Clinic & Dudrucs Pharmacy - Direct Database Connection Config
 * Edit the credentials below according to your cPanel / Hosting MySQL database.
 */
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: 3306);
define('DB_NAME', getenv('DB_NAME') ?: 'sandana_dudrucs_mysql');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

function getDatabaseConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
`;
  fs.writeFileSync(path.resolve(process.cwd(), 'public/db_connect.php'), dbConnectPhp, 'utf-8');
  console.log('Exported public/db_connect.php');

  // 10. Generate Hosting Instructions
  const hostingGuide = `# Sandana Clinic & Dudrucs Medical Store - Domain / Hosting Deployment Guide
================================================================================

Aap is poore project ko kisi bhi cPanel, Hostinger, GoDaddy, Namecheap, VPS, ya
Apache/Nginx Shared Hosting par upload karke chala sakte hain!

## STEP 1: MySQL Database Create & Import Karein
1. Apne cPanel ya Hosting panel me login karein.
2. "MySQL Databases" me jaa kar ek naya database banayein (jaise: \`sandana_dudrucs_mysql\`).
3. Ek MySQL User banayein aur us user ko is database ke "ALL PRIVILEGES" assign karein.
4. "phpMyAdmin" open karein aur us database ko select karein.
5. "Import" tab par click karein aur is folder me maujood **\`database.sql\`** file ko select karke "Go" / "Import" dabayein.
   -> Sara schema (12 Tables) aur pre-seeded Doctors, Settings, Pharmacy Medicines aur FIFO Batches turant load ho jayenge!

## STEP 2: Database Connection Settings
- Agar aap PHP backend use kar rahe hain to \`public/mysql_api.php\` ya \`public/db_connect.php\` me apne host, user, password aur database name daal dein.
- Agar aap Node.js / VPS par run kar rahe hain:
  \`\`\`bash
  export MYSQL_HOST="localhost"
  export MYSQL_USER="your_db_user"
  export MYSQL_PASSWORD="your_db_password"
  export MYSQL_DATABASE="sandana_dudrucs_mysql"
  npm run build
  npm run start
  \`\`\`

## Included Database Files:
1. \`database.sql\` / \`public/database.sql\` -> Complete 1-click runnable MySQL dump
2. \`public/mysql_api.php\` -> High-performance REST API for all 12 tables
3. \`public/db_connect.php\` -> Simple PDO connector
4. \`sandana_clinic_mysql.sqlite\` -> Embedded SQLite database engine for zero-configuration local execution
`;
  fs.writeFileSync(path.resolve(process.cwd(), 'public/README_HOSTING_MYSQL.txt'), hostingGuide, 'utf-8');
  console.log('Exported public/README_HOSTING_MYSQL.txt');
}

main().catch(console.error);
