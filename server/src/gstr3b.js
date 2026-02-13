/**
 * GSTR-3B Auto-Computation Module
 * Computes GSTR-3B values from GSTR-1 (outward) and GSTR-2B (inward) data
 */

/**
 * Compute GSTR-3B from sales/GSTR-1 and purchase/GSTR-2B data
 */
function computeGSTR3B(data) {
  const {
    salesData = [],
    purchaseData = [],
    gstr1Data = [],
    gstr2bData = [],
    previousBalance = { cgst: 0, sgst: 0, igst: 0, cess: 0 },
    period = ''
  } = data;

  // Use GSTR-1 data if available, else sales data for outward supply
  const outwardData = gstr1Data.length > 0 ? gstr1Data : salesData;
  const inwardData = gstr2bData.length > 0 ? gstr2bData : purchaseData;

  // ── Table 3.1: Outward Supplies ──
  const table3_1 = computeOutwardSupplies(outwardData);

  // ── Table 3.2: Inter-state supplies to unregistered/composition
  const table3_2 = computeInterStateUnregistered(outwardData);

  // ── Table 4: Eligible ITC ──
  const table4 = computeEligibleITC(inwardData);

  // ── Table 5: Exempt/Nil-rated/Non-GST Inward Supplies ──
  const table5 = computeExemptInward(inwardData);

  // ── Table 6: Payment of Tax ──
  const table6 = computeTaxPayment(table3_1, table4, previousBalance);

  return {
    period,
    generatedAt: new Date().toISOString(),
    table3_1,
    table3_2,
    table4,
    table5,
    table6,
    summary: {
      totalOutwardLiability: table3_1.totalLiability,
      totalITC: table4.netITC,
      netPayable: table6.netPayable,
      totalLiability: table6.totalLiability,
      totalITCUtilized: table6.itcUtilized
    }
  };
}

/**
 * Table 3.1: Details of Outward Supplies and Inward Supplies liable to Reverse Charge
 */
