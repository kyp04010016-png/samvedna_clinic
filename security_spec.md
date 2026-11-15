# Security Specification — Sandana Clinic + Dudrucs Management System

## 1. Data Invariants
1. **Users (`/users/{uid}`)**: Only administrators (`role == 'admin'` or bootstrapped admin email) can create, update, or delete staff accounts. Authenticated users can read their own profile or staff directory as permitted by role.
2. **Doctors (`/doctors/{id}`)**: Publicly readable so patients can browse doctors and available slots on `/` and `/book`. Only administrators can create, update, or delete doctor profiles.
3. **Appointments (`/appointments/{id}`)**: Anyone can create a new appointment with `status == 'booked'` and valid schema fields (`patientName`, `phone`, `age`, `doctorId`, `doctorName`, `date`, `slot`, `bookedBy`, `createdAt`). Reading and updating appointments is restricted to authenticated staff (`admin`, `doctor`, `reception`), and slot availability queries are permitted.
4. **Medicines (`/medicines/{id}`)**: Readable by authenticated staff (`admin`, `pharmacy`, `doctor`, `reception`). Writeable only by `admin` and `pharmacy` with strict schema validation (`price >= 0`, `stock >= 0`).
5. **Invoices (`/invoices/{id}`)**: Readable and writeable only by `admin` and `pharmacy` roles with bounded line item arrays (`items.size() <= 100`) and non-negative totals.
6. **Feedback (`/feedback/{id}`)**: Publicly readable and creatable (when `isApproved == false` and `rating >= 1 && rating <= 5`). Only `admin` can update (`isApproved`) or delete feedback.
7. **Settings (`/settings/{doc}`)**: Publicly readable (`clinic` document) for footer contact details and pharmacy UPI QR generation. Only `admin` can write settings.
8. **Counters (`/counters/{doc}`)**: Readable and writeable only by `admin` and `pharmacy` for sequential invoice numbering (`lastNumber >= 0`).

## 2. The "Dirty Dozen" Payloads
1. **Self-Privilege Escalation**: Unauthenticated or non-admin user writes `{ "role": "admin" }` to `/users/attackerUid`.
2. **Shadow Field Injection on Appointment**: Client sends `{ ..., "isPriority": true, "hacked": "yes" }` to `/appointments/apt1`.
3. **Pre-Approved Public Feedback**: Unauthenticated user creates `/feedback/fb1` with `{ "isApproved": true, "rating": 5 }`.
4. **Out-of-Range Rating**: Client submits feedback with `{ "rating": 999 }`.
5. **Negative Medicine Price/Stock**: Malicious payload attempts `{ "name": "Med", "price": -500, "stock": -10 }`.
6. **Oversized String Denial-of-Wallet**: Client injects a 50,000-character string into `patientName` or `comment`.
7. **Unauthorized UPI Hijack**: Non-admin user attempts to overwrite `/settings/clinic` with `{ "upiId": "attacker@upi" }`.
8. **Doctor Deleting Invoices**: User with `role == 'doctor'` attempts to delete `/invoices/inv1`.
9. **Reception Modifying Medicine Stock**: User with `role == 'reception'` attempts to update `/medicines/med1`.
10. **Path ID Poisoning**: Request uses invalid document ID characters or >128 char ID.
11. **Direct Completed Appointment Creation by Public**: Public booking creates appointment with `status: "completed"`.
12. **Unbounded Array Injection on Doctor Slots**: Payload passes 500 elements in `availableSlots`.
