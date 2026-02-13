/**
 * E-Invoice Module
 * Generates e-invoice JSON in NIC (National Informatics Centre) format
 * For IRN generation via GST E-Invoice Portal
 */

const { validateGSTIN } = require('./validation');

/**
 * State code to state name mapping
 */
const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar',
  '36': 'Telangana', '37': 'Andhra Pradesh'
};

/**
 * Convert date from DD-MM-YYYY to DD/MM/YYYY (NIC format)
 */
function toNICDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '/');
}

/**
 * Generate e-invoice JSON for a single invoice (NIC format v1.1)
 */
function generateEInvoice(invoice, sellerDetails, options = {}) {
  const buyer = {
    gstin: invoice.customerGSTIN || '',
    name: invoice.customerName || '',
    address: invoice.buyerAddress || '',
    location: invoice.buyerCity || '',
    pincode: invoice.buyerPincode || '',
    stateCode: invoice.customerGSTIN ? invoice.customerGSTIN.substring(0, 2) : '',
    phone: invoice.buyerPhone || '',
    email: invoice.buyerEmail || ''
  };

  const seller = {
    gstin: sellerDetails.gstin || '',
    name: sellerDetails.name || sellerDetails.tradeName || '',
    tradeName: sellerDetails.tradeName || sellerDetails.name || '',
    address: sellerDetails.address || '',
    location: sellerDetails.city || '',
    pincode: sellerDetails.pincode || '',
    stateCode: sellerDetails.gstin ? sellerDetails.gstin.substring(0, 2) : '',
    phone: sellerDetails.phone || '',
    email: sellerDetails.email || ''
  };

  const isInterState = seller.stateCode !== buyer.stateCode;
  const taxableAmount = parseFloat(invoice.taxableAmount) || 0;
  const cgst = parseFloat(invoice.cgst) || 0;
  const sgst = parseFloat(invoice.sgst) || 0;
  const igst = parseFloat(invoice.igst) || 0;
  const cess = parseFloat(invoice.cess) || 0;
  const totalAmount = parseFloat(invoice.totalAmount) || 0;
  const roundOff = parseFloat(invoice.roundOff) || 0;

  // Build items list
  const items = (invoice.items || []).map((item, idx) => ({
    SlNo: String(idx + 1),
    PrdDesc: item.description || item.name || 'Item',
    IsServc: item.isService ? 'Y' : 'N',
    HsnCd: String(item.hsn || item.hsnCode || invoice.hsnCode || '9988'),
    Barcde: item.barcode || null,
    Qty: parseFloat(item.qty) || 1,
    FreeQty: 0,
    Unit: item.unit || 'NOS',
    UnitPrice: parseFloat(item.rate) || parseFloat(item.unitPrice) || 0,
    TotAmt: parseFloat(item.amount) || parseFloat(item.totalAmount) || 0,
    Discount: parseFloat(item.discount) || 0,
    PreTaxVal: 0,
    AssAmt: parseFloat(item.taxableAmount) || parseFloat(item.amount) || 0,
    GstRt: parseFloat(item.gstRate) || (isInterState
      ? (parseFloat(item.igstRate) || parseFloat(invoice.igstRate) || 18)
      : ((parseFloat(item.cgstRate) || parseFloat(invoice.cgstRate) || 9) * 2)),
    IgstAmt: isInterState ? (parseFloat(item.igst) || 0) : 0,
    CgstAmt: !isInterState ? (parseFloat(item.cgst) || 0) : 0,
    SgstAmt: !isInterState ? (parseFloat(item.sgst) || 0) : 0,
    CesRt: parseFloat(item.cessRate) || 0,
    CesAmt: parseFloat(item.cess) || 0,
    CesNonAdvlAmt: 0,
    StateCesRt: 0,
    StateCesAmt: 0,
    StateCesNonAdvlAmt: 0,
    OthChrg: 0,
    TotItemVal: parseFloat(item.totalWithTax) ||
      ((parseFloat(item.taxableAmount) || parseFloat(item.amount) || 0) +
        (parseFloat(item.igst) || 0) + (parseFloat(item.cgst) || 0) +
        (parseFloat(item.sgst) || 0) + (parseFloat(item.cess) || 0))
  }));

  // If no items, create single item from invoice totals
  if (items.length === 0) {
    const gstRate = isInterState
      ? (parseFloat(invoice.igstRate) || 18)
      : ((parseFloat(invoice.cgstRate) || 9) * 2);

    items.push({
      SlNo: '1',
      PrdDesc: 'As per invoice',
      IsServc: 'Y',
      HsnCd: String(invoice.hsnCode || '9988'),
      Qty: 1,
      FreeQty: 0,
      Unit: 'NOS',
      UnitPrice: taxableAmount,
      TotAmt: taxableAmount,
      Discount: 0,
      PreTaxVal: 0,
      AssAmt: taxableAmount,
      GstRt: gstRate,
      IgstAmt: igst,
      CgstAmt: cgst,
      SgstAmt: sgst,
      CesRt: 0,
      CesAmt: cess,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: totalAmount
    });
  }

  // Determine supply type
  let supplyType = 'B2B'; // Default
  if (!buyer.gstin) supplyType = 'B2C';
  if (invoice.exportType) supplyType = 'EXPWP';
  if (invoice.sezSupply) supplyType = 'SEZWP';

  const einvoice = {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: supplyType,
      RegRev: (invoice.reverseCharge || 'N').toUpperCase() === 'Y' ? 'Y' : 'N',
      EcmGstin: null,
      IgstOnIntra: 'N'
    },
    DocDtls: {
      Typ: invoice.docType || 'INV', // INV, CRN, DBN
      No: String(invoice.invoiceNo),
      Dt: toNICDate(invoice.date)
    },
    SellerDtls: {
      Gstin: seller.gstin,
      LglNm: seller.name,
      TrdNm: seller.tradeName,
      Addr1: seller.address.substring(0, 100) || 'Address',
      Addr2: '',
      Loc: seller.location || 'City',
      Pin: parseInt(seller.pincode) || 000000,
      Stcd: seller.stateCode,
      Ph: seller.phone || null,
      Em: seller.email || null
    },
    BuyerDtls: {
      Gstin: buyer.gstin || 'URP',
      LglNm: buyer.name || 'Cash Customer',
      TrdNm: buyer.name || '',
      Pos: buyer.stateCode || seller.stateCode,
      Addr1: buyer.address.substring(0, 100) || 'Address',
      Addr2: '',
      Loc: buyer.location || 'City',
      Pin: parseInt(buyer.pincode) || 000000,
      Stcd: buyer.stateCode || seller.stateCode,
      Ph: buyer.phone || null,
      Em: buyer.email || null
    },
    ItemList: items,
    ValDtls: {
      AssVal: Math.round(taxableAmount * 100) / 100,
      CgstVal: Math.round(cgst * 100) / 100,
      SgstVal: Math.round(sgst * 100) / 100,
      IgstVal: Math.round(igst * 100) / 100,
      CesVal: Math.round(cess * 100) / 100,
      StCesVal: 0,
      Discount: parseFloat(invoice.discount) || 0,
      OthChrg: parseFloat(invoice.otherCharges) || 0,
      RndOffAmt: Math.round(roundOff * 100) / 100,
      TotInvVal: Math.round(totalAmount * 100) / 100,
      TotInvValFc: 0
    }
  };

  // Add e-way bill details if present
  if (invoice.transporterId || invoice.vehicleNo || options.generateEwayBill) {
    einvoice.EwbDtls = {
      TransId: invoice.transporterId || '',
      TransName: invoice.transporterName || '',
      TransMode: invoice.transportMode || '1', // 1=Road,2=Rail,3=Air,4=Ship
      Distance: parseInt(invoice.distance) || 0,
      TransDocNo: invoice.transportDocNo || '',
      TransDocDt: invoice.transportDocDate ? toNICDate(invoice.transportDocDate) : '',
      VehNo: invoice.vehicleNo || '',
      VehType: invoice.vehicleType || 'R' // R=Regular, O=Over Dimensional
    };
  }

  return einvoice;
}