function computeOutwardSupplies(outwardData) {
  const categories = {
    // (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
    taxable: { taxableAmount: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    // (b) Outward taxable supplies (zero rated)
    zeroRated: { taxableAmount: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    // (c) Other outward supplies (Nil rated, exempted)
    nilRatedExempt: { taxableAmount: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    // (d) Inward supplies (liable to reverse charge)
    reverseCharge: { taxableAmount: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    // (e) Non-GST outward supplies
    nonGST: { taxableAmount: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  };

  for (const inv of outwardData) {
    const taxableAmount = parseFloat(inv.taxableAmount) || 0;
    const cgst = parseFloat(inv.cgst) || 0;
    const sgst = parseFloat(inv.sgst) || 0;
    const igst = parseFloat(inv.igst) || 0;
    const cess = parseFloat(inv.cess) || 0;
    const rc = (inv.reverseCharge || '').toUpperCase();
    const gstRate = (parseFloat(inv.cgstRate) || 0) + (parseFloat(inv.sgstRate) || 0) + (parseFloat(inv.igstRate) || 0);

    let category;
    if (rc === 'Y') {
      category = 'reverseCharge';
    } else if (gstRate === 0 && taxableAmount > 0 && (cgst + sgst + igst) === 0) {
      // Check if it's zero-rated (export) or nil/exempt
      if (inv.exportType || inv.invoiceType === 'EXPWP' || inv.invoiceType === 'EXPWOP') {
        category = 'zeroRated';
      } else {
        category = 'nilRatedExempt';
      }
    } else {
      category = 'taxable';
    }

    categories[category].taxableAmount += taxableAmount;
    categories[category].igst += igst;
    categories[category].cgst += cgst;
    categories[category].sgst += sgst;
    categories[category].cess += cess;
  }

  // Round all values
  for (const cat of Object.values(categories)) {
    for (const key of Object.keys(cat)) {
      cat[key] = Math.round(cat[key] * 100) / 100;
    }
  }

  const totalLiability = {
    igst: categories.taxable.igst + categories.zeroRated.igst + categories.reverseCharge.igst,
    cgst: categories.taxable.cgst + categories.zeroRated.cgst + categories.reverseCharge.cgst,
    sgst: categories.taxable.sgst + categories.zeroRated.sgst + categories.reverseCharge.sgst,
    cess: categories.taxable.cess + categories.zeroRated.cess + categories.reverseCharge.cess
  };
  totalLiability.total = totalLiability.igst + totalLiability.cgst + totalLiability.sgst + totalLiability.cess;

  return { ...categories, totalLiability };
}

/**
 * Table 3.2: Inter-state supplies
 */
function computeInterStateUnregistered(outwardData) {
  const supplies = {
    toUnregistered: { placeOfSupply: {}, total: 0 },
    toComposition: { placeOfSupply: {}, total: 0 },
    toUIN: { placeOfSupply: {}, total: 0 }
  };

  for (const inv of outwardData) {
    const igst = parseFloat(inv.igst) || 0;
    if (igst <= 0) continue;

    const pos = inv.placeOfSupply || 'Unknown';
    const customerGSTIN = inv.customerGSTIN || '';

    // Classify: unregistered if no GSTIN, composition if GSTIN present but composition type
    if (!customerGSTIN) {
      if (!supplies.toUnregistered.placeOfSupply[pos]) {
        supplies.toUnregistered.placeOfSupply[pos] = 0;
      }
      supplies.toUnregistered.placeOfSupply[pos] += parseFloat(inv.totalAmount) || 0;
      supplies.toUnregistered.total += parseFloat(inv.totalAmount) || 0;
    }
  }

  return supplies;
}

/**
 * Table 4: Eligible ITC
 */
function computeEligibleITC(inwardData) {
  const itc = {
    // (A) ITC Available
    importGoods: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    importServices: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    reverseCharge: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    fromISD: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    allOther: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    totalAvailable: { igst: 0, cgst: 0, sgst: 0, cess: 0 },

    // (B) ITC Reversed
    rule42: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    rule43: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    otherReversals: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    totalReversed: { igst: 0, cgst: 0, sgst: 0, cess: 0 },

    // (C) Net ITC
    netITC: { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 }
  };

  for (const inv of inwardData) {
    const cgst = parseFloat(inv.cgst) || 0;
    const sgst = parseFloat(inv.sgst) || 0;
    const igst = parseFloat(inv.igst) || 0;
    const cess = parseFloat(inv.cess) || 0;
    const rc = (inv.reverseCharge || '').toUpperCase();
    const itcAvail = inv.itcAvailability !== 'N'; // Default: available

    if (!itcAvail) continue;

    let category;
    if (rc === 'Y') {
      category = 'reverseCharge';
    } else if (inv.source === 'ISD') {
      category = 'fromISD';
    } else {
      category = 'allOther';
    }

    itc[category].igst += igst;
    itc[category].cgst += cgst;
    itc[category].sgst += sgst;
    itc[category].cess += cess;
  }

  // Total available
  const availCategories = ['importGoods', 'importServices', 'reverseCharge', 'fromISD', 'allOther'];
  for (const cat of availCategories) {
    itc.totalAvailable.igst += itc[cat].igst;
    itc.totalAvailable.cgst += itc[cat].cgst;
    itc.totalAvailable.sgst += itc[cat].sgst;
    itc.totalAvailable.cess += itc[cat].cess;
  }

  // Total reversed
  const revCategories = ['rule42', 'rule43', 'otherReversals'];
  for (const cat of revCategories) {
    itc.totalReversed.igst += itc[cat].igst;
    itc.totalReversed.cgst += itc[cat].cgst;
    itc.totalReversed.sgst += itc[cat].sgst;
    itc.totalReversed.cess += itc[cat].cess;
  }

  // Net ITC = Available - Reversed
  itc.netITC.igst = Math.round((itc.totalAvailable.igst - itc.totalReversed.igst) * 100) / 100;
  itc.netITC.cgst = Math.round((itc.totalAvailable.cgst - itc.totalReversed.cgst) * 100) / 100;
  itc.netITC.sgst = Math.round((itc.totalAvailable.sgst - itc.totalReversed.sgst) * 100) / 100;
  itc.netITC.cess = Math.round((itc.totalAvailable.cess - itc.totalReversed.cess) * 100) / 100;
  itc.netITC.total = itc.netITC.igst + itc.netITC.cgst + itc.netITC.sgst + itc.netITC.cess;

  return itc;
}

/**
 * Table 5: Exempt, Nil-rated, Non-GST inward supplies
 */
function computeExemptInward(inwardData) {
  const exempt = {
    interState: { exempt: 0, nilRated: 0, nonGST: 0 },
    intraState: { exempt: 0, nilRated: 0, nonGST: 0 }
  };

  for (const inv of inwardData) {
    const taxableAmount = parseFloat(inv.taxableAmount) || 0;
    const totalTax = (parseFloat(inv.cgst) || 0) + (parseFloat(inv.sgst) || 0) + (parseFloat(inv.igst) || 0);
    const isInterState = (parseFloat(inv.igst) || 0) > 0;

    if (totalTax === 0 && taxableAmount > 0) {
      const stateKey = isInterState ? 'interState' : 'intraState';
      exempt[stateKey].nilRated += taxableAmount;
    }
  }

  return exempt;
}

/**
 * Table 6: Payment of Tax
 * Computes tax payable after ITC utilization
 */
function computeTaxPayment(table3_1, table4, previousBalance = {}) {
  const liability = {
    igst: table3_1.totalLiability.igst,
    cgst: table3_1.totalLiability.cgst,
    sgst: table3_1.totalLiability.sgst,
    cess: table3_1.totalLiability.cess
  };

  const itc = {
    igst: table4.netITC.igst,
    cgst: table4.netITC.cgst,
    sgst: table4.netITC.sgst,
    cess: table4.netITC.cess
  };

  // ITC utilization order as per GST rules:
  // 1. IGST ITC → IGST liability → CGST liability → SGST liability
  // 2. CGST ITC → CGST liability → IGST liability (not SGST)
  // 3. SGST ITC → SGST liability → IGST liability (not CGST)

  let remainIGST = itc.igst;
  let remainCGST = itc.cgst;
  let remainSGST = itc.sgst;
  let remainCESS = itc.cess;

  let payIGST = liability.igst;
  let payCGST = liability.cgst;
  let paySGST = liability.sgst;
  let payCESS = liability.cess;

  // Step 1: Use IGST ITC against IGST liability
  const igstAgainstIgst = Math.min(remainIGST, payIGST);
  remainIGST -= igstAgainstIgst;
  payIGST -= igstAgainstIgst;

  // Step 2: Use remaining IGST ITC against CGST liability
  const igstAgainstCgst = Math.min(remainIGST, payCGST);
  remainIGST -= igstAgainstCgst;
  payCGST -= igstAgainstCgst;

  // Step 3: Use remaining IGST ITC against SGST liability
  const igstAgainstSgst = Math.min(remainIGST, paySGST);
  remainIGST -= igstAgainstSgst;
  paySGST -= igstAgainstSgst;

  // Step 4: Use CGST ITC against CGST liability
  const cgstAgainstCgst = Math.min(remainCGST, payCGST);
  remainCGST -= cgstAgainstCgst;
  payCGST -= cgstAgainstCgst;

  // Step 5: Use remaining CGST ITC against IGST liability
  const cgstAgainstIgst = Math.min(remainCGST, payIGST);
  remainCGST -= cgstAgainstIgst;
  payIGST -= cgstAgainstIgst;

  // Step 6: Use SGST ITC against SGST liability
  const sgstAgainstSgst = Math.min(remainSGST, paySGST);
  remainSGST -= sgstAgainstSgst;
  paySGST -= sgstAgainstSgst;

  // Step 7: Use remaining SGST ITC against IGST liability
  const sgstAgainstIgst = Math.min(remainSGST, payIGST);
  remainSGST -= sgstAgainstIgst;
  payIGST -= sgstAgainstIgst;

  // Step 8: CESS ITC against CESS liability
  const cessAgainstCess = Math.min(remainCESS, payCESS);
  remainCESS -= cessAgainstCess;
  payCESS -= cessAgainstCess;

  // Cash payable (after ITC utilization)
  const cashPayable = {
    igst: Math.round(Math.max(0, payIGST) * 100) / 100,
    cgst: Math.round(Math.max(0, payCGST) * 100) / 100,
    sgst: Math.round(Math.max(0, paySGST) * 100) / 100,
    cess: Math.round(Math.max(0, payCESS) * 100) / 100
  };
  cashPayable.total = cashPayable.igst + cashPayable.cgst + cashPayable.sgst + cashPayable.cess;

  const totalLiability = liability.igst + liability.cgst + liability.sgst + liability.cess;
  const itcUtilized = {
    igst: itc.igst - remainIGST,
    cgst: itc.cgst - remainCGST,
    sgst: itc.sgst - remainSGST,
    cess: itc.cess - remainCESS
  };
  itcUtilized.total = itcUtilized.igst + itcUtilized.cgst + itcUtilized.sgst + itcUtilized.cess;

  // ITC balance carried forward
  const itcBalance = {
    igst: Math.round(remainIGST * 100) / 100,
    cgst: Math.round(remainCGST * 100) / 100,
    sgst: Math.round(remainSGST * 100) / 100,
    cess: Math.round(remainCESS * 100) / 100
  };
  itcBalance.total = itcBalance.igst + itcBalance.cgst + itcBalance.sgst + itcBalance.cess;

  // Utilization breakdown
  const utilization = {
    igstToIgst: igstAgainstIgst,
    igstToCgst: igstAgainstCgst,
    igstToSgst: igstAgainstSgst,
    cgstToCgst: cgstAgainstCgst,
    cgstToIgst: cgstAgainstIgst,
    sgstToSgst: sgstAgainstSgst,
    sgstToIgst: sgstAgainstIgst,
    cessTocess: cessAgainstCess
  };

  return {
    liability,
    itcAvailable: itc,
    utilization,
    itcUtilized,
    cashPayable,
    itcBalance,
    totalLiability,
    netPayable: cashPayable.total,
    interestPayable: 0, // Manual input needed
    lateFeeCGST: 0,     // Auto-calculated based on filing date
    lateFeeSGST: 0
  };
}

/**
 * Generate GSTR-3B JSON in GST portal format
 */
function generateGSTR3BJSON(gstr3bData, gstin, period) {
  return {
    gstin: gstin,
    ret_period: period, // e.g., "012024" for Jan 2024
    sup_details: {
      osup_det: {
        txval: gstr3bData.table3_1.taxable.taxableAmount,
        iamt: gstr3bData.table3_1.taxable.igst,
        camt: gstr3bData.table3_1.taxable.cgst,
        samt: gstr3bData.table3_1.taxable.sgst,
        csamt: gstr3bData.table3_1.taxable.cess
      },
      osup_zero: {
        txval: gstr3bData.table3_1.zeroRated.taxableAmount,
        iamt: gstr3bData.table3_1.zeroRated.igst,
        camt: 0, samt: 0, csamt: 0
      },
      osup_nil_exmp: {
        txval: gstr3bData.table3_1.nilRatedExempt.taxableAmount
      },
      isup_rev: {
        txval: gstr3bData.table3_1.reverseCharge.taxableAmount,
        iamt: gstr3bData.table3_1.reverseCharge.igst,
        camt: gstr3bData.table3_1.reverseCharge.cgst,
        samt: gstr3bData.table3_1.reverseCharge.sgst,
        csamt: gstr3bData.table3_1.reverseCharge.cess
      },
      osup_nongst: {
        txval: gstr3bData.table3_1.nonGST.taxableAmount
      }
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'IMPG',
          iamt: gstr3bData.table4.importGoods.igst,
          camt: 0, samt: 0,
          csamt: gstr3bData.table4.importGoods.cess
        },
        {
          ty: 'IMPS',
          iamt: gstr3bData.table4.importServices.igst,
          camt: 0, samt: 0, csamt: 0
        },
        {
          ty: 'ISRC',
          iamt: gstr3bData.table4.reverseCharge.igst,
          camt: gstr3bData.table4.reverseCharge.cgst,
          samt: gstr3bData.table4.reverseCharge.sgst,
          csamt: gstr3bData.table4.reverseCharge.cess
        },
        {
          ty: 'ISD',
          iamt: gstr3bData.table4.fromISD.igst,
          camt: gstr3bData.table4.fromISD.cgst,
          samt: gstr3bData.table4.fromISD.sgst,
          csamt: gstr3bData.table4.fromISD.cess
        },
        {
          ty: 'OTH',
          iamt: gstr3bData.table4.allOther.igst,
          camt: gstr3bData.table4.allOther.cgst,
          samt: gstr3bData.table4.allOther.sgst,
          csamt: gstr3bData.table4.allOther.cess
        }
      ],
      itc_rev: [
        {
          ty: 'RUL',
          iamt: gstr3bData.table4.rule42.igst + gstr3bData.table4.rule43.igst,
          camt: gstr3bData.table4.rule42.cgst + gstr3bData.table4.rule43.cgst,
          samt: gstr3bData.table4.rule42.sgst + gstr3bData.table4.rule43.sgst,
          csamt: gstr3bData.table4.rule42.cess + gstr3bData.table4.rule43.cess
        },
        {
          ty: 'OTH',
          iamt: gstr3bData.table4.otherReversals.igst,
          camt: gstr3bData.table4.otherReversals.cgst,
          samt: gstr3bData.table4.otherReversals.sgst,
          csamt: gstr3bData.table4.otherReversals.cess
        }
      ],
      itc_net: {
        iamt: gstr3bData.table4.netITC.igst,
        camt: gstr3bData.table4.netITC.cgst,
        samt: gstr3bData.table4.netITC.sgst,
        csamt: gstr3bData.table4.netITC.cess
      }
    }
  };
}

module.exports = {
  computeGSTR3B,
  generateGSTR3BJSON
};
