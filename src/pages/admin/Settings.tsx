import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, CheckCircle2 } from 'lucide-react';
import { db } from '../../firebase';
import { ClinicSettingsDoc } from '../public/Home';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';

export const Settings: React.FC = () => {
  const [formData, setFormData] = useState<ClinicSettingsDoc>({
    upiId: 'sandanaclinic@okaxis',
    upiName: 'Dudrucs',
    clinicName: 'Sandana Clinic',
    clinicAddress: '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
    clinicPhone: '+91 98400 11223',
    clinicTimings: 'Mon - Sat: 09:00 AM - 09:00 PM | Sun: 10:00 AM - 02:00 PM',
    medicalName: 'Dudrucs',
    medicalPhone: '919840011224',
    defaultMarginPercent: 20,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'settings', 'clinic'));
        if (snap.exists()) {
          const data = snap.data() as Partial<ClinicSettingsDoc>;
          setFormData((prev) => ({
            ...prev,
            ...data,
            defaultMarginPercent:
              typeof data.defaultMarginPercent === 'number'
                ? data.defaultMarginPercent
                : 20,
          }));
        }
      } catch (err) {
        console.error('Error loading settings/clinic:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (field: keyof ClinicSettingsDoc, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToastSuccess(null);

    const cleanData: ClinicSettingsDoc = {
      upiId: formData.upiId.trim().slice(0, 100),
      upiName: formData.upiName.trim().slice(0, 120),
      clinicName: formData.clinicName.trim().slice(0, 120),
      clinicAddress: formData.clinicAddress.trim().slice(0, 300),
      clinicPhone: formData.clinicPhone.trim().slice(0, 30),
      clinicTimings: formData.clinicTimings.trim().slice(0, 150),
      medicalName: formData.medicalName.trim().slice(0, 120),
      medicalPhone: formData.medicalPhone.trim().slice(0, 30),
      defaultMarginPercent: Math.max(
        0,
        Math.min(500, Number(formData.defaultMarginPercent ?? 20))
      ),
    };

    try {
      await setDoc(doc(db, 'settings', 'clinic'), cleanData, { merge: true });
      setToastSuccess(
        'Settings saved to settings/clinic! UPI QR codes and batch auto-margin suggestions updated.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/clinic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-green-700">
          Admin · Global Clinic, UPI &amp; Marg Pricing Configuration
        </p>
        <h1 className="text-2xl font-bold text-slate-900">
          Clinic, UPI QR &amp; Margin Settings
        </h1>
      </div>

      {toastSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-green-800">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <span>{toastSuccess}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="space-y-4 border-b border-slate-200 pb-6">
          <h2 className="text-base font-bold text-slate-900">
            Dudrucs UPI QR &amp; Default Margin %
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Merchant / Clinic UPI ID *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={formData.upiId}
                onChange={(e) => handleChange('upiId', e.target.value)}
                placeholder="sandanaclinic@okaxis"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                UPI Payee Name *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={formData.upiName}
                onChange={(e) => handleChange('upiName', e.target.value)}
                placeholder="Dudrucs"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Default Margin % (on Cost) *
              </label>
              <input
                type="number"
                required
                min={0}
                max={500}
                step="0.5"
                disabled={loading}
                value={formData.defaultMarginPercent ?? 20}
                onChange={(e) =>
                  handleChange('defaultMarginPercent', Number(e.target.value))
                }
                placeholder="20"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            This UPI ID will be used to generate payment QR codes for Dudrucs billing. The Default Margin % ({formData.defaultMarginPercent ?? 20}%) is used in Pharmacy Stock to auto-suggest a selling price when entering batch purchase cost (`costPrice + costPrice * defaultMarginPercent / 100`).
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Clinic &amp; Medical Store Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Clinic Name *
              </label>
              <input
                type="text"
                required
                value={formData.clinicName}
                onChange={(e) => handleChange('clinicName', e.target.value)}
                placeholder="Sandana Clinic"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Clinic Phone *
              </label>
              <input
                type="text"
                required
                value={formData.clinicPhone}
                onChange={(e) => handleChange('clinicPhone', e.target.value)}
                placeholder="+91 98400 11223"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Clinic Address *
            </label>
            <input
              type="text"
              required
              value={formData.clinicAddress}
              onChange={(e) => handleChange('clinicAddress', e.target.value)}
              placeholder="42, MG Healthcare Road, Anna Nagar, Chennai"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Clinic Timings *
            </label>
            <input
              type="text"
              required
              value={formData.clinicTimings}
              onChange={(e) => handleChange('clinicTimings', e.target.value)}
              placeholder="Mon - Sat: 09:00 AM - 09:00 PM"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Medical Store Name *
              </label>
              <input
                type="text"
                required
                value={formData.medicalName}
                onChange={(e) => handleChange('medicalName', e.target.value)}
                placeholder="Dudrucs"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Medical Store WhatsApp / Phone *
              </label>
              <input
                type="text"
                required
                value={formData.medicalPhone}
                onChange={(e) => handleChange('medicalPhone', e.target.value)}
                placeholder="919840011224"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving Settings...' : 'Save Clinic, UPI & Margin Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
