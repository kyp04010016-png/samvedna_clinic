import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { Check, X, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { FeedbackDoc } from '../public/Home';
import { StarRating } from '../../components/StarRating';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';

export const Feedback: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'feedback'));
      const list: FeedbackDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FeedbackDoc, 'id'>),
      }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setFeedbacks(list);
    } catch (err) {
      console.error('Error loading feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const handleToggleApprove = async (item: FeedbackDoc) => {
    try {
      await updateDoc(doc(db, 'feedback', item.id), {
        isApproved: !item.isApproved,
      });
      await loadFeedback();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `feedback/${item.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'feedback', id));
      await loadFeedback();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `feedback/${id}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-green-700">Admin · Moderation</p>
        <h1 className="text-2xl font-bold text-slate-900">Patient Feedback Approval</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Approve verified patient reviews to publish them on the Sandana Clinic public homepage.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading patient feedback...
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No patient feedback entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Patient</th>
                  <th className="py-3 px-4 font-semibold">Rating</th>
                  <th className="py-3 px-4 font-semibold">Comment</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feedbacks.map((fb) => (
                  <tr key={fb.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{fb.patientName}</p>
                      <p className="font-mono text-slate-400">
                        {fb.createdAt ? fb.createdAt.split('T')[0] : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StarRating rating={fb.rating} readonly size={14} />
                    </td>
                    <td className="py-3.5 px-4 max-w-md text-slate-700">
                      {fb.comment}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={
                          fb.isApproved
                            ? 'text-green-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {fb.isApproved ? 'Approved (Public)' : 'Pending Approval'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleApprove(fb)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold ${
                          fb.isApproved
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {fb.isApproved ? <X size={13} /> : <Check size={13} />}
                        {fb.isApproved ? 'Unapprove' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(fb.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md font-medium"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
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
