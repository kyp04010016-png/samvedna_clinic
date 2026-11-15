import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PublicNavbar } from './components/PublicNavbar';
import { MainLayout } from './components/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { autoBootstrapDomainDatabaseIfNeeded } from './utils/seedData';
import { startRealtimeSqlSyncBridge } from './utils/sqlSyncBridge';
import { startLiveDateAndDailyBackupEngine } from './utils/liveDateEngine';

import { Home } from './pages/public/Home';
import { BookAppointment } from './pages/public/BookAppointment';
import { FeedbackForm } from './pages/public/FeedbackForm';
import { Login } from './pages/public/Login';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Doctors } from './pages/admin/Doctors';
import { StaffManager } from './pages/admin/StaffManager';
import { ActivityLog } from './pages/admin/ActivityLog';
import { Feedback } from './pages/admin/Feedback';
import { Reports } from './pages/admin/Reports';
import { SiteSettings } from './pages/admin/SiteSettings';
import { BackupRestore } from './pages/admin/BackupRestore';
import { AppointmentManager } from './pages/admin/AppointmentManager';
import { StaffReports } from './pages/admin/StaffReports';
import { PrescriptionsAdmin } from './pages/admin/PrescriptionsAdmin';
import { AdminManualBook } from './pages/admin/AdminManualBook';

import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { SaleBilling } from './pages/pharmacy/SaleBilling';
import { Masters } from './pages/pharmacy/Masters';
import { StockReport } from './pages/pharmacy/StockReport';
import { Invoices } from './pages/pharmacy/Invoices';
import { MargErpViews } from './pages/pharmacy/MargErpViews';
import { PrescriptionsPharmacy } from './pages/pharmacy/PrescriptionsPharmacy';
import { ReceptionDashboard } from './pages/reception/ReceptionDashboard';
import { PatientPrescriptionPortal } from './pages/public/PatientPrescriptionPortal';

const AppRoutes: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    autoBootstrapDomainDatabaseIfNeeded();
    startRealtimeSqlSyncBridge();
    startLiveDateAndDailyBackupEngine();
  }, []);

  const isPublicPage =
    location.pathname === '/' ||
    location.pathname === '/book' ||
    location.pathname === '/patient-prescriptions' ||
    location.pathname === '/feedback' ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/login/');

  if (isPublicPage) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <PublicNavbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<BookAppointment />} />
            <Route path="/patient-prescriptions" element={<PatientPrescriptionPortal />} />
            <Route path="/feedback" element={<FeedbackForm />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/:portal" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <MainLayout>
      <Routes>
        {/* Admin ERP Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/manual"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminManualBook />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/appointments"
          element={
            <ProtectedRoute allowedRoles={['admin', 'reception']}>
              <AppointmentManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff-reports"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StaffReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/backup"
          element={
            <ProtectedRoute allowedRoles={['admin', 'pharmacy']}>
              <BackupRestore />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StaffManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SiteSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/site-settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SiteSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/doctors"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Doctors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/feedback"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Feedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/prescriptions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PrescriptionsAdmin />
            </ProtectedRoute>
          }
        />

        {/* Pharmacy Marg ERP 9+ Routes */}
        <Route
          path="/pharmacy"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <MargErpViews />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/erp"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <MargErpViews />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/sale"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <SaleBilling />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/prescriptions"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <PrescriptionsPharmacy />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/masters"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <Masters />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/stock"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <Masters />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/report"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <StockReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/invoices"
          element={
            <ProtectedRoute allowedRoles={['pharmacy', 'admin']}>
              <Invoices />
            </ProtectedRoute>
          }
        />

        {/* Doctor & Reception Routes */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute allowedRoles={['doctor', 'admin']}>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/prescriptions"
          element={
            <ProtectedRoute allowedRoles={['doctor', 'admin']}>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reception"
          element={
            <ProtectedRoute allowedRoles={['reception', 'admin']}>
              <ReceptionDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reception/prescriptions"
          element={
            <ProtectedRoute allowedRoles={['reception', 'admin']}>
              <ReceptionDashboard />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/pharmacy" replace />} />
      </Routes>
    </MainLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
