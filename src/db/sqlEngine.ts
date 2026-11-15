import Database from 'better-sqlite3';
import mysql, { Pool } from 'mysql2/promise';
import path from 'path';
import fs from 'fs';

export const SQL_TABLES = [
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

export type SqlTableName = (typeof SQL_TABLES)[number];

export interface MySqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'sandana_clinic_mysql.sqlite');
const MYSQL_CONFIG_PATH = path.resolve(process.cwd(), 'mysql-connection.json');

let sqliteDb: Database.Database | null = null;
let mysqlPool: Pool | null = null;
let activeMysqlConfig: MySqlConnectionConfig | null = null;
let mysqlConnected = false;
let mysqlLastError: string | null = null;

export function getSqliteDb(): Database.Database {
  if (!sqliteDb) {
    sqliteDb = new Database(DB_FILE_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('synchronous = NORMAL');
    initSqliteSchema(sqliteDb);
  }
  return sqliteDb;
}

function initSqliteSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      clinic_name TEXT,
      medical_name TEXT,
      phone TEXT,
      gst_no TEXT,
      google_map_url TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      last_number INTEGER DEFAULT 0,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      role TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT,
      specialization TEXT,
      qualification TEXT,
      consultation_fee REAL DEFAULT 300,
      is_active INTEGER DEFAULT 1,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_name TEXT,
      patient_phone TEXT,
      doctor_id TEXT,
      doctor_name TEXT,
      appointment_date TEXT,
      slot TEXT,
      token_number INTEGER DEFAULT 0,
      status TEXT,
      created_at TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      token_number INTEGER DEFAULT 0,
      patient_name TEXT,
      doctor_id TEXT,
      date TEXT,
      status TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      appointment_id TEXT,
      patient_name TEXT,
      doctor_id TEXT,
      diagnosis TEXT,
      created_at TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT,
      brand TEXT,
      generic_name TEXT,
      manufacturer TEXT,
      hsn_code TEXT,
      unit TEXT,
      gst_percent REAL DEFAULT 12,
      schedule_type TEXT,
      reorder_level INTEGER DEFAULT 10,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      medicine_id TEXT,
      medicine_name TEXT,
      batch_no TEXT,
      expiry_date TEXT,
      cost_price REAL DEFAULT 0,
      mrp REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      supplier_name TEXT,
      supplier_bill_no TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_no TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      payment_mode TEXT,
      grand_total REAL DEFAULT 0,
      total_profit REAL DEFAULT 0,
      created_by_name TEXT,
      created_at TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      patient_name TEXT,
      rating INTEGER DEFAULT 5,
      comment TEXT,
      approved INTEGER DEFAULT 0,
      created_at TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_activity (
      id TEXT PRIMARY KEY,
      staff_name TEXT,
      role TEXT,
      action TEXT,
      details TEXT,
      timestamp TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getMySqlSchemaDdl(databaseName = 'sandana_clinic_db'): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS settings (
      id VARCHAR(128) PRIMARY KEY,
      clinic_name VARCHAR(255),
      medical_name VARCHAR(255),
      phone VARCHAR(64),
      gst_no VARCHAR(64),
      google_map_url TEXT,
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS counters (
      id VARCHAR(128) PRIMARY KEY,
      last_number INT DEFAULT 0,
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(64),
      role VARCHAR(64),
      is_active TINYINT(1) DEFAULT 1,
      created_at VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS doctors (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255),
      specialization VARCHAR(255),
      qualification VARCHAR(255),
      consultation_fee DECIMAL(10,2) DEFAULT 300.00,
      is_active TINYINT(1) DEFAULT 1,
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id VARCHAR(128) PRIMARY KEY,
      patient_name VARCHAR(255),
      patient_phone VARCHAR(64),
      doctor_id VARCHAR(128),
      doctor_name VARCHAR(255),
      appointment_date VARCHAR(64),
      slot VARCHAR(64),
      token_number INT DEFAULT 0,
      status VARCHAR(64),
      created_at VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS tokens (
      id VARCHAR(128) PRIMARY KEY,
      token_number INT DEFAULT 0,
      patient_name VARCHAR(255),
      doctor_id VARCHAR(128),
      date VARCHAR(64),
      status VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id VARCHAR(128) PRIMARY KEY,
      appointment_id VARCHAR(128),
      patient_name VARCHAR(255),
      doctor_id VARCHAR(128),
      diagnosis TEXT,
      created_at VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS medicines (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255),
      brand VARCHAR(255),
      generic_name VARCHAR(255),
      manufacturer VARCHAR(255),
      hsn_code VARCHAR(64),
      unit VARCHAR(64),
      gst_percent DECIMAL(5,2) DEFAULT 12.00,
      schedule_type VARCHAR(32),
      reorder_level INT DEFAULT 10,
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS batches (
      id VARCHAR(128) PRIMARY KEY,
      medicine_id VARCHAR(128),
      medicine_name VARCHAR(255),
      batch_no VARCHAR(128),
      expiry_date VARCHAR(64),
      cost_price DECIMAL(10,2) DEFAULT 0.00,
      mrp DECIMAL(10,2) DEFAULT 0.00,
      sell_price DECIMAL(10,2) DEFAULT 0.00,
      stock INT DEFAULT 0,
      supplier_name VARCHAR(255),
      supplier_bill_no VARCHAR(128),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(128) PRIMARY KEY,
      invoice_no VARCHAR(128),
      customer_name VARCHAR(255),
      customer_phone VARCHAR(64),
      payment_mode VARCHAR(64),
      grand_total DECIMAL(12,2) DEFAULT 0.00,
      total_profit DECIMAL(12,2) DEFAULT 0.00,
      created_by_name VARCHAR(255),
      created_at VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR(128) PRIMARY KEY,
      patient_name VARCHAR(255),
      rating INT DEFAULT 5,
      comment TEXT,
      approved TINYINT(1) DEFAULT 0,
      created_at VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS staff_activity (
      id VARCHAR(128) PRIMARY KEY,
      staff_name VARCHAR(255),
      role VARCHAR(64),
      action VARCHAR(128),
      details TEXT,
      timestamp VARCHAR(64),
      data_json LONGTEXT NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
}

function mapDocToColumns(
  table: SqlTableName,
  id: string,
  data: Record<string, any>
): { columns: string[]; values: any[] } {
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(data || {});

  switch (table) {
    case 'settings':
      return {
        columns: [
          'id',
          'clinic_name',
          'medical_name',
          'phone',
          'gst_no',
          'google_map_url',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.clinicName || data.name || ''),
          String(data.medicalName || ''),
          String(data.clinicPhone || data.phone || ''),
          String(data.gstNo || ''),
          String(data.googleMapUrl || ''),
          dataJson,
          now,
        ],
      };
    case 'counters':
      return {
        columns: ['id', 'last_number', 'data_json', 'updated_at'],
        values: [id, Number(data.lastNumber ?? data.count ?? 0), dataJson, now],
      };
    case 'users':
      return {
        columns: [
          'id',
          'name',
          'email',
          'phone',
          'role',
          'is_active',
          'created_at',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.name || ''),
          String(data.email || ''),
          String(data.phone || ''),
          String(data.role || 'pharmacy'),
          data.isActive === false ? 0 : 1,
          String(data.createdAt || now),
          dataJson,
          now,
        ],
      };
    case 'doctors':
      return {
        columns: [
          'id',
          'name',
          'specialization',
          'qualification',
          'consultation_fee',
          'is_active',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.name || ''),
          String(data.specialization || ''),
          String(data.qualification || ''),
          Number(data.consultationFee ?? 300),
          data.isActive === false ? 0 : 1,
          dataJson,
          now,
        ],
      };
    case 'appointments':
      return {
        columns: [
          'id',
          'patient_name',
          'patient_phone',
          'doctor_id',
          'doctor_name',
          'appointment_date',
          'slot',
          'token_number',
          'status',
          'created_at',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.patientName || ''),
          String(data.patientPhone || data.phone || ''),
          String(data.doctorId || ''),
          String(data.doctorName || ''),
          String(data.date || data.appointmentDate || ''),
          String(data.slot || data.timeSlot || ''),
          Number(data.tokenNumber ?? 0),
          String(data.status || 'pending'),
          String(data.createdAt || now),
          dataJson,
          now,
        ],
      };
    case 'tokens':
      return {
        columns: [
          'id',
          'token_number',
          'patient_name',
          'doctor_id',
          'date',
          'status',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          Number(data.tokenNumber ?? 0),
          String(data.patientName || ''),
          String(data.doctorId || ''),
          String(data.date || ''),
          String(data.status || 'waiting'),
          dataJson,
          now,
        ],
      };
    case 'prescriptions':
      return {
        columns: [
          'id',
          'appointment_id',
          'patient_name',
          'doctor_id',
          'diagnosis',
          'created_at',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.appointmentId || ''),
          String(data.patientName || ''),
          String(data.doctorId || ''),
          String(data.diagnosis || data.notes || ''),
          String(data.createdAt || now),
          dataJson,
          now,
        ],
      };
    case 'medicines':
      return {
        columns: [
          'id',
          'name',
          'brand',
          'generic_name',
          'manufacturer',
          'hsn_code',
          'unit',
          'gst_percent',
          'schedule_type',
          'reorder_level',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.name || ''),
          String(data.brand || ''),
          String(data.genericName || ''),
          String(data.manufacturer || ''),
          String(data.hsnCode || '30049099'),
          String(data.unit || 'strip'),
          Number(data.gstPercent ?? 12),
          String(data.scheduleType || 'OTC'),
          Number(data.reorderLevel ?? 10),
          dataJson,
          now,
        ],
      };
    case 'batches':
      return {
        columns: [
          'id',
          'medicine_id',
          'medicine_name',
          'batch_no',
          'expiry_date',
          'cost_price',
          'mrp',
          'sell_price',
          'stock',
          'supplier_name',
          'supplier_bill_no',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.medicineId || ''),
          String(data.medicineName || ''),
          String(data.batchNo || ''),
          String(data.expiryDate || ''),
          Number(data.costPrice ?? 0),
          Number(data.mrp ?? 0),
          Number(data.sellPrice ?? 0),
          Number(data.stock ?? 0),
          String(data.supplierName || ''),
          String(data.supplierBillNo || ''),
          dataJson,
          now,
        ],
      };
    case 'invoices':
      return {
        columns: [
          'id',
          'invoice_no',
          'customer_name',
          'customer_phone',
          'payment_mode',
          'grand_total',
          'total_profit',
          'created_by_name',
          'created_at',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.invoiceNo || id),
          String(data.customerName || data.patientName || 'Walk-in Patient'),
          String(data.customerPhone || data.patientPhone || ''),
          String(data.paymentMode || 'cash'),
          Number(data.grandTotal ?? data.totalAmount ?? 0),
          Number(data.totalProfit ?? 0),
          String(data.createdByName || 'Pharmacist'),
          String(data.createdAt || now),
          dataJson,
          now,
        ],
      };
    case 'feedback':
      return {
        columns: [
          'id',
          'patient_name',
          'rating',
          'comment',
          'approved',
          'created_at',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.patientName || data.name || 'Patient'),
          Number(data.rating ?? 5),
          String(data.comment || data.message || ''),
          data.approved ? 1 : 0,
          String(data.createdAt || now),
          dataJson,
          now,
        ],
      };
    case 'staff_activity':
      return {
        columns: [
          'id',
          'staff_name',
          'role',
          'action',
          'details',
          'timestamp',
          'data_json',
          'updated_at',
        ],
        values: [
          id,
          String(data.staffName || data.userName || 'Staff'),
          String(data.role || 'staff'),
          String(data.action || ''),
          String(data.details || ''),
          String(data.timestamp || data.createdAt || now),
          dataJson,
          now,
        ],
      };
  }
}

