import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getDeadlines(months);
        setDeadlines(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, [months]);

  const getStatusStyle = (d: any) => {
    if (d.isOverdue) return { card: 'card-gradient-red', icon: 'bg-red-200 text-red-700', text: 'text-red-700', badge: 'badge-mismatched' };
    if (d.daysRemaining <= 5) return { card: 'card-gradient-amber', icon: 'bg-amber-200 text-amber-700', text: 'text-amber-700', badge: 'badge-missing' };
    if (d.daysRemaining <= 15) return { card: 'bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200', icon: 'bg-yellow-200 text-yellow-700', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700 font-semibold' };
    return { card: 'card-gradient-green', icon: 'bg-emerald-200 text-emerald-700', text: 'text-emerald-700', badge: 'badge-matched' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">GST Filing Deadlines</h2>
          <p className="text-sm text-gray-500 mt-1">Track upcoming deadlines and avoid late fees</p>
        </div>
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {[3, 6, 12].map(m => (
            <button key={m} onClick={() => setMonths(m)}
              className={`px-4 py-2 text-xs rounded-lg font-medium transition ${months === m ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {m} months
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-gray-600 font-semibold">No deadlines found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deadlines.map((d, i) => {
            const style = getStatusStyle(d);
            return (
              <div key={i} className={`${style.card} rounded-2xl p-5 animate-slide-in`} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.icon}`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${style.text}`}>{d.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Period: {d.period}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-extrabold ${style.text}`}>{d.dueDate}</p>
                    <span className={`inline-block text-xs px-3 py-1 rounded-full mt-1.5 ${style.badge}`}>
                      {d.isOverdue ? `${Math.abs(d.daysRemaining)} days overdue` : `${d.daysRemaining} days left`}
                    </span>
                  </div>
                </div>
                {d.penalty && (
                  <p className="text-xs text-gray-500 mt-3 ml-16">
                    Penalty: {d.penalty}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 card-gradient-blue rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-200 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-sm font-bold text-indigo-800">Important Notes</h3>
        </div>
        <ul className="text-xs text-indigo-700 space-y-2 ml-13">
          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />GSTR-1 due by 11th of next month (outward supplies)</li>
          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />GSTR-3B due by 20th of next month (summary + tax payment)</li>
          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />QRMP taxpayers can use IFF by 13th for B2B invoices</li>
          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />Late fee: Rs.50/day CGST + Rs.50/day SGST (max Rs.5000 each for nil returns)</li>
          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />Interest on late tax payment: 18% per annum</li>
          <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />GSTR-9 (Annual) due by 31st December of next FY</li>
        </ul>
      </div>
    </div>
  );
}
