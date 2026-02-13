import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  AppState, WizardStep, ReconciliationResult, MatchedInvoice
} from './types';
import { formatCurrency, downloadBlob } from './utils/format';
import * as api from './api';

import StepWizard from './components/StepWizard';
import FileUpload from './components/FileUpload';
import ValidationPanel from './components/ValidationPanel';
import SummaryCards from './components/SummaryCards';
import DataTable from './components/DataTable';
import ComparisonView from './components/ComparisonView';
import { ReconciliationPieChart, MonthlyTrendChart, TopCustomerErrorsChart } from './components/Charts';

import OCRPage from './pages/OCRPage';
import ClientsPage from './pages/ClientsPage';
import GSTR2Page from './pages/GSTR2Page';
import GSTR3BPage from './pages/GSTR3BPage';
import EInvoicePage from './pages/EInvoicePage';
import TallyExportPage from './pages/TallyExportPage';
import DeadlinesPage from './pages/DeadlinesPage';
import SettingsPage from './pages/SettingsPage';

// ─── NAV ITEMS ───
const NAV_ITEMS = [
  { path: '/', label: 'Reconciliation', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { path: '/ocr', label: 'Invoice OCR', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
  { path: '/gstr2', label: 'GSTR-2A/2B', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { path: '/gstr3b', label: 'GSTR-3B', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/einvoice', label: 'E-Invoice', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { path: '/tally', label: 'Tally Export', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  { path: '/clients', label: 'Clients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/deadlines', label: 'Deadlines', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

// ─── SIDEBAR ───
function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`sidebar-gradient flex flex-col transition-all ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="p-4 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse-glow">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-white tracking-tight">TaxStack</h1>
            <p className="text-[10px] text-indigo-200/70 font-medium">GST Compliance Suite</p>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-indigo-300/60 hover:text-white transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'} />
          </svg>
        </button>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'}
            className={({ isActive }) => `nav-link flex items-center gap-3 px-3 py-2.5 text-sm transition ${
              isActive ? 'nav-link-active text-white font-semibold' : 'text-indigo-200/80 hover:text-white'
            }`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <div className="p-3 border-t border-white/10 text-[10px] text-indigo-300/50 text-center">
          TaxStack v2.0 — Built for CAs
        </div>
      )}
    </aside>
  );
}

// ─── RECONCILIATION PAGE (original wizard flow) ───
function ReconciliationPage() {
  const INITIAL_STATE: AppState = {
    currentStep: 'upload', salesData: null, gstr1Data: null, purchaseData: null,
    salesFileName: '', gstr1FileName: '', purchaseFileName: '',
    salesValidation: null, reconciliationResult: null, isProcessing: false, error: null
  };

  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [selectedInvoice, setSelectedInvoice] = useState<MatchedInvoice | null>(null);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  const handleSalesUpload = useCallback(async (file: File) => {
    const result = await api.uploadSalesRegister(file);
    setState(s => ({ ...s, salesData: result.data, salesFileName: result.fileName, salesValidation: result.validation || null, error: null }));
  }, []);

  const handleGSTR1Upload = useCallback(async (file: File) => {
    const result = await api.uploadGSTR1(file);
    setState(s => ({ ...s, gstr1Data: result.data, gstr1FileName: result.fileName, error: null }));
  }, []);

  const handlePurchaseUpload = useCallback(async (file: File) => {
    const result = await api.uploadPurchaseRegister(file);
    setState(s => ({ ...s, purchaseData: result.data, purchaseFileName: result.fileName, error: null }));
  }, []);

  const handleReconcile = useCallback(async () => {
    if (!state.salesData || !state.gstr1Data) return;
    setState(s => ({ ...s, isProcessing: true, error: null }));
    try {
      const result: ReconciliationResult = await api.runReconciliation(state.salesData, state.gstr1Data);
      setState(s => ({ ...s, reconciliationResult: result, currentStep: 'review', isProcessing: false }));
      setActiveTab('summary');
    } catch (err: any) {
      setState(s => ({ ...s, isProcessing: false, error: err.message }));
    }
  }, [state.salesData, state.gstr1Data]);

  const handleExportDiscrepancy = useCallback(async () => {
    if (!state.reconciliationResult) return;
    setExportLoading('discrepancy');
    try {
      const blob = await api.exportDiscrepancyReport(state.reconciliationResult);
      downloadBlob(blob, `GST-Discrepancy-Report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) { setState(s => ({ ...s, error: err.message })); }
    setExportLoading(null);
  }, [state.reconciliationResult]);

  const handleExportCorrectedGSTR1 = useCallback(async () => {
    if (!state.reconciliationResult || !state.salesData) return;
    setExportLoading('gstr1');
    try {
      const blob = await api.exportCorrectedGSTR1(state.reconciliationResult.matched, state.salesData);
      downloadBlob(blob, `Corrected-GSTR1-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) { setState(s => ({ ...s, error: err.message })); }
    setExportLoading(null);
  }, [state.reconciliationResult, state.salesData]);

  const handleExportPDF = useCallback(async () => {
    if (!state.reconciliationResult) return;
    setExportLoading('pdf');
    try {
      const blob = await api.exportPDFSummary(state.reconciliationResult, 'FY 2024-25');
      downloadBlob(blob, `Reconciliation-Summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) { setState(s => ({ ...s, error: err.message })); }
    setExportLoading(null);
  }, [state.reconciliationResult]);

  const handleDownloadTemplate = useCallback(async (type: 'sales' | 'purchase') => {
    const blob = await api.downloadTemplate(type);
    downloadBlob(blob, `${type}-register-template.xlsx`);
  }, []);

  function goToStep(step: WizardStep) { setState(s => ({ ...s, currentStep: step })); }
  function handleReset() { setState(INITIAL_STATE); setSelectedInvoice(null); setActiveTab('summary'); }

  const r = state.reconciliationResult;
  const canReconcile = !!state.salesData && !!state.gstr1Data;

  return (
    <div>
      <StepWizard currentStep={state.currentStep} salesUploaded={!!state.salesData} gstr1Uploaded={!!state.gstr1Data} reconciled={!!state.reconciliationResult} />

      {state.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {state.error}
          </p>
          <button onClick={() => setState(s => ({ ...s, error: null }))} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}

      {/* STEP 1: Upload */}
      {state.currentStep === 'upload' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Upload Your Data Files</h2>
            <div className="flex gap-2">
              <button onClick={() => handleDownloadTemplate('sales')} className="text-xs btn-secondary px-3 py-1.5">Sales Template</button>
              <button onClick={() => handleDownloadTemplate('purchase')} className="text-xs btn-secondary px-3 py-1.5">Purchase Template</button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <FileUpload label="Sales Register" description="Upload your sales register with invoice details" accept={['.xlsx', '.xls', '.csv']} onFileUpload={handleSalesUpload} fileName={state.salesFileName} recordCount={state.salesData?.length} isUploaded={!!state.salesData} />
            <FileUpload label="GSTR-1 Data" description="Upload GSTR-1 JSON or Excel from GST portal" accept={['.json', '.xlsx', '.xls', '.csv']} onFileUpload={handleGSTR1Upload} fileName={state.gstr1FileName} recordCount={state.gstr1Data?.length} isUploaded={!!state.gstr1Data} />
          </div>
          <div className="mt-2">
            <FileUpload label="Purchase Register" description="Upload purchase register for ITC reconciliation" accept={['.xlsx', '.xls', '.csv']} onFileUpload={handlePurchaseUpload} fileName={state.purchaseFileName} recordCount={state.purchaseData?.length} isUploaded={!!state.purchaseData} isOptional />
          </div>
          {state.salesValidation && <ValidationPanel validation={state.salesValidation} fileName={state.salesFileName} />}
          {state.salesData && state.salesData.length > 0 && (
            <div className="mt-4">
              <DataTable title="Sales Register Preview" columns={[
                { key: 'invoiceNo', label: 'Invoice No' }, { key: 'date', label: 'Date' },
                { key: 'customerGSTIN', label: 'GSTIN' }, { key: 'customerName', label: 'Customer' },
                { key: 'taxableAmount', label: 'Taxable', type: 'currency' },
                { key: 'cgst', label: 'CGST', type: 'currency' }, { key: 'sgst', label: 'SGST', type: 'currency' },
                { key: 'igst', label: 'IGST', type: 'currency' }, { key: 'totalAmount', label: 'Total', type: 'currency' },
              ]} data={state.salesData} pageSize={10} />
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button onClick={() => goToStep('process')} disabled={!canReconcile}
              className="px-6 py-2.5 btn-primary px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
              Continue to Reconciliation
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Process */}
      {state.currentStep === 'process' && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto card p-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ready to Reconcile</h2>
            <p className="text-sm text-gray-500 mb-6">
              Match {state.salesData?.length || 0} sales invoices against {state.gstr1Data?.length || 0} GSTR-1 records.
            </p>
            {state.isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-indigo-600 font-medium">Processing invoices...</p>
              </div>
            ) : (
              <div className="flex gap-3 justify-center">
                <button onClick={() => goToStep('upload')} className="px-4 py-2 btn-secondary text-sm">Back</button>
                <button onClick={handleReconcile} className="px-6 py-2.5 btn-primary text-sm">Start Reconciliation</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {state.currentStep === 'review' && r && (
        <div>
          <SummaryCards summary={r.summary} />
          <div className="mt-6 card rounded-b-none border-b-0">
            <div className="flex overflow-x-auto px-2 pt-2">
              {[
                { key: 'summary', label: 'Dashboard', count: 0 },
                { key: 'mismatched', label: 'Mismatched', count: r.mismatched.length },
                { key: 'missing-gstr1', label: 'Missing in GSTR-1', count: r.missingSalesInGSTR1.length },
                { key: 'missing-sales', label: 'Extra in GSTR-1', count: r.missingGSTR1InSales.length },
                { key: 'matched', label: 'Matched', count: r.matched.length },
                { key: 'validation', label: 'Validation Issues', count: r.validationIssues.length },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : ''}`}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                      ${tab.key === 'matched' ? 'badge-matched' : ''}
                      ${tab.key === 'mismatched' || tab.key === 'validation' ? 'badge-mismatched' : ''}
                      ${tab.key === 'missing-gstr1' || tab.key === 'missing-sales' ? 'badge-missing' : ''}
                    `}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="card rounded-t-none border-t-0 p-5">
            {activeTab === 'summary' && (
              <div className="grid md:grid-cols-2 gap-4">
                <ReconciliationPieChart result={r} />
                <MonthlyTrendChart result={r} />
                <div className="md:col-span-2"><TopCustomerErrorsChart result={r} /></div>
              </div>
            )}
            {activeTab === 'mismatched' && (
              <DataTable title="Mismatched Invoices" columns={[
                { key: 'invoiceNo', label: 'Invoice No' },
                { key: 'salesInvoice', label: 'Date', render: (_: any, row: any) => row.salesInvoice?.date || '-' },
                { key: 'customerGSTIN', label: 'GSTIN', render: (_: any, row: any) => row.salesInvoice?.customerGSTIN || '-' },
                { key: 'customerName', label: 'Customer', render: (_: any, row: any) => row.salesInvoice?.customerName || '-' },
                { key: 'salesTotalAmount', label: 'Sales Amt', render: (_: any, row: any) => formatCurrency(row.salesInvoice?.totalAmount || 0) },
                { key: 'gstr1TotalAmount', label: 'GSTR-1 Amt', render: (_: any, row: any) => formatCurrency(row.gstr1Invoice?.totalAmount || 0) },
                { key: 'totalDifference', label: 'Difference', type: 'currency' },
                { key: 'discrepancies', label: 'Issues', render: (val: any) => <span className="text-xs text-red-600">{val?.length || 0} fields</span> },
              ]} data={r.mismatched} onRowClick={(row: any) => setSelectedInvoice(row)} emptyMessage="No mismatched invoices found" />
            )}
            {activeTab === 'missing-gstr1' && (
              <DataTable title="Missing in GSTR-1" columns={[
                { key: 'invoiceNo', label: 'Invoice No' }, { key: 'date', label: 'Date' },
                { key: 'customerGSTIN', label: 'GSTIN' }, { key: 'customerName', label: 'Customer' },
                { key: 'taxableAmount', label: 'Taxable', type: 'currency' }, { key: 'totalAmount', label: 'Total', type: 'currency' },
                { key: 'suggestion', label: 'Action' },
              ]} data={r.missingSalesInGSTR1} emptyMessage="All sales invoices are present in GSTR-1" />
            )}
            {activeTab === 'missing-sales' && (
              <DataTable title="Extra in GSTR-1" columns={[
                { key: 'invoiceNo', label: 'Invoice No' }, { key: 'date', label: 'Date' },
                { key: 'customerGSTIN', label: 'GSTIN' }, { key: 'taxableAmount', label: 'Taxable', type: 'currency' },
                { key: 'totalAmount', label: 'Total', type: 'currency' }, { key: 'suggestion', label: 'Action' },
              ]} data={r.missingGSTR1InSales} emptyMessage="No extra invoices in GSTR-1" />
            )}
            {activeTab === 'matched' && (
              <DataTable title="Matched Invoices" columns={[
                { key: 'invoiceNo', label: 'Invoice No' },
                { key: 'date', label: 'Date', render: (_: any, row: any) => row.salesInvoice?.date || '-' },
                { key: 'customerGSTIN', label: 'GSTIN', render: (_: any, row: any) => row.salesInvoice?.customerGSTIN || '-' },
                { key: 'customerName', label: 'Customer', render: (_: any, row: any) => row.salesInvoice?.customerName || '-' },
                { key: 'totalAmount', label: 'Amount', render: (_: any, row: any) => formatCurrency(row.salesInvoice?.totalAmount || 0) },
                { key: 'matchType', label: 'Match', render: (val: any) => <span className={`text-xs px-2 py-0.5 rounded-full ${val === 'exact' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{val}</span> },
              ]} data={r.matched} onRowClick={(row: any) => setSelectedInvoice(row)} emptyMessage="No matched invoices" />
            )}
            {activeTab === 'validation' && (
              <DataTable title="Validation Issues" columns={[
                { key: 'invoiceNo', label: 'Invoice No' },
                { key: 'type', label: 'Issue Type', render: (val: any) => <span className="text-xs font-mono">{val?.replace(/_/g, ' ')}</span> },
                { key: 'message', label: 'Details' }, { key: 'severity', label: 'Severity', type: 'severity' },
              ]} data={r.validationIssues} emptyMessage="No validation issues found" />
            )}
          </div>
          <div className="mt-6 flex gap-3 justify-between">
            <button onClick={() => goToStep('upload')} className="px-4 py-2 btn-secondary text-sm">Upload New Files</button>
            <button onClick={() => goToStep('export')} className="px-6 py-2.5 btn-primary text-sm">Export Reports</button>
          </div>
        </div>
      )}

      {/* STEP 4: Export */}
      {state.currentStep === 'export' && r && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Export Reports</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { key: 'discrepancy', label: 'Discrepancy Report', desc: 'Detailed Excel with all mismatches, missing, validation issues', color: 'red', handler: handleExportDiscrepancy, btnText: 'Download Excel' },
              { key: 'gstr1', label: 'Corrected GSTR-1', desc: 'Excel with B2B and B2CL data for GSTR-1 filing', color: 'green', handler: handleExportCorrectedGSTR1, btnText: 'Download GSTR-1' },
              { key: 'pdf', label: 'PDF Summary', desc: 'Professional summary for client review', color: 'blue', handler: handleExportPDF, btnText: 'Download PDF' },
            ].map(e => (
              <div key={e.key} className="card p-6">
                <h3 className="text-base font-semibold text-gray-800 mb-1">{e.label}</h3>
                <p className="text-sm text-gray-500 mb-4">{e.desc}</p>
                <button onClick={e.handler} disabled={exportLoading === e.key}
                  className={`w-full px-4 py-2 bg-${e.color}-600 text-white text-sm font-medium rounded-lg hover:bg-${e.color}-700 disabled:bg-gray-300 transition`}>
                  {exportLoading === e.key ? 'Generating...' : e.btnText}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => goToStep('review')} className="px-4 py-2 btn-secondary text-sm">Back to Review</button>
            <button onClick={handleReset} className="px-4 py-2 btn-secondary text-sm">New Session</button>
          </div>
        </div>
      )}

      {selectedInvoice && <ComparisonView item={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-8 py-8">
            <div className="page-content animate-fade-in">
              <Routes>
                <Route path="/" element={<ReconciliationPage />} />
                <Route path="/ocr" element={<OCRPage />} />
                <Route path="/gstr2" element={<GSTR2Page />} />
                <Route path="/gstr3b" element={<GSTR3BPage />} />
                <Route path="/einvoice" element={<EInvoicePage />} />
                <Route path="/tally" element={<TallyExportPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/deadlines" element={<DeadlinesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
