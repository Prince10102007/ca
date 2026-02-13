/**
 * File Parser Module
 * Handles parsing of Excel, CSV, and GSTR-1 JSON files
 * Supports: Tally ERP 9, Tally Prime, Busy, Zoho Books, ClearTax, and manual formats
 */

const XLSX = require('xlsx');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

// ─── Master Column Mapping ───
// Maps every known column name variation to our standard field names
// Covers: Tally ERP 9, Tally Prime, Busy, Zoho Books, ClearTax, GST portal, manual formats
const SALES_COLUMN_MAP = {
  // ── Invoice Number ──
  'invoice no': 'invoiceNo',
  'invoice no.': 'invoiceNo',
  'invoice number': 'invoiceNo',
  'inv no': 'invoiceNo',
  'inv no.': 'invoiceNo',
  'invoice_no': 'invoiceNo',
  'invoiceno': 'invoiceNo',
  'bill no': 'invoiceNo',
  'bill no.': 'invoiceNo',
  'bill number': 'invoiceNo',
  'voucher no': 'invoiceNo',
  'voucher no.': 'invoiceNo',
  'vch no': 'invoiceNo',
  'vch no.': 'invoiceNo',
  'voucher number': 'invoiceNo',
  'vch number': 'invoiceNo',
  'ref no': 'invoiceNo',
  'ref no.': 'invoiceNo',
  'reference no': 'invoiceNo',
  'reference no.': 'invoiceNo',
  'reference number': 'invoiceNo',
  'doc no': 'invoiceNo',
  'doc no.': 'invoiceNo',
  'document no': 'invoiceNo',
  'document no.': 'invoiceNo',
  'document number': 'invoiceNo',
  'sr no': 'invoiceNo',
  'sr. no': 'invoiceNo',
  'sr. no.': 'invoiceNo',
  'serial no': 'invoiceNo',
  'serial number': 'invoiceNo',
  // Tally Prime GSTR-1 export
  'invoice no (as per books)': 'invoiceNo',
  'original invoice no': 'invoiceNo',
  'original invoice number': 'invoiceNo',
  'note/ref. no.': 'invoiceNo',
  'note no.': 'invoiceNo',

  // ── Date ──
  'date': 'date',
  'invoice date': 'date',
  'inv date': 'date',
  'bill date': 'date',
  'invoice_date': 'date',
  'voucher date': 'date',
  'vch date': 'date',
  'document date': 'date',
  'doc date': 'date',
  'transaction date': 'date',
  'txn date': 'date',
  // Tally specific
  'vch date': 'date',

  // ── Customer GSTIN ──
  'customer gstin': 'customerGSTIN',
  'gstin': 'customerGSTIN',
  'gst no': 'customerGSTIN',
  'gst no.': 'customerGSTIN',
  'gstin/uin': 'customerGSTIN',
  'customer_gstin': 'customerGSTIN',
  'gst number': 'customerGSTIN',
  'buyer gstin': 'customerGSTIN',
  'party gstin': 'customerGSTIN',
  'party gstin no': 'customerGSTIN',
  'party gstin no.': 'customerGSTIN',
  "party's gstin": 'customerGSTIN',
  "party's gstin/uin": 'customerGSTIN',
  // Tally ERP 9 / Tally Prime
  'gstin/uin of recipient': 'customerGSTIN',
  'recipient gstin': 'customerGSTIN',
  "buyer's gstin": 'customerGSTIN',
  'gstin of buyer': 'customerGSTIN',
  'gstin of recipient': 'customerGSTIN',
  'gstin of customer': 'customerGSTIN',
  'party gstin/uin': 'customerGSTIN',
  // Busy
  'tin/gstin': 'customerGSTIN',
  'party tin/gstin': 'customerGSTIN',
  'gst registration no': 'customerGSTIN',
  'gst registration no.': 'customerGSTIN',
  // ClearTax / GST portal
  'gstin/uin of the receiver': 'customerGSTIN',
  'ctin': 'customerGSTIN',

  // ── Customer Name ──
  'customer name': 'customerName',
  'party name': 'customerName',
  'buyer name': 'customerName',
  'customer_name': 'customerName',
  'name': 'customerName',
  'receiver name': 'customerName',
  'recipient name': 'customerName',
  // Tally
  'particulars': 'customerName',
  'party ledger name': 'customerName',
  'ledger name': 'customerName',
  'party a/c name': 'customerName',
  'name of the customer': 'customerName',
  'buyer/party name': 'customerName',
  // Busy
  'account name': 'customerName',
  'a/c name': 'customerName',

  // ── HSN/SAC Code ──
  'hsn code': 'hsnCode',
  'hsn': 'hsnCode',
  'hsn_code': 'hsnCode',
  'sac code': 'hsnCode',
  'sac': 'hsnCode',
  'hsn/sac': 'hsnCode',
  'hsn/sac code': 'hsnCode',
  'hsn / sac': 'hsnCode',
  // Tally
  'hsn/sac code of goods/services': 'hsnCode',
  'hsn details': 'hsnCode',

  // ── Taxable Amount ──
  'taxable amount': 'taxableAmount',
  'taxable value': 'taxableAmount',
  'taxable_amount': 'taxableAmount',
  'assessable value': 'taxableAmount',
  'base amount': 'taxableAmount',
  'taxable amt': 'taxableAmount',
  'taxable amt.': 'taxableAmount',
  // Tally ERP 9 / Tally Prime
  'assessable amount': 'taxableAmount',
  'value of goods/services': 'taxableAmount',
  'goods value': 'taxableAmount',
  'value': 'taxableAmount',
  'basic value': 'taxableAmount',
  // Busy
  'net assessable value': 'taxableAmount',
  'net taxable value': 'taxableAmount',
  'taxable val': 'taxableAmount',

  // ── CGST ──
  'cgst rate': 'cgstRate',
  'cgst %': 'cgstRate',
  'cgst_rate': 'cgstRate',
  'central tax rate': 'cgstRate',
  'central tax rate (%)': 'cgstRate',
  'cgst rate (%)': 'cgstRate',
  'cgst': 'cgst',
  'cgst amount': 'cgst',
  'cgst amt': 'cgst',
  'cgst amt.': 'cgst',
  'cgst_amount': 'cgst',
  'central tax': 'cgst',
  // Tally
  'central tax amount': 'cgst',
  'central tax amt': 'cgst',
  'central gst': 'cgst',
  'cgst value': 'cgst',

  // ── SGST / UTGST ──
  'sgst rate': 'sgstRate',
  'sgst %': 'sgstRate',
  'sgst_rate': 'sgstRate',
  'state tax rate': 'sgstRate',
  'state tax rate (%)': 'sgstRate',
  'sgst rate (%)': 'sgstRate',
  'sgst/utgst rate': 'sgstRate',
  'sgst/utgst rate (%)': 'sgstRate',
  'sgst': 'sgst',
  'sgst amount': 'sgst',
  'sgst amt': 'sgst',
  'sgst amt.': 'sgst',
  'sgst_amount': 'sgst',
  'utgst': 'sgst',
  'state tax': 'sgst',
  'utgst amount': 'sgst',
  'sgst/utgst': 'sgst',
  // Tally
  'state tax amount': 'sgst',
  'state tax amt': 'sgst',
  'sgst/utgst amount': 'sgst',
  'sgst/utgst amt': 'sgst',
  'state gst': 'sgst',
  'sgst value': 'sgst',
  'ut tax': 'sgst',
  'ut tax amount': 'sgst',

  // ── IGST ──
  'igst rate': 'igstRate',
  'igst %': 'igstRate',
  'igst_rate': 'igstRate',
  'integrated tax rate': 'igstRate',
  'integrated tax rate (%)': 'igstRate',
  'igst rate (%)': 'igstRate',
  'igst': 'igst',
  'igst amount': 'igst',
  'igst amt': 'igst',
  'igst amt.': 'igst',
  'igst_amount': 'igst',
  'integrated tax': 'igst',
  // Tally
  'integrated tax amount': 'igst',
  'integrated tax amt': 'igst',
  'integrated gst': 'igst',
  'igst value': 'igst',

  // ── Cess ──
  'cess': 'cess',
  'cess amount': 'cess',
  'cess amt': 'cess',
  'cess value': 'cess',

  // ── Total Amount ──
  'total amount': 'totalAmount',
  'total': 'totalAmount',
  'invoice amount': 'totalAmount',
  'total_amount': 'totalAmount',
  'invoice value': 'totalAmount',
  'gross amount': 'totalAmount',
  'net amount': 'totalAmount',
  'grand total': 'totalAmount',
  'bill amount': 'totalAmount',
  'amount': 'totalAmount',
  'total value': 'totalAmount',
  // Tally
  'gross total': 'totalAmount',
  'bill value': 'totalAmount',
  'voucher total': 'totalAmount',
  'vch amount': 'totalAmount',
  'total invoice value': 'totalAmount',
  'total inv value': 'totalAmount',
  // Busy
  'net total': 'totalAmount',

  // ── Place of Supply ──
  'place of supply': 'placeOfSupply',
  'pos': 'placeOfSupply',
  'place_of_supply': 'placeOfSupply',
  'supply place': 'placeOfSupply',
  // Tally
  'place of supply (name)': 'placeOfSupply',
  'place of supply (code)': 'placeOfSupply',
  'state': 'placeOfSupply',
  'state name': 'placeOfSupply',
  'buyer state': 'placeOfSupply',
  'destination': 'placeOfSupply',

  // ── Reverse Charge ──
  'reverse charge': 'reverseCharge',
  'rcm': 'reverseCharge',
  'reverse_charge': 'reverseCharge',
  'reverse charge (y/n)': 'reverseCharge',
  'is reverse charge': 'reverseCharge',
  'applicable of reverse charge': 'reverseCharge',
  'applicable % of tax rate': 'reverseCharge',

  // ── Voucher Type (Tally) ──
  'voucher type': 'voucherType',
  'vch type': 'voucherType',
  'type': 'voucherType',
  'transaction type': 'voucherType',
  'invoice type': 'voucherType',

  // ── GST Rate (combined) ──
  'rate': 'gstRate',
  'gst rate': 'gstRate',
  'gst rate (%)': 'gstRate',
  'tax rate': 'gstRate',
  'tax rate (%)': 'gstRate',
  'rate of tax': 'gstRate',
  'applicable % of tax rate': 'gstRate',

  // ── E-way Bill / E-invoice ──
  'e-way bill no': 'ewayBillNo',
  'e-way bill no.': 'ewayBillNo',
  'eway bill': 'ewayBillNo',
  'irn': 'irn',
  'irn number': 'irn',
  'e-invoice no': 'irn',
};

