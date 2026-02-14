/**
 * API Client for GST Reconciliation Server
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

async function request(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res;
}

// ─── Upload APIs ───

export async function uploadSalesRegister(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request('/upload/sales', { method: 'POST', body: formData });
  return res.json();
}

export async function uploadGSTR1(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request('/upload/gstr1', { method: 'POST', body: formData });
  return res.json();
}

export async function uploadPurchaseRegister(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request('/upload/purchase', { method: 'POST', body: formData });
  return res.json();
}

// ─── Reconciliation ───

export async function runReconciliation(salesData: any[], gstr1Data: any[], options?: any) {
  const res = await request('/reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salesData, gstr1Data, options })
  });
  return res.json();
}

// ─── Sessions ───

export async function getSessions() {
  const res = await request('/sessions');
  return res.json();
}

export async function getSession(id: string) {
  const res = await request(`/session/${id}`);
  return res.json();
}

// ─── Export APIs ───

export async function exportDiscrepancyReport(reconciliationResult: any) {
  const res = await fetch(`${API_BASE}/export/discrepancy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reconciliationResult })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function exportCorrectedGSTR1(matchedInvoices: any[], salesData: any[]) {
  const res = await fetch(`${API_BASE}/export/corrected-gstr1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchedInvoices, salesData })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function exportPDFSummary(reconciliationResult: any, period?: string) {
  const res = await fetch(`${API_BASE}/export/pdf-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reconciliationResult, period })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

// ─── Templates ───

export async function downloadTemplate(type: 'sales' | 'purchase') {
  const res = await fetch(`${API_BASE}/template/${type}`);
  if (!res.ok) throw new Error('Download failed');
  return res.blob();
}

// ─── GSTIN Validation ───

export async function validateGSTIN(gstin: string) {
  const res = await request('/validate/gstin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gstin })
  });
  return res.json();
}

// ─── OCR APIs ───

function getAnthropicKey(): string | null {
  try {
    const settings = JSON.parse(localStorage.getItem('taxstack_settings') || '{}');
    return settings.anthropicKey || null;
  } catch { return null; }
}

export async function extractInvoice(file: File, forceAI = false) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('forceAI', String(forceAI));
  const headers: Record<string, string> = {};
  const apiKey = getAnthropicKey();
  if (apiKey) headers['x-anthropic-key'] = apiKey;
  const res = await fetch(`${API_BASE}/ocr/extract`, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function bulkExtractInvoices(files: File[], forceAI = false) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('forceAI', String(forceAI));
  const headers: Record<string, string> = {};
  const apiKey = getAnthropicKey();
  if (apiKey) headers['x-anthropic-key'] = apiKey;
  const res = await fetch(`${API_BASE}/ocr/bulk-extract`, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── OCR Export APIs ───

export async function exportOCRExcel(invoices: any[]) {
  const res = await fetch(`${API_BASE}/ocr/export-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoices })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

// ─── Tally Push API ───

export async function pushToTally(xml: string, tallyUrl?: string): Promise<{ success: boolean; message: string; tallyResponse?: string }> {
  // Try local Tally Connector proxy first (runs on customer's PC at port 7777)
  const connectorUrl = 'http://localhost:7777';
  try {
    const res = await fetch(connectorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml
    });
    return res.json();
  } catch {
    // Connector not running — try backend proxy as fallback (works when backend is local)
    try {
      const res = await request('/tally/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml, tallyUrl })
      });
      return res.json();
    } catch {
      throw new Error(
        'Cannot connect to Tally. Please run the Tally Connector:\n' +
        '1. Open Command Prompt on your PC\n' +
        '2. Run: node tally-connector.js\n' +
        '3. Keep it open and try again'
      );
    }
  }
}

// ─── Client Management APIs ───

export async function getClients() {
  const res = await request('/clients');
  return res.json();
}

export async function createClient(data: any) {
  const res = await request('/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getClientById(id: string) {
  const res = await request(`/clients/${id}`);
  return res.json();
}

export async function updateClient(id: string, data: any) {
  const res = await request(`/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteClient(id: string) {
  const res = await request(`/clients/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function getClientDashboard(id: string) {
  const res = await request(`/clients/${id}/dashboard`);
  return res.json();
}

export async function saveClientPeriod(clientId: string, data: any) {
  const res = await request(`/clients/${clientId}/periods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getClientPeriods(clientId: string) {
  const res = await request(`/clients/${clientId}/periods`);
  return res.json();
}

// ─── GSTR-2A/2B APIs ───

export async function uploadGSTR2A(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request('/upload/gstr2a', { method: 'POST', body: formData });
  return res.json();
}

export async function uploadGSTR2B(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request('/upload/gstr2b', { method: 'POST', body: formData });
  return res.json();
}

export async function reconcilePurchase2A2B(purchaseData: any[], gstr2Data: any[], options?: any) {
  const res = await request('/reconcile/purchase-2a2b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseData, gstr2Data, options })
  });
  return res.json();
}

// ─── GSTR-3B APIs ───

export async function computeGSTR3B(data: any) {
  const res = await request('/gstr3b/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function generateGSTR3BJSON(gstr3bData: any, gstin: string, period: string) {
  const res = await request('/gstr3b/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gstr3bData, gstin, period })
  });
  return res.json();
}

// ─── E-Invoice APIs ───

export async function generateEInvoice(invoice: any, sellerDetails: any, options?: any) {
  const res = await request('/einvoice/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice, sellerDetails, options })
  });
  return res.json();
}

export async function generateBulkEInvoices(invoices: any[], sellerDetails: any, options?: any) {
  const res = await request('/einvoice/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoices, sellerDetails, options })
  });
  return res.json();
}

// ─── Tally Export APIs ───

export async function exportTallySales(invoices: any[], options?: any) {
  const res = await fetch(`${API_BASE}/export/tally-sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoices, options })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function exportTallyPurchase(invoices: any[], options?: any) {
  const res = await fetch(`${API_BASE}/export/tally-purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoices, options })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function exportTallyLedgers(invoices: any[], options?: any) {
  const res = await fetch(`${API_BASE}/export/tally-ledgers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoices, options })
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

// ─── Deadlines ───

export async function getDeadlines(months = 3) {
  const res = await request(`/deadlines?months=${months}`);
  return res.json();
}
