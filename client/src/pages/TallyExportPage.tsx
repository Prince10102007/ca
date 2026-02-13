import React, { useState, useCallback } from 'react';
import * as api from '../api';
import { downloadBlob } from '../utils/format';

export default function TallyExportPage() {
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [purchaseData, setPurchaseData] = useState<any[] | null>(null);
  const [salesFile, setSalesFile] = useState('');
  const [purchaseFile, setPurchaseFile] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [tallyUrl, setTallyUrl] = useState('http://localhost:9000');
  const [pushing, setPushing] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleExport = async (type: string) => {
    setExporting(type);
    setError(null);
    try {
      const options = { companyName: companyName || 'My Company' };
      let blob: Blob;
      let filename: string;

      switch (type) {
        case 'sales':
          if (!salesData) { setError('Upload sales data first'); setExporting(null); return; }
          blob = await api.exportTallySales(salesData, options);
          filename = `tally-sales-vouchers-${Date.now()}.xml`;
          break;
        case 'purchase':
          if (!purchaseData) { setError('Upload purchase data first'); setExporting(null); return; }
          blob = await api.exportTallyPurchase(purchaseData, options);
          filename = `tally-purchase-vouchers-${Date.now()}.xml`;
          break;
        case 'ledgers-sales':
          if (!salesData) { setError('Upload sales data first'); setExporting(null); return; }
          blob = await api.exportTallyLedgers(salesData, { ...options, type: 'sales' });
          filename = `tally-customer-ledgers-${Date.now()}.xml`;
          break;
        case 'ledgers-purchase':
          if (!purchaseData) { setError('Upload purchase data first'); setExporting(null); return; }
          blob = await api.exportTallyLedgers(purchaseData, { ...options, type: 'purchase' });
          filename = `tally-vendor-ledgers-${Date.now()}.xml`;
          break;
        default:
          setExporting(null); return;
      }
      downloadBlob(blob, filename!);
    } catch (err: any) { setError(err.message); }
    setExporting(null);
  };

  const handlePush = async (type: string) => {
    setPushing(type);
    setPushResult(null);
    setError(null);
    try {
      const options = { companyName: companyName || 'My Company' };
      let blob: Blob;
      switch (type) {
        case 'sales':
          if (!salesData) { setError('Upload sales data first'); setPushing(null); return; }
          blob = await api.exportTallySales(salesData, options);
          break;
        case 'purchase':
          if (!purchaseData) { setError('Upload purchase data first'); setPushing(null); return; }
          blob = await api.exportTallyPurchase(purchaseData, options);
          break;
        case 'ledgers-sales':
          if (!salesData) { setError('Upload sales data first'); setPushing(null); return; }
          blob = await api.exportTallyLedgers(salesData, { ...options, type: 'sales' });
          break;
        case 'ledgers-purchase':
          if (!purchaseData) { setError('Upload purchase data first'); setPushing(null); return; }
          blob = await api.exportTallyLedgers(purchaseData, { ...options, type: 'purchase' });
          break;
        default: setPushing(null); return;
      }
      const xml = await blob.text();
      const result = await api.pushToTally(xml, tallyUrl);
      setPushResult(result);
    } catch (err: any) { setError(err.message); }
    setPushing(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900">Tally XML Export</h2>
        <p className="text-sm text-gray-500 mt-1">Generate Tally-compatible XML vouchers for bulk import into Tally ERP 9 / Prime</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          </div>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="card p-5 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <label className="text-sm text-gray-700 font-semibold">Tally Company Name</label>
            <p className="text-xs text-gray-400">Enter the company name as it appears in Tally</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1 font-medium">Company Name</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Enter your Tally company name"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1 font-medium">Tally XML Server URL</label>
            <input value={tallyUrl} onChange={e => setTallyUrl(e.target.value)} placeholder="http://localhost:9000"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition" />
          </div>
        </div>
      </div>

      {pushResult && (
        <div className={`mb-5 p-4 rounded-xl flex items-center gap-3 animate-fade-in ${pushResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${pushResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
            {pushResult.success
              ? <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              : <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>}
          </div>
          <p className={`text-sm ${pushResult.success ? 'text-green-700' : 'text-red-700'}`}>{pushResult.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <div className={`dropzone p-8 ${salesData ? 'upload-success !border-solid' : ''}`}>
          <div className="flex items-center gap-4 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${salesData ? 'bg-green-100' : 'bg-blue-100'}`}>
              <svg className={`w-6 h-6 ${salesData ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Sales Register</h3>
              <p className="text-xs text-gray-500">For sales voucher XML generation</p>
            </div>
          </div>
          {salesData ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {salesFile} — {salesData.length} invoices
            </div>
          ) : (
            <label className="btn-primary inline-block px-5 py-2.5 text-sm cursor-pointer">
              Upload Sales <input type="file" accept=".xlsx,.xls,.csv" onChange={handleSalesUpload} className="hidden" />
            </label>
          )}
        </div>

        <div className={`dropzone p-8 ${purchaseData ? 'upload-success !border-solid' : ''}`}>
          <div className="flex items-center gap-4 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${purchaseData ? 'bg-green-100' : 'bg-orange-100'}`}>
              <svg className={`w-6 h-6 ${purchaseData ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Purchase Register</h3>
              <p className="text-xs text-gray-500">For purchase voucher XML generation</p>
            </div>
          </div>
          {purchaseData ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {purchaseFile} — {purchaseData.length} invoices
            </div>
          ) : (
            <label className="btn-secondary inline-block px-5 py-2.5 text-sm cursor-pointer">
              Upload Purchase <input type="file" accept=".xlsx,.xls,.csv" onChange={handlePurchaseUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Sales Vouchers XML</h3>
              <p className="text-xs text-gray-400">Import sales invoices as vouchers in Tally</p>
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => handleExport('sales')} disabled={!salesData || exporting === 'sales'}
              className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-40">
              {exporting === 'sales' ? 'Generating...' : 'Download XML'}
            </button>
            <button onClick={() => handleExport('ledgers-sales')} disabled={!salesData || exporting === 'ledgers-sales'}
              className="btn-secondary text-sm px-4 py-2.5 disabled:opacity-40">
              {exporting === 'ledgers-sales' ? '...' : 'Ledgers'}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handlePush('ledgers-sales')} disabled={!salesData || pushing === 'ledgers-sales'}
              className="flex-1 btn-secondary text-xs py-2 disabled:opacity-40">
              {pushing === 'ledgers-sales' ? 'Pushing...' : 'Push Ledgers to Tally'}
            </button>
            <button onClick={() => handlePush('sales')} disabled={!salesData || pushing === 'sales'}
              className="flex-1 text-xs py-2 disabled:opacity-40 rounded-xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
              {pushing === 'sales' ? 'Pushing...' : 'Push to Tally'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Purchase Vouchers XML</h3>
              <p className="text-xs text-gray-400">Import purchase invoices as vouchers in Tally</p>
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => handleExport('purchase')} disabled={!purchaseData || exporting === 'purchase'}
              className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
              {exporting === 'purchase' ? 'Generating...' : 'Download XML'}
            </button>
            <button onClick={() => handleExport('ledgers-purchase')} disabled={!purchaseData || exporting === 'ledgers-purchase'}
              className="btn-secondary text-sm px-4 py-2.5 disabled:opacity-40">
              {exporting === 'ledgers-purchase' ? '...' : 'Ledgers'}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handlePush('ledgers-purchase')} disabled={!purchaseData || pushing === 'ledgers-purchase'}
              className="flex-1 btn-secondary text-xs py-2 disabled:opacity-40">
              {pushing === 'ledgers-purchase' ? 'Pushing...' : 'Push Ledgers to Tally'}
            </button>
            <button onClick={() => handlePush('purchase')} disabled={!purchaseData || pushing === 'purchase'}
              className="flex-1 text-xs py-2 disabled:opacity-40 rounded-xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
              {pushing === 'purchase' ? 'Pushing...' : 'Push to Tally'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 card-gradient-blue rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-indigo-200 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-sm font-bold text-indigo-800">How to Import in Tally</h3>
        </div>
        <ol className="text-xs text-indigo-700 space-y-1.5 list-decimal list-inside ml-11">
          <li><strong>Push to Tally (recommended):</strong> Enable XML Server in Tally (F12 &gt; Advanced Config &gt; Enable XML Server = Yes), then use "Push to Tally" buttons</li>
          <li><strong>Manual import:</strong> Download XML, then in Tally: Gateway &gt; Import Data &gt; Select the XML file</li>
          <li>Always import Ledger Masters first, then Vouchers</li>
          <li>Verify imported vouchers in Day Book</li>
        </ol>
      </div>
    </div>
  );
}