// ─── Tally-specific sheet name patterns ───
const TALLY_SHEET_PATTERNS = [
  'sales register', 'sale register', 'sales voucher', 'sales',
  'gstr-1', 'gstr1', 'gst sales', 'b2b', 'b2cl', 'b2cs',
  'tax invoice', 'invoices', 'daybook', 'day book',
  'purchase register', 'purchase voucher', 'purchases',
  'gstr-2', 'gstr2', 'gst purchases', 'gst purchase'
];

/**
 * Parse Excel or CSV file
 * Enhanced to handle Tally ERP 9 and Tally Prime exports
 */
async function parseFile(filePath, type) {
  const ext = path.extname(filePath).toLowerCase();

  let rawData;
  if (ext === '.csv') {
    rawData = parseCSV(filePath);
  } else {
    rawData = parseExcel(filePath);
  }

  if (!rawData || rawData.length === 0) {
    throw new Error('File is empty or could not be parsed');
  }

  // Map columns to standard names
  const mapped = mapColumns(rawData, type);
  return mapped;
}

/**
 * Parse Excel file
 * Enhanced: tries multiple sheets, skips Tally header rows, finds the data table
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });

  // Try to find the best sheet (Tally exports often have multiple sheets)
  let bestSheet = null;
  let bestSheetName = workbook.SheetNames[0];

  // Look for a sheet with a matching name
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase().trim();
    if (TALLY_SHEET_PATTERNS.some(p => lower.includes(p))) {
      bestSheetName = name;
      break;
    }
  }

  bestSheet = workbook.Sheets[bestSheetName];

  // First try: normal parse
  let data = XLSX.utils.sheet_to_json(bestSheet, { defval: '' });

  // Check if we got valid data (Tally sometimes has title/company rows at top)
  if (data.length > 0) {
    const firstRow = data[0];
    const keys = Object.keys(firstRow);

    // Check if the first few rows are headers/titles (no recognizable column names)
    const hasValidColumns = keys.some(k => {
      const normalized = k.toLowerCase().trim();
      return SALES_COLUMN_MAP[normalized] !== undefined;
    });

    if (!hasValidColumns) {
      // Try to find the actual header row by scanning down
      data = findDataInSheet(bestSheet);
    }
  }

  return data;
}

/**
 * Find actual data table in a sheet that has title/company rows at the top
 * Common in Tally exports which have:
 *   Row 1: Company Name
 *   Row 2: Report Title (e.g., "Sales Register")
 *   Row 3: Period
 *   Row 4: (blank)
 *   Row 5: Actual column headers
 *   Row 6+: Data
 */
