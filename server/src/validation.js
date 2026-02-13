/**
 * GST Validation Module
 * Handles GSTIN validation, invoice data validation, and tax calculation checks
 */

// State codes mapping for India
const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '96': 'Foreign Country', '97': 'Other Territory'
};

/**
 * Validate GSTIN format and checksum
 * GSTIN Format: SS PPPPPPPPPP E Z C
 * SS = State Code (2 digits)
 * PPPPPPPPPP = PAN (10 chars)
 * E = Entity Number (1 digit/char)
 * Z = 'Z' by default
 * C = Check digit
 */
function validateGSTIN(gstin) {
  const result = {
    isValid: false,
    gstin: gstin,
    errors: [],
    details: {}
  };

  if (!gstin) {
    result.errors.push('GSTIN is required');
    return result;
  }

  gstin = gstin.trim().toUpperCase();
  result.gstin = gstin;

  // Check length
  if (gstin.length !== 15) {
    result.errors.push(`GSTIN must be 15 characters, got ${gstin.length}`);
    return result;
  }

  // Check format pattern
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinPattern.test(gstin)) {
    result.errors.push('GSTIN format is invalid');

    // Detailed checks
    if (!/^[0-9]{2}/.test(gstin)) {
      result.errors.push('First 2 characters must be a valid state code (digits)');
    }
    if (!/^.{2}[A-Z]{5}/.test(gstin)) {
      result.errors.push('Characters 3-7 must be letters (part of PAN)');
    }
    if (!/^.{7}[0-9]{4}/.test(gstin)) {
      result.errors.push('Characters 8-11 must be digits (part of PAN)');
    }
    if (gstin[13] !== 'Z') {
      result.errors.push('14th character must be "Z"');
    }
    return result;
  }

  // Validate state code
  const stateCode = gstin.substring(0, 2);
  if (!STATE_CODES[stateCode]) {
    result.errors.push(`Invalid state code: ${stateCode}`);
    return result;
  }
  result.details.stateCode = stateCode;
  result.details.stateName = STATE_CODES[stateCode];

  // Extract PAN
  result.details.pan = gstin.substring(2, 12);
  result.details.entityType = getEntityType(gstin[5]);

  // Validate checksum
  const isChecksumValid = validateGSTINChecksum(gstin);
  if (!isChecksumValid) {
    result.errors.push('GSTIN checksum digit is invalid');
    return result;
  }

  result.isValid = true;
  return result;
}

/**
 * GSTIN Checksum validation using Luhn-like algorithm
 */
function validateGSTINChecksum(gstin) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const idx = chars.indexOf(gstin[i]);
    if (idx === -1) return false;

    let product;
    if (i % 2 === 0) {
      product = idx;
    } else {
      product = idx * 2;
    }

    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }

  const checkCodePoint = (36 - (sum % 36)) % 36;
  const expectedChar = chars[checkCodePoint];

  return gstin[14] === expectedChar;
}

/**
 * Get entity type from PAN 5th character
 */
function getEntityType(char) {
  const types = {
    'C': 'Company', 'P': 'Person', 'H': 'HUF',
    'F': 'Firm', 'A': 'AOP', 'T': 'Trust',
    'B': 'BOI', 'L': 'Local Authority', 'J': 'Artificial Juridical Person',
    'G': 'Government'
  };
  return types[char] || 'Unknown';
}

/**
 * Validate invoice data array
 * Returns detailed validation report
 */