/**
 * Generate bulk e-invoices
 */
function generateBulkEInvoices(invoices, sellerDetails, options = {}) {
  const results = [];
  const errors = [];

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    try {
      // Validate minimum requirements
      const validationErrors = validateEInvoiceData(inv, sellerDetails);
      if (validationErrors.length > 0) {
        errors.push({
          index: i,
          invoiceNo: inv.invoiceNo,
          errors: validationErrors
        });
        continue;
      }

      const einvoice = generateEInvoice(inv, sellerDetails, options);
      results.push({
        index: i,
        invoiceNo: inv.invoiceNo,
        einvoice,
        status: 'success'
      });
    } catch (err) {
      errors.push({
        index: i,
        invoiceNo: inv.invoiceNo,
        errors: [err.message]
      });
    }
  }

  return {
    totalProcessed: invoices.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors
  };
}

/**
 * Validate e-invoice data before generation
 */
function validateEInvoiceData(invoice, sellerDetails) {
  const errors = [];

  // Required fields
  if (!invoice.invoiceNo) errors.push('Invoice number is required');
  if (!invoice.date) errors.push('Invoice date is required');
  if (!sellerDetails.gstin) errors.push('Seller GSTIN is required');

  // GSTIN validation
  if (sellerDetails.gstin) {
    const sellerValidation = validateGSTIN(sellerDetails.gstin);
    if (!sellerValidation.valid) {
      errors.push(`Invalid seller GSTIN: ${sellerValidation.errors.join(', ')}`);
    }
  }

  if (invoice.customerGSTIN) {
    const buyerValidation = validateGSTIN(invoice.customerGSTIN);
    if (!buyerValidation.valid) {
      errors.push(`Invalid buyer GSTIN: ${buyerValidation.errors.join(', ')}`);
    }
  }

  // Amount validation
  const taxable = parseFloat(invoice.taxableAmount) || 0;
  if (taxable <= 0) errors.push('Taxable amount must be greater than 0');

  const total = parseFloat(invoice.totalAmount) || 0;
  if (total <= 0) errors.push('Total amount must be greater than 0');

  // Date format validation
  if (invoice.date && !/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(invoice.date)) {
    errors.push('Date must be in DD-MM-YYYY format');
  }

  return errors;
}

