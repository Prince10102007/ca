import React, { useState, useCallback } from 'react';
import * as api from '../api';
import { formatCurrency, downloadBlob } from '../utils/format';

interface OCRResult {
  originalName: string;
  success: boolean;
  data?: any;
  method?: string;
  confidence?: number;
  error?: string;
  warning?: string;
}

export default function OCRPage() {
  const [results, setResults] = useState<OCRResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceAI, setForceAI] = useState(false);
  const [selectedResult, setSelectedResult] = useState<OCRResult | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [tallyUrl, setTallyUrl] = useState('http://localhost:9000');
  const [pushing, setPushing] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      if (files.length === 1) {
        const result = await api.extractInvoice(files[0], forceAI);
        setResults([{ originalName: files[0].name, success: true, ...result }]);
      } else {
        const result = await api.bulkExtractInvoices(Array.from(files), forceAI);
        setResults(result.results || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsProcessing(false);
  }, [forceAI]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'bmp', 'tiff', 'tif'].includes(ext || '');
    });
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      if (files.length === 1) {
        const result = await api.extractInvoice(files[0], forceAI);
        setResults([{ originalName: files[0].name, success: true, ...result }]);
      } else {
        const result = await api.bulkExtractInvoices(files, forceAI);
        setResults(result.results || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsProcessing(false);
  }, [forceAI]);

  const getExtractedInvoices = () => results.filter(r => r.success).map(r => r.data);

  const downloadJSON = () => {
    const data = getExtractedInvoices();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `ocr-extracted-${Date.now()}.json`);
  };

  const handleExport = async (type: string) => {
    const invoices = getExtractedInvoices();
    if (!invoices.length) return;
    setExporting(type);
    try {
      const options = { companyName: companyName || 'My Company' };
      let blob: Blob;
      let filename: string;
      switch (type) {
        case 'tally-purchase':
          blob = await api.exportTallyPurchase(invoices, options);
          filename = `tally-purchase-vouchers-${Date.now()}.xml`;
          break;
        case 'tally-sales':
          blob = await api.exportTallySales(invoices, options);
          filename = `tally-sales-vouchers-${Date.now()}.xml`;
          break;
        case 'tally-ledgers':
          blob = await api.exportTallyLedgers(invoices, { ...options, type: 'purchase' });
          filename = `tally-ledger-masters-${Date.now()}.xml`;
          break;
        case 'excel':
          blob = await api.exportOCRExcel(invoices);
          filename = `ocr-extracted-${Date.now()}.xlsx`;
          break;
        default: return;
      }
      downloadBlob(blob, filename!);
    } catch (err: any) { setError(err.message); }
    setExporting(null);
  };

  const handlePushToTally = async (type: 'purchase' | 'sales' | 'ledgers') => {
    const invoices = getExtractedInvoices();
    if (!invoices.length) return;
    setPushing(type);
    setPushResult(null);
    setError(null);
    try {
      const options = { companyName: companyName || 'My Company' };
      let blob: Blob;
      switch (type) {
        case 'purchase':
          blob = await api.exportTallyPurchase(invoices, options);
          break;
        case 'sales':
          blob = await api.exportTallySales(invoices, options);
          break;
        case 'ledgers':
          blob = await api.exportTallyLedgers(invoices, { ...options, type: 'purchase' });
          break;
      }
      const xml = await blob.text();
      const result = await api.pushToTally(xml, tallyUrl);
      setPushResult(result);
    } catch (err: any) {
      setError(err.message);
    }
    setPushing(null);
  };

  const FIELDS = [
    { key: 'invoiceNo', label: 'Invoice No' }, { key: 'date', label: 'Date' },
    { key: 'sellerName', label: 'Seller' }, { key: 'sellerGSTIN', label: 'Seller GSTIN' },
    { key: 'customerName', label: 'Buyer' }, { key: 'customerGSTIN', label: 'Buyer GSTIN' },
    { key: 'taxableAmount', label: 'Taxable Amt', type: 'number' },
    { key: 'cgst', label: 'CGST', type: 'number' }, { key: 'sgst', label: 'SGST', type: 'number' },
    { key: 'igst', label: 'IGST', type: 'number' }, { key: 'totalAmount', label: 'Total', type: 'number' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Invoice OCR Scanner</h2>
          <p className="text-sm text-gray-500 mt-1">Upload invoice photos or PDFs to auto-extract GST data</p>
        </div>
        {results.length > 0 && (
          <span className="text-xs text-gray-400 font-medium">{results.filter(r => r.success).length} invoices extracted</span>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          </div>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        className={`dropzone p-12 text-center ${dragActive ? 'dropzone-active' : ''}`}
      >
        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-gray-800 font-semibold text-lg mb-1">Drop invoice images or PDFs here</p>
        <p className="text-sm text-gray-400 mb-6">Supported: JPG, PNG, WebP, BMP, TIFF, PDF — Up to 50 files at once</p>
        <label className="btn-primary inline-block px-6 py-3 text-sm cursor-pointer">
          Choose Files
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.bmp,.tiff,.tif" multiple onChange={handleFiles} className="hidden" />
        </label>
        <div className="mt-5 flex items-center justify-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={forceAI} onChange={e => setForceAI(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Force AI extraction (Claude Vision — better for photos/scans)
          </label>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-8 flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-purple-600 font-semibold">Extracting invoice data...</p>
        </div>
      )}

      {results.length > 0 && !isProcessing && (
        <div className="mt-8 space-y-3 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-800">
            Results <span className="text-sm font-normal text-gray-500">({results.filter(r => r.success).length}/{results.length} successful)</span>
          </h3>
          {results.map((r, i) => (
            <div key={i} className={`card p-5 animate-slide-in ${!r.success ? 'border-red-200 bg-red-50/50' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.success ? 'bg-gradient-to-br from-green-100 to-emerald-100' : 'bg-gradient-to-br from-red-100 to-rose-100'}`}>
                    {r.success ? <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      : <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.originalName || `Invoice ${i + 1}`}</p>
                    {r.success && r.data && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.data.invoiceNo && <span className="font-mono">#{r.data.invoiceNo}</span>}{r.data.sellerName && ` — ${r.data.sellerName}`}{r.data.totalAmount > 0 && ` — ${formatCurrency(r.data.totalAmount)}`}
                      </p>
                    )}
                    {!r.success && <p className="text-xs text-red-500 mt-0.5">{r.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.method && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.method === 'claude-vision' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{r.method}</span>}
                  {r.confidence && <span className="text-xs text-gray-400 font-mono">{r.confidence}%</span>}
                  {r.success && <button onClick={() => { setSelectedResult(r); setEditingData(r.data ? { ...r.data } : null); }} className="btn-secondary text-xs px-3 py-1.5">Review</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && results.some(r => r.success) && !isProcessing && (
        <div className="mt-8 animate-fade-in">
          <div className="card p-6 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Tally Company Name</h3>
                <p className="text-xs text-gray-400">Enter the company name as it appears in Tally (for XML export)</p>
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

          <div className="card p-5 mb-5" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdfa 100%)', border: '1px solid #bbf7d0' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-200 to-green-200 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-800">Push Directly to Tally</h3>
                <p className="text-xs text-emerald-600">Auto-import into Tally without manual file selection (requires Tally XML Server)</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handlePushToTally('ledgers')} disabled={pushing === 'ledgers'}
                className="btn-secondary text-xs px-4 py-2.5 disabled:opacity-40">
                {pushing === 'ledgers' ? <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />Pushing...</span> : '1. Push Ledger Masters'}
              </button>
              <button onClick={() => handlePushToTally('purchase')} disabled={pushing === 'purchase'}
                className="btn-primary text-xs px-4 py-2.5 disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
                {pushing === 'purchase' ? <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Pushing...</span> : '2. Push Purchase Vouchers'}
              </button>
              <button onClick={() => handlePushToTally('sales')} disabled={pushing === 'sales'}
                className="btn-primary text-xs px-4 py-2.5 disabled:opacity-40">
                {pushing === 'sales' ? <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Pushing...</span> : '2. Push Sales Vouchers'}
              </button>
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-4">Download & Export</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Tally Purchase Vouchers</h4>
                  <p className="text-xs text-gray-400">Import scanned invoices as purchase entries</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleExport('tally-purchase')} disabled={exporting === 'tally-purchase'}
                  className="flex-1 btn-primary text-xs py-2.5 disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
                  {exporting === 'tally-purchase' ? 'Generating...' : 'Export Purchase XML'}
                </button>
                <button onClick={() => handleExport('tally-ledgers')} disabled={exporting === 'tally-ledgers'}
                  className="btn-secondary text-xs px-3 py-2.5 disabled:opacity-40">
                  {exporting === 'tally-ledgers' ? '...' : 'Ledgers'}
                </button>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Tally Sales Vouchers</h4>
                  <p className="text-xs text-gray-400">Import as sales entries (if scanning own invoices)</p>
                </div>
              </div>
              <button onClick={() => handleExport('tally-sales')} disabled={exporting === 'tally-sales'}
                className="w-full btn-primary text-xs py-2.5 disabled:opacity-40">
                {exporting === 'tally-sales' ? 'Generating...' : 'Export Sales XML'}
              </button>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-teal-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Excel Spreadsheet</h4>
                  <p className="text-xs text-gray-400">Download as .xlsx for manual review or editing</p>
                </div>
              </div>
              <button onClick={() => handleExport('excel')} disabled={exporting === 'excel'}
                className="w-full btn-secondary text-xs py-2.5 disabled:opacity-40">
                {exporting === 'excel' ? 'Generating...' : 'Download Excel'}
              </button>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">JSON Data</h4>
                  <p className="text-xs text-gray-400">Raw extracted data for programmatic use</p>
                </div>
              </div>
              <button onClick={downloadJSON} className="w-full btn-secondary text-xs py-2.5">
                Download JSON
              </button>
            </div>
          </div>

          <div className="mt-5 card-gradient-blue rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-indigo-200 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-indigo-800">How to Import into Tally</h3>
            </div>
            <ol className="text-xs text-indigo-700 space-y-1.5 list-decimal list-inside ml-11">
              <li>First export and import <strong>Ledger Masters XML</strong> (creates supplier/customer ledgers in Tally)</li>
              <li>Then export and import <strong>Purchase/Sales Vouchers XML</strong> (creates invoice entries)</li>
              <li>In Tally: <strong>Gateway &gt; Import Data &gt; Select the XML file</strong></li>
              <li>Verify imported vouchers in Day Book and check party ledger balances</li>
            </ol>
          </div>
        </div>
      )}

      {selectedResult && editingData && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Review Extracted Data</h3>
                <p className="text-sm text-gray-500 mt-0.5">{selectedResult.originalName}</p>
              </div>
              <button onClick={() => { setSelectedResult(null); setEditingData(null); }} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              {FIELDS.map(({ key, label, type }) => (
                <div key={key} className="flex items-center gap-4">
                  <label className="w-32 text-sm text-gray-500 text-right flex-shrink-0 font-medium">{label}</label>
                  <input type={type || 'text'} value={editingData[key] ?? ''}
                    onChange={e => setEditingData((d: any) => ({ ...d, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setSelectedResult(null); setEditingData(null); }} className="btn-secondary px-5 py-2.5 text-sm">Close</button>
              <button onClick={() => { setResults(prev => prev.map(r => r === selectedResult ? { ...r, data: editingData } : r)); setSelectedResult(null); setEditingData(null); }}
                className="btn-primary px-5 py-2.5 text-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
