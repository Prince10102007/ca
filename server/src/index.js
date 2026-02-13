const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { reconcileData } = require('./reconciliation');
const { validateGSTIN, validateInvoiceData } = require('./validation');
const { generateExcelReport, generateCorrectedGSTR1, generatePDFReport } = require('./export');
const { parseFile, parseGSTR1JSON } = require('./fileParser');
const { extractInvoiceData, bulkExtract, cleanup: ocrCleanup } = require('./ocr');
const { createClient, listClients, getClient, updateClient, deleteClient,
        savePeriodData, getPeriodData, listPeriods, getClientDashboard } = require('./clients');
const { generateSalesVouchers, generatePurchaseVouchers, generateLedgerMasters } = require('./tallyExport');
const { parseGSTR2A, parseGSTR2B, reconcilePurchaseWith2A2B } = require('./gstr2Reconciliation');
const { computeGSTR3B, generateGSTR3BJSON } = require('./gstr3b');
const { generateEInvoice, generateBulkEInvoices, getFilingDeadlines, getUpcomingDeadlines } = require('./einvoice');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: allow Vercel frontend + localhost for development
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in production for now
    }
  }
}));
app.use(express.json({ limit: '50mb' }));

// Ensure directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const exportsDir = path.join(__dirname, '..', 'exports');
const sessionsDir = path.join(__dirname, '..', 'sessions');
[uploadsDir, exportsDir, sessionsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer config for spreadsheet uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv', '.json'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, .csv, and .json files are allowed'));
    }
  }
});

// Multer config for invoice image/PDF uploads (OCR)
const ocrUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) and PDF are allowed'));
    }
  }
});

