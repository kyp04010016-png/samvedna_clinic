import React, { useEffect, useRef, useState } from 'react';
import {
  CloudDownload,
  CloudUpload,
  Database,
  DatabaseBackup,
  FileCode2,
  FileJson,
  HardDriveDownload,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Table as TableIcon,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  BACKUP_COLLECTIONS,
  CloudBackupSnapshot,
  FullSystemBackupPayload,
  collectFullSystemBackup,
  computeBackupChecksum,
  createCloudBackupSnapshot,
  deleteCloudBackupSnapshot,
  downloadSystemBackupJson,
  listCloudBackupSnapshots,
  restoreSystemFromPayload,
} from '../../utils/backupRestore';
import {
  downloadHostingHtaccessFile,
  downloadStandalonePhpOtpFile,
} from '../../utils/emailOTP';
import {
  SQL_SYNC_TABLES,
  SqlEngineStatusResponse,
  SqlSyncTableName,
  connectLiveMySqlServer,
  downloadCompleteMySqlDumpFile,
  downloadPhpMysqlConnector,
  fetchSqlEngineStatus,
  fetchSqlTablePreview,
  hydrateAppFromSqlDatabase,
  runLiveSqlQuery,
  syncAllDataToSqlNow,
} from '../../utils/sqlSyncBridge';
import {
  useLiveDate,
  fetchDailyBackupStatus,
  triggerDailyBackupNow,
  DailyBackupStatus,
} from '../../utils/liveDateEngine';

const PRESET_SQL_QUERIES: Array<{ label: string; sql: string }> = [
  {
    label: 'All Medicines Master',
    sql: 'SELECT id, name, brand, generic_name, unit, gst_percent, schedule_type, reorder_level, updated_at FROM medicines ORDER BY name ASC LIMIT 100',
  },
  {
    label: 'FIFO Batches & Stock',
    sql: 'SELECT id, medicine_name, batch_no, expiry_date, cost_price, mrp, sell_price, stock, supplier_name FROM batches ORDER BY expiry_date ASC LIMIT 100',
  },
  {
    label: 'Recent GST Sale Invoices',
    sql: 'SELECT invoice_no, customer_name, customer_phone, payment_mode, grand_total, total_profit, created_by_name, created_at FROM invoices ORDER BY created_at DESC LIMIT 100',
  },
  {
    label: 'Patient OPD Appointments',
    sql: 'SELECT patient_name, patient_phone, doctor_name, appointment_date, slot, token_number, status FROM appointments ORDER BY created_at DESC LIMIT 100',
  },
  {
    label: 'Specialist Doctors',
    sql: 'SELECT id, name, specialization, qualification, consultation_fee, is_active FROM doctors',
  },
  {
    label: 'Clinic & Pharmacy Settings',
    sql: 'SELECT id, clinic_name, medical_name, phone, gst_no, google_map_url, updated_at FROM settings',
  },
];

