/**
 * Reconciliation Engine
 * Core matching algorithm to reconcile sales register with GSTR-1 data
 */

const { validateGSTIN, classifyInvoice } = require('./validation');

/**
 * Main reconciliation function
 * Compares sales register data with GSTR-1 data and identifies discrepancies
 */
function reconcileData(salesData, gstr1Data, options = {}) {
  const toleranceAmount = options.toleranceAmount || 1; // ₹1 tolerance for rounding
  const tolerancePercent = options.tolerancePercent || 0; // 0% tolerance

  const result = {
    summary: {
      totalSalesInvoices: salesData.length,
      totalGSTR1Invoices: gstr1Data.length,
      matched: 0,
      mismatched: 0,
      missingSalesInGSTR1: 0,   // In sales but not in GSTR-1
      missingGSTR1InSales: 0,   // In GSTR-1 but not in sales
      totalDiscrepancyAmount: 0
    },
    matched: [],
    mismatched: [],
    missingSalesInGSTR1: [],  // Present in sales register, absent in GSTR-1
    missingGSTR1InSales: [],  // Present in GSTR-1, absent in sales register
    duplicates: [],
    validationIssues: [],
    monthlyBreakdown: {},
    customerBreakdown: {}
  };

  // Build lookup maps for efficient matching
  const salesMap = buildInvoiceMap(salesData, 'sales');
  const gstr1Map = buildInvoiceMap(gstr1Data, 'gstr1');

  // Track processed invoices
  const processedGSTR1 = new Set();

  // ─── Match each sales invoice against GSTR-1 ───
  for (const [key, salesInvoices] of salesMap.entries()) {
    // Check for duplicates in sales register
    if (salesInvoices.length > 1) {
      result.duplicates.push({
        type: 'sales_duplicate',
        invoiceNo: salesInvoices[0].invoiceNo,
        count: salesInvoices.length,
        invoices: salesInvoices
      });
    }

    const salesInv = salesInvoices[0]; // Take first occurrence
    const gstr1Invoices = gstr1Map.get(key);

    if (!gstr1Invoices || gstr1Invoices.length === 0) {
      // Try fuzzy match (invoice number might differ slightly)
      const fuzzyMatch = findFuzzyMatch(salesInv, gstr1Map, processedGSTR1);

      if (fuzzyMatch) {
        const comparison = compareInvoices(salesInv, fuzzyMatch.invoice, toleranceAmount);
        comparison.matchType = 'fuzzy';
        comparison.matchConfidence = fuzzyMatch.confidence;

        if (comparison.discrepancies.length === 0) {
          result.matched.push(comparison);
          result.summary.matched++;
        } else {
          result.mismatched.push(comparison);
          result.summary.mismatched++;
          result.summary.totalDiscrepancyAmount += Math.abs(comparison.totalDifference);
        }
        processedGSTR1.add(normalizeInvoiceNo(fuzzyMatch.invoice.invoiceNo));
      } else {
        // Missing in GSTR-1
        result.missingSalesInGSTR1.push({
          ...salesInv,
          status: 'MISSING_IN_GSTR1',
          severity: 'high',
          suggestion: 'Add this invoice to GSTR-1 filing'
        });
        result.summary.missingSalesInGSTR1++;
      }
    } else {
      processedGSTR1.add(key);

      // Check for duplicates in GSTR-1
      if (gstr1Invoices.length > 1) {
        result.duplicates.push({
          type: 'gstr1_duplicate',
          invoiceNo: gstr1Invoices[0].invoiceNo,
          count: gstr1Invoices.length,
          invoices: gstr1Invoices
        });
      }

      const gstr1Inv = gstr1Invoices[0];
      const comparison = compareInvoices(salesInv, gstr1Inv, toleranceAmount);

      if (comparison.discrepancies.length === 0) {
        result.matched.push(comparison);
        result.summary.matched++;
      } else {
        result.mismatched.push(comparison);
        result.summary.mismatched++;
        result.summary.totalDiscrepancyAmount += Math.abs(comparison.totalDifference);
      }
    }

    // Track monthly breakdown
    const month = extractMonth(salesInv.date);
    if (month) {
      if (!result.monthlyBreakdown[month]) {
        result.monthlyBreakdown[month] = { matched: 0, mismatched: 0, missing: 0, total: 0 };
      }
      result.monthlyBreakdown[month].total++;
    }

    // Track customer breakdown
    const custKey = salesInv.customerGSTIN || salesInv.customerName || 'Unknown';
    if (!result.customerBreakdown[custKey]) {
      result.customerBreakdown[custKey] = {
        name: salesInv.customerName || custKey,
        gstin: salesInv.customerGSTIN || '',
        total: 0, matched: 0, mismatched: 0, discrepancyAmount: 0
      };
    }
    result.customerBreakdown[custKey].total++;
  }

  // ─── Find GSTR-1 invoices not in sales register ───
  for (const [key, gstr1Invoices] of gstr1Map.entries()) {
    if (!processedGSTR1.has(key)) {
      for (const inv of gstr1Invoices) {
        result.missingGSTR1InSales.push({
          ...inv,
          status: 'MISSING_IN_SALES',
          severity: 'high',
          suggestion: 'This invoice exists in GSTR-1 but not in sales register - verify or remove from GSTR-1'
        });
        result.summary.missingGSTR1InSales++;
      }
    }
  }

  // ─── Update monthly and customer breakdowns ───
  for (const item of result.matched) {
    const month = extractMonth(item.salesInvoice.date);
    if (month && result.monthlyBreakdown[month]) {
      result.monthlyBreakdown[month].matched++;
    }
    const custKey = item.salesInvoice.customerGSTIN || item.salesInvoice.customerName || 'Unknown';
    if (result.customerBreakdown[custKey]) {
      result.customerBreakdown[custKey].matched++;
    }
  }

  for (const item of result.mismatched) {
    const month = extractMonth(item.salesInvoice.date);
    if (month && result.monthlyBreakdown[month]) {
      result.monthlyBreakdown[month].mismatched++;
    }
    const custKey = item.salesInvoice.customerGSTIN || item.salesInvoice.customerName || 'Unknown';
    if (result.customerBreakdown[custKey]) {
      result.customerBreakdown[custKey].mismatched++;
      result.customerBreakdown[custKey].discrepancyAmount += Math.abs(item.totalDifference);
    }
  }

  for (const item of result.missingSalesInGSTR1) {
    const month = extractMonth(item.date);
    if (month && result.monthlyBreakdown[month]) {
      result.monthlyBreakdown[month].missing++;
    }
  }

  // ─── Run additional validation ───
  result.validationIssues = runAdditionalChecks(salesData, gstr1Data);

  // Round summary amount
  result.summary.totalDiscrepancyAmount = Math.round(result.summary.totalDiscrepancyAmount * 100) / 100;

  return result;
}

