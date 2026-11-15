import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  CalendarCheck,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  XCircle,
  Printer,
} from 'lucide-react';
import { db } from '../../firebase';
import { logStaffActivity } from '../../utils/activityLogger';
import { printElementById } from '../../utils/printEngine';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';

export interface AppointmentRecord {
  id: string;
  patientName: string;
  phone: string;
  email?: string;
  age?: number;
  doctorId: string;
  doctorName?: string;
  date: string;
  slot: string;
  status: 'booked' | 'confirmed' | 'completed' | 'cancelled';
  bookedBy: 'patient' | 'reception' | 'admin';
  tokenNo?: number;
  createdAt?: string;
}

export interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
}

export const AppointmentManager: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aptSnap, docSnap] = await Promise.all([
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'doctors')),
      ]);

      const docList: DoctorOption[] = docSnap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name || 'Doctor'),
        specialization: String(d.data().specialization || 'General'),
      }));

      const aptList: AppointmentRecord[] = aptSnap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppointmentRecord, 'id'>),
        }))
        .sort((a, b) =>
          String(b.date || '').localeCompare(String(a.date || ''))
        );

      setDoctors(docList);
      setAppointments(aptList);
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (
    apt: AppointmentRecord,
    newStatus: 'booked' | 'confirmed' | 'completed' | 'cancelled'
  ) => {
    try {
      await updateDoc(doc(db, 'appointments', apt.id), {
        status: newStatus,
      });
      await saveRecordToSql('appointments', apt.id, {
        ...apt,
        status: newStatus,
      });
      await logStaffActivity(
        'APPOINTMENT_STATUS_UPDATED',
        `Appointment for ${apt.patientName} (${apt.date} ${apt.slot}) marked ${newStatus.toUpperCase()}`
      );
      setToastMsg(
        `Appointment for ${apt.patientName} updated to ${newStatus.toUpperCase()}.`
      );
      await loadData();
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to update appointment status.');
    }
  };

  const handleDoctorReassign = async (
    apt: AppointmentRecord,
    newDoctorId: string
  ) => {
    const targetDoc = doctors.find((d) => d.id === newDoctorId);
    if (!targetDoc) return;
    try {
      await updateDoc(doc(db, 'appointments', apt.id), {
        doctorId: targetDoc.id,
        doctorName: targetDoc.name,
      });
      await saveRecordToSql('appointments', apt.id, {
        ...apt,
        doctorId: targetDoc.id,
        doctorName: targetDoc.name,
      });
      await logStaffActivity(
        'APPOINTMENT_DOCTOR_REASSIGNED',
        `Reassigned patient ${apt.patientName} to ${targetDoc.name}`
      );
      setToastMsg(
        `Assigned ${targetDoc.name} to patient ${apt.patientName}.`
      );
      await loadData();
    } catch (err: any) {
      setToastMsg(err?.message || 'Could not reassign doctor.');
    }
  };

  const handleDeleteAppointment = async (apt: AppointmentRecord) => {
    try {
      await deleteDoc(doc(db, 'appointments', apt.id));
      await logStaffActivity(
        'APPOINTMENT_DELETED',
        `Deleted appointment of ${apt.patientName} (${apt.date})`
      );
      setToastMsg(`Deleted appointment of ${apt.patientName}.`);
      await loadData();
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to delete appointment.');
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
    if (dateFilter && apt.date !== dateFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        String(apt.patientName || '').toLowerCase().includes(q) ||
        String(apt.phone || '').toLowerCase().includes(q) ||
        String(apt.doctorName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportExcel = () => {
    const rows = filteredAppointments.map((a) => ({
      TokenNo: a.tokenNo || 1,
      Date: a.date,
      Slot: a.slot,
      PatientName: a.patientName,
      Phone: a.phone,
      Age: a.age || '',
      Doctor: a.doctorName || a.doctorId,
      Status: a.status,
      BookedBy: a.bookedBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Appointments');
    XLSX.writeFile(
      wb,
      `Sandana_Clinic_Appointments_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleExportCsv = () => {
    const rows = filteredAppointments.map((a) => ({
      TokenNo: a.tokenNo || 1,
      Date: a.date,
      Slot: a.slot,
      PatientName: a.patientName,
      Phone: a.phone,
      Age: a.age || '',
      Doctor: a.doctorName || a.doctorId,
      Status: a.status,
      BookedBy: a.bookedBy,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sandana_Clinic_Appointments_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="printable-admin-appointments" className="space-y-4">
      <div className="bg-[#000080] text-white px-4 py-3 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono text-amber-300 uppercase">
            ADMINISTRATION — FULL APPOINTMENTS CONTROL
          </p>
          <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide flex items-center gap-2">
            <CalendarCheck size={18} />
            Manage All Clinic Appointments, Status &amp; Doctor Assignment
          </h1>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              printElementById('printable-admin-appointments', {
                title: 'Sandana_Clinic_Appointments_Register',
              })
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-[#000080] text-xs font-bold rounded shadow-2xs"
          >
            <Printer size={13} />
            Print Register
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded"
          >
            <FileSpreadsheet size={13} />
            Export .XLSX
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded"
          >
            <FileSpreadsheet size={13} />
            Export .CSV
          </button>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded border border-blue-500"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 bg-green-50 border border-green-300 rounded text-xs font-bold text-green-900 flex items-center justify-between">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-300 rounded p-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patient name, 10-digit mobile, or doctor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#000080]"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
          >
            <option value="all">All Statuses ({appointments.length})</option>
            <option value="booked">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                <th className="py-2.5 px-3 font-bold">Token</th>
                <th className="py-2.5 px-3 font-bold">Date &amp; Slot</th>
                <th className="py-2.5 px-3 font-bold">Patient Details</th>
                <th className="py-2.5 px-3 font-bold">Booked By</th>
                <th className="py-2.5 px-3 font-bold">
                  Assigned Doctor (Reassign)
                </th>
                <th className="py-2.5 px-3 font-bold">Status</th>
                <th className="py-2.5 px-3 font-bold text-right">
                  Admin Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    No appointments found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-blue-50/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-green-700">
                      #{apt.tokenNo || 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-slate-900">{apt.date}</div>
                      <div className="text-[11px] text-slate-600">
                        {apt.slot}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">
                        {apt.patientName}{' '}
                        {apt.age ? (
                          <span className="font-normal text-slate-500">
                            ({apt.age} yrs)
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-[11px] text-slate-600">
                        {apt.phone}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 uppercase font-mono text-[10px] font-bold text-slate-600">
                      {apt.bookedBy || 'patient'}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={apt.doctorId}
                        onChange={(e) =>
                          handleDoctorReassign(apt, e.target.value)
                        }
                        className="px-2 py-1 text-xs border border-slate-300 rounded bg-white font-semibold text-slate-900"
                      >
                        {!doctors.some((d) => d.id === apt.doctorId) && (
                          <option value={apt.doctorId}>
                            {apt.doctorName || apt.doctorId}
                          </option>
                        )}
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.specialization})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          apt.status === 'confirmed' ||
                          apt.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : apt.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-[#000080]'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(apt, 'confirmed')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold"
                        title="Confirm Appointment"
                      >
                        <UserCheck size={12} />
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(apt, 'completed')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[11px] font-bold"
                        title="Mark Completed"
                      >
                        <CheckCircle2 size={12} />
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(apt, 'cancelled')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold"
                        title="Cancel Appointment"
                      >
                        <XCircle size={12} />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAppointment(apt)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px]"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AppointmentManager;