function findDataInSheet(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const totalRows = range.e.r;
  const totalCols = range.e.c;

  // Scan rows to find the header row (the one with most recognizable column names)
  let bestHeaderRow = 0;
  let bestMatchCount = 0;

  for (let r = 0; r <= Math.min(totalRows, 15); r++) {
    let matchCount = 0;
    for (let c = 0; c <= totalCols; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        const normalized = String(cell.v).toLowerCase().trim();
        if (SALES_COLUMN_MAP[normalized] !== undefined) {
          matchCount++;
        }
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestHeaderRow = r;
    }
  }

  if (bestMatchCount >= 2) {
    // Re-parse starting from the found header row
    const newRange = { ...range, s: { ...range.s, r: bestHeaderRow } };
    sheet['!ref'] = XLSX.utils.encode_range(newRange);
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  // Fallback: return original parse from row 0
  const origRange = { ...range, s: { ...range.s, r: 0 } };
  sheet['!ref'] = XLSX.utils.encode_range(origRange);
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Tally CSV exports sometimes have BOM or extra header lines
  // Remove BOM if present
  const cleanContent = content.replace(/^\uFEFF/, '');

  // Check if first few lines are title/company lines (not CSV data)
  const lines = cleanContent.split('\n');
  let startLine = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = lines[i].split(',');
    // A header row typically has 4+ columns
    if (cols.length >= 4) {
      const matchCount = cols.filter(c => {
        const normalized = c.toLowerCase().trim().replace(/^"|"$/g, '');
        return SALES_COLUMN_MAP[normalized] !== undefined;
      }).length;
      if (matchCount >= 2) {
        startLine = i;
        break;
      }
    }
  }

  const csvContent = lines.slice(startLine).join('\n');

  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: h => h.trim().replace(/^"|"$/g, '')
  });

  if (result.errors.length > 0) {
    const criticalErrors = result.errors.filter(e => e.type === 'FieldMismatch');
    if (criticalErrors.length > 5) {
      throw new Error(`CSV parsing errors: ${criticalErrors.slice(0, 3).map(e => e.message).join(', ')}`);
    }
  }

  return result.data;
}