function validateInvoiceData(invoices) {
  const report = {
    totalRecords: invoices.length,
    validRecords: 0,
    invalidRecords: 0,
    warnings: [],
    errors: [],
    duplicateInvoices: [],
    invalidGSTINs: [],
    taxMismatches: [],
    highValueWithoutEInvoice: []
  };

  const invoiceNumbers = new Map();

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const rowNum = i + 1;
    let hasError = false;

    // Check required fields
    if (!inv.invoiceNo) {
      report.errors.push({ row: rowNum, field: 'invoiceNo', message: 'Invoice number is missing' });
      hasError = true;
    }

    if (!inv.date) {
      report.errors.push({ row: rowNum, field: 'date', message: 'Date is missing', invoiceNo: inv.invoiceNo });
      hasError = true;
    }

    // Check for duplicate invoice numbers
    if (inv.invoiceNo) {
      if (invoiceNumbers.has(inv.invoiceNo)) {
        report.duplicateInvoices.push({
          invoiceNo: inv.invoiceNo,
          rows: [invoiceNumbers.get(inv.invoiceNo), rowNum]
        });
        report.errors.push({ row: rowNum, field: 'invoiceNo', message: `Duplicate invoice: ${inv.invoiceNo}` });
        hasError = true;
      } else {
        invoiceNumbers.set(inv.invoiceNo, rowNum);
      }
    }

    // Validate GSTIN if present (B2B invoices)
    if (inv.customerGSTIN && inv.customerGSTIN.trim()) {
      const gstinResult = validateGSTIN(inv.customerGSTIN);
      if (!gstinResult.isValid) {
        report.invalidGSTINs.push({
          row: rowNum,
          invoiceNo: inv.invoiceNo,
          gstin: inv.customerGSTIN,
          errors: gstinResult.errors
        });
        hasError = true;
      }
    }

    // Validate tax calculations
    const taxableAmount = parseFloat(inv.taxableAmount) || 0;
    const cgst = parseFloat(inv.cgst) || 0;
    const sgst = parseFloat(inv.sgst) || 0;
    const igst = parseFloat(inv.igst) || 0;
    const totalAmount = parseFloat(inv.totalAmount) || 0;

    // Check: Either CGST+SGST or IGST should be charged, not both
    if (cgst > 0 && sgst > 0 && igst > 0) {
      report.taxMismatches.push({
        row: rowNum,
        invoiceNo: inv.invoiceNo,
        message: 'Both CGST/SGST and IGST are charged - only one should apply'
      });
      report.warnings.push({ row: rowNum, message: 'Both intra-state and inter-state tax applied' });
    }

    // Check CGST = SGST (they must be equal)
    if (Math.abs(cgst - sgst) > 0.5 && (cgst > 0 || sgst > 0)) {
      report.taxMismatches.push({
        row: rowNum,
        invoiceNo: inv.invoiceNo,
        message: `CGST (${cgst}) and SGST (${sgst}) should be equal`
      });
      hasError = true;
    }

    // Verify total = taxable + cgst + sgst + igst
    const calculatedTotal = taxableAmount + cgst + sgst + igst;
    if (Math.abs(calculatedTotal - totalAmount) > 1) {
      report.taxMismatches.push({
        row: rowNum,
        invoiceNo: inv.invoiceNo,
        message: `Total (${totalAmount}) doesn't match Taxable(${taxableAmount}) + CGST(${cgst}) + SGST(${sgst}) + IGST(${igst}) = ${calculatedTotal}`
      });
      hasError = true;
    }

    // Validate tax rates (common GST rates: 5%, 12%, 18%, 28%)
    if (taxableAmount > 0) {
      const totalTax = cgst + sgst + igst;
      const effectiveRate = (totalTax / taxableAmount) * 100;
      const validRates = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 14, 18, 28];
      const isValidRate = validRates.some(r => Math.abs(effectiveRate - r) < 0.5);
      if (!isValidRate && totalTax > 0) {
        report.warnings.push({
          row: rowNum,
          invoiceNo: inv.invoiceNo,
          message: `Unusual tax rate: ${effectiveRate.toFixed(2)}%`
        });
      }
    }

    // Flag high value invoices (>₹50,000 for e-invoice requirement)
    if (totalAmount > 50000 && inv.customerGSTIN) {
      report.highValueWithoutEInvoice.push({
        row: rowNum,
        invoiceNo: inv.invoiceNo,
        amount: totalAmount,
        message: 'Invoice exceeds ₹50,000 - e-invoice may be required'
      });
    }

    if (!hasError) {
      report.validRecords++;
    } else {
      report.invalidRecords++;
    }
  }

  return report;
}

/**
 * Determine B2B vs B2C classification
 */
function classifyInvoice(invoice) {
  if (invoice.customerGSTIN && invoice.customerGSTIN.trim()) {
    return 'B2B';
  }
  const total = parseFloat(invoice.totalAmount) || 0;
  if (total > 250000) {
    return 'B2CL'; // B2C Large (inter-state > 2.5L)
  }
  return 'B2CS'; // B2C Small
}

module.exports = {
  validateGSTIN,
  validateInvoiceData,
  classifyInvoice,
  STATE_CODES
};
