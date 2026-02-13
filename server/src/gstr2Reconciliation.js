/**
 * GSTR-2A/2B Reconciliation Module
 * Matches purchase register against GSTR-2A (auto-populated) and GSTR-2B (static)
 * Identifies ITC mismatches, missing invoices, and excess claims
 */

/**
 * Parse GSTR-2A JSON (downloaded from GST portal)
 */
function parseGSTR2A(jsonData) {
  const invoices = [];

  // B2B section
  if (jsonData.b2b) {
    for (const supplier of jsonData.b2b) {
      const supplierGSTIN = supplier.ctin;
      const supplierName = supplier.cfs || supplier.trdnm || '';

      for (const inv of (supplier.inv || [])) {
        const invoice = {
          supplierGSTIN,
          supplierName,
          invoiceNo: inv.inum,
          date: inv.idt,
          invoiceValue: parseFloat(inv.val) || 0,
          placeOfSupply: inv.pos,
          reverseCharge: inv.rchrg || 'N',
          invoiceType: inv.inv_typ || 'R',
          items: [],
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
          totalAmount: 0,
          filingStatus: inv.cflag || 'N',
          filingDate: inv.cfs_dt || null,
          returnPeriod: inv.fldtr1 || null,
          source: '2A'
        };

        for (const item of (inv.itms || [])) {
          const det = item.itm_det || {};
          invoice.items.push({
            rate: parseFloat(det.rt) || 0,
            taxableAmount: parseFloat(det.txval) || 0,
            igst: parseFloat(det.iamt) || 0,
            cgst: parseFloat(det.camt) || 0,
            sgst: parseFloat(det.samt) || 0,
            cess: parseFloat(det.csamt) || 0
          });
          invoice.taxableAmount += parseFloat(det.txval) || 0;
          invoice.igst += parseFloat(det.iamt) || 0;
          invoice.cgst += parseFloat(det.camt) || 0;
          invoice.sgst += parseFloat(det.samt) || 0;
          invoice.cess += parseFloat(det.csamt) || 0;
        }
        invoice.totalAmount = invoice.taxableAmount + invoice.cgst + invoice.sgst + invoice.igst + invoice.cess;
        invoices.push(invoice);
      }
    }
  }

  // CDN section (credit/debit notes)
  if (jsonData.cdn) {
    for (const supplier of jsonData.cdn) {
      for (const note of (supplier.nt || [])) {
        const invoice = {
          supplierGSTIN: supplier.ctin,
          supplierName: supplier.cfs || '',
          invoiceNo: note.nt_num,
          date: note.nt_dt,
          noteType: note.ntty, // C=Credit, D=Debit
          invoiceValue: parseFloat(note.val) || 0,
          taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0,
          source: '2A-CDN',
          items: []
        };

        for (const item of (note.itms || [])) {
          const det = item.itm_det || {};
          invoice.taxableAmount += parseFloat(det.txval) || 0;
          invoice.igst += parseFloat(det.iamt) || 0;
          invoice.cgst += parseFloat(det.camt) || 0;
          invoice.sgst += parseFloat(det.samt) || 0;
          invoice.cess += parseFloat(det.csamt) || 0;
        }
        invoice.totalAmount = invoice.taxableAmount + invoice.cgst + invoice.sgst + invoice.igst + invoice.cess;

        // Credit notes reduce ITC, so negate
        if (note.ntty === 'C') {
          invoice.taxableAmount = -invoice.taxableAmount;
          invoice.cgst = -invoice.cgst;
          invoice.sgst = -invoice.sgst;
          invoice.igst = -invoice.igst;
          invoice.totalAmount = -invoice.totalAmount;
        }
        invoices.push(invoice);
      }
    }
  }

  return invoices;
}

/**
 * Parse GSTR-2B JSON (same structure as 2A but static/confirmed)
 */
