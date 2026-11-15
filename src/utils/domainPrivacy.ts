import { collection, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteSqlRecord } from '../db/sqlEngine';

export const PROTECTED_ADMIN_EMAIL = 'kyp04010016@gmail.com';

const KNOWN_DUMMY_IDS = new Set([
  'reception_1',
  'pharmacist_1',
  'portal_admin',
  'portal_doctor',
  'portal_pharmacy',
  'portal_reception',
  '9840011223',
  '9840022334',
  '9840033445',
  '9840099999',
  '9999999999',
]);

const KNOWN_DUMMY_EMAILS = new Set([
  'pharmacy@sandanaclinic.com',
  'reception@sandanaclinic.com',
  'doctor@sandanaclinic.com',
  '9840011223@sandanaclinic.com',
  '9840022334@sandanaclinic.com',
  '9840033445@sandanaclinic.com',
  '9840099999@sandanaclinic.com',
  'puja@gmail.com',
]);

/**
 * Returns true if running on a live custom domain, production hosting,
 * or cloud run environment (protecting all user privacy).
 */
export function isDomainOrHostingEnvironment(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname.toLowerCase();
  // Any real domain or production container
  return (
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    !host.endsWith('.local')
  );
}

export interface CleanupDummyResult {
  success: boolean;
  deletedFirestoreCount: number;
  deletedSqlCount: number;
  details: string[];
}

/**
 * Cleans out all hardcoded and test dummy accounts from Firestore and SQL database.
 * Protects real registered staff and the master admin kyp04010016@gmail.com.
 */
export async function purgeAllDummyAccounts(): Promise<CleanupDummyResult> {
  const details: string[] = [];
  let deletedFirestoreCount = 0;
  let deletedSqlCount = 0;

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      const data = d.data() as any;
      const docId = d.id;
      const email = String(data?.email || '').trim().toLowerCase();

      // Never touch master admin
      if (email === PROTECTED_ADMIN_EMAIL) {
        continue;
      }

      const isDummyId = KNOWN_DUMMY_IDS.has(docId) || docId.startsWith('portal_');
      const isDummyEmail = KNOWN_DUMMY_EMAILS.has(email);
      const isDummyName = String(data?.name || '').toLowerCase().includes('operator (');

      if (isDummyId || isDummyEmail || isDummyName) {
        // Delete from Firestore
        await deleteDoc(doc(db, 'users', docId)).catch(() => {});
        deletedFirestoreCount++;
        details.push(`Deleted dummy account: ${data?.name || docId} (${email})`);

        // Also call backend to delete from SQL database
        try {
          await fetch(`/api/admin/clean-dummy-user/${encodeURIComponent(docId)}`, {
            method: 'DELETE',
          });
          deletedSqlCount++;
        } catch {
          // ignore transient offline error
        }
      }
    }

    // Call server-wide SQL dummy cleanup endpoint
    try {
      const sRes = await fetch('/api/admin/clean-dummy-users', {
        method: 'POST',
      });
      if (sRes.ok) {
        const sData = await sRes.json().catch(() => null);
        if (sData?.deletedCount) {
          deletedSqlCount += sData.deletedCount;
        }
      }
    } catch {
      // ignore
    }

    return {
      success: true,
      deletedFirestoreCount,
      deletedSqlCount,
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      deletedFirestoreCount,
      deletedSqlCount,
      details: [err?.message || 'Error purging dummy accounts'],
    };
  }
}
