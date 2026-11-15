import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { Activity, RefreshCw, Search } from 'lucide-react';
import { db } from '../../firebase';

export interface StaffActivityRecord {
  id: string;
  staffId: string;
  staffName: string;
  action: string;
  details: string;
  timestamp: string;
}

export const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<StaffActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'staff_activity'));
      const list: StaffActivityRecord[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffActivityRecord, 'id'>),
        }))
        .sort((a, b) =>
          String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
        );
      setLogs(list);
    } catch (err) {
      console.error('Error loading staff_activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((item) => {
    const matchesAction =
      actionFilter === 'ALL' || item.action === actionFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.staffName.toLowerCase().includes(q) ||
      item.details.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q);
    return matchesAction && matchesQuery;
  });

  const formatTimestamp = (iso: string) => {
    try {
      return format(new Date(iso), 'dd-MMM-yyyy hh:mm:ss a');
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Marg ERP Header */}
      <div className="bg-[#000080] text-white px-4 py-2.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-amber-300" />
          <div>
            <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide">
              MARG OPERATOR AUDIT &amp; STAFF ACTIVITY LOG
            </h1>
            <p className="text-[11px] text-blue-200">
              Real-time trail of bills created, payments collected, batches added, and staff logins
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={13} />
          Refresh Log
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-300 rounded p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by staff name (e.g. Raju), invoice #DUD-2026-001, or action..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#000080]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#000080]"
          >
            <option value="ALL">ALL ACTIONS ({logs.length})</option>
            <option value="CREATE_BILL">CREATE_BILL</option>
            <option value="MARK_PAID">MARK_PAID</option>
            <option value="ADD_MEDICINE">ADD_MEDICINE</option>
            <option value="ADD_BATCH">ADD_BATCH</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="CREATE_STAFF">CREATE_STAFF</option>
            <option value="BLOCK_STAFF">BLOCK_STAFF</option>
          </select>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading staff activity audit trail...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No activity records match your filter. Create a bill or add stock to see live audit logs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                  <th className="py-2 px-3 font-bold">Date &amp; Time</th>
                  <th className="py-2 px-3 font-bold">Operator / Staff</th>
                  <th className="py-2 px-3 font-bold">Action Code</th>
                  <th className="py-2 px-3 font-bold">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/40">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {log.staffName}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold text-[#000080]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800 font-medium">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