function parseGSTR2B(jsonData) {
  const invoices = [];
  const data = jsonData.data || jsonData;

  // docdata → b2b section
  const b2b = data.docdata?.b2b || data.b2b || [];
  for (const supplier of b2b) {
    const supplierGSTIN = supplier.ctin;

    for (const inv of (supplier.inv || [])) {
      const invoice = {
        supplierGSTIN,
        supplierName: supplier.trdnm || '',
        invoiceNo: inv.inum,
        date: inv.dt,
        invoiceValue: parseFloat(inv.val) || 0,
        placeOfSupply: inv.pos,
        reverseCharge: inv.rev || 'N',
        itcAvailability: inv.itcavl || 'Y', // Y=Available, N=Not available
        reason: inv.rsn || '',
        taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0,
        source: '2B',
        items: []
      };

      for (const item of (inv.items || inv.itms || [])) {
        const det = item.itm_det || item;
        invoice.taxableAmount += parseFloat(det.txval) || 0;
        invoice.igst += parseFloat(det.iamt) || 0;
        invoice.cgst += parseFloat(det.camt) || 0;
        invoice.sgst += parseFloat(det.samt) || 0;
        invoice.cess += parseFloat(det.csamt) || 0;
      }
      invoice.totalAmount = invoice.taxableAmount + invoice.cgst + invoice.sgst + invoice.igst + invoice.cess;
      invoices.push(invoice);
    }
  }

  return invoices;
}

/**
 * Normalize invoice number for matching
 */
function normalizeInvNo(invNo) {
  if (!invNo) return '';
  return String(invNo).replace(/[\s\-\/\\\.]/g, '').toUpperCase();
}

/**
 * Reconcile Purchase Register against GSTR-2A/2B
 */
