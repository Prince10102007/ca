import React, { useState, useCallback } from 'react';
import * as api from '../api';
import { formatCurrency } from '../utils/format';

export default function EInvoicePage() {
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [salesFile, setSalesFile] = useState('');
  const [sellerDetails, setSellerDetails] = useState({
    gstin: '', name: '', tradeName: '', address: '', city: '', pincode: '', phone: '', email: ''
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadSalesRegister(file);
      setSalesData(res.data); setSalesFile(res.fileName); setError(null);
    } catch (err: any) { setError(err.message); }
  }, []);

  const handleGenerate = async () => {
    if (!salesData || !sellerDetails.gstin || !sellerDetails.name) {
      setError('Upload sales data and fill seller details (GSTIN & Name required)');
      return;
    }
    setIsProcessing(true); setError(null);
    try {
      const res = await api.generateBulkEInvoices(salesData, sellerDetails);
      setResult(res);
    } catch (err: any) { setError(err.message); }
    setIsProcessing(false);
  };

  const downloadAllJSON = () => {
    if (!result) return;
    const data = result.results.map((r: any) => r.einvoice);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `e-invoices-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900">E-Invoice Generator</h2>
        <p className="text-sm text-gray-500 mt-1">Generate NIC-format e-invoice JSON from your sales data for IRN generation</p>
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
          <div className="card p-6 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Seller Details (Your Company)</h3>
                <p className="text-xs text-gray-400">This information will appear on all generated e-invoices</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { key: 'gstin', label: 'GSTIN *', placeholder: '27AABCU9603R1ZM' },
                { key: 'name', label: 'Legal Name *', placeholder: 'ABC Pvt Ltd' },
                { key: 'tradeName', label: 'Trade Name', placeholder: 'ABC Trading' },
                { key: 'address', label: 'Address', placeholder: '123 MG Road, Andheri' },
                { key: 'city', label: 'City', placeholder: 'Mumbai' },
                { key: 'pincode', label: 'Pincode', placeholder: '400001' },
                { key: 'phone', label: 'Phone', placeholder: '9876543210' },
                { key: 'email', label: 'Email', placeholder: 'abc@company.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">{label}</label>
                  <input value={(sellerDetails as any)[key]}
                    onChange={e => setSellerDetails(s => ({ ...s, [key]: key === 'gstin' ? e.target.value.toUpperCase() : e.target.value }))}
                    placeholder={placeholder}
                    className={`w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ${key === 'gstin' ? 'font-mono' : ''}`} />
                </div>
              ))}
            </div>
          </div>

          <div className={`dropzone p-8 mb-8 ${salesData ? 'upload-success !border-solid' : ''}`}>
            <div className="flex items-center gap-4 mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${salesData ? 'bg-green-100' : 'bg-emerald-100'}`}>
                <svg className={`w-6 h-6 ${salesData ? 'text-green-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Sales Invoices</h3>
                <p className="text-xs text-gray-500">Upload sales register for e-invoice generation</p>
              </div>
            </div>
            {salesData ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                {salesFile} — {salesData.length} invoices
              </div>
            ) : (
              <label className="btn-primary inline-block px-5 py-2.5 text-sm cursor-pointer">
                Upload Sales Data <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
              </label>
            )}
          </div>

          <div className="flex justify-center">
            <button onClick={handleGenerate} disabled={!salesData || isProcessing}
              className="btn-primary px-8 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </span>
              ) : 'Generate E-Invoices'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="stat-card card-gradient-blue text-center"><p className="text-3xl font-extrabold text-indigo-700">{result.totalProcessed}</p><p className="text-xs text-indigo-600 font-medium mt-1">Total Processed</p></div>
            <div className="stat-card card-gradient-green text-center"><p className="text-3xl font-extrabold text-emerald-700">{result.successful}</p><p className="text-xs text-emerald-600 font-medium mt-1">Successful</p></div>
            <div className="stat-card card-gradient-red text-center"><p className="text-3xl font-extrabold text-red-700">{result.failed}</p><p className="text-xs text-red-600 font-medium mt-1">Failed</p></div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="card-gradient-red rounded-xl p-5 mb-5">
              <h3 className="text-sm font-bold text-red-700 mb-3">Validation Errors</h3>
              <div className="space-y-2">
                {result.errors.map((err: any, i: number) => (
                  <div key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <span className="font-mono badge-mismatched text-xs px-2 py-0.5 rounded-full">#{err.invoiceNo || err.index}</span>
                    <span>{err.errors?.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden mb-6">
            <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-indigo-800">Generated E-Invoices</h3>
              <button onClick={downloadAllJSON} className="btn-primary text-xs px-4 py-2">
                Download All JSON
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {result.results?.map((r: any, i: number) => (
                <div key={i} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">{i + 1}</div>
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{r.invoiceNo}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {r.einvoice?.BuyerDtls?.LglNm} — {formatCurrency(r.einvoice?.ValDtls?.TotInvVal || 0)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedInvoice(r.einvoice)}
                    className="btn-secondary text-xs px-3 py-1.5">View JSON</button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { setResult(null); setSalesData(null); }}
            className="btn-secondary px-5 py-2.5 text-sm">Reset</button>
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">E-Invoice JSON</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedInvoice.DocDtls?.No}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">&times;</button>
            </div>
            <pre className="p-5 text-xs font-mono text-gray-700 overflow-auto flex-1 bg-slate-50">
              {JSON.stringify(selectedInvoice, null, 2)}
            </pre>
            <div className="p-5 border-t border-gray-100 flex justify-end">
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(selectedInvoice, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `einvoice-${selectedInvoice.DocDtls?.No}.json`; a.click();
                URL.revokeObjectURL(url);
              }} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download This Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
