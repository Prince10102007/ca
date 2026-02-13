import React, { useState, useCallback } from 'react';
import * as api from '../api';
import { formatCurrency } from '../utils/format';

export default function GSTR3BPage() {
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [purchaseData, setPurchaseData] = useState<any[] | null>(null);
  const [salesFile, setSalesFile] = useState('');
  const [purchaseFile, setPurchaseFile] = useState('');
  const [period, setPeriod] = useState('');
  const [gstin, setGstin] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSalesUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadSalesRegister(file);
      setSalesData(res.data); setSalesFile(res.fileName); setError(null);
    } catch (err: any) { setError(err.message); }
  }, []);

  const handlePurchaseUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadPurchaseRegister(file);
      setPurchaseData(res.data); setPurchaseFile(res.fileName); setError(null);
    } catch (err: any) { setError(err.message); }
  }, []);

  const handleCompute = async () => {
    if (!salesData) return;
    setIsProcessing(true); setError(null);
    try {
      const res = await api.computeGSTR3B({ salesData, purchaseData: purchaseData || [], period });
      setResult(res);
    } catch (err: any) { setError(err.message); }
    setIsProcessing(false);
  };

  const handleDownloadJSON = async () => {
    if (!result || !gstin || !period) { setError('Enter GSTIN and period to generate JSON'); return; }
    try {
      const json = await api.generateGSTR3BJSON(result, gstin, period.replace('-', ''));
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `GSTR3B-${period}-${gstin}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { setError(err.message); }
  };

  const TaxRow = ({ label, data, cls = '' }: { label: string; data: any; cls?: string }) => (
    <tr>
      <td className={`px-4 py-3 text-sm ${cls}`}>{label}</td>
      <td className={`px-4 py-3 text-right text-sm ${cls}`}>{formatCurrency(data?.taxableAmount || 0)}</td>
      <td className={`px-4 py-3 text-right text-sm ${cls}`}>{formatCurrency(data?.igst || 0)}</td>
      <td className={`px-4 py-3 text-right text-sm ${cls}`}>{formatCurrency(data?.cgst || 0)}</td>
      <td className={`px-4 py-3 text-right text-sm ${cls}`}>{formatCurrency(data?.sgst || 0)}</td>
      <td className={`px-4 py-3 text-right text-sm ${cls}`}>{formatCurrency(data?.cess || 0)}</td>
    </tr>
  );

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900">GSTR-3B Auto-Computation</h2>
        <p className="text-sm text-gray-500 mt-1">Auto-compute GSTR-3B from your sales and purchase data</p>
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
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-gray-600 block mb-1.5 font-medium">Period (e.g., 01-2024)</label>
              <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="01-2024"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1.5 font-medium">GSTIN</label>
              <input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="27AABCU9603R1ZM"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-mono" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <div className={`dropzone p-8 ${salesData ? 'upload-success !border-solid' : ''}`}>
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${salesData ? 'bg-green-100' : 'bg-indigo-100'}`}>
                  <svg className={`w-6 h-6 ${salesData ? 'text-green-600' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Sales / GSTR-1 Data *</h3>
                  <p className="text-xs text-gray-500">For outward supply computation (Table 3.1)</p>
                </div>
              </div>
              {salesData ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  {salesFile} — {salesData.length} records
                </div>
              ) : (
                <label className="btn-primary inline-block px-5 py-2.5 text-sm cursor-pointer">
                  Upload Sales Data <input type="file" accept=".xlsx,.xls,.csv" onChange={handleSalesUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className={`dropzone p-8 ${purchaseData ? 'upload-success !border-solid' : ''}`}>
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${purchaseData ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <svg className={`w-6 h-6 ${purchaseData ? 'text-green-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Purchase / GSTR-2B Data</h3>
                  <p className="text-xs text-gray-500">For ITC computation (Table 4) — Optional</p>
                </div>
              </div>
              {purchaseData ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  {purchaseFile} — {purchaseData.length} records
                </div>
              ) : (
                <label className="btn-secondary inline-block px-5 py-2.5 text-sm cursor-pointer">
                  Upload Purchase Data <input type="file" accept=".xlsx,.xls,.csv" onChange={handlePurchaseUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button onClick={handleCompute} disabled={!salesData || isProcessing}
              className="btn-primary px-8 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Computing...
                </span>
              ) : 'Compute GSTR-3B'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card card-gradient-red"><p className="text-xs text-red-600 font-medium">Total Liability</p><p className="text-xl font-extrabold text-red-700 mt-1">{formatCurrency(result.summary?.totalOutwardLiability?.total || 0)}</p></div>
            <div className="stat-card card-gradient-green"><p className="text-xs text-emerald-600 font-medium">Total ITC</p><p className="text-xl font-extrabold text-emerald-700 mt-1">{formatCurrency(result.summary?.totalITC || 0)}</p></div>
            <div className="stat-card card-gradient-blue"><p className="text-xs text-indigo-600 font-medium">Net Payable (Cash)</p><p className="text-xl font-extrabold text-indigo-700 mt-1">{formatCurrency(result.summary?.netPayable || 0)}</p></div>
            <div className="stat-card card-gradient-purple"><p className="text-xs text-purple-600 font-medium">ITC Utilized</p><p className="text-xl font-extrabold text-purple-700 mt-1">{formatCurrency(result.summary?.totalITCUtilized?.total || 0)}</p></div>
          </div>

          {/* Table 3.1 */}
          <div className="card mb-4 overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <h3 className="text-sm font-bold text-indigo-800">Table 3.1 — Outward Supplies</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead><tr>
                  <th className="px-4 py-3 text-left">Nature of Supply</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">Cess</th>
                </tr></thead>
                <tbody>
                  <TaxRow label="(a) Outward Taxable" data={result.table3_1?.taxable} />
                  <TaxRow label="(b) Zero Rated" data={result.table3_1?.zeroRated} />
                  <TaxRow label="(c) Nil/Exempt" data={result.table3_1?.nilRatedExempt} />
                  <TaxRow label="(d) Reverse Charge" data={result.table3_1?.reverseCharge} />
                  <TaxRow label="(e) Non-GST" data={result.table3_1?.nonGST} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4 */}
          <div className="card mb-4 overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <h3 className="text-sm font-bold text-green-800">Table 4 — Eligible ITC</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead><tr>
                  <th className="px-4 py-3 text-left">Details</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">Cess</th>
                </tr></thead>
                <tbody>
                  {[
                    { label: 'All Other ITC', data: result.table4?.allOther },
                    { label: 'Reverse Charge', data: result.table4?.reverseCharge },
                    { label: 'Import of Goods', data: result.table4?.importGoods },
                    { label: 'Total Available', data: result.table4?.totalAvailable, cls: 'font-semibold text-emerald-700' },
                    { label: 'Net ITC', data: result.table4?.netITC, cls: 'font-bold text-emerald-800 bg-emerald-50' },
                  ].map(({ label, data, cls }) => data && (
                    <tr key={label}>
                      <td className={`px-4 py-3 ${cls || ''}`}>{label}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.igst || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.cgst || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.sgst || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.cess || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 6 */}
          <div className="card mb-6 overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100">
              <h3 className="text-sm font-bold text-red-800">Table 6 — Tax Payment</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead><tr>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">Cess</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {[
                    { label: 'Tax Liability', data: result.table6?.liability },
                    { label: 'ITC Utilized', data: result.table6?.itcUtilized, cls: 'text-emerald-700 font-medium' },
                    { label: 'Cash Payable', data: result.table6?.cashPayable, cls: 'font-bold text-red-700 bg-red-50' },
                    { label: 'ITC Balance c/f', data: result.table6?.itcBalance, cls: 'text-indigo-700 font-medium' },
                  ].map(({ label, data, cls }) => data && (
                    <tr key={label}>
                      <td className={`px-4 py-3 ${cls || ''}`}>{label}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.igst || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.cgst || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.sgst || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.cess || 0)}</td>
                      <td className={`px-4 py-3 text-right ${cls || ''}`}>{formatCurrency(data.total || (data.igst + data.cgst + data.sgst + (data.cess || 0)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setResult(null); setSalesData(null); setPurchaseData(null); }}
              className="btn-secondary px-5 py-2.5 text-sm">Reset</button>
            <button onClick={handleDownloadJSON}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download GSTR-3B JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