export async function connectRemoteMySql(
  config: MySqlConnectionConfig,
  persistConfig = true
): Promise<{ connected: boolean; message: string }> {
  try {
    if (mysqlPool) {
      await mysqlPool.end().catch(() => {});
      mysqlPool = null;
    }

    const pool = mysql.createPool({
      host: config.host,
      port: Number(config.port || 3306),
      user: config.user,
      password: config.password || '',
      database: config.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 8000,
      ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    const conn = await pool.getConnection();
    try {
      const ddls = getMySqlSchemaDdl(config.database);
      for (const ddl of ddls) {
        await conn.query(ddl);
      }
    } finally {
      conn.release();
    }

    mysqlPool = pool;
    activeMysqlConfig = config;
    mysqlConnected = true;
    mysqlLastError = null;

    if (persistConfig) {
      try {
        fs.writeFileSync(
          MYSQL_CONFIG_PATH,
          JSON.stringify(config, null, 2),
          'utf-8'
        );
      } catch {
        // ignore fs error
      }
    }

    // Mirror existing SQLite records into the newly connected MySQL database
    await syncSqliteToRemoteMySql();

    return {
      connected: true,
      message: `Connected to MySQL server ${config.host}:${config.port || 3306}/${config.database} and initialized all 12 relational tables.`,
    };
  } catch (err: any) {
    mysqlConnected = false;
    mysqlLastError = err?.message || 'Failed to connect to remote MySQL server';
    return {
      connected: false,
      message: mysqlLastError || 'Connection failed',
    };
  }
}

export async function initSqlEngineFromEnv(): Promise<void> {
  // Always initialize local persistent SQLite relational database first
  getSqliteDb();

  // Check if env vars or saved mysql-connection.json exist
  const envHost = process.env.MYSQL_HOST;
  const envUser = process.env.MYSQL_USER;
  const envDatabase = process.env.MYSQL_DATABASE || process.env.MYSQL_DB;
  const envPassword = process.env.MYSQL_PASSWORD || '';
  const envPort = Number(process.env.MYSQL_PORT || 3306);

  if (envHost && envUser && envDatabase) {
    await connectRemoteMySql(
      {
        host: envHost,
        port: envPort,
        user: envUser,
        password: envPassword,
        database: envDatabase,
      },
      false
    );
    return;
  }

  if (fs.existsSync(MYSQL_CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(MYSQL_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as MySqlConnectionConfig;
      if (parsed && parsed.host && parsed.user && parsed.database) {
        await connectRemoteMySql(parsed, false);
      }
    } catch {
      // ignore invalid saved config
    }
  }
}

async function syncSqliteToRemoteMySql(): Promise<void> {
  if (!mysqlPool || !mysqlConnected) return;
  const db = getSqliteDb();

  for (const table of SQL_TABLES) {
    const rows = db
      .prepare(`SELECT id, data_json FROM ${table}`)
      .all() as Array<{ id: string; data_json: string }>;

    for (const r of rows) {
      try {
        const data = JSON.parse(r.data_json);
        await upsertMySqlRow(table, r.id, data);
      } catch {
        // ignore single row error
      }
    }
  }
}

async function upsertMySqlRow(
  table: SqlTableName,
  id: string,
  data: Record<string, any>
): Promise<void> {
  if (!mysqlPool || !mysqlConnected) return;
  const { columns, values } = mapDocToColumns(table, id, data);
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = VALUES(${c})`)
    .join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
  await mysqlPool.query(sql, values);
}

export async function upsertSqlRecord(
  table: SqlTableName,
  id: string,
  data: Record<string, any>
): Promise<void> {
  if (!SQL_TABLES.includes(table)) return;
  const safeId = String(id).trim();
  if (!safeId) return;

  const db = getSqliteDb();
  const { columns, values } = mapDocToColumns(table, safeId, data);
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  const stmt = db.prepare(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
  );
  stmt.run(...values);

  if (mysqlPool && mysqlConnected) {
    try {
      await upsertMySqlRow(table, safeId, data);
    } catch (err: any) {
      mysqlLastError = err?.message || 'MySQL write error';
    }
  }
}

export async function deleteSqlRecord(
  table: SqlTableName,
  id: string
): Promise<void> {
  if (!SQL_TABLES.includes(table)) return;
  const db = getSqliteDb();
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(String(id));

  if (mysqlPool && mysqlConnected) {
    try {
      await mysqlPool.query(`DELETE FROM ${table} WHERE id = ?`, [String(id)]);
    } catch (err: any) {
      mysqlLastError = err?.message || 'MySQL delete error';
    }
  }
}

export async function bulkSyncToSql(
  collections: Partial<
    Record<SqlTableName, Array<{ id: string; data: Record<string, any> }>>
  >,
  replaceTables = false
): Promise<{ totalSynced: number; tableCounts: Record<SqlTableName, number> }> {
  const db = getSqliteDb();
  let totalSynced = 0;

  const tx = db.transaction(() => {
    for (const table of SQL_TABLES) {
      const incoming = collections[table];
      if (!Array.isArray(incoming)) continue;

      if (replaceTables && table !== 'settings' && table !== 'counters') {
        db.prepare(`DELETE FROM ${table}`).run();
      }

      for (const row of incoming) {
        if (!row || !row.id || !row.data) continue;
        const { columns, values } = mapDocToColumns(
          table,
          String(row.id),
          row.data
        );
        const placeholders = columns.map(() => '?').join(', ');
        const updates = columns
          .filter((c) => c !== 'id')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ');
        db.prepare(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
        ).run(...values);
        totalSynced += 1;
      }
    }
  });

  tx();

  if (mysqlPool && mysqlConnected) {
    await syncSqliteToRemoteMySql().catch(() => {});
  }

  return {
    totalSynced,
    tableCounts: getSqlTableCounts(),
  };
}

export function getSqlTableCounts(): Record<SqlTableName, number> {
  const db = getSqliteDb();
  const counts = {} as Record<SqlTableName, number>;
  for (const table of SQL_TABLES) {
    const row = db
      .prepare(`SELECT COUNT(*) as cnt FROM ${table}`)
      .get() as { cnt: number };
    counts[table] = Number(row?.cnt || 0);
  }
  return counts;
}

export function getAllSqlCollections(): Record<
  SqlTableName,
  Array<{ id: string; data: Record<string, any> }>
> {
  const db = getSqliteDb();
  const result = {} as Record<
    SqlTableName,
    Array<{ id: string; data: Record<string, any> }>
  >;

  for (const table of SQL_TABLES) {
    const rows = db
      .prepare(`SELECT id, data_json FROM ${table} ORDER BY updated_at DESC`)
      .all() as Array<{ id: string; data_json: string }>;

    result[table] = rows.map((r) => {
      let parsed: Record<string, any> = {};
      try {
        parsed = JSON.parse(r.data_json);
      } catch {
        parsed = {};
      }
      return { id: r.id, data: parsed };
    });
  }

  return result;
}

export function getSqlTableRows(
  table: SqlTableName,
  limit = 200
): Array<Record<string, any>> {
  if (!SQL_TABLES.includes(table)) return [];
  const db = getSqliteDb();
  return db
    .prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as Array<Record<string, any>>;
}

export function executeReadOnlySqlQuery(sqlQuery: string): {
  columns: string[];
  rows: Array<Record<string, any>>;
  rowCount: number;
} {
  const trimmed = String(sqlQuery || '').trim();
  if (!/^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmed)) {
    throw new Error(
      'Only SELECT queries are permitted in the SQL Query Explorer for safety.'
    );
  }
  const db = getSqliteDb();
  const stmt = db.prepare(trimmed);
  const rows = stmt.all() as Array<Record<string, any>>;
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    columns,
    rows,
    rowCount: rows.length,
  };
}

function escapeMySqlLiteral(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? '1' : '0';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `'${str}'`;
}

export function generateMySqlDump(
  databaseName = activeMysqlConfig?.database || 'sandana_dudrucs_mysql'
): string {
  const db = getSqliteDb();
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push(`-- ============================================================================`);
  lines.push(`-- SANDANA CLINIC & DUDRUCS MEDICAL STORE — COMPLETE MYSQL DATABASE DUMP (.SQL)`);
  lines.push(`-- Generated At: ${now}`);
  lines.push(`-- Compatible with: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.4+ / phpMyAdmin / cPanel`);
  lines.push(`-- ============================================================================`);
  lines.push(``);
  lines.push(`SET NAMES utf8mb4;`);
  lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
  lines.push(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  lines.push(`USE \`${databaseName}\`;`);
  lines.push(``);

  const ddls = getMySqlSchemaDdl(databaseName);
  for (let i = 0; i < SQL_TABLES.length; i++) {
    const table = SQL_TABLES[i];
    const ddl = ddls[i];
    lines.push(`-- ----------------------------------------------------------------------------`);
    lines.push(`-- Table structure for table \`${table}\``);
    lines.push(`-- ----------------------------------------------------------------------------`);
    lines.push(`${ddl};`);
    lines.push(``);

    const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<
      Record<string, any>
    >;
    if (rows.length > 0) {
      lines.push(`-- Dumping data for table \`${table}\` (${rows.length} rows)`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const colNames = cols.map((c) => `\`${c}\``).join(', ');
        const colVals = cols.map((c) => escapeMySqlLiteral(row[c])).join(', ');
        const updates = cols
          .filter((c) => c !== 'id')
          .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
          .join(', ');
        lines.push(
          `INSERT INTO \`${table}\` (${colNames}) VALUES (${colVals}) ON DUPLICATE KEY UPDATE ${updates};`
        );
      }
      lines.push(``);
    }
  }

  lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
  lines.push(`-- End of Sandana Clinic & Dudrucs MySQL Dump`);
  return lines.join('\n');
}

export function getSqlEngineStatus() {
  const counts = getSqlTableCounts();
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    engine: mysqlConnected
      ? 'MySQL Remote Server + Local SQL Engine (Dual Active)'
      : 'Embedded SQL Relational Engine (MySQL-Compatible Schema)',
    sqliteFile: 'sandana_clinic_mysql.sqlite',
    mysqlConnected,
    mysqlHost: activeMysqlConfig?.host || null,
    mysqlPort: activeMysqlConfig?.port || 3306,
    mysqlDatabase: activeMysqlConfig?.database || 'sandana_dudrucs_mysql',
    mysqlUser: activeMysqlConfig?.user || null,
    mysqlLastError,
    totalRows,
    tableCounts: counts,
    tables: SQL_TABLES,
    updatedAt: new Date().toISOString(),
  };
}

export function generatePhpMysqlConnectorFile(
  config?: Partial<MySqlConnectionConfig>
): string {
  const dbHost = config?.host || 'localhost';
  const dbPort = config?.port || 3306;
  const dbName = config?.database || 'sandana_dudrucs_mysql';
  const dbUser = config?.user || 'root';
  const dbPass = config?.password || '';

  return `<?php
/**
 * ============================================================================
 * SANDANA CLINIC & DUDRUCS MEDICAL STORE — STANDALONE PHP + MYSQL CONNECTOR
 * File: mysql_api.php
 * Upload this file to your cPanel / Hostinger / GoDaddy public_html folder
 * alongside your website files and import sandana_dudrucs_mysql.sql in phpMyAdmin.
 * ============================================================================
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DB_HOST = getenv('MYSQL_HOST') ?: '${dbHost}';
$DB_PORT = getenv('MYSQL_PORT') ?: '${dbPort}';
$DB_NAME = getenv('MYSQL_DATABASE') ?: '${dbName}';
$DB_USER = getenv('MYSQL_USER') ?: '${dbUser}';
$DB_PASS = getenv('MYSQL_PASSWORD') ?: '${dbPass}';

try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "MySQL Connection Failed: " . $e->getMessage()
    ]);
    exit;
}

$allowedTables = [
    'settings', 'counters', 'users', 'doctors', 'appointments',
    'tokens', 'prescriptions', 'medicines', 'batches', 'invoices',
    'feedback', 'staff_activity'
];

$action = $_GET['action'] ?? 'status';

if ($action === 'status') {
    $counts = [];
    foreach ($allowedTables as $t) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM \`{$t}\`");
            $row = $stmt->fetch();
            $counts[$t] = (int)($row['cnt'] ?? 0);
        } catch (Exception $ex) {
            $counts[$t] = 0;
        }
    }
    echo json_encode([
        "success" => true,
        "engine" => "PHP PDO MySQL Relational Database",
        "database" => $DB_NAME,
        "tableCounts" => $counts
    ]);
    exit;
}

if ($action === 'get_all') {
    $collections = [];
    foreach ($allowedTables as $t) {
        try {
            $stmt = $pdo->query("SELECT id, data_json FROM \`{$t}\` ORDER BY updated_at DESC");
            $rows = [];
            while ($r = $stmt->fetch()) {
                $rows[] = [
                    "id" => $r['id'],
                    "data" => json_decode($r['data_json'], true) ?: []
                ];
            }
            $collections[$t] = $rows;
        } catch (Exception $ex) {
            $collections[$t] = [];
        }
    }
    echo json_encode(["success" => true, "collections" => $collections]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'upsert') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $table = $body['table'] ?? '';
    $id = $body['id'] ?? '';
    $data = $body['data'] ?? [];

    if (!in_array($table, $allowedTables, true) || empty($id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Invalid table or ID"]);
        exit;
    }

    $now = gmdate('Y-m-d\\TH:i:s\\Z');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare("INSERT INTO \`{$table}\` (id, data_json, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = VALUES(updated_at)");
    $stmt->execute([$id, $json, $now]);

    echo json_encode(["success" => true, "table" => $table, "id" => $id]);
    exit;
}

echo json_encode(["success" => true, "message" => "Sandana Clinic & Dudrucs MySQL API Active"]);
?>`;
}
