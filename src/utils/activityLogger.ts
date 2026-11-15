import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { saveRecordToSql } from './sqlSyncBridge';

export async function logStaffActivity(
  arg1: string,
  arg2: string,
  arg3?: string,
  arg4?: string
): Promise<void> {
  const user = auth.currentUser;
  let sessionStaffId = user?.uid || 'operator_portal';
  let sessionStaffName =
    user?.displayName || user?.email || 'Clinic/Pharmacy Operator';

  try {
    const rawSession =
      localStorage.getItem('sandana_persistent_staff_session_v2') ||
      sessionStorage.getItem('sandana_otp_staff_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.uid) sessionStaffId = String(parsed.uid);
      if (parsed?.name) sessionStaffName = String(parsed.name);
    }
  } catch {
    // ignore storage parse errors
  }

  let staffId = sessionStaffId;
  let staffName = sessionStaffName;
  let action = arg1;
  let details = arg2;

  if (typeof arg4 === 'string') {
    // Called as (staffId, staffName, action, details)
    staffId = arg1 || sessionStaffId;
    staffName = arg2 || sessionStaffName;
    action = arg3 || 'SYSTEM_ACTION';
    details = arg4 || 'Action executed';
  } else if (typeof arg3 === 'string' && arg3.trim().length > 0) {
    // Called as (action, details, staffNameOverride)
    action = arg1;
    details = arg2;
    staffName = arg3;
  }

  const payload = {
    staffId: String(staffId || 'operator').slice(0, 128),
    staffName: String(staffName || 'Operator').slice(0, 120),
    action: String(action || 'ACTION').slice(0, 100),
    details: String(details || 'Executed').slice(0, 500),
    timestamp: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, 'staff_activity'), payload);
    await saveRecordToSql('staff_activity', docRef.id, payload);
  } catch {
    const fallbackId = `act_${Date.now()}`;
    await saveRecordToSql('staff_activity', fallbackId, payload);
  }
}