/**
 * GST Filing deadlines calculator
 */
function getFilingDeadlines(month, year) {
  // month is 1-12
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthStr = String(nextMonth).padStart(2, '0');

  const deadlines = {
    period: `${String(month).padStart(2, '0')}/${year}`,
    GSTR1: {
      name: 'GSTR-1 (Outward Supplies)',
      due: `11-${monthStr}-${nextYear}`,
      description: 'Details of outward supplies',
      penalty: 'Late fee: Rs.50/day CGST + Rs.50/day SGST (max Rs.5000 each)'
    },
    GSTR3B: {
      name: 'GSTR-3B (Summary Return)',
      due: `20-${monthStr}-${nextYear}`,
      description: 'Summary of outward & inward supplies + tax payment',
      penalty: 'Late fee: Rs.50/day CGST + Rs.50/day SGST + 18% interest on tax'
    },
    GSTR1_IFF: {
      name: 'IFF (Invoice Furnishing Facility)',
      due: `13-${monthStr}-${nextYear}`,
      description: 'For QRMP taxpayers - optional B2B invoice upload',
      penalty: 'No penalty (optional)'
    },
    CMP08: {
      name: 'CMP-08 (Composition)',
      due: month % 3 === 0 ? `18-${monthStr}-${nextYear}` : null,
      description: 'Quarterly return for composition dealers',
      penalty: 'Late fee: Rs.50/day CGST + Rs.50/day SGST'
    }
  };

  // Annual returns (if month is March)
  if (month === 3) {
    deadlines.GSTR9 = {
      name: 'GSTR-9 (Annual Return)',
      due: `31-12-${year + 1}`,
      description: `Annual return for FY ${year}-${year + 1}`,
      penalty: 'Late fee: Rs.200/day (max 0.25% of turnover)'
    };
    deadlines.GSTR9C = {
      name: 'GSTR-9C (Reconciliation Statement)',
      due: `31-12-${year + 1}`,
      description: 'Self-certified reconciliation for turnover > 5 Cr',
      penalty: 'Same as GSTR-9'
    };
  }

  return deadlines;
}

/**
 * Get upcoming deadlines for the next N months
 */
function getUpcomingDeadlines(fromDate, months = 3) {
  const now = fromDate ? new Date(fromDate) : new Date();
  const deadlines = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const periodDeadlines = getFilingDeadlines(month, year);

    for (const [key, dl] of Object.entries(periodDeadlines)) {
      if (key === 'period' || !dl.due) continue;

      // Parse due date
      const parts = dl.due.split('-');
      const dueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));

      deadlines.push({
        ...dl,
        returnType: key,
        period: periodDeadlines.period,
        dueDate: dl.due,
        dueDateObj: dueDate,
        isOverdue: dueDate < now,
        daysRemaining: Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
      });
    }
  }

  return deadlines
    .filter(d => d.daysRemaining > -60) // Show up to 60 days overdue
    .sort((a, b) => a.dueDateObj - b.dueDateObj);
}

module.exports = {
  generateEInvoice,
  generateBulkEInvoices,
  validateEInvoiceData,
  getFilingDeadlines,
  getUpcomingDeadlines
};
