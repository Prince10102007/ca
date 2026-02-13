/**
 * Tally Export Module
 * Generates Tally-compatible XML vouchers for bulk import
 * Supports Tally ERP 9 and Tally Prime XML format
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
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`;
  }
  return dateStr.replace(/-/g, '');
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
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
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

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${xmlEscape(voucherType)}" ACTION="Create" OBJCLS="Voucher" REMOTEID="">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>${xmlEscape(voucherType)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${xmlEscape(inv.invoiceNo)}</VOUCHERNUMBER>
            <REFERENCE>${xmlEscape(inv.invoiceNo)}</REFERENCE>
            <PARTYLEDGERNAME>${xmlEscape(partyName)}</PARTYLEDGERNAME>
            <PARTYGSTIN>${xmlEscape(gstin)}</PARTYGSTIN>
            <PLACEOFSUPPLY>${xmlEscape(stateName)}</PLACEOFSUPPLY>
            <ISGSTAPPLICABLE>Yes</ISGSTAPPLICABLE>
            <GSTTYPEOFSUPPLY>${isInterState ? 'Interstate' : 'Intrastate'}</GSTTYPEOFSUPPLY>
            <NARRATION>Sales Invoice ${xmlEscape(inv.invoiceNo)} to ${xmlEscape(partyName)}</NARRATION>
            <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
`;

    // Party ledger entry (debit - customer owes total)
    xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(partyName)}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;

    // Sales ledger entry (credit - taxable amount)
    xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(salesLedger)}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${taxableAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;

    // Tax entries
    if (isInterState && igst > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(igstLedger)}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${igst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    } else {
      if (cgst > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(cgstLedger)}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
      if (sgst > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(sgstLedger)}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
    }

    xml += `          </VOUCHER>
        </TALLYMESSAGE>
`;
  }

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

/**
 * Generate Tally-compatible XML for purchase vouchers
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
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
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

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${xmlEscape(voucherType)}" ACTION="Create" OBJCLS="Voucher" REMOTEID="">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>${xmlEscape(voucherType)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${xmlEscape(inv.invoiceNo)}</VOUCHERNUMBER>
            <REFERENCE>${xmlEscape(inv.invoiceNo)}</REFERENCE>
            <PARTYLEDGERNAME>${xmlEscape(partyName)}</PARTYLEDGERNAME>
            <PARTYGSTIN>${xmlEscape(gstin)}</PARTYGSTIN>
            <PLACEOFSUPPLY>${xmlEscape(stateName)}</PLACEOFSUPPLY>
            <ISGSTAPPLICABLE>Yes</ISGSTAPPLICABLE>
            <GSTTYPEOFSUPPLY>${isInterState ? 'Interstate' : 'Intrastate'}</GSTTYPEOFSUPPLY>
            <NARRATION>Purchase ${xmlEscape(inv.invoiceNo)} from ${xmlEscape(partyName)}</NARRATION>
            <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
`;

    // Purchase ledger (debit - we bought goods)
    xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(purchaseLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${taxableAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;

    // Tax entries (debit - ITC)
    if (isInterState && igst > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(igstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    } else {
      if (cgst > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(cgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
      if (sgst > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(sgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
    }

    // Party ledger (credit - we owe vendor)
    xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEscape(partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;

    xml += `          </VOUCHER>
        </TALLYMESSAGE>
`;
  }

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

/**
 * Generate Tally Ledger Master XML (create party ledgers)
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
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  for (const [, party] of parties) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
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

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
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