// In-memory store for reconciliation sessions
const sessions = {};

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Upload Sales Register ───
app.post('/api/upload/sales', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const data = await parseFile(req.file.path, 'sales');
    const validation = validateInvoiceData(data);

    res.json({
      success: true,
      fileName: req.file.originalname,
      recordCount: data.length,
      data,
      validation
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Upload GSTR-1 JSON ───
app.post('/api/upload/gstr1', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let data;
    if (ext === '.json') {
      data = parseGSTR1JSON(req.file.path);
    } else {
      data = await parseFile(req.file.path, 'gstr1');
    }

    res.json({
      success: true,
      fileName: req.file.originalname,
      recordCount: data.length,
      data
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Upload Purchase Register ───
app.post('/api/upload/purchase', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const data = await parseFile(req.file.path, 'purchase');

    res.json({
      success: true,
      fileName: req.file.originalname,
      recordCount: data.length,
      data
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Validate GSTIN ───
app.post('/api/validate/gstin', (req, res) => {
  const { gstin } = req.body;
  const result = validateGSTIN(gstin);
  res.json(result);
});

// ─── Run Reconciliation ───
app.post('/api/reconcile', (req, res) => {
  try {
    const { salesData, gstr1Data, options } = req.body;

    if (!salesData || !gstr1Data) {
      return res.status(400).json({ error: 'Both sales data and GSTR-1 data are required' });
    }

    const result = reconcileData(salesData, gstr1Data, options || {});

    // Save session
    const sessionId = uuidv4();
    sessions[sessionId] = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      result,
      salesData,
      gstr1Data
    };

    // Persist session to disk
    fs.writeFileSync(
      path.join(sessionsDir, `${sessionId}.json`),
      JSON.stringify(sessions[sessionId])
    );

    res.json({ sessionId, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Session ───
app.get('/api/session/:id', (req, res) => {
  const { id } = req.params;

  // Check memory first, then disk
  if (sessions[id]) return res.json(sessions[id]);

  const filePath = path.join(sessionsDir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    sessions[id] = data;
    return res.json(data);
  }

  res.status(404).json({ error: 'Session not found' });
});

// ─── List Sessions ───
app.get('/api/sessions', (req, res) => {
  try {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf8'));
      return {
        id: data.id,
        createdAt: data.createdAt,
        totalInvoices: data.result?.summary?.totalSalesInvoices || 0,
        matchedCount: data.result?.summary?.matched || 0
      };
    });
    res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.json([]);
  }
});

// ─── Export Discrepancy Report (Excel) ───
app.post('/api/export/discrepancy', (req, res) => {
  try {
    const { reconciliationResult } = req.body;
    const buffer = generateExcelReport(reconciliationResult);
    const filename = `discrepancy-report-${Date.now()}.xlsx`;
    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, buffer);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export Corrected GSTR-1 (Excel) ───
app.post('/api/export/corrected-gstr1', (req, res) => {
  try {
    const { matchedInvoices, salesData } = req.body;
    const buffer = generateCorrectedGSTR1(matchedInvoices, salesData);
    const filename = `corrected-gstr1-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export PDF Summary ───
app.post('/api/export/pdf-summary', async (req, res) => {
  try {
    const { reconciliationResult, period } = req.body;
    const buffer = await generatePDFReport(reconciliationResult, period);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-summary-${Date.now()}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate Sample Template ───
app.get('/api/template/:type', (req, res) => {
  const XLSX = require('xlsx');
  const { type } = req.params;

  let headers, sampleRows, sheetName;

  if (type === 'sales') {
    sheetName = 'Sales Register';
    headers = ['Invoice No', 'Date', 'Customer GSTIN', 'Customer Name', 'HSN Code',
               'Taxable Amount', 'CGST Rate', 'CGST', 'SGST Rate', 'SGST', 'IGST Rate', 'IGST',
               'Total Amount', 'Place of Supply', 'Reverse Charge'];
    sampleRows = [
      ['INV-001', '15-01-2024', '27AABCU9603R1ZM', 'ABC Pvt Ltd', '9983',
       10000, 9, 900, 9, 900, 0, 0, 11800, 'Maharashtra', 'N'],
      ['INV-002', '16-01-2024', '29AABCU9603R1ZK', 'XYZ Corp', '9954',
       25000, 0, 0, 0, 0, 18, 4500, 29500, 'Karnataka', 'N'],
      ['INV-003', '18-01-2024', '27AAACT2727Q1ZV', 'PQR Services', '9971',
       50000, 9, 4500, 9, 4500, 0, 0, 59000, 'Maharashtra', 'N']
    ];
  } else if (type === 'purchase') {
    sheetName = 'Purchase Register';
    headers = ['Invoice No', 'Date', 'Supplier GSTIN', 'Supplier Name', 'HSN Code',
               'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Amount'];
    sampleRows = [
      ['PUR-001', '10-01-2024', '27AABCU9603R1ZM', 'Vendor A', '9983', 5000, 450, 450, 0, 5900],
      ['PUR-002', '12-01-2024', '29AABCU9603R1ZK', 'Vendor B', '9954', 15000, 0, 0, 2700, 17700]
    ];
  } else {
    return res.status(400).json({ error: 'Invalid template type. Use "sales" or "purchase"' });
  }

  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-register-template.xlsx"`);
  res.send(buffer);
});

// ═══════════════════════════════════════════
// OCR ROUTES
// ═══════════════════════════════════════════

// ─── OCR: Extract single invoice ───
app.post('/api/ocr/extract', ocrUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const forceAI = req.body.forceAI === 'true';
    const anthropicKey = req.headers['x-anthropic-key'] || null;
    const result = await extractInvoiceData(req.file.path, { forceAI, anthropicKey });
    res.json({ success: true, fileName: req.file.originalname, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── OCR: Bulk extract invoices ───
app.post('/api/ocr/bulk-extract', ocrUpload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const filePaths = req.files.map(f => f.path);
    const forceAI = req.body.forceAI === 'true';
    const anthropicKey = req.headers['x-anthropic-key'] || null;
    const results = await bulkExtract(filePaths, { forceAI, anthropicKey });

    // Map original filenames
    for (let i = 0; i < results.length; i++) {
      if (req.files[i]) results[i].originalName = req.files[i].originalname;
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OCR: Export extracted data as Excel ───
app.post('/api/ocr/export-excel', (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { invoices } = req.body;
    if (!invoices || !invoices.length) return res.status(400).json({ error: 'No invoice data provided' });

    const headers = ['Invoice No', 'Date', 'Seller Name', 'Seller GSTIN', 'Buyer Name', 'Buyer GSTIN',
                     'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Amount'];
    const rows = invoices.map(inv => [
      inv.invoiceNo || '', inv.date || '', inv.sellerName || '', inv.sellerGSTIN || '',
      inv.customerName || '', inv.customerGSTIN || '',
      inv.taxableAmount || 0, inv.cgst || 0, inv.sgst || 0, inv.igst || 0, inv.totalAmount || 0
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    XLSX.utils.book_append_sheet(wb, ws, 'OCR Extracted Data');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ocr-extracted-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Push XML directly to Tally's XML Server ───
app.post('/api/tally/push', async (req, res) => {
  try {
    const { xml, tallyUrl } = req.body;
    if (!xml) return res.status(400).json({ error: 'No XML data provided' });

    const url = tallyUrl || 'http://localhost:9000';
    const http = require('http');
    const { URL } = require('url');
    const parsed = new URL(url);

    const result = await new Promise((resolve, reject) => {
      const postReq = http.request({
        hostname: parsed.hostname,
        port: parsed.port || 9000,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(xml)
        },
        timeout: 15000
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ status: response.statusCode, body: data }));
      });
      postReq.on('error', (err) => reject(err));
      postReq.on('timeout', () => { postReq.destroy(); reject(new Error('Connection to Tally timed out. Is Tally running with XML Server enabled?')); });
      postReq.write(xml);
      postReq.end();
    });

    // Check if Tally returned an error in its XML response
    const hasError = result.body.includes('<LINEERROR>') || result.body.includes('<ERRORS>');
    if (hasError) {
      return res.json({ success: false, message: 'Tally reported errors during import', tallyResponse: result.body });
    }
    res.json({ success: true, message: 'Data pushed to Tally successfully', tallyResponse: result.body });
  } catch (err) {
    const msg = err.code === 'ECONNREFUSED'
      ? 'Cannot connect to Tally. Make sure Tally is running and XML Server is enabled (F12 > Advanced Config > Enable XML Server = Yes)'
      : err.message;
    res.status(500).json({ error: msg });
  }
});

// ═══════════════════════════════════════════
// CLIENT MANAGEMENT ROUTES
// ═══════════════════════════════════════════

// ─── Create client ───
app.post('/api/clients', (req, res) => {
  try {
    const client = createClient(req.body);
    res.json({ success: true, client });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── List all clients ───
app.get('/api/clients', (req, res) => {
  try {
    const clients = listClients();
    res.json(clients);
  } catch (err) {
    res.json([]);
  }
});

// ─── Get single client ───
app.get('/api/clients/:id', (req, res) => {
  const client = getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

// ─── Update client ───
app.put('/api/clients/:id', (req, res) => {
  const client = updateClient(req.params.id, req.body);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ success: true, client });
});

// ─── Delete client ───
app.delete('/api/clients/:id', (req, res) => {
  const deleted = deleteClient(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Client not found' });
  res.json({ success: true });
});

// ─── Client dashboard ───
app.get('/api/clients/:id/dashboard', (req, res) => {
  const dashboard = getClientDashboard(req.params.id);
  if (!dashboard) return res.status(404).json({ error: 'Client not found' });
  res.json(dashboard);
});

// ─── Save period data for client ───
app.post('/api/clients/:id/periods', (req, res) => {
  try {
    const { period, ...data } = req.body;
    if (!period) return res.status(400).json({ error: 'Period is required (e.g., "Jan-2024")' });
    const result = savePeriodData(req.params.id, period, data);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── List periods for client ───
app.get('/api/clients/:id/periods', (req, res) => {
  const periods = listPeriods(req.params.id);
  res.json(periods);
});

// ─── Get period data ───
app.get('/api/clients/:id/periods/:periodKey', (req, res) => {
  const data = getPeriodData(req.params.id, req.params.periodKey);
  if (!data) return res.status(404).json({ error: 'Period data not found' });
  res.json(data);
});

// ═══════════════════════════════════════════
// TALLY EXPORT ROUTES
// ═══════════════════════════════════════════

// ─── Export as Tally XML (Sales) ───
app.post('/api/export/tally-sales', (req, res) => {
  try {
    const { invoices, options } = req.body;
    if (!invoices || !invoices.length) return res.status(400).json({ error: 'No invoices provided' });

    const xml = generateSalesVouchers(invoices, options || {});
    const filename = `tally-sales-${Date.now()}.xml`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export as Tally XML (Purchase) ───
app.post('/api/export/tally-purchase', (req, res) => {
  try {
    const { invoices, options } = req.body;
    if (!invoices || !invoices.length) return res.status(400).json({ error: 'No invoices provided' });

    const xml = generatePurchaseVouchers(invoices, options || {});
    const filename = `tally-purchase-${Date.now()}.xml`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export Tally Ledger Masters ───
app.post('/api/export/tally-ledgers', (req, res) => {
  try {
    const { invoices, options } = req.body;
    const xml = generateLedgerMasters(invoices, options || {});
    const filename = `tally-ledgers-${Date.now()}.xml`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// GSTR-2A/2B RECONCILIATION ROUTES
// ═══════════════════════════════════════════

// ─── Upload GSTR-2A JSON ───
app.post('/api/upload/gstr2a', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const jsonData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    const data = parseGSTR2A(jsonData);
    res.json({ success: true, fileName: req.file.originalname, recordCount: data.length, data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Upload GSTR-2B JSON ───
app.post('/api/upload/gstr2b', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const jsonData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    const data = parseGSTR2B(jsonData);
    res.json({ success: true, fileName: req.file.originalname, recordCount: data.length, data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Reconcile Purchase vs GSTR-2A/2B ───
app.post('/api/reconcile/purchase-2a2b', (req, res) => {
  try {
    const { purchaseData, gstr2Data, options } = req.body;
    if (!purchaseData || !gstr2Data) {
      return res.status(400).json({ error: 'Both purchase data and GSTR-2A/2B data are required' });
    }
    const result = reconcilePurchaseWith2A2B(purchaseData, gstr2Data, options || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// GSTR-3B ROUTES
// ═══════════════════════════════════════════

// ─── Compute GSTR-3B ───
app.post('/api/gstr3b/compute', (req, res) => {
  try {
    const result = computeGSTR3B(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate GSTR-3B JSON for filing ───
app.post('/api/gstr3b/json', (req, res) => {
  try {
    const { gstr3bData, gstin, period } = req.body;
    if (!gstr3bData || !gstin || !period) {
      return res.status(400).json({ error: 'gstr3bData, gstin, and period are required' });
    }
    const json = generateGSTR3BJSON(gstr3bData, gstin, period);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// E-INVOICE ROUTES
// ═══════════════════════════════════════════

// ─── Generate single e-invoice ───
app.post('/api/einvoice/generate', (req, res) => {
  try {
    const { invoice, sellerDetails, options } = req.body;
    if (!invoice || !sellerDetails) {
      return res.status(400).json({ error: 'invoice and sellerDetails are required' });
    }
    const einvoice = generateEInvoice(invoice, sellerDetails, options || {});
    res.json({ success: true, einvoice });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Generate bulk e-invoices ───
app.post('/api/einvoice/bulk', (req, res) => {
  try {
    const { invoices, sellerDetails, options } = req.body;
    if (!invoices || !sellerDetails) {
      return res.status(400).json({ error: 'invoices and sellerDetails are required' });
    }
    const result = generateBulkEInvoices(invoices, sellerDetails, options || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// DEADLINES & UTILITIES
// ═══════════════════════════════════════════

// ─── Get filing deadlines ───
app.get('/api/deadlines', (req, res) => {
  const months = parseInt(req.query.months) || 3;
  const deadlines = getUpcomingDeadlines(null, months);
  res.json(deadlines);
});

// ─── Get deadlines for specific period ───
app.get('/api/deadlines/:month/:year', (req, res) => {
  const month = parseInt(req.params.month);
  const year = parseInt(req.params.year);
  if (month < 1 || month > 12 || year < 2017) {
    return res.status(400).json({ error: 'Invalid month/year' });
  }
  const deadlines = getFilingDeadlines(month, year);
  res.json(deadlines);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 20MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await ocrCleanup();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TaxStack API Server running on port ${PORT}`);
  console.log('Modules: Reconciliation, OCR, Clients, Tally, GSTR-2A/2B, GSTR-3B, E-Invoice, Deadlines');
});