/**
 * Build a map of invoices keyed by normalized invoice number
 */
function buildInvoiceMap(invoices, source) {
  const map = new Map();

  for (const inv of invoices) {
    if (!inv.invoiceNo) continue;
    const key = normalizeInvoiceNo(inv.invoiceNo);

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({ ...inv, _source: source });
  }

  return map;
}

/**
 * Normalize invoice number for matching
 * Removes spaces, special chars, leading zeros
 */
function normalizeInvoiceNo(invoiceNo) {
  if (!invoiceNo) return '';
  return String(invoiceNo)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^0+/, ''); // Remove leading zeros
}

/**
 * Try to find a fuzzy match for an invoice
 */
function findFuzzyMatch(salesInv, gstr1Map, processedSet) {
  const salesNo = normalizeInvoiceNo(salesInv.invoiceNo);
  let bestMatch = null;
  let bestConfidence = 0;

  for (const [key, gstr1Invoices] of gstr1Map.entries()) {
    if (processedSet.has(key)) continue;

    const gstr1Inv = gstr1Invoices[0];

    // Check if invoice numbers are similar (e.g., INV-001 vs INV001 vs 001)
    const numericSales = salesNo.replace(/[^0-9]/g, '');
    const numericGSTR1 = key.replace(/[^0-9]/g, '');

    let confidence = 0;

    // Exact numeric match + same GSTIN
    if (numericSales && numericSales === numericGSTR1 &&
        salesInv.customerGSTIN && gstr1Inv.customerGSTIN &&
        salesInv.customerGSTIN.toUpperCase() === gstr1Inv.customerGSTIN.toUpperCase()) {
      confidence = 0.9;
    }
    // Same amount + same GSTIN + similar date
    else if (salesInv.customerGSTIN && gstr1Inv.customerGSTIN &&
             salesInv.customerGSTIN.toUpperCase() === gstr1Inv.customerGSTIN.toUpperCase() &&
             Math.abs((salesInv.totalAmount || 0) - (gstr1Inv.totalAmount || 0)) < 1) {
      confidence = 0.7;
    }

    if (confidence > bestConfidence && confidence >= 0.7) {
      bestConfidence = confidence;
      bestMatch = { invoice: gstr1Inv, confidence };
    }
  }

  return bestMatch;
}

/**
 * Compare two invoices and identify discrepancies
 */