function reconcilePurchaseWith2A2B(purchaseData, gstr2Data, options = {}) {
  const tolerance = options.tolerance || 1;
  const source = gstr2Data.length > 0 && gstr2Data[0].source === '2B' ? '2B' : '2A';

  const result = {
    summary: {
      totalPurchaseInvoices: purchaseData.length,
      totalGSTR2Invoices: gstr2Data.length,
      matched: 0,
      mismatched: 0,
      missingInGSTR2: 0,   // In purchases but not in 2A/2B (ITC at risk)
      missingInPurchase: 0, // In 2A/2B but not booked (unclaimed ITC)
      source
    },
    matched: [],
    mismatched: [],
    missingInGSTR2: [],    // ITC claimed but not appearing in 2A/2B
    missingInPurchase: [],  // Available ITC not claimed
    itcSummary: {
      claimedITC: { cgst: 0, sgst: 0, igst: 0, total: 0 },
      availableITC: { cgst: 0, sgst: 0, igst: 0, total: 0 },
      matchedITC: { cgst: 0, sgst: 0, igst: 0, total: 0 },
      excessClaimed: { cgst: 0, sgst: 0, igst: 0, total: 0 },
      unclaimed: { cgst: 0, sgst: 0, igst: 0, total: 0 }
    },
    supplierBreakdown: {}
  };

  // Build maps
  const gstr2Map = new Map();
  const gstr2Used = new Set();

  for (let i = 0; i < gstr2Data.length; i++) {
    const inv = gstr2Data[i];
    const key = normalizeInvNo(inv.invoiceNo);
    const gstin = (inv.supplierGSTIN || '').toUpperCase();
    const compositeKey = `${gstin}_${key}`;

    if (!gstr2Map.has(compositeKey)) {
      gstr2Map.set(compositeKey, []);
    }
    gstr2Map.get(compositeKey).push({ ...inv, _index: i });

    // Track available ITC
    result.itcSummary.availableITC.cgst += parseFloat(inv.cgst) || 0;
    result.itcSummary.availableITC.sgst += parseFloat(inv.sgst) || 0;
    result.itcSummary.availableITC.igst += parseFloat(inv.igst) || 0;
  }
  result.itcSummary.availableITC.total =
    result.itcSummary.availableITC.cgst + result.itcSummary.availableITC.sgst + result.itcSummary.availableITC.igst;

  // Match purchase invoices
  for (const purchase of purchaseData) {
    const purchaseKey = normalizeInvNo(purchase.invoiceNo);
    const purchaseGSTIN = (purchase.sellerGSTIN || purchase.supplierGSTIN || '').toUpperCase();
    const compositeKey = `${purchaseGSTIN}_${purchaseKey}`;

    // Track claimed ITC
    result.itcSummary.claimedITC.cgst += parseFloat(purchase.cgst) || 0;
    result.itcSummary.claimedITC.sgst += parseFloat(purchase.sgst) || 0;
    result.itcSummary.claimedITC.igst += parseFloat(purchase.igst) || 0;

    // Exact match
    let matched = false;
    if (gstr2Map.has(compositeKey)) {
      const candidates = gstr2Map.get(compositeKey);
      for (const candidate of candidates) {
        if (gstr2Used.has(candidate._index)) continue;

        const discrepancies = comparePurchaseInvoice(purchase, candidate, tolerance);

        if (discrepancies.length === 0) {
          result.matched.push({ purchase, gstr2: candidate, discrepancies: [] });
          result.summary.matched++;
          result.itcSummary.matchedITC.cgst += parseFloat(purchase.cgst) || 0;
          result.itcSummary.matchedITC.sgst += parseFloat(purchase.sgst) || 0;
          result.itcSummary.matchedITC.igst += parseFloat(purchase.igst) || 0;
        } else {
          result.mismatched.push({ purchase, gstr2: candidate, discrepancies });
          result.summary.mismatched++;
        }

        gstr2Used.add(candidate._index);
        matched = true;
        break;
      }
    }

    // Fuzzy match fallback
    if (!matched) {
      const fuzzyMatch = findFuzzyMatch2A(purchase, gstr2Data, gstr2Used);
      if (fuzzyMatch) {
        const discrepancies = comparePurchaseInvoice(purchase, fuzzyMatch, tolerance);
        result.mismatched.push({
          purchase,
          gstr2: fuzzyMatch,
          discrepancies: [...discrepancies, { field: 'invoiceNo', severity: 'warning',
            message: `Invoice number mismatch: "${purchase.invoiceNo}" vs "${fuzzyMatch.invoiceNo}"` }]
        });
        result.summary.mismatched++;
        gstr2Used.add(fuzzyMatch._index);
        matched = true;
      }
    }

    if (!matched) {
      result.missingInGSTR2.push(purchase);
      result.summary.missingInGSTR2++;
    }

    // Supplier breakdown
    const supplierKey = purchaseGSTIN || 'Unknown';
    if (!result.supplierBreakdown[supplierKey]) {
      result.supplierBreakdown[supplierKey] = {
        gstin: purchaseGSTIN,
        name: purchase.sellerName || purchase.supplierName || '',
        matched: 0, mismatched: 0, missing: 0,
        purchaseAmount: 0, gstr2Amount: 0
      };
    }
    result.supplierBreakdown[supplierKey].purchaseAmount += parseFloat(purchase.totalAmount) || 0;
    if (!matched) result.supplierBreakdown[supplierKey].missing++;
    else if (result.matched.length > 0 && result.matched[result.matched.length - 1].purchase === purchase) {
      result.supplierBreakdown[supplierKey].matched++;
    } else {
      result.supplierBreakdown[supplierKey].mismatched++;
    }
  }

  result.itcSummary.claimedITC.total =
    result.itcSummary.claimedITC.cgst + result.itcSummary.claimedITC.sgst + result.itcSummary.claimedITC.igst;
  result.itcSummary.matchedITC.total =
    result.itcSummary.matchedITC.cgst + result.itcSummary.matchedITC.sgst + result.itcSummary.matchedITC.igst;

  // ITC not appearing in 2A/2B (unclaimed by suppliers)
  for (let i = 0; i < gstr2Data.length; i++) {
    if (!gstr2Used.has(i)) {
      result.missingInPurchase.push(gstr2Data[i]);
      result.summary.missingInPurchase++;
    }
  }

  // Calculate excess/unclaimed ITC
  result.itcSummary.excessClaimed = {
    cgst: Math.max(0, result.itcSummary.claimedITC.cgst - result.itcSummary.availableITC.cgst),
    sgst: Math.max(0, result.itcSummary.claimedITC.sgst - result.itcSummary.availableITC.sgst),
    igst: Math.max(0, result.itcSummary.claimedITC.igst - result.itcSummary.availableITC.igst),
    total: 0
  };
  result.itcSummary.excessClaimed.total =
    result.itcSummary.excessClaimed.cgst + result.itcSummary.excessClaimed.sgst + result.itcSummary.excessClaimed.igst;

  result.itcSummary.unclaimed = {
    cgst: Math.max(0, result.itcSummary.availableITC.cgst - result.itcSummary.claimedITC.cgst),
    sgst: Math.max(0, result.itcSummary.availableITC.sgst - result.itcSummary.claimedITC.sgst),
    igst: Math.max(0, result.itcSummary.availableITC.igst - result.itcSummary.claimedITC.igst),
    total: 0
  };
  result.itcSummary.unclaimed.total =
    result.itcSummary.unclaimed.cgst + result.itcSummary.unclaimed.sgst + result.itcSummary.unclaimed.igst;

  return result;
}

