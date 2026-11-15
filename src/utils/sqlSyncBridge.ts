import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
   Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

export const SQL_SYNC_TABLES = [
  'settings',
  'counters',
  'users',
  'doctors',
  'appointments',
  'tokens',
  'prescriptions',
  'medicines',
  'batches',
  'invoices',
  'feedback',
  'staff_activity',
] as const;

export type SqlSyncTableName = (typeof SQL_SYNC_TABLES)[number];

export interface SqlEngineStatusResponse {
  success: boolean;
  engine: string;
  sqliteFile: string;
  mysqlConnected: boolean;
  mysqlHost: string | null;
  mysqlPort: number;
  mysqlDatabase: string;
  mysqlUser: string | null;
  mysqlLastError: string | null;
  totalRows: number;
  tableCounts: Record<SqlSyncTableName, number>;
  tables: SqlSyncTableName[];
  updatedAt: string;
}

export interface MySqlConnectionInput {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

let activeUnsubscribes: Unsubscribe[] = [];
let bridgeStarted = false;

export async function fetchSqlEngineStatus(): Promise<SqlEngineStatusResponse | null> {
  try {
    const res = await fetch('/api/sql/status');
    if (!res.ok) return null;
    return (await res.json()) as SqlEngineStatusResponse;
  } catch {
    return null;
  }
}

export async function saveRecordToSql(
  table: SqlSyncTableName,
  id: string,
  data: Record<string, any>
): Promise<boolean> {
  if (!id) return false;
  try {
    const res = await fetch('/api/sql/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncAllDataToSqlNow(
  replace = false
): Promise<SqlEngineStatusResponse | null> {
  const collectionsPayload: Partial<
    Record<SqlSyncTableName, Array<{ id: string; data: Record<string, any> }>>
  > = {};

  await Promise.all(
    SQL_SYNC_TABLES.map(async (tableName) => {
      try {
        const snap = await getDocs(collection(db, tableName));
        collectionsPayload[tableName] = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, any>,
        }));
      } catch {
        collectionsPayload[tableName] = [];
      }
    })
  );

  const res = await fetch('/api/sql/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: collectionsPayload, replace }),
  });

  if (!res.ok) {
    throw new Error('Failed to synchronize data with SQL database');
  }
  const json = await res.json();
  return (json.status as SqlEngineStatusResponse) || null;
}

export async function hydrateAppFromSqlDatabase(): Promise<{
  restoredCount: number;
}> {
  const res = await fetch('/api/sql/collections');
  if (!res.ok) {
    throw new Error('Failed to fetch collections from SQL database');
  }
  const json = await res.json();
  const collections = json?.collections || {};
  let restoredCount = 0;

  for (const table of SQL_SYNC_TABLES) {
    const rows = collections[table];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || !row.id || !row.data) continue;
      await setDoc(doc(db, table, String(row.id)), row.data, { merge: true });
      restoredCount += 1;
    }
  }

  return { restoredCount };
}

export async function connectLiveMySqlServer(
  config: MySqlConnectionInput
): Promise<{
  success: boolean;
  message: string;
  status?: SqlEngineStatusResponse;
}> {
  const res = await fetch('/api/sql/connect-mysql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return await res.json();
}

export async function runLiveSqlQuery(sql: string): Promise<{
  success: boolean;
  columns: string[];
  rows: Array<Record<string, any>>;
  rowCount: number;
  error?: string;
}> {
  const res = await fetch('/api/sql/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  return await res.json();
}

export async function fetchSqlTablePreview(
  table: SqlSyncTableName,
  limit = 100
): Promise<{
  success: boolean;
  table: string;
  count: number;
  rows: Array<Record<string, any>>;
}> {
  const res = await fetch(
    `/api/sql/table/${encodeURIComponent(table)}?limit=${limit}`
  );
  if (!res.ok) {
    return { success: false, table, count: 0, rows: [] };
  }
  return await res.json();
}

export function downloadCompleteMySqlDumpFile(
  databaseName = 'sandana_dudrucs_mysql'
): void {
  const a = document.createElement('a');
  a.href = `/api/sql/dump.sql?database=${encodeURIComponent(databaseName)}`;
  a.download = `Sandana_Dudrucs_MySQL_Database_${new Date()
    .toISOString()
    .slice(0, 10)}.sql`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadPhpMysqlConnector(
  config?: Partial<MySqlConnectionInput>
): void {
  const params = new URLSearchParams({
    host: config?.host || 'localhost',
    port: String(config?.port || 3306),
    database: config?.database || 'sandana_dudrucs_mysql',
    user: config?.user || 'root',
  });
  const a = document.createElement('a');
  a.href = `/api/sql/mysql_api.php?${params.toString()}`;
  a.download = 'mysql_api.php';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function startRealtimeSqlSyncBridge(): void {
  if (bridgeStarted) return;
  bridgeStarted = true;

  // Initial two-way synchronization check
  syncAllDataToSqlNow(false).catch(() => {});

  // Attach real-time listeners so every create/update/delete across all 12 modules
  // is immediately saved into the SQL relational database
  activeUnsubscribes = SQL_SYNC_TABLES.map((tableName) =>
    onSnapshot(
      collection(db, tableName),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          if (change.type === 'added' || change.type === 'modified') {
            fetch('/api/sql/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                table: tableName,
                id: docId,
                data: change.doc.data(),
              }),
            }).catch(() => {});
          } else if (change.type === 'removed') {
            fetch(
              `/api/sql/record/${encodeURIComponent(tableName)}/${encodeURIComponent(docId)}`,
              { method: 'DELETE' }
            ).catch(() => {});
          }
        });
      },
      () => {
        // Ignore permission warnings on public unauthenticated views for restricted collections
      }
    )
  );
}

export function stopRealtimeSqlSyncBridge(): void {
  activeUnsubscribes.forEach((u) => u());
  activeUnsubscribes = [];
  bridgeStarted = false;
}