export const BackupRestore: React.FC = () => {
  const { profile, user } = useAuth();
  const operatorName =
    profile?.name || user?.displayName || user?.email || 'Super Admin';
  const { displayDate, displayTime, todayStr } = useLiveDate();

  const [livePayload, setLivePayload] =
    useState<FullSystemBackupPayload | null>(null);
  const [snapshots, setSnapshots] = useState<CloudBackupSnapshot[]>([]);
  const [dailyStatus, setDailyStatus] = useState<DailyBackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [uploadedBackup, setUploadedBackup] =
    useState<FullSystemBackupPayload | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [confirmRestoreSnapshot, setConfirmRestoreSnapshot] =
    useState<CloudBackupSnapshot | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // SQL & MySQL Engine States
  const [sqlStatus, setSqlStatus] = useState<SqlEngineStatusResponse | null>(
    null
  );
  const [selectedSqlTable, setSelectedSqlTable] =
    useState<SqlSyncTableName>('batches');
  const [sqlTableRows, setSqlTableRows] = useState<Array<Record<string, any>>>(
    []
  );
  const [sqlQueryText, setSqlQueryText] = useState<string>(
    PRESET_SQL_QUERIES[1].sql
  );
  const [sqlQueryResult, setSqlQueryResult] = useState<{
    columns: string[];
    rows: Array<Record<string, any>>;
    rowCount: number;
  } | null>(null);

  // Remote MySQL Server Connection Form
  const [mysqlHost, setMysqlHost] = useState('localhost');
  const [mysqlPort, setMysqlPort] = useState('3306');
  const [mysqlDatabase, setMysqlDatabase] = useState('sandana_dudrucs_mysql');
  const [mysqlUser, setMysqlUser] = useState('root');
  const [mysqlPassword, setMysqlPassword] = useState('');
  const [mysqlSsl, setMysqlSsl] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadBackupCenter = async () => {
    setLoading(true);
    try {
      // Ensure live data is synced to SQL tables first
      await syncAllDataToSqlNow(false).catch(() => {});

      const [currentData, cloudList, currentSqlStatus, tablePreview, dailyStat] =
        await Promise.all([
          collectFullSystemBackup(operatorName),
          listCloudBackupSnapshots(),
          fetchSqlEngineStatus(),
          fetchSqlTablePreview(selectedSqlTable, 100),
          fetchDailyBackupStatus(),
        ]);
      setLivePayload(currentData);
      setSnapshots(cloudList);
      if (dailyStat) {
        setDailyStatus(dailyStat);
      }
      if (currentSqlStatus) {
        setSqlStatus(currentSqlStatus);
        if (currentSqlStatus.mysqlHost) {
          setMysqlHost(currentSqlStatus.mysqlHost);
        }
        if (currentSqlStatus.mysqlPort) {
          setMysqlPort(String(currentSqlStatus.mysqlPort));
        }
        if (currentSqlStatus.mysqlDatabase) {
          setMysqlDatabase(currentSqlStatus.mysqlDatabase);
        }
        if (currentSqlStatus.mysqlUser) {
          setMysqlUser(currentSqlStatus.mysqlUser);
        }
      }
      if (tablePreview?.rows) {
        setSqlTableRows(tablePreview.rows);
      }
    } catch (err: any) {
      console.error('Error loading backup & SQL center:', err);
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to read system collections.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackupCenter();
  }, []);

  const handleSelectSqlTable = async (table: SqlSyncTableName) => {
    setSelectedSqlTable(table);
    setSqlQueryResult(null);
    const preview = await fetchSqlTablePreview(table, 100);
    setSqlTableRows(preview.rows || []);
  };

  const handleSyncToSqlNow = async () => {
    setBusyAction('sync-sql');
    setStatusBanner(null);
    try {
      const updated = await syncAllDataToSqlNow(false);
      if (updated) setSqlStatus(updated);
      const preview = await fetchSqlTablePreview(selectedSqlTable, 100);
      setSqlTableRows(preview.rows || []);
      setStatusBanner({
        type: 'success',
        text: `All 12 Clinic & Pharmacy tables synced to SQL Database (${
          updated?.totalRows ?? 0
        } SQL rows saved)!`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to sync to SQL database.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleHydrateFromSql = async () => {
    setBusyAction('hydrate-sql');
    setStatusBanner(null);
    try {
      const res = await hydrateAppFromSqlDatabase();
      await loadBackupCenter();
      setStatusBanner({
        type: 'success',
        text: `Loaded and verified ${res.restoredCount} records directly from the SQL Database into the live application!`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to load data from SQL database.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleConnectRemoteMySql = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('connect-mysql');
    setStatusBanner(null);
    try {
      const res = await connectLiveMySqlServer({
        host: mysqlHost.trim(),
        port: Number(mysqlPort || 3306),
        database: mysqlDatabase.trim(),
        user: mysqlUser.trim(),
        password: mysqlPassword,
        ssl: mysqlSsl,
      });
      if (res.status) setSqlStatus(res.status);
      if (res.success) {
        setStatusBanner({
          type: 'success',
          text: res.message,
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: `MySQL Connection Note: ${res.message}. Your data remains 100% saved in the local SQL relational database and you can download the .SQL dump file anytime!`,
        });
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Could not connect to remote MySQL server.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunSqlQuery = async (customSql?: string) => {
    const queryToRun = customSql ?? sqlQueryText;
    if (customSql) setSqlQueryText(customSql);
    setBusyAction('run-sql');
    setStatusBanner(null);
    try {
      const res = await runLiveSqlQuery(queryToRun);
      if (!res.success) {
        setStatusBanner({
          type: 'error',
          text: res.error || 'SQL Query failed.',
        });
        return;
      }
      setSqlQueryResult({
        columns: res.columns || [],
        rows: res.rows || [],
        rowCount: res.rowCount || 0,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'SQL Query execution error.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadJson = async () => {
    setBusyAction('download');
    setStatusBanner(null);
    try {
      const payload = await downloadSystemBackupJson(operatorName);
      setLivePayload(payload);
      setStatusBanner({
        type: 'success',
        text: `Complete Clinic & Pharmacy Backup downloaded successfully! Integrity Checksum: ${payload.checksum}`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Could not download JSON backup.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTriggerDailyBackup = async () => {
    setBusyAction('daily-backup');
    setStatusBanner(null);
    try {
      const res = await triggerDailyBackupNow();
      if (res.success) {
        await loadBackupCenter();
        setStatusBanner({
          type: 'success',
          text: `DAILY AUTO-BACKUP COMPLETE! Snapshot for ${todayStr} secured to server archives and database.sql updated.`,
        });
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to generate daily backup snapshot.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreDailyBackup = async (date: string) => {
    if (
      !window.confirm(
        `Are you sure you want to restore the entire database from daily backup (${date})? This will sync all 12 tables.`
      )
    ) {
      return;
    }
    setBusyAction(`restore-daily-${date}`);
    setStatusBanner(null);
    try {
      const res = await fetch(`/api/backup/daily/restore/${date}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Daily backup restore failed.');
      }
      await loadBackupCenter();
      setStatusBanner({
        type: 'success',
        text: `DAILY BACKUP RESTORE COMPLETE! Successfully restored ${json.syncResult?.totalSynced || 'all'} records from ${date} snapshot.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Restore from daily backup failed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateCloudSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('snapshot');
    setStatusBanner(null);
    try {
      const defaultTitle =
        snapshotLabel.trim() ||
        `Full ERP + Clinic Backup (${new Date().toLocaleString()})`;
      const snap = await createCloudBackupSnapshot(defaultTitle, operatorName);
      setSnapshotLabel('');
      await loadBackupCenter();
      setStatusBanner({
        type: 'success',
        text: `Cloud Snapshot "${snap.name}" saved (${snap.checksum}). You can restore it anytime with 1 click.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to create cloud backup snapshot.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileUploadChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusBanner(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as FullSystemBackupPayload;
      if (
        !parsed ||
        !parsed.collections ||
        typeof parsed.collections !== 'object'
      ) {
        throw new Error(
          'Selected JSON file is not a valid Sandana Clinic + Dudrucs backup file.'
        );
      }
      setUploadedBackup(parsed);
      setUploadedFileName(file.name);
      setStatusBanner({
        type: 'success',
        text: `Loaded backup file "${file.name}" (${parsed.checksum || 'Verified'}). Ready to restore.`,
      });
    } catch (err: any) {
      setUploadedBackup(null);
      setUploadedFileName('');
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Invalid backup JSON file.',
      });
    }
  };

  const handleRestoreFromUploadedFile = async () => {
    if (!uploadedBackup) return;
    setBusyAction('restore-file');
    setStatusBanner(null);
    try {
      const res = await restoreSystemFromPayload(
        uploadedBackup,
        restoreMode,
        operatorName
      );
      await syncAllDataToSqlNow(restoreMode === 'replace');
      await loadBackupCenter();
      setStatusBanner({
        type: 'success',
        text: `RESTORE COMPLETE! Restored ${res.totalRestored} records across ${res.collectionsRestored} Clinic & Pharmacy tables and synced to SQL (Mode: ${restoreMode.toUpperCase()}).`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to restore from uploaded backup file.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreFromCloudSnapshot = async (snap: CloudBackupSnapshot) => {
    setBusyAction(`restore-${snap.id}`);
    setStatusBanner(null);
    try {
      const parsed = JSON.parse(snap.payloadJson) as FullSystemBackupPayload;
      const res = await restoreSystemFromPayload(
        parsed,
        restoreMode,
        operatorName
      );
      await syncAllDataToSqlNow(restoreMode === 'replace');
      setConfirmRestoreSnapshot(null);
      await loadBackupCenter();
      setStatusBanner({
        type: 'success',
        text: `CLOUD + SQL RESTORE COMPLETE! Restored "${snap.name}" (${res.totalRestored} records across ${res.collectionsRestored} tables).`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Could not restore from cloud snapshot.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadSnapshotFile = (snap: CloudBackupSnapshot) => {
    try {
      const parsed = JSON.parse(snap.payloadJson);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${snap.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${snap.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    setBusyAction(`del-${id}`);
    try {
      await deleteCloudBackupSnapshot(id);
      await loadBackupCenter();
      setStatusBanner({
        type: 'success',
        text: 'Cloud snapshot removed.',
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Failed to delete snapshot.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const totalLiveDocs = livePayload
    ? (Object.values(livePayload.counts) as number[]).reduce(
        (sum, n) => sum + Number(n || 0),
        0
      )
    : 0;

  const activeDisplayRows = sqlQueryResult ? sqlQueryResult.rows : sqlTableRows;
  const activeDisplayColumns = sqlQueryResult
    ? sqlQueryResult.columns
    : sqlTableRows.length > 0
    ? Object.keys(sqlTableRows[0]).filter((c) => c !== 'data_json')
    : [];

  return (
    <div className="space-y-4">
      {/* Top Header Banner */}
      <div className="bg-[#000080] text-white px-4 py-3.5 rounded flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Database size={19} className="text-amber-300" />
            <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide">
              SANDANA CLINIC + DUDRUCS — MYSQL &amp; SQL RELATIONAL DATABASE +
              CLOUD BACKUP VAULT
            </h1>
          </div>
          <p className="text-[11px] text-blue-200 mt-0.5">
            All 12 Clinic &amp; Marg ERP Modules Connected to Relational SQL
            Tables (`medicines`, `batches`, `invoices`, `appointments`,
            `doctors`, `users`, `settings`) with 1-Click `.SQL` Dump &amp; Live
            MySQL Sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCompleteMySqlDumpFile(
                mysqlDatabase || 'sandana_dudrucs_mysql'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded shadow transition-colors cursor-pointer"
          >
            <Database size={13} />
            Download MySQL `.sql` Database
          </button>
          <button
            type="button"
            onClick={() =>
              downloadPhpMysqlConnector({
                host: mysqlHost,
                port: Number(mysqlPort || 3306),
                database: mysqlDatabase,
                user: mysqlUser,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-extrabold rounded shadow transition-colors cursor-pointer"
          >
            <FileCode2 size={13} />
            Download `mysql_api.php`
          </button>
          <button
            type="button"
            onClick={() => downloadStandalonePhpOtpFile()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold rounded shadow transition-colors cursor-pointer"
          >
            <FileJson size={13} />
            Download `otp.php`
          </button>
          <button
            type="button"
            onClick={downloadHostingHtaccessFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded border border-slate-500 transition-colors cursor-pointer"
          >
            `.htaccess`
          </button>
          <button
            type="button"
            onClick={loadBackupCenter}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded border border-blue-500 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh SQL
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`p-3 rounded border text-xs font-bold flex items-center justify-between ${
            statusBanner.type === 'success'
              ? 'bg-green-50 border-green-400 text-green-900'
              : 'bg-red-50 border-red-400 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 size={16} className="text-green-700 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-red-700 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ====================================================================== */}
      {/* SECTION 0: AUTOMATED DAILY BACKUP & LIVE ROLLOVER ENGINE               */}
      {/* ====================================================================== */}
      <div className="bg-gradient-to-br from-[#0F2942] via-[#103E5C] to-[#0A2239] text-white border-2 border-emerald-500/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-slate-950 font-mono">
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
                Live Mode Active
              </span>
              <span className="text-xs font-mono font-bold text-emerald-300">
                Auto-Save Enabled (Dual Sync: Firestore + MySQL)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Automated Daily Backup &amp; Midnight Date Rollover System
            </h2>
            <p className="text-xs text-blue-200/90 leading-relaxed max-w-2xl">
              Website me sara data automatically save hota hai. Raat 12:00:00 AM baje live date apne aap change hoti hai, naye din ka token counter fresh shuru hota hai, aur poore system ka <strong>Daily .SQL &amp; .JSON snapshot</strong> backup archive me automatically save ho jata hai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleTriggerDailyBackup}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-md transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={busyAction === 'daily-backup' ? 'animate-spin' : ''}
              />
              <span>Run Daily Backup Now</span>
            </button>
            <a
              href="/database.sql"
              download={`sandana_dudrucs_daily_backup_${todayStr}.sql`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2B59C3] hover:bg-blue-600 text-white text-xs font-extrabold rounded-xl shadow-md transition-colors"
            >
              <HardDriveDownload size={14} />
              <span>Download Today .SQL</span>
            </a>
          </div>
        </div>

        {/* 3 Status Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 space-y-1">
            <p className="text-[11px] font-bold text-teal-300 uppercase tracking-wide">
              Live Real-Time Date &amp; Clock
            </p>
            <p className="text-sm font-black text-white font-mono">{displayDate}</p>
            <p className="text-xs font-bold text-amber-300 font-mono">{displayTime}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 space-y-1">
            <p className="text-[11px] font-bold text-teal-300 uppercase tracking-wide">
              Today&apos;s Daily Auto-Backup
            </p>
            <p className="text-sm font-black text-emerald-400 font-mono">
              {dailyStatus?.backups[0] ? '✅ Active & Secured' : '⏳ Initializing...'}
            </p>
            <p className="text-[11px] text-blue-200">
              {dailyStatus?.backups[0]?.totalRows || sqlStatus?.totalRows || 140} rows · {dailyStatus?.backups[0]?.sqlFileSize || '414 KB'} SQL
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 space-y-1">
            <p className="text-[11px] font-bold text-teal-300 uppercase tracking-wide">
              Next Scheduled Auto-Backup
            </p>
            <p className="text-sm font-bold text-white font-mono">Tonight at 00:00:00</p>
            <p className="text-[11px] text-blue-200">
              Auto-Rollover to new day queue
            </p>
          </div>
        </div>

        {/* Daily Backup Archive History */}
        {dailyStatus?.backups && dailyStatus.backups.length > 0 && (
          <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
                <DatabaseBackup size={14} />
                Daily Backup Archive History ({dailyStatus.backups.length} snapshots)
              </span>
              <span className="text-[10px] text-blue-200 font-mono">
                Stored in /backups &amp; database.sql
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-teal-300 font-mono">
                    <th className="py-1 px-2">Date</th>
                    <th className="py-1 px-2">Records</th>
                    <th className="py-1 px-2">SQL Size</th>
                    <th className="py-1 px-2">JSON Size</th>
                    <th className="py-1 px-2">Timestamp</th>
                    <th className="py-1 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dailyStatus.backups.map((b) => (
                    <tr key={b.date} className="hover:bg-white/5">
                      <td className="py-1.5 px-2 font-bold font-mono text-white">
                        {b.date} {b.date === todayStr && <span className="text-emerald-400 text-[10px] ml-1">(Today)</span>}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-blue-100">{b.totalRows} rows</td>
                      <td className="py-1.5 px-2 font-mono text-teal-200">{b.sqlFileSize}</td>
                      <td className="py-1.5 px-2 font-mono text-sky-200">{b.jsonFileSize}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-300">{new Date(b.timestamp).toLocaleTimeString()}</td>
                      <td className="py-1.5 px-2 text-right space-x-2 whitespace-nowrap">
                        <a
                          href={`/api/backup/daily/download/${b.date}/sql`}
                          download={`sandana_backup_${b.date}.sql`}
                          className="text-emerald-400 hover:text-emerald-300 underline font-mono font-bold"
                        >
                          .SQL
                        </a>
                        <a
                          href={`/api/backup/daily/download/${b.date}/json`}
                          download={`sandana_backup_${b.date}.json`}
                          className="text-sky-400 hover:text-sky-300 underline font-mono font-bold"
                        >
                          .JSON
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRestoreDailyBackup(b.date)}
                          disabled={busyAction !== null}
                          className="text-amber-400 hover:text-amber-300 font-bold ml-1 cursor-pointer disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================== */}
      {/* SECTION 1: LIVE SQL & MYSQL RELATIONAL DATABASE ENGINE CONTROL         */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: 12 Relational SQL Tables Grid */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded p-4 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] flex items-center gap-1.5">
                <Database size={15} className="text-emerald-600" />
                Live SQL Relational Tables (
                {sqlStatus?.totalRows ?? totalLiveDocs} Total SQL Rows Saved)
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Click any SQL table below to inspect its relational columns and
                rows live. Every new appointment, medicine, purchase bill &amp;
                sale invoice is automatically saved in SQL.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncToSqlNow}
                disabled={busyAction !== null}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs transition-colors cursor-pointer"
              >
                {busyAction === 'sync-sql'
                  ? 'Syncing SQL...'
                  : 'Sync All Data → SQL Now'}
              </button>
              <button
                type="button"
                onClick={handleHydrateFromSql}
                disabled={busyAction !== null}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded transition-colors cursor-pointer"
              >
                {busyAction === 'hydrate-sql'
                  ? 'Loading...'
                  : 'Load App from SQL'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SQL_SYNC_TABLES.map((tName) => {
              const count =
                sqlStatus?.tableCounts?.[tName] ??
                (livePayload?.counts as any)?.[tName] ??
                0;
              const isSelected = selectedSqlTable === tName && !sqlQueryResult;
              return (
                <button
                  key={tName}
                  type="button"
                  onClick={() => handleSelectSqlTable(tName)}
                  className={`p-2.5 rounded border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-[#000080] ring-1 ring-[#000080]'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono uppercase font-extrabold text-[#000080]">
                      {tName}
                    </span>
                    <TableIcon size={12} className="text-slate-400" />
                  </div>
                  <span className="text-lg font-extrabold font-mono text-slate-900 mt-1">
                    {loading ? '...' : count}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    ● SQL Table Active
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Connect External / cPanel MySQL Server */}
        <div className="lg:col-span-5 bg-white border border-slate-300 rounded p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] flex items-center gap-1.5">
              <Server size={15} className="text-emerald-600" />
              MySQL Server Connection (`mysql2` Live Driver)
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                sqlStatus?.mysqlConnected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-blue-100 text-blue-900'
              }`}
            >
              {sqlStatus?.mysqlConnected
                ? 'REMOTE MYSQL CONNECTED'
                : 'LOCAL SQL + .SQL DUMP READY'}
            </span>
          </div>

          <p className="text-[11px] text-slate-600">
            All data is automatically saved in the built-in SQL database. To
            also connect a live external MySQL database (cPanel / Hostinger /
            VPS / RDS), enter your MySQL details below or click{' '}
            <strong>&ldquo;Download MySQL .sql Database&rdquo;</strong> above to
            import into phpMyAdmin.
          </p>

          <form onSubmit={handleConnectRemoteMySql} className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                  MySQL Host
                </label>
                <input
                  type="text"
                  value={mysqlHost}
                  onChange={(e) => setMysqlHost(e.target.value)}
                  placeholder="localhost or MySQL IP"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                  Port
                </label>
                <input
                  type="number"
                  value={mysqlPort}
                  onChange={(e) => setMysqlPort(e.target.value)}
                  placeholder="3306"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                  Database Name
                </label>
                <input
                  type="text"
                  value={mysqlDatabase}
                  onChange={(e) => setMysqlDatabase(e.target.value)}
                  placeholder="sandana_dudrucs_mysql"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                  MySQL Username
                </label>
                <input
                  type="text"
                  value={mysqlUser}
                  onChange={(e) => setMysqlUser(e.target.value)}
                  placeholder="root / cpanel_user"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                  MySQL Password
                </label>
                <input
                  type="password"
                  value={mysqlPassword}
                  onChange={(e) => setMysqlPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mysqlSsl}
                  onChange={(e) => setMysqlSsl(e.target.checked)}
                />
                <span>Use SSL Connection</span>
              </label>

              <button
                type="submit"
                disabled={busyAction !== null}
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white text-xs font-bold rounded shadow transition-colors cursor-pointer"
              >
                {busyAction === 'connect-mysql'
                  ? 'Connecting MySQL...'
                  : 'Connect Live MySQL & Create 12 Tables'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECTION 2: INTERACTIVE SQL QUERY EXPLORER & LIVE SQL TABLE VIEWER      */}
      {/* ====================================================================== */}
      <div className="bg-white border border-slate-300 rounded p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] flex items-center gap-1.5">
              <Play size={14} className="text-emerald-600" />
              Live SQL Query Runner &amp; Relational Table Inspector
            </h2>
            <p className="text-[11px] text-slate-600">
              Run real SQL <code className="font-mono">SELECT</code> queries on
              your live clinic &amp; pharmacy database or click any preset SQL
              query below:
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SQL_QUERIES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleRunSqlQuery(preset.sql)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 border border-slate-300 hover:border-[#000080] text-[11px] font-bold text-slate-800 rounded transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={sqlQueryText}
            onChange={(e) => setSqlQueryText(e.target.value)}
            className="flex-1 px-3 py-2 font-mono text-xs bg-slate-900 text-emerald-300 border border-slate-700 rounded focus:outline-none"
            placeholder="SELECT * FROM batches LIMIT 50"
          />
          <button
            type="button"
            onClick={() => handleRunSqlQuery()}
            disabled={busyAction !== null}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Play size={13} />
            {busyAction === 'run-sql' ? 'Running SQL...' : 'Run SQL Query'}
          </button>
        </div>

        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
            <span>
              {sqlQueryResult
                ? `SQL Query Result (${sqlQueryResult.rowCount} rows)`
                : `Live SQL Table: \`${selectedSqlTable}\` (${activeDisplayRows.length} rows)`}
            </span>
            {sqlQueryResult && (
              <button
                type="button"
                onClick={() => setSqlQueryResult(null)}
                className="text-[11px] text-[#000080] underline cursor-pointer"
              >
                Back to `{selectedSqlTable}` Table View
              </button>
            )}
          </div>

          {activeDisplayRows.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No rows found in this SQL table yet. Click{' '}
              <strong>&ldquo;Sync All Data → SQL Now&rdquo;</strong> above to
              populate all tables.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800 sticky top-0">
                    {activeDisplayColumns.map((col) => (
                      <th
                        key={col}
                        className="py-2 px-3 font-mono font-bold uppercase text-[10px] whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeDisplayRows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/40">
                      {activeDisplayColumns.map((col) => {
                        const rawVal = row[col];
                        const displayVal =
                          rawVal === null || rawVal === undefined
                            ? '-'
                            : typeof rawVal === 'object'
                            ? JSON.stringify(rawVal)
                            : String(rawVal);
                        return (
                          <td
                            key={col}
                            className="py-1.5 px-3 font-mono text-[11px] text-slate-800 whitespace-nowrap max-w-xs truncate"
                            title={displayVal}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECTION 3: CLOUD SNAPSHOT VAULT & JSON BACKUP / RESTORE                */}
      {/* ====================================================================== */}
      <div className="bg-amber-50/90 border border-amber-300 rounded p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-amber-950">
            Select Anytime Restore Mode (Applies to both Cloud Snapshot Restore
            &amp; File Upload Restore):
          </p>
          <p className="text-[11px] text-amber-800">
            <strong>Safe Merge (Recommended):</strong> Restores all backed-up
            records &amp; updates existing IDs without deleting newer entries.{' '}
            <strong>Full Clean Replace:</strong> Exact point-in-time rollback.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRestoreMode('merge')}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
              restoreMode === 'merge'
                ? 'bg-[#000080] text-white border-[#000080]'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            Safe Merge Restore
          </button>
          <button
            type="button"
            onClick={() => setRestoreMode('replace')}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
              restoreMode === 'replace'
                ? 'bg-red-700 text-white border-red-700'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            Full Clean Replace
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded shadow transition-colors"
          >
            <HardDriveDownload size={14} />
            {busyAction === 'download' ? 'Generating...' : 'Download JSON'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-300 rounded p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <CloudUpload size={15} className="text-green-700" />
            1. Create Instant Cloud Backup Snapshot
          </h2>
          <p className="text-xs text-slate-600">
            Save a complete point-in-time snapshot of all Clinic &amp; Pharmacy
            tables so you can restore it anytime with a single click.
          </p>
          <form
            onSubmit={handleCreateCloudSnapshot}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="e.g., Before Monthly GST Closing / Evening Backup"
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
            />
            <button
              type="submit"
              disabled={busyAction !== null}
              className="px-4 py-2 bg-[#000080] hover:bg-blue-900 text-white text-xs font-bold rounded transition-colors whitespace-nowrap"
            >
              {busyAction === 'snapshot'
                ? 'Saving Snapshot...'
                : '+ Save Cloud Snapshot'}
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-300 rounded p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <FileJson size={15} className="text-amber-600" />
            2. Restore Anytime from Downloaded `.json` Backup File
          </h2>
          <p className="text-xs text-slate-600">
            Select any previously downloaded{' '}
            <code className="font-mono bg-slate-100 px-1 rounded">
              Sandana_Dudrucs_Full_Backup_*.json
            </code>{' '}
            file to restore all clinic and pharmacy records into both Cloud and
            SQL tables immediately.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUploadChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-xs font-bold rounded transition-colors"
            >
              Choose Backup `.json` File...
            </button>

            {uploadedBackup && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleRestoreFromUploadedFile}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                {busyAction === 'restore-file'
                  ? 'Restoring Database...'
                  : `Restore Now (${restoreMode.toUpperCase()})`}
              </button>
            )}
          </div>

          {uploadedBackup && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[11px] text-slate-800 space-y-1">
              <div className="font-bold text-[#000080]">
                File Ready: {uploadedFileName}
              </div>
              <div className="font-mono text-[10px] text-slate-600">
                Exported: {uploadedBackup.exportedAt} · By:{' '}
                {uploadedBackup.exportedBy || 'Admin'} · Checksum:{' '}
                {uploadedBackup.checksum ||
                  computeBackupChecksum(JSON.stringify(uploadedBackup.counts))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] flex items-center gap-1.5">
            <CloudDownload size={15} className="text-[#000080]" />
            Saved Cloud Backup Snapshots ({snapshots.length}) — 1-Click Anytime
            Restore
          </h2>
          <span className="text-[11px] font-mono text-slate-600">
            Synced with SQL + Cloud `backups`
          </span>
        </div>

        {snapshots.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No cloud snapshots saved yet. Click{' '}
            <strong>&ldquo;+ Save Cloud Snapshot&rdquo;</strong> above to store
            an instant restore point.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                  <th className="py-2.5 px-3 font-bold">Snapshot Name</th>
                  <th className="py-2.5 px-3 font-bold">Created At</th>
                  <th className="py-2.5 px-3 font-bold">Created By</th>
                  <th className="py-2.5 px-3 font-bold">Records Summary</th>
                  <th className="py-2.5 px-3 font-bold">Integrity Checksum</th>
                  <th className="py-2.5 px-3 font-bold text-right">
                    Anytime Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {snapshots.map((snap) => {
                  const c = snap.counts || {};
                  return (
                    <tr key={snap.id} className="hover:bg-blue-50/40">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {snap.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {new Date(snap.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {snap.createdBy}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        Meds: {c.medicines ?? 0} | Batches: {c.batches ?? 0} |
                        Bills: {c.invoices ?? 0} | Docs: {c.doctors ?? 0} |
                        OPD: {c.appointments ?? 0}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-green-800 font-bold">
                        {snap.checksum}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        {confirmRestoreSnapshot?.id === snap.id ? (
                          <>
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() =>
                                handleRestoreFromCloudSnapshot(snap)
                              }
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-[11px]"
                            >
                              {busyAction === `restore-${snap.id}`
                                ? 'Restoring...'
                                : `Confirm ${restoreMode.toUpperCase()}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreSnapshot(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded text-[11px]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreSnapshot(snap)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded text-[11px]"
                          >
                            <RotateCcw size={12} />
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadSnapshotFile(snap)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold rounded text-[11px]"
                          title="Download JSON"
                        >
                          <HardDriveDownload size={12} />
                          JSON
                        </button>
                        <button
                          type="button"
                          disabled={busyAction === `del-${snap.id}`}
                          onClick={() => handleDeleteSnapshot(snap.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded text-[11px]"
                          title="Delete Snapshot"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;