/**
 * Map column names to standard field names
 * Enhanced with fuzzy matching for columns that don't match exactly
 */
function mapColumns(data, type) {
  if (!data || data.length === 0) return [];

  // Get the original column names
  const originalColumns = Object.keys(data[0]);

  // Build mapping from original to standard
  const columnMapping = {};
  const unmappedColumns = [];

  for (const col of originalColumns) {
    const normalized = col.toLowerCase().trim()
      .replace(/\s+/g, ' ')        // normalize whitespace
      .replace(/['"]/g, '')         // remove quotes
      .replace(/\.$/, '');          // remove trailing dot

    if (SALES_COLUMN_MAP[normalized]) {
      columnMapping[col] = SALES_COLUMN_MAP[normalized];
    } else {
      // Try with trailing dot
      const withDot = normalized + '.';
      if (SALES_COLUMN_MAP[withDot]) {
        columnMapping[col] = SALES_COLUMN_MAP[withDot];
      } else {
        // Try fuzzy match: check if any key is contained in or contains the column name
        const fuzzyMatch = fuzzyColumnMatch(normalized);
        if (fuzzyMatch) {
          columnMapping[col] = fuzzyMatch;
        } else {
          unmappedColumns.push(col);
        }
      }
    }
  }

  // If no 'totalAmount' mapped but we see a column with 'amount'/'value' that's unmapped,
  // and we already have taxableAmount, try to map it
  if (!Object.values(columnMapping).includes('totalAmount')) {
    for (const col of unmappedColumns) {
      const lower = col.toLowerCase();
      if (lower.includes('amount') || lower.includes('value') || lower.includes('total')) {
        columnMapping[col] = 'totalAmount';
        break;
      }
    }
  }

  // Map each row
  return data.map((row, index) => {
    const mapped = {};

    for (const [origCol, stdCol] of Object.entries(columnMapping)) {
      let value = row[origCol];

      // Parse dates
      if (stdCol === 'date' && value) {
        value = formatDate(value);
      }

      // Parse numbers
      if (['taxableAmount', 'cgst', 'sgst', 'igst', 'totalAmount', 'cgstRate', 'sgstRate',
           'igstRate', 'gstRate', 'cess'].includes(stdCol)) {
        value = parseNumber(value);
      }

      // Clean GSTIN
      if (stdCol === 'customerGSTIN' && value) {
        value = String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      }

      // Clean invoice number
      if (stdCol === 'invoiceNo' && value) {
        value = String(value).trim();
      }

      // Reverse charge: normalize to Y/N
      if (stdCol === 'reverseCharge' && value) {
        const v = String(value).trim().toLowerCase();
        value = (v === 'y' || v === 'yes' || v === 'true' || v === '1') ? 'Y' : 'N';
      }

      mapped[stdCol] = value;
    }

    // ─── Post-processing: fill gaps from combined columns ───

    // If we have gstRate but not individual rates, calculate them
    if (mapped.gstRate && !mapped.cgstRate && !mapped.igstRate) {
      const rate = parseFloat(mapped.gstRate) || 0;
      if (mapped.igst && mapped.igst > 0) {
        mapped.igstRate = rate;
      } else {
        mapped.cgstRate = rate / 2;
        mapped.sgstRate = rate / 2;
      }
    }

    // If we have rates but not amounts, calculate from taxable
    if (mapped.taxableAmount) {
      if (mapped.cgstRate && !mapped.cgst) {
        mapped.cgst = Math.round(mapped.taxableAmount * mapped.cgstRate / 100 * 100) / 100;
      }
      if (mapped.sgstRate && !mapped.sgst) {
        mapped.sgst = Math.round(mapped.taxableAmount * mapped.sgstRate / 100 * 100) / 100;
      }
      if (mapped.igstRate && !mapped.igst) {
        mapped.igst = Math.round(mapped.taxableAmount * mapped.igstRate / 100 * 100) / 100;
      }
    }

    // Also copy any unmapped columns with their original names
    for (const col of originalColumns) {
      if (!columnMapping[col]) {
        mapped[col] = row[col];
      }
    }

    // Assign a row index for reference
    mapped._rowIndex = index + 1;

    // Ensure defaults
    mapped.cgst = mapped.cgst || 0;
    mapped.sgst = mapped.sgst || 0;
    mapped.igst = mapped.igst || 0;

    // Calculate total if missing
    if (!mapped.totalAmount && mapped.taxableAmount) {
      mapped.totalAmount = (mapped.taxableAmount || 0) + (mapped.cgst || 0) +
                           (mapped.sgst || 0) + (mapped.igst || 0) + (mapped.cess || 0);
    }

    // Round total
    if (mapped.totalAmount) {
      mapped.totalAmount = Math.round(mapped.totalAmount * 100) / 100;
    }

    return mapped;
  }).filter(row => {
    // Filter out empty rows and Tally summary/total rows
    if (!row.invoiceNo && !row.taxableAmount) return false;
    const invNo = String(row.invoiceNo || '').toLowerCase();
    if (invNo === 'total' || invNo === 'grand total' || invNo === 'sub total') return false;
    return true;
  });
}

/**
 * Fuzzy column name matching
 * Handles cases where Tally exports have slightly different naming
 */
function fuzzyColumnMatch(normalized) {
  // Direct keyword-based matching as fallback
  const keywordMap = [
    { keywords: ['invoice', 'inv', 'voucher', 'vch', 'bill', 'ref', 'doc'], excludeKeywords: ['date', 'value', 'amount', 'type'], field: 'invoiceNo' },
    { keywords: ['gstin', 'gst no', 'gst reg', 'uin'], excludeKeywords: ['supply', 'place'], field: 'customerGSTIN' },
    { keywords: ['party name', 'customer name', 'buyer name', 'receiver', 'recipient', 'particular', 'ledger name'], field: 'customerName' },
    { keywords: ['taxable'], field: 'taxableAmount' },
    { keywords: ['cgst', 'central tax', 'central gst'], excludeKeywords: ['rate', '%'], field: 'cgst' },
    { keywords: ['sgst', 'state tax', 'state gst', 'utgst', 'ut tax'], excludeKeywords: ['rate', '%'], field: 'sgst' },
    { keywords: ['igst', 'integrated tax', 'integrated gst'], excludeKeywords: ['rate', '%'], field: 'igst' },
    { keywords: ['hsn', 'sac'], field: 'hsnCode' },
    { keywords: ['place of supply', 'supply place'], field: 'placeOfSupply' },
    { keywords: ['reverse charge', 'rcm'], field: 'reverseCharge' },
  ];

  for (const rule of keywordMap) {
    const hasKeyword = rule.keywords.some(kw => normalized.includes(kw));
    const hasExclude = rule.excludeKeywords
      ? rule.excludeKeywords.some(ex => normalized.includes(ex))
      : false;

    if (hasKeyword && !hasExclude) {
      return rule.field;
    }
  }

  return null;
}

/**
 * Format date to DD-MM-YYYY
 * Handles all Indian date formats and Tally's date output
 */
function formatDate(value) {
  if (!value) return '';

  // If it's already a Date object (from Excel)
  if (value instanceof Date) {
    const d = value.getDate().toString().padStart(2, '0');
    const m = (value.getMonth() + 1).toString().padStart(2, '0');
    const y = value.getFullYear();
    return `${d}-${m}-${y}`;
  }

  // String date - try common formats
  const str = String(value).trim();

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[1].padStart(2, '0')}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[3]}`;
  }

  // YYYY-MM-DD (ISO)
  const ymdMatch = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[3].padStart(2, '0')}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[1]}`;
  }

  // Tally format: "1-Apr-2024" or "01-Apr-24" or "1 Apr 2024"
  const monthNames = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'june': '06', 'july': '07', 'august': '08', 'september': '09',
    'october': '10', 'november': '11', 'december': '12'
  };

  const namedDateMatch = str.match(/^(\d{1,2})[-\/.\s]+([a-zA-Z]+)[-\/.\s]+(\d{2,4})$/);
  if (namedDateMatch) {
    const day = namedDateMatch[1].padStart(2, '0');
    const monthStr = namedDateMatch[2].toLowerCase();
    const month = monthNames[monthStr];
    let year = namedDateMatch[3];
    if (year.length === 2) year = '20' + year;
    if (month) {
      return `${day}-${month}-${year}`;
    }
  }

  // Excel serial number
  if (!isNaN(value) && Number(value) > 10000) {
    const date = new Date((Number(value) - 25569) * 86400 * 1000);
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return str;
}

