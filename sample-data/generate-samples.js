/**
 * Generate sample data files for testing the GST Reconciliation Tool
 * Run: node generate-samples.js
 */

const XLSX = require('../server/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

// Sample GSTINs (valid format)
const CUSTOMERS = [
  { gstin: '27AABCU9603R1ZM', name: 'ABC Pvt Ltd', state: 'Maharashtra' },
  { gstin: '29AABCT1332L1ZL', name: 'XYZ Technologies', state: 'Karnataka' },
  { gstin: '27AAACT2727Q1ZV', name: 'PQR Services Pvt Ltd', state: 'Maharashtra' },
  { gstin: '07AADCB2230M1Z3', name: 'Delhi Traders', state: 'Delhi' },
  { gstin: '33AABCS5765D1ZQ', name: 'Chennai Exports', state: 'Tamil Nadu' },
  { gstin: '24AADCJ6812A1ZM', name: 'Gujarat Industries', state: 'Gujarat' },
  { gstin: '27AAGCR4375J1ZU', name: 'Reliable Enterprises', state: 'Maharashtra' },
  { gstin: '29AABCM9407D1ZL', name: 'Mysore Manufacturing', state: 'Karnataka' },
  { gstin: '06AABCN8849E1ZJ', name: 'Haryana Constructions', state: 'Haryana' },
  { gstin: '09AABCP3957K1ZD', name: 'UP Beverages Ltd', state: 'Uttar Pradesh' },
  { gstin: '27AABCL9876M1ZP', name: 'Laxmi Trading Co', state: 'Maharashtra' },
  { gstin: '33AABCD1234F1ZS', name: 'Deepak Enterprises', state: 'Tamil Nadu' },
  { gstin: '24AABCE5678G1ZR', name: 'Eshan Polymers', state: 'Gujarat' },
  { gstin: '29AABCF9012H1ZQ', name: 'Flipkart India Pvt Ltd', state: 'Karnataka' },
  { gstin: '07AABCG3456J1ZP', name: 'Global Solutions Delhi', state: 'Delhi' },
];

const HSN_CODES = ['9983', '9954', '9971', '9988', '9973', '8471', '8517', '3926', '7318', '8504'];
const RATES = [5, 12, 18, 28];

function randomDate(month, year) {
  const day = Math.floor(Math.random() * 28) + 1;
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

function generateSalesRegister() {
  const invoices = [];
  let invNum = 1;

  // Generate invoices for Jan-Mar 2024 (3 months)
  for (let month = 1; month <= 3; month++) {
    const count = 30 + Math.floor(Math.random() * 20); // 30-50 per month
    for (let i = 0; i < count; i++) {
      const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
      const isInterState = customer.state !== 'Maharashtra'; // Assume seller is in MH
      const rate = RATES[Math.floor(Math.random() * RATES.length)];
      const taxableAmount = Math.round((Math.random() * 200000 + 5000) * 100) / 100;
      const halfRate = rate / 2;

      const cgst = isInterState ? 0 : Math.round(taxableAmount * halfRate / 100 * 100) / 100;
      const sgst = isInterState ? 0 : Math.round(taxableAmount * halfRate / 100 * 100) / 100;
      const igst = isInterState ? Math.round(taxableAmount * rate / 100 * 100) / 100 : 0;
      const totalAmount = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;

      invoices.push({
        'Invoice No': `INV-2024-${String(invNum++).padStart(4, '0')}`,
        'Date': randomDate(month, 2024),
        'Customer GSTIN': customer.gstin,
        'Customer Name': customer.name,
        'HSN Code': HSN_CODES[Math.floor(Math.random() * HSN_CODES.length)],
        'Taxable Amount': taxableAmount,
        'CGST Rate': isInterState ? 0 : halfRate,
        'CGST': cgst,
        'SGST Rate': isInterState ? 0 : halfRate,
        'SGST': sgst,
        'IGST Rate': isInterState ? rate : 0,
        'IGST': igst,
        'Total Amount': totalAmount,
        'Place of Supply': customer.state,
        'Reverse Charge': 'N'
      });
    }
  }

  return invoices;
}

function generateGSTR1Data(salesInvoices) {
  const gstr1Invoices = [];

  for (const inv of salesInvoices) {
    const random = Math.random();

    // 80% match perfectly
    if (random < 0.80) {
      gstr1Invoices.push({ ...inv });
    }
    // 8% have amount differences (rounding, data entry errors)
    else if (random < 0.88) {
      const diff = (Math.random() - 0.5) * 200; // +/- ₹100
      const newTaxable = Math.round((inv['Taxable Amount'] + diff) * 100) / 100;
      const rate = inv['IGST Rate'] || (inv['CGST Rate'] * 2);
      const isInterState = inv['IGST'] > 0;
      const cgst = isInterState ? 0 : Math.round(newTaxable * (rate / 2) / 100 * 100) / 100;
      const sgst = isInterState ? 0 : Math.round(newTaxable * (rate / 2) / 100 * 100) / 100;
      const igst = isInterState ? Math.round(newTaxable * rate / 100 * 100) / 100 : 0;

      gstr1Invoices.push({
        ...inv,
        'Taxable Amount': newTaxable,
        'CGST': cgst,
        'SGST': sgst,
        'IGST': igst,
        'Total Amount': Math.round((newTaxable + cgst + sgst + igst) * 100) / 100
      });
    }
    // 5% missing from GSTR-1 (not added)
    else if (random < 0.93) {
      // Skip - not in GSTR-1
    }
    // 4% have GSTIN typos
    else if (random < 0.97) {
      const wrongGSTIN = inv['Customer GSTIN'].slice(0, -2) + 'XX';
      gstr1Invoices.push({
        ...inv,
        'Customer GSTIN': wrongGSTIN
      });
    }
    // 3% have date differences
    else {
      const parts = inv['Date'].split('-');
      const newDay = Math.max(1, Math.min(28, parseInt(parts[0]) + (Math.random() > 0.5 ? 1 : -1)));
      gstr1Invoices.push({
        ...inv,
        'Date': `${String(newDay).padStart(2, '0')}-${parts[1]}-${parts[2]}`
      });
    }
  }

  // Add a few extra invoices in GSTR-1 (not in sales register)
  for (let i = 0; i < 5; i++) {
    const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    const isInterState = customer.state !== 'Maharashtra';
    const taxableAmount = Math.round(Math.random() * 50000 * 100) / 100;
    const rate = 18;

    gstr1Invoices.push({
      'Invoice No': `EXTRA-${String(i + 1).padStart(3, '0')}`,
      'Date': randomDate(Math.floor(Math.random() * 3) + 1, 2024),
      'Customer GSTIN': customer.gstin,
      'Customer Name': customer.name,
      'HSN Code': '9983',
      'Taxable Amount': taxableAmount,
      'CGST Rate': isInterState ? 0 : 9,
      'CGST': isInterState ? 0 : Math.round(taxableAmount * 0.09 * 100) / 100,
      'SGST Rate': isInterState ? 0 : 9,
      'SGST': isInterState ? 0 : Math.round(taxableAmount * 0.09 * 100) / 100,
      'IGST Rate': isInterState ? 18 : 0,
      'IGST': isInterState ? Math.round(taxableAmount * 0.18 * 100) / 100 : 0,
      'Total Amount': Math.round(taxableAmount * 1.18 * 100) / 100,
      'Place of Supply': customer.state,
      'Reverse Charge': 'N'
    });
  }

  return gstr1Invoices;
}

function generateGSTR1JSON(gstr1Data) {
  // Group B2B by GSTIN
  const b2bMap = {};
  for (const inv of gstr1Data) {
    if (!inv['Customer GSTIN']) continue;
    const gstin = inv['Customer GSTIN'];
    if (!b2bMap[gstin]) {
      b2bMap[gstin] = [];
    }

    // Parse date
    const dateParts = inv['Date'].split('-');
    const dateStr = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;

    b2bMap[gstin].push({
      inum: inv['Invoice No'],
      idt: dateStr,
      val: inv['Total Amount'],
      pos: getStateCode(inv['Place of Supply']),
      rchrg: inv['Reverse Charge'] || 'N',
      typ: 'R',
      itms: [{
        num: 1,
        itm_det: {
          txval: inv['Taxable Amount'],
          rt: inv['IGST Rate'] || (inv['CGST Rate'] * 2),
          camt: inv['CGST'] || 0,
          samt: inv['SGST'] || 0,
          iamt: inv['IGST'] || 0,
          csamt: 0
        }
      }]
    });
  }

  const b2b = Object.entries(b2bMap).map(([ctin, invs]) => ({
    ctin,
    inv: invs
  }));

  return {
    gstin: '27AADCS0472N1Z1',
    fp: '012024',
    b2b,
    b2cl: [],
    b2cs: [],
    nil: { inv: [] },
    cdnr: [],
    cdnur: [],
    exp: { exp_typ: 'WPAY', inv: [] },
    at: [],
    txpd: [],
    hsn: { data: [] },
    doc_issue: { doc_det: [] }
  };
}

function getStateCode(stateName) {
  const codes = {
    'Maharashtra': '27', 'Karnataka': '29', 'Tamil Nadu': '33',
    'Gujarat': '24', 'Delhi': '07', 'Haryana': '06',
    'Uttar Pradesh': '09', 'Rajasthan': '08'
  };
  return codes[stateName] || '27';
}

// ─── Generate Files ───

console.log('Generating sample data...');

const salesData = generateSalesRegister();
console.log(`Generated ${salesData.length} sales invoices`);

const gstr1Data = generateGSTR1Data(salesData);
console.log(`Generated ${gstr1Data.length} GSTR-1 records`);

// Write Sales Register Excel
const salesWB = XLSX.utils.book_new();
const salesWS = XLSX.utils.json_to_sheet(salesData);
salesWS['!cols'] = Object.keys(salesData[0]).map(k => ({ wch: Math.max(k.length + 2, 15) }));
XLSX.utils.book_append_sheet(salesWB, salesWS, 'Sales Register');
XLSX.writeFile(salesWB, path.join(__dirname, 'sales-register-sample.xlsx'));
console.log('Created: sales-register-sample.xlsx');

// Write GSTR-1 Excel
const gstr1WB = XLSX.utils.book_new();
const gstr1WS = XLSX.utils.json_to_sheet(gstr1Data);
gstr1WS['!cols'] = Object.keys(gstr1Data[0]).map(k => ({ wch: Math.max(k.length + 2, 15) }));
XLSX.utils.book_append_sheet(gstr1WB, gstr1WS, 'GSTR-1');
XLSX.writeFile(gstr1WB, path.join(__dirname, 'gstr1-data-sample.xlsx'));
console.log('Created: gstr1-data-sample.xlsx');

// Write GSTR-1 JSON
const gstr1JSON = generateGSTR1JSON(gstr1Data);
fs.writeFileSync(
  path.join(__dirname, 'gstr1-sample.json'),
  JSON.stringify(gstr1JSON, null, 2)
);
console.log('Created: gstr1-sample.json');

// Write CSV version of sales
const salesCSV = [
  Object.keys(salesData[0]).join(','),
  ...salesData.map(row => Object.values(row).map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(','))
].join('\n');
fs.writeFileSync(path.join(__dirname, 'sales-register-sample.csv'), salesCSV);
console.log('Created: sales-register-sample.csv');

console.log('\nSample data generation complete!');
console.log(`Sales: ${salesData.length} invoices, GSTR-1: ${gstr1Data.length} records`);
console.log('Expected: ~80% match, ~8% amount mismatch, ~5% missing, ~4% GSTIN error, ~3% date mismatch');
