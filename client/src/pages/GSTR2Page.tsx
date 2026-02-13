import React, { useState, useCallback } from 'react';
import * as api from '../api';
import { formatCurrency } from '../utils/format';
import DataTable from '../components/DataTable';

export default function GSTR2Page() {
  const [purchaseData, setPurchaseData] = useState<any[] | null>(null);
  const [gstr2Data, setGstr2Data] = useState<any[] | null>(null);
  const [purchaseFile, setPurchaseFile] = useState('');
  const [gstr2File, setGstr2File] = useState('');
  const [gstr2Type, setGstr2Type] = useState<'2A' | '2B'>('2B');
  const [result, setResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');

  const handlePurchaseUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadPurchaseRegister(file);
      setPurchaseData(res.data);
      setPurchaseFile(res.fileName);
      setError(null);
    } catch (err: any) { setError(err.message); }
  }, []);

  const handleGSTR2Upload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = gstr2Type === '2A' ? await api.uploadGSTR2A(file) : await api.uploadGSTR2B(file);
      setGstr2Data(res.data);
      setGstr2File(res.fileName);
      setError(null);
    } catch (err: any) { setError(err.message); }
  }, [gstr2Type]);

  const handleReconcile = async () => {
    if (!purchaseData || !gstr2Data) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await api.reconcilePurchase2A2B(purchaseData, gstr2Data);
      setResult(res);
      setActiveTab('summary');
    } catch (err: any) { setError(err.message); }
    setIsProcessing(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900">GSTR-2A/2B ITC Reconciliation</h2>
        <p className="text-sm text-gray-500 mt-1">Match purchase register against GSTR-2A/2B to verify Input Tax Credit</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          </div>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!result && (
        <div>
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <div className={`dropzone p-8 ${purchaseData ? 'upload-success !border-solid' : ''}`}>
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${purchaseData ? 'bg-green-100' : 'bg-indigo-100'}`}>
                  <svg className={`w-6 h-6 ${purchaseData ? 'text-green-600' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Purchase Register</h3>
                  <p className="text-xs text-gray-500">Upload your purchase register (Excel/CSV)</p>
                </div>
              </div>
              {purchaseData ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  {purchaseFile} — {purchaseData.length} records
                </div>
              ) : (
                <label className="btn-primary inline-block px-5 py-2.5 text-sm cursor-pointer">
                  Upload Purchase
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handlePurchaseUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className={`dropzone p-8 ${gstr2Data ? 'upload-success !border-solid' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gstr2Data ? 'bg-green-100' : 'bg-cyan-100'}`}>
                    <svg className={`w-6 h-6 ${gstr2Data ? 'text-green-600' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">GSTR-2A/2B Data</h3>
                    <p className="text-xs text-gray-500">Upload GSTR-{gstr2Type} JSON from GST portal</p>
                  </div>
                </div>
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button onClick={() => setGstr2Type('2A')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${gstr2Type === '2A' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>2A</button>
                  <button onClick={() => setGstr2Type('2B')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${gstr2Type === '2B' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>2B</button>
                </div>
              </div>
              {gstr2Data ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  {gstr2File} — {gstr2Data.length} records
                </div>
              ) : (
                <label className="btn-primary inline-block px-5 py-2.5 text-sm cursor-pointer">
                  Upload GSTR-{gstr2Type}
                  <input type="file" accept=".json" onChange={handleGSTR2Upload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button onClick={handleReconcile} disabled={!purchaseData || !gstr2Data || isProcessing}
              className="btn-primary px-8 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reconciling...
                </span>
              ) : 'Reconcile Purchase vs GSTR-2A/2B'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card card-gradient-blue"><p className="text-xs text-indigo-600 font-medium">ITC Claimed (Books)</p><p className="text-xl font-extrabold text-indigo-700 mt-1">{formatCurrency(result.itcSummary?.claimedITC?.total || 0)}</p></div>
            <div className="stat-card card-gradient-green"><p className="text-xs text-emerald-600 font-medium">ITC Available (2A/2B)</p><p className="text-xl font-extrabold text-emerald-700 mt-1">{formatCurrency(result.itcSummary?.availableITC?.total || 0)}</p></div>
            <div className="stat-card card-gradient-red"><p className="text-xs text-red-600 font-medium">Excess Claimed</p><p className="text-xl font-extrabold text-red-700 mt-1">{formatCurrency(result.itcSummary?.excessClaimed?.total || 0)}</p></div>
            <div className="stat-card card-gradient-amber"><p className="text-xs text-amber-600 font-medium">Unclaimed ITC</p><p className="text-xl font-extrabold text-amber-700 mt-1">{formatCurrency(result.itcSummary?.unclaimed?.total || 0)}</p></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Matched', val: result.summary.matched, bg: 'card-gradient-green', text: 'text-emerald-700', sub: 'text-emerald-600' },
              { label: 'Mismatched', val: result.summary.mismatched, bg: 'card-gradient-red', text: 'text-red-700', sub: 'text-red-600' },
              { label: 'Missing in 2A/2B', val: result.summary.missingInGSTR2, bg: 'card-gradient-amber', text: 'text-amber-700', sub: 'text-amber-600' },
              { label: 'Not in Books', val: result.summary.missingInPurchase, bg: 'card-gradient-purple', text: 'text-purple-700', sub: 'text-purple-600' },
              { label: 'Total', val: result.summary.totalPurchaseInvoices, bg: 'card-gradient-blue', text: 'text-indigo-700', sub: 'text-indigo-600' },
            ].map(({ label, val, bg, text, sub }) => (
              <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-extrabold ${text}`}>{val}</p>
                <p className={`text-xs font-medium ${sub}`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="card rounded-b-none border-b-0">
            <div className="flex overflow-x-auto px-2 pt-2">
              {[
                { key: 'summary', label: 'ITC Details' },
                { key: 'mismatched', label: `Mismatched (${result.mismatched.length})` },
                { key: 'missingIn2A', label: `Missing in 2A/2B (${result.missingInGSTR2.length})` },
                { key: 'unclaimed', label: `Not in Books (${result.missingInPurchase.length})` },
                { key: 'matched', label: `Matched (${result.matched.length})` },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : ''}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card rounded-t-none border-t-0 p-5">
            {activeTab === 'summary' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm data-table">
                  <thead><tr>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right font-bold">Total</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { label: 'ITC Claimed (Books)', data: result.itcSummary?.claimedITC, cls: 'text-indigo-700 font-medium' },
                      { label: 'ITC Available (2A/2B)', data: result.itcSummary?.availableITC, cls: 'text-emerald-700 font-medium' },
                      { label: 'Matched ITC', data: result.itcSummary?.matchedITC, cls: '' },
                      { label: 'Excess Claimed', data: result.itcSummary?.excessClaimed, cls: 'text-red-700 font-semibold' },
                      { label: 'Unclaimed (Available)', data: result.itcSummary?.unclaimed, cls: 'text-amber-700 font-semibold' },
                    ].map(({ label, data, cls }) => data && (
                      <tr key={label}>
                        <td className={`px-4 py-3 ${cls}`}>{label}</td>
                        <td className={`px-4 py-3 text-right ${cls}`}>{formatCurrency(data.igst || 0)}</td>
                        <td className={`px-4 py-3 text-right ${cls}`}>{formatCurrency(data.cgst || 0)}</td>
                        <td className={`px-4 py-3 text-right ${cls}`}>{formatCurrency(data.sgst || 0)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${cls}`}>{formatCurrency(data.total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'mismatched' && (
              <DataTable title="Mismatched Invoices" columns={[
                { key: 'invoiceNo', label: 'Invoice No', render: (_: any, row: any) => row.purchase?.invoiceNo },
                { key: 'supplier', label: 'Supplier GSTIN', render: (_: any, row: any) => row.purchase?.sellerGSTIN || row.purchase?.supplierGSTIN },
                { key: 'purAmt', label: 'Books Amt', render: (_: any, row: any) => formatCurrency(row.purchase?.totalAmount || 0) },
                { key: 'gstr2Amt', label: '2A/2B Amt', render: (_: any, row: any) => formatCurrency(row.gstr2?.totalAmount || 0) },
                { key: 'issues', label: 'Issues', render: (_: any, row: any) => <span className="badge-mismatched text-xs px-2 py-0.5 rounded-full">{row.discrepancies?.length || 0} fields</span> },
              ]} data={result.mismatched} emptyMessage="No mismatches" />
            )}

            {activeTab === 'missingIn2A' && (
              <DataTable title="Missing in GSTR-2A/2B (ITC at Risk)" columns={[
                { key: 'invoiceNo', label: 'Invoice No' },
                { key: 'sellerGSTIN', label: 'Supplier GSTIN', render: (_: any, row: any) => row.sellerGSTIN || row.supplierGSTIN },
                { key: 'sellerName', label: 'Supplier', render: (_: any, row: any) => row.sellerName || row.supplierName },
                { key: 'totalAmount', label: 'Amount', type: 'currency' },
                { key: 'igst', label: 'IGST', type: 'currency' },
                { key: 'cgst', label: 'CGST', type: 'currency' },
              ]} data={result.missingInGSTR2} emptyMessage="All invoices found in 2A/2B" />
            )}

            {activeTab === 'unclaimed' && (
              <DataTable title="In 2A/2B But Not in Books (Unclaimed ITC)" columns={[
                { key: 'invoiceNo', label: 'Invoice No' },
                { key: 'supplierGSTIN', label: 'Supplier GSTIN' },
                { key: 'supplierName', label: 'Supplier' },
                { key: 'totalAmount', label: 'Amount', type: 'currency' },
                { key: 'igst', label: 'IGST', type: 'currency' },
                { key: 'cgst', label: 'CGST', type: 'currency' },
              ]} data={result.missingInPurchase} emptyMessage="No unclaimed ITC" />
            )}

            {activeTab === 'matched' && (
              <DataTable title="Matched Invoices" columns={[
                { key: 'invoiceNo', label: 'Invoice No', render: (_: any, row: any) => row.purchase?.invoiceNo },
                { key: 'supplier', label: 'Supplier', render: (_: any, row: any) => row.purchase?.sellerGSTIN || row.purchase?.supplierGSTIN },
                { key: 'amount', label: 'Amount', render: (_: any, row: any) => formatCurrency(row.purchase?.totalAmount || 0) },
                { key: 'status', label: 'Status', render: () => <span className="badge-matched text-xs px-2.5 py-1 rounded-full">Matched</span> },
              ]} data={result.matched} emptyMessage="No matches" />
            )}
          </div>

          <div className="mt-6">
            <button onClick={() => { setResult(null); setPurchaseData(null); setGstr2Data(null); setPurchaseFile(''); setGstr2File(''); }}
              className="btn-secondary px-5 py-2.5 text-sm">New Reconciliation</button>
          </div>
        </div>
      )}
    </div>
  );
}