function compareInvoices(salesInv, gstr1Inv, tolerance) {
  const discrepancies = [];

  // Compare amounts
  const fields = [
    { key: 'taxableAmount', label: 'Taxable Amount' },
    { key: 'cgst', label: 'CGST' },
    { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' },
    { key: 'totalAmount', label: 'Total Amount' }
  ];

  let totalDifference = 0;

  for (const field of fields) {
    const salesVal = parseFloat(salesInv[field.key]) || 0;
    const gstr1Val = parseFloat(gstr1Inv[field.key]) || 0;
    const diff = salesVal - gstr1Val;

    if (Math.abs(diff) > tolerance) {
      discrepancies.push({
        field: field.key,
        label: field.label,
        salesValue: salesVal,
        gstr1Value: gstr1Val,
        difference: Math.round(diff * 100) / 100,
        severity: Math.abs(diff) > 100 ? 'high' : Math.abs(diff) > 10 ? 'medium' : 'low'
      });
    }

    if (field.key === 'totalAmount') {
      totalDifference = diff;
    }
  }

  // Compare GSTIN
  const salesGSTIN = (salesInv.customerGSTIN || '').toUpperCase().trim();
  const gstr1GSTIN = (gstr1Inv.customerGSTIN || '').toUpperCase().trim();
  if (salesGSTIN && gstr1GSTIN && salesGSTIN !== gstr1GSTIN) {
    discrepancies.push({
      field: 'customerGSTIN',
      label: 'Customer GSTIN',
      salesValue: salesGSTIN,
      gstr1Value: gstr1GSTIN,
      difference: 'Mismatch',
      severity: 'high'
    });
  }

  // Compare dates
  const salesDate = normalizeDate(salesInv.date);
  const gstr1Date = normalizeDate(gstr1Inv.date);
  if (salesDate && gstr1Date && salesDate !== gstr1Date) {
    discrepancies.push({
      field: 'date',
      label: 'Invoice Date',
      salesValue: salesInv.date,
      gstr1Value: gstr1Inv.date,
      difference: 'Date mismatch',
      severity: 'medium'
    });
  }

  return {
    invoiceNo: salesInv.invoiceNo,
    salesInvoice: salesInv,
    gstr1Invoice: gstr1Inv,
    discrepancies,
    totalDifference: Math.round(totalDifference * 100) / 100,
    status: discrepancies.length === 0 ? 'MATCHED' : 'MISMATCHED',
    matchType: 'exact'
  };
}

/**
 * Normalize date for comparison
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();

  // Extract day, month, year from various formats
  let d, m, y;

  const dmy = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (dmy) { d = dmy[1]; m = dmy[2]; y = dmy[3]; }

  const ymd = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (ymd) { d = ymd[3]; m = ymd[2]; y = ymd[1]; }

  if (d && m && y) {
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return str;
}

/**
 * Extract month from date string (returns YYYY-MM)
 */
function extractMonth(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  const dmy = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`;

  const ymd = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}`;

  return null;
}

/**
 * Run additional validation checks
 */
function runAdditionalChecks(salesData, gstr1Data) {
  const issues = [];

  for (const inv of salesData) {
    // Validate GSTIN
    if (inv.customerGSTIN && inv.customerGSTIN.trim()) {
      const gstinResult = validateGSTIN(inv.customerGSTIN);
      if (!gstinResult.isValid) {
        issues.push({
          type: 'INVALID_GSTIN',
          invoiceNo: inv.invoiceNo,
          value: inv.customerGSTIN,
          message: gstinResult.errors.join('; '),
          severity: 'high'
        });
      }
    }

    // B2B vs B2C classification check
    const classification = classifyInvoice(inv);
    if (classification === 'B2B' && (!inv.customerGSTIN || !inv.customerGSTIN.trim())) {
      issues.push({
        type: 'CLASSIFICATION_ERROR',
        invoiceNo: inv.invoiceNo,
        message: 'Invoice appears to be B2B but has no GSTIN',
        severity: 'medium'
      });
    }

    // Check CGST/SGST vs IGST consistency
    const cgst = parseFloat(inv.cgst) || 0;
    const sgst = parseFloat(inv.sgst) || 0;
    const igst = parseFloat(inv.igst) || 0;

    if (cgst > 0 && igst > 0) {
      issues.push({
        type: 'TAX_TYPE_ERROR',
        invoiceNo: inv.invoiceNo,
        message: 'Both CGST/SGST and IGST applied. Use CGST+SGST for intra-state, IGST for inter-state.',
        severity: 'high'
      });
    }

    // High value invoice check
    const total = parseFloat(inv.totalAmount) || 0;
    if (total > 50000 && inv.customerGSTIN) {
      issues.push({
        type: 'E_INVOICE_CHECK',
        invoiceNo: inv.invoiceNo,
        amount: total,
        message: `High value invoice (₹${total.toLocaleString('en-IN')}) - ensure e-invoice compliance`,
        severity: 'info'
      });
    }
  }

  return issues;
}

module.exports = { reconcileData };
