/**
 * Tally Export Module
 * Generates Tally-compatible XML vouchers for bulk import
 * Uses official TallyPrime XML format
 */

const fs = require('fs');
const path = require('path');

/**
 * State code to state name mapping
 */
const STATE_MAP = {
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
 * Convert date from DD-MM-YYYY to Tally's YYYYMMDD format
 */
function toTallyDate(dateStr) {
  if (!dateStr) return '';
  // Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY separators
  const parts = dateStr.split(/[-\/.]/);
  if (parts.length === 3) {
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const yyyy = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    return `${yyyy}${mm}${dd}`;
  }
  return dateStr.replace(/[-\/.]/g, '');
}

/**
 * XML escape special characters
 */
function xmlEscape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Tally-compatible XML for sales vouchers
 * Uses official TallyPrime XML import format
 */
function generateSalesVouchers(invoices, options = {}) {
  const companyName = options.companyName || 'My Company';
  const voucherType = options.voucherType || 'Sales';
  const salesLedger = options.salesLedger || 'Sales Account';
  const cgstLedger = options.cgstLedger || 'CGST';
  const sgstLedger = options.sgstLedger || 'SGST';
  const igstLedger = options.igstLedger || 'IGST';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
`;

  for (const inv of invoices) {
    const tallyDate = toTallyDate(inv.date);
    const totalAmount = parseFloat(inv.totalAmount) || 0;
    const taxableAmount = parseFloat(inv.taxableAmount) || 0;
    const cgst = parseFloat(inv.cgst) || 0;
    const sgst = parseFloat(inv.sgst) || 0;
    const igst = parseFloat(inv.igst) || 0;
    const partyName = inv.customerName || inv.sellerName || 'Cash';
    const gstin = inv.customerGSTIN || inv.sellerGSTIN || '';
    const placeOfSupply = inv.placeOfSupply || '';
    const stateCode = gstin ? gstin.substring(0, 2) : '';
    const stateName = STATE_MAP[stateCode] || placeOfSupply;
    const isInterState = igst > 0;

    xml += `      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="${xmlEscape(voucherType)}" ACTION="Create">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>${xmlEscape(voucherType)}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${xmlEscape(inv.invoiceNo)}</VOUCHERNUMBER>
          <REFERENCE>${xmlEscape(inv.invoiceNo)}</REFERENCE>
          <PARTYLEDGERNAME>${xmlEscape(partyName)}</PARTYLEDGERNAME>
          <PARTYGSTIN>${xmlEscape(gstin)}</PARTYGSTIN>
          <PLACEOFSUPPLY>${xmlEscape(stateName)}</PLACEOFSUPPLY>
          <ISINVOICE>Yes</ISINVOICE>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <NARRATION>Sales Invoice ${xmlEscape(inv.invoiceNo)} to ${xmlEscape(partyName)}</NARRATION>
`;

    // Party ledger entry (debit - customer owes total)
    xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(partyName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;

    // Sales ledger entry (credit - taxable amount)
    xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(salesLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${taxableAmount.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;

    // Tax entries
    if (isInterState && igst > 0) {
      xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(igstLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${igst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;
    } else {
      if (cgst > 0) {
        xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(cgstLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;
      }
      if (sgst > 0) {
        xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(sgstLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;
      }
    }

    xml += `        </VOUCHER>
      </TALLYMESSAGE>
`;
  }

  xml += `    </DATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

/**
 * Generate Tally-compatible XML for purchase vouchers
 * Uses official TallyPrime XML import format
 */
function generatePurchaseVouchers(invoices, options = {}) {
  const companyName = options.companyName || 'My Company';
  const voucherType = options.voucherType || 'Purchase';
  const purchaseLedger = options.purchaseLedger || 'Purchase Account';
  const cgstLedger = options.cgstLedger || 'Input CGST';
  const sgstLedger = options.sgstLedger || 'Input SGST';
  const igstLedger = options.igstLedger || 'Input IGST';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
`;

  for (const inv of invoices) {
    const tallyDate = toTallyDate(inv.date);
    const totalAmount = parseFloat(inv.totalAmount) || 0;
    const taxableAmount = parseFloat(inv.taxableAmount) || 0;
    const cgst = parseFloat(inv.cgst) || 0;
    const sgst = parseFloat(inv.sgst) || 0;
    const igst = parseFloat(inv.igst) || 0;
    const partyName = inv.sellerName || inv.supplierName || 'Cash';
    const gstin = inv.sellerGSTIN || inv.supplierGSTIN || '';
    const isInterState = igst > 0;
    const stateCode = gstin ? gstin.substring(0, 2) : '';
    const stateName = STATE_MAP[stateCode] || inv.placeOfSupply || '';

    xml += `      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="${xmlEscape(voucherType)}" ACTION="Create">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>${xmlEscape(voucherType)}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${xmlEscape(inv.invoiceNo)}</VOUCHERNUMBER>
          <REFERENCE>${xmlEscape(inv.invoiceNo)}</REFERENCE>
          <PARTYLEDGERNAME>${xmlEscape(partyName)}</PARTYLEDGERNAME>
          <PARTYGSTIN>${xmlEscape(gstin)}</PARTYGSTIN>
          <PLACEOFSUPPLY>${xmlEscape(stateName)}</PLACEOFSUPPLY>
          <ISINVOICE>Yes</ISINVOICE>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <NARRATION>Purchase ${xmlEscape(inv.invoiceNo)} from ${xmlEscape(partyName)}</NARRATION>
`;

    // Purchase ledger (debit - we bought goods)
    xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(purchaseLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${taxableAmount.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;

    // Tax entries (debit - ITC)
    if (isInterState && igst > 0) {
      xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(igstLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;
    } else {
      if (cgst > 0) {
        xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(cgstLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;
      }
      if (sgst > 0) {
        xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(sgstLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;
      }
    }

    // Party ledger (credit - we owe vendor)
    xml += `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(partyName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>${totalAmount.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
`;

    xml += `        </VOUCHER>
      </TALLYMESSAGE>
`;
  }

  xml += `    </DATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

/**
 * Generate Tally Ledger Master XML (create party ledgers)
 * Uses official TallyPrime XML import format
 */
function generateLedgerMasters(invoices, options = {}) {
  const companyName = options.companyName || 'My Company';
  const parentGroup = options.type === 'purchase' ? 'Sundry Creditors' : 'Sundry Debtors';

  // Unique parties
  const parties = new Map();
  for (const inv of invoices) {
    const name = inv.customerName || inv.sellerName || inv.supplierName;
    const gstin = inv.customerGSTIN || inv.sellerGSTIN || inv.supplierGSTIN;
    if (name && !parties.has(name)) {
      parties.set(name, {
        name,
        gstin: gstin || '',
        stateCode: gstin ? gstin.substring(0, 2) : '',
        state: gstin ? STATE_MAP[gstin.substring(0, 2)] || '' : ''
      });
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
`;

  for (const [, party] of parties) {
    xml += `      <TALLYMESSAGE>
        <LEDGER NAME="${xmlEscape(party.name)}" ACTION="Create">
          <NAME.LIST>
            <NAME>${xmlEscape(party.name)}</NAME>
          </NAME.LIST>
          <PARENT>${xmlEscape(parentGroup)}</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
          <PARTYGSTIN>${xmlEscape(party.gstin)}</PARTYGSTIN>
          <LEDSTATENAME>${xmlEscape(party.state)}</LEDSTATENAME>
          <COUNTRYNAME>India</COUNTRYNAME>
        </LEDGER>
      </TALLYMESSAGE>
`;
  }

  xml += `    </DATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

module.exports = {
  generateSalesVouchers,
  generatePurchaseVouchers,
  generateLedgerMasters,
  toTallyDate
};