/**
 * Parse numeric value from various formats
 * Handles: ₹1,00,000.50, (1000) for negatives, "1,00,000", "Dr 5000", "5000 Cr"
 */
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100) / 100;

  let str = String(value).trim();

  // Tally sometimes shows Dr/Cr suffix for debit/credit
  const isNegative = str.startsWith('(') || str.startsWith('-') || str.toLowerCase().endsWith(' cr');
  str = str.replace(/\(|\)/g, '').replace(/\s*(dr|cr)\.?\s*$/i, '');

  // Remove currency symbols, commas, spaces
  const cleaned = str.replace(/[₹$,\s]/g, '').trim();
  const num = parseFloat(cleaned);

  if (isNaN(num)) return 0;
  const result = Math.round(Math.abs(num) * 100) / 100;
  return isNegative ? -result : result;
}

/**
 * Parse GSTR-1 JSON file (as downloaded from GST portal)
 */
function parseGSTR1JSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    throw new Error('Invalid JSON file. Please upload a valid GSTR-1 JSON.');
  }

  const invoices = [];

  // Parse B2B section
  if (json.b2b) {
    for (const customer of json.b2b) {
      const ctin = customer.ctin;
      for (const inv of (customer.inv || [])) {
        const items = inv.itms || [];
        let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

        for (const item of items) {
          const det = item.itm_det || {};
          totalTaxable += det.txval || 0;
          totalCGST += det.camt || 0;
          totalSGST += det.samt || 0;
          totalIGST += det.iamt || 0;
        }

        invoices.push({
          invoiceNo: inv.inum,
          date: inv.idt,
          customerGSTIN: ctin,
          customerName: customer.ctin, // GSTR-1 may not have name
          taxableAmount: Math.round(totalTaxable * 100) / 100,
          cgst: Math.round(totalCGST * 100) / 100,
          sgst: Math.round(totalSGST * 100) / 100,
          igst: Math.round(totalIGST * 100) / 100,
          totalAmount: Math.round((totalTaxable + totalCGST + totalSGST + totalIGST) * 100) / 100,
          invoiceType: inv.typ || 'R',
          placeOfSupply: inv.pos,
          reverseCharge: inv.rchrg,
          source: 'GSTR1'
        });
      }
    }
  }

  // Parse B2CL section (large B2C invoices > ₹2.5L)
  if (json.b2cl) {
    for (const state of json.b2cl) {
      for (const inv of (state.inv || [])) {
        const items = inv.itms || [];
        let totalTaxable = 0, totalIGST = 0;

        for (const item of items) {
          const det = item.itm_det || {};
          totalTaxable += det.txval || 0;
          totalIGST += det.iamt || 0;
        }

        invoices.push({
          invoiceNo: inv.inum,
          date: inv.idt,
          customerGSTIN: '',
          customerName: 'B2CL',
          taxableAmount: Math.round(totalTaxable * 100) / 100,
          cgst: 0,
          sgst: 0,
          igst: Math.round(totalIGST * 100) / 100,
          totalAmount: Math.round((totalTaxable + totalIGST) * 100) / 100,
          placeOfSupply: state.pos,
          source: 'GSTR1',
          type: 'B2CL'
        });
      }
    }
  }

  // If JSON is just an array of invoices (simple format)
  if (Array.isArray(json)) {
    return json.map(inv => ({
      invoiceNo: inv.invoiceNo || inv.inum || inv['Invoice No'],
      date: inv.date || inv.idt || inv['Date'],
      customerGSTIN: (inv.customerGSTIN || inv.ctin || inv['GSTIN'] || '').toUpperCase(),
      customerName: inv.customerName || inv['Customer Name'] || '',
      taxableAmount: parseNumber(inv.taxableAmount || inv.txval || inv['Taxable Amount']),
      cgst: parseNumber(inv.cgst || inv.camt || inv['CGST']),
      sgst: parseNumber(inv.sgst || inv.samt || inv['SGST']),
      igst: parseNumber(inv.igst || inv.iamt || inv['IGST']),
      totalAmount: parseNumber(inv.totalAmount || inv['Total Amount'] || inv['Invoice Value']),
      source: 'GSTR1'
    }));
  }

  if (invoices.length === 0) {
    throw new Error('No invoice data found in GSTR-1 JSON. Please check the file format.');
  }

  return invoices;
}

module.exports = {
  parseFile,
  parseGSTR1JSON
};
