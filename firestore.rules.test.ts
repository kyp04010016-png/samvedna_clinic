/**
 * Firestore Security Rules Test Specification
 * Verifies that all "Dirty Dozen" payloads are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'delete' | 'get';
  authRole: 'unauthenticated' | 'patient' | 'reception' | 'doctor' | 'pharmacy' | 'admin';
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const dirtyDozenTests: SecurityTestCase[] = [
  {
    name: '1. Self-Privilege Escalation to Admin',
    collection: 'users',
    docId: 'attackerUid',
    operation: 'create',
    authRole: 'reception',
    payload: { name: 'Attacker', email: 'a@b.com', phone: '1234567890', role: 'admin', createdAt: '2026-10-25T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '2. Shadow Field Injection on Appointment',
    collection: 'appointments',
    docId: 'apt_shadow',
    operation: 'create',
    authRole: 'unauthenticated',
    payload: {
      patientName: 'John',
      phone: '9876543210',
      age: 30,
      doctorId: 'doc1',
      doctorName: 'Dr. Kumar',
      date: '2026-10-25',
      slot: '10:00',
      status: 'booked',
      bookedBy: 'patient',
      createdAt: '2026-10-25T00:00:00Z',
      shadowField: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '3. Pre-Approved Public Feedback',
    collection: 'feedback',
    docId: 'fb_spoof',
    operation: 'create',
    authRole: 'unauthenticated',
    payload: {
      patientName: 'Tester',
      rating: 5,
      comment: 'Great clinic',
      isApproved: true,
      createdAt: '2026-10-25T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '4. Out-of-Range Rating in Feedback',
    collection: 'feedback',
    docId: 'fb_rating',
    operation: 'create',
    authRole: 'unauthenticated',
    payload: {
      patientName: 'Tester',
      rating: 10,
      comment: 'Invalid rating',
      isApproved: false,
      createdAt: '2026-10-25T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '5. Negative Medicine Price',
    collection: 'medicines',
    docId: 'med_neg',
    operation: 'create',
    authRole: 'pharmacy',
    payload: {
      name: 'Paracetamol',
      brand: 'Cipla',
      price: -25,
      stock: 100,
      unit: 'strip',
      expiryDate: '2027-12-01',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '6. Oversized String in Feedback Comment',
    collection: 'feedback',
    docId: 'fb_large',
    operation: 'create',
    authRole: 'unauthenticated',
    payload: {
      patientName: 'Tester',
      rating: 4,
      comment: 'A'.repeat(2000),
      isApproved: false,
      createdAt: '2026-10-25T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '7. Unauthorized UPI Hijack in Settings',
    collection: 'settings',
    docId: 'clinic',
    operation: 'update',
    authRole: 'pharmacy',
    payload: {
      upiId: 'hacker@okaxis',
      upiName: 'Hacker',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '8. Doctor Deleting Invoices',
    collection: 'invoices',
    docId: 'inv_1',
    operation: 'delete',
    authRole: 'doctor',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '9. Reception Modifying Medicine Stock',
    collection: 'medicines',
    docId: 'med_1',
    operation: 'update',
    authRole: 'reception',
    payload: { stock: 9999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '10. Invalid Document ID Poisoning',
    collection: 'doctors',
    docId: 'invalid id with spaces!',
    operation: 'create',
    authRole: 'admin',
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '11. Direct Completed Appointment Creation by Public',
    collection: 'appointments',
    docId: 'apt_completed',
    operation: 'create',
    authRole: 'unauthenticated',
    payload: {
      patientName: 'John',
      phone: '9876543210',
      age: 30,
      doctorId: 'doc1',
      doctorName: 'Dr. Kumar',
      date: '2026-10-25',
      slot: '10:00',
      status: 'completed',
      bookedBy: 'patient',
      createdAt: '2026-10-25T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unauthenticated Invoice Creation',
    collection: 'invoices',
    docId: 'inv_unauth',
    operation: 'create',
    authRole: 'unauthenticated',
    payload: { invoiceNo: 'DUD-2026-001', total: 100 },
    expectedResult: 'PERMISSION_DENIED',
  },
];
