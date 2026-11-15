import { useEffect, useState } from 'react';
import { saveAutoSelfBackupAndSyncHost } from './backupRestore';

export interface LiveDateState {
  todayStr: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Sunday, 01 Nov 2026"
  displayTime: string; // e.g. "05:35:10 AM"
  dayOfWeek: string; // e.g. "Sunday"
  isLiveMode: boolean;
  lastBackupTime: string | null;
}

export interface DailyBackupItem {
  date: string;
  timestamp: string;
  totalRows: number;
  sqlFileSize: string;
  jsonFileSize: string;
  status: 'completed' | 'verified';
}

export interface DailyBackupStatus {
  active: boolean;
  today: string;
  lastBackupTime: string | null;
  nextScheduledBackup: string;
  totalBackups: number;
  backups: DailyBackupItem[];
}

let lastKnownDateStr = '';
let engineStarted = false;

export function getSystemTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLiveDate(d: Date = new Date()): {
  todayStr: string;
  displayDate: string;
  displayTime: string;
  dayOfWeek: string;
} {
  const todayStr = getSystemTodayDate();
  const dayOfWeek = d.toLocaleDateString('en-IN', { weekday: 'long' });
  const displayDate = d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const displayTime = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return { todayStr, displayDate, displayTime, dayOfWeek };
}

/**
 * Triggers an immediate daily backup to be saved on the server, cloud Firestore, and browser self-backup
 */
export async function triggerDailyBackupNow(): Promise<{
  success: boolean;
  message: string;
  backup?: DailyBackupItem;
}> {
  try {
    await saveAutoSelfBackupAndSyncHost('Daily Auto-Backup Engine', 'daily_rollover').catch(() => {});
    const res = await fetch('/api/backup/daily/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual_or_rollover' }),
    });
    if (!res.ok) {
      throw new Error(`Backup failed with HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      message: data.message || 'Daily backup completed successfully.',
      backup: data.backup,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Daily backup failed.',
    };
  }
}

/**
 * Fetches the daily backup status and past backup archive from server
 */
export async function fetchDailyBackupStatus(): Promise<DailyBackupStatus | null> {
  try {
    const res = await fetch('/api/backup/daily/status');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Starts the continuous Live Date Rollover & Auto-Backup watcher.
 * - Detects date change automatically at midnight
 * - Triggers daily backup and fires window event 'live-date-rollover'
 * - Runs a background self-backup & host sync on boot and every 10 minutes
 */
export function startLiveDateAndDailyBackupEngine(): void {
  if (engineStarted || typeof window === 'undefined') return;
  engineStarted = true;

  lastKnownDateStr = getSystemTodayDate();
  const savedDate = localStorage.getItem('sandana_active_date');

  // Initial boot self-backup & host sync after 3 seconds
  setTimeout(() => {
    saveAutoSelfBackupAndSyncHost('System Auto-Sync', 'boot_sync').catch(() => {});
  }, 3000);

  // If opening on a new day compared to previous session, trigger rollover immediately
  if (savedDate && savedDate !== lastKnownDateStr) {
    console.log(`[LiveMode] New day detected on launch: ${savedDate} -> ${lastKnownDateStr}. Running daily rollover...`);
    triggerDailyBackupNow().catch(() => {});
    window.dispatchEvent(
      new CustomEvent('live-date-rollover', {
        detail: { previousDate: savedDate, newDate: lastKnownDateStr },
      })
    );
  }
  localStorage.setItem('sandana_active_date', lastKnownDateStr);

  // Every 10 minutes, run background self-backup + host daily archive update
  setInterval(() => {
    saveAutoSelfBackupAndSyncHost('Periodic Auto-Backup', 'periodic_10m').catch(() => {});
  }, 10 * 60 * 1000);

  // Every 2 seconds, check if the date rolled over (e.g. at 00:00:00 midnight)
  setInterval(() => {
    const currentToday = getSystemTodayDate();
    if (currentToday !== lastKnownDateStr) {
      const prev = lastKnownDateStr;
      lastKnownDateStr = currentToday;
      localStorage.setItem('sandana_active_date', currentToday);

      console.log(`[LiveMode] Midnight Date Rollover triggered: ${prev} -> ${currentToday}`);

      // Auto-trigger daily backup snapshot
      triggerDailyBackupNow().catch(() => {});

      // Dispatch global event for all components to update
      window.dispatchEvent(
        new CustomEvent('live-date-rollover', {
          detail: { previousDate: prev, newDate: currentToday },
        })
      );
      window.dispatchEvent(new Event('app-date-changed'));
    }
  }, 2000);
}

/**
 * React hook for live date, ticking clock, and daily rollover awareness
 */
export function useLiveDate() {
  const [liveState, setLiveState] = useState<LiveDateState>(() => {
    const f = formatLiveDate();
    return {
      todayStr: f.todayStr,
      displayDate: f.displayDate,
      displayTime: f.displayTime,
      dayOfWeek: f.dayOfWeek,
      isLiveMode: true,
      lastBackupTime: null,
    };
  });

  useEffect(() => {
    startLiveDateAndDailyBackupEngine();

    const timer = setInterval(() => {
      const f = formatLiveDate();
      setLiveState((prev) => ({
        ...prev,
        todayStr: f.todayStr,
        displayDate: f.displayDate,
        displayTime: f.displayTime,
        dayOfWeek: f.dayOfWeek,
      }));
    }, 1000);

    const handleRollover = (e: any) => {
      const f = formatLiveDate();
      setLiveState((prev) => ({
        ...prev,
        todayStr: f.todayStr,
        displayDate: f.displayDate,
        displayTime: f.displayTime,
        dayOfWeek: f.dayOfWeek,
        lastBackupTime: new Date().toISOString(),
      }));
    };

    window.addEventListener('live-date-rollover', handleRollover);

    return () => {
      clearInterval(timer);
      window.removeEventListener('live-date-rollover', handleRollover);
    };
  }, []);

  return liveState;
}
