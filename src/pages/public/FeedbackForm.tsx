import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection } from 'firebase/firestore';
import { CheckCircle2 } from 'lucide-react';
import { db } from '../../firebase';
import { StarRating } from '../../components/StarRating';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';

export const FeedbackForm: React.FC = () => {
  const [patientName, setPatientName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!patientName.trim() || !comment.trim()) {
      setErrorMsg('Please enter your name and feedback comment.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patientName: patientName.trim().slice(0, 120),
        rating: Number(rating),
        comment: comment.trim().slice(0, 1000),
        doctorId: '',
        isApproved: false,
        createdAt: new Date().toISOString(),
      };
      try {
        const docRef = await addDoc(collection(db, 'feedback'), payload);
        await saveRecordToSql('feedback', docRef.id, payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'feedback');
      }
      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
            <CheckCircle2 size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Thank you, pending admin approval
          </h1>
          <p className="text-sm text-slate-600">
            We appreciate your feedback for Sandana Clinic &amp; Dudrucs Medical Store. Once reviewed by our clinic administrator, it will appear on the public home page.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setPatientName('');
                setComment('');
                setRating(5);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Submit Another Review
            </button>
            <Link
              to="/"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1 border-b border-slate-100 pb-4">
          <p className="text-xs font-semibold text-green-700">Patient Experience</p>
          <h1 className="text-2xl font-bold text-slate-900">Share Your Feedback</h1>
          <p className="text-xs text-slate-500">
            Rate your consultation at Sandana Clinic or pharmacy service at Dudrucs.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Your Name *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Priya Natarajan"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Star Rating (1 to 5) *
            </label>
            <div className="flex items-center gap-3">
              <StarRating rating={rating} onChange={setRating} size={28} />
              <span className="text-xs font-mono font-semibold text-slate-700">
                {rating} / 5 Stars
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Your Review / Comments *
            </label>
            <textarea
              required
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about the doctor consultation, waiting time, or Dudrucs pharmacy service..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Submitting Feedback...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
};