/**
 * Compare two invoices and return discrepancies
 */
function comparePurchaseInvoice(purchase, gstr2, tolerance) {
  const discrepancies = [];

  // Amount comparison
  const fields = [
    { name: 'taxableAmount', label: 'Taxable Amount' },
    { name: 'cgst', label: 'CGST' },
    { name: 'sgst', label: 'SGST' },
    { name: 'igst', label: 'IGST' },
    { name: 'totalAmount', label: 'Total Amount' }
  ];

  for (const { name, label } of fields) {
    const pVal = parseFloat(purchase[name]) || 0;
    const gVal = parseFloat(gstr2[name]) || 0;
    if (Math.abs(pVal - gVal) > tolerance) {
      discrepancies.push({
        field: name,
        label,
        purchaseValue: pVal,
        gstr2Value: gVal,
        difference: pVal - gVal,
        severity: Math.abs(pVal - gVal) > 100 ? 'error' : 'warning'
      });
    }
  }

  // GSTIN comparison
  const pGSTIN = (purchase.sellerGSTIN || purchase.supplierGSTIN || '').toUpperCase();
  const gGSTIN = (gstr2.supplierGSTIN || '').toUpperCase();
  if (pGSTIN && gGSTIN && pGSTIN !== gGSTIN) {
    discrepancies.push({
      field: 'gstin',
      label: 'Supplier GSTIN',
      purchaseValue: pGSTIN,
      gstr2Value: gGSTIN,
      severity: 'error'
    });
  }

  return discrepancies;
}

/**
 * Fuzzy match for 2A/2B reconciliation
 */
function findFuzzyMatch2A(purchase, gstr2Data, usedSet) {
  const purchaseGSTIN = (purchase.sellerGSTIN || purchase.supplierGSTIN || '').toUpperCase();
  const purchaseAmount = parseFloat(purchase.totalAmount) || 0;

  for (let i = 0; i < gstr2Data.length; i++) {
    if (usedSet.has(i)) continue;
    const g = gstr2Data[i];
    const gGSTIN = (g.supplierGSTIN || '').toUpperCase();
    const gAmount = parseFloat(g.totalAmount) || 0;

    // Same GSTIN + similar amount = likely same invoice
    if (purchaseGSTIN && purchaseGSTIN === gGSTIN && Math.abs(purchaseAmount - gAmount) <= 1) {
      return { ...g, _index: i };
    }
  }
  return null;
}

module.exports = {
  parseGSTR2A,
  parseGSTR2B,
  reconcilePurchaseWith2A2B
};
