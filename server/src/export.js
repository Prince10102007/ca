/**
 * Export Module
 * Generates Excel reports, corrected GSTR-1, and PDF summaries
 */

const XLSX = require('xlsx');

/**
 * Generate detailed discrepancy report as Excel
 */
function generateExcelReport(reconciliationResult) {
  const wb = XLSX.utils.book_new();
  const { summary, matched, mismatched, missingSalesInGSTR1, missingGSTR1InSales, duplicates, validationIssues } = reconciliationResult;

  // ─── Sheet 1: Summary ───
  const summaryData = [
    ['GST Reconciliation Summary Report'],
    ['Generated on', new Date().toLocaleDateString('en-IN')],
    [],
    ['Metric', 'Count'],
    ['Total Sales Invoices', summary.totalSalesInvoices],
    ['Total GSTR-1 Invoices', summary.totalGSTR1Invoices],
    ['Matched Invoices', summary.matched],
    ['Mismatched Invoices', summary.mismatched],
    ['Missing in GSTR-1', summary.missingSalesInGSTR1],
    ['Extra in GSTR-1 (not in Sales)', summary.missingGSTR1InSales],
    ['Total Discrepancy Amount (₹)', summary.totalDiscrepancyAmount],
    [],
    ['Match Rate', `${summary.totalSalesInvoices > 0 ? ((summary.matched / summary.totalSalesInvoices) * 100).toFixed(1) : 0}%`]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ─── Sheet 2: Mismatched Invoices ───
  if (mismatched && mismatched.length > 0) {
    const mismatchHeaders = [
      'Invoice No', 'Date', 'Customer GSTIN', 'Customer Name',
      'Sales Taxable', 'GSTR1 Taxable', 'Diff Taxable',
      'Sales CGST', 'GSTR1 CGST', 'Diff CGST',
      'Sales SGST', 'GSTR1 SGST', 'Diff SGST',
      'Sales IGST', 'GSTR1 IGST', 'Diff IGST',
      'Sales Total', 'GSTR1 Total', 'Diff Total',
      'Discrepancy Type', 'Severity'
    ];
    const mismatchRows = mismatched.map(item => {
      const s = item.salesInvoice;
      const g = item.gstr1Invoice;
      const types = item.discrepancies.map(d => d.label).join(', ');
      const maxSeverity = item.discrepancies.reduce((max, d) =>
        d.severity === 'high' ? 'high' : (d.severity === 'medium' && max !== 'high') ? 'medium' : max, 'low');

      return [
        item.invoiceNo, s.date, s.customerGSTIN, s.customerName,
        s.taxableAmount, g.taxableAmount, (s.taxableAmount || 0) - (g.taxableAmount || 0),
        s.cgst, g.cgst, (s.cgst || 0) - (g.cgst || 0),
        s.sgst, g.sgst, (s.sgst || 0) - (g.sgst || 0),
        s.igst, g.igst, (s.igst || 0) - (g.igst || 0),
        s.totalAmount, g.totalAmount, (s.totalAmount || 0) - (g.totalAmount || 0),
        types, maxSeverity
      ];
    });

    const wsMismatch = XLSX.utils.aoa_to_sheet([mismatchHeaders, ...mismatchRows]);
    wsMismatch['!cols'] = mismatchHeaders.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, wsMismatch, 'Mismatched');
  }

  // ─── Sheet 3: Missing in GSTR-1 ───
  if (missingSalesInGSTR1 && missingSalesInGSTR1.length > 0) {
    const missingHeaders = ['Invoice No', 'Date', 'Customer GSTIN', 'Customer Name',
      'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Amount', 'Action Required'];
    const missingRows = missingSalesInGSTR1.map(inv => [
      inv.invoiceNo, inv.date, inv.customerGSTIN, inv.customerName,
      inv.taxableAmount, inv.cgst, inv.sgst, inv.igst, inv.totalAmount,
      inv.suggestion || 'Add to GSTR-1'
    ]);
    const wsMissing = XLSX.utils.aoa_to_sheet([missingHeaders, ...missingRows]);
    wsMissing['!cols'] = missingHeaders.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, wsMissing, 'Missing in GSTR-1');
  }

  // ─── Sheet 4: Extra in GSTR-1 ───
  if (missingGSTR1InSales && missingGSTR1InSales.length > 0) {
    const extraHeaders = ['Invoice No', 'Date', 'Customer GSTIN',
      'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Amount', 'Action Required'];
    const extraRows = missingGSTR1InSales.map(inv => [
      inv.invoiceNo, inv.date, inv.customerGSTIN,
      inv.taxableAmount, inv.cgst, inv.sgst, inv.igst, inv.totalAmount,
      inv.suggestion || 'Verify or remove from GSTR-1'
    ]);
    const wsExtra = XLSX.utils.aoa_to_sheet([extraHeaders, ...extraRows]);
    wsExtra['!cols'] = extraHeaders.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, wsExtra, 'Extra in GSTR-1');
  }

  // ─── Sheet 5: Matched (for reference) ───
  if (matched && matched.length > 0) {
    const matchedHeaders = ['Invoice No', 'Date', 'Customer GSTIN', 'Customer Name',
      'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Amount', 'Match Type'];
    const matchedRows = matched.map(item => {
      const s = item.salesInvoice;
      return [
        item.invoiceNo, s.date, s.customerGSTIN, s.customerName,
        s.taxableAmount, s.cgst, s.sgst, s.igst, s.totalAmount,
        item.matchType || 'exact'
      ];
    });
    const wsMatched = XLSX.utils.aoa_to_sheet([matchedHeaders, ...matchedRows]);
    wsMatched['!cols'] = matchedHeaders.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, wsMatched, 'Matched');
  }

  // ─── Sheet 6: Validation Issues ───
  if (validationIssues && validationIssues.length > 0) {
    const valHeaders = ['Invoice No', 'Issue Type', 'Value', 'Message', 'Severity'];
    const valRows = validationIssues.map(issue => [
      issue.invoiceNo, issue.type, issue.value || '', issue.message, issue.severity
    ]);
    const wsVal = XLSX.utils.aoa_to_sheet([valHeaders, ...valRows]);
    wsVal['!cols'] = valHeaders.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsVal, 'Validation Issues');
  }

  // ─── Sheet 7: Duplicates ───
  if (duplicates && duplicates.length > 0) {
    const dupHeaders = ['Invoice No', 'Source', 'Count', 'Details'];
    const dupRows = duplicates.map(dup => [
      dup.invoiceNo, dup.type, dup.count,
      `Found ${dup.count} instances in ${dup.type === 'sales_duplicate' ? 'Sales Register' : 'GSTR-1'}`
    ]);
    const wsDup = XLSX.utils.aoa_to_sheet([dupHeaders, ...dupRows]);
    wsDup['!cols'] = dupHeaders.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, wsDup, 'Duplicates');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate corrected GSTR-1 ready Excel
 */
function generateCorrectedGSTR1(matchedInvoices, salesData) {
  const wb = XLSX.utils.book_new();

  // Combine matched invoices + missing invoices (everything that should be in GSTR-1)
  const allInvoices = salesData || [];

  // B2B Sheet
  const b2bInvoices = allInvoices.filter(inv =>
    inv.customerGSTIN && inv.customerGSTIN.trim()
  );

  if (b2bInvoices.length > 0) {
    const b2bHeaders = [
      'GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number',
      'Invoice Date', 'Invoice Value', 'Place of Supply',
      'Reverse Charge', 'Invoice Type', 'Rate', 'Taxable Value',
      'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'
    ];

    const b2bRows = b2bInvoices.map(inv => {
      const taxable = parseFloat(inv.taxableAmount) || 0;
      const cgst = parseFloat(inv.cgst) || 0;
      const sgst = parseFloat(inv.sgst) || 0;
      const igst = parseFloat(inv.igst) || 0;
      let rate = 0;
      if (taxable > 0) {
        rate = igst > 0 ? Math.round((igst / taxable) * 100) : Math.round(((cgst + sgst) / taxable) * 100);
      }

      return [
        inv.customerGSTIN, inv.customerName, inv.invoiceNo,
        inv.date, parseFloat(inv.totalAmount) || 0, inv.placeOfSupply || '',
        inv.reverseCharge || 'N', 'Regular', rate, taxable,
        cgst, sgst, igst, 0
      ];
    });

    const wsB2B = XLSX.utils.aoa_to_sheet([b2bHeaders, ...b2bRows]);
    wsB2B['!cols'] = b2bHeaders.map(h => ({ wch: Math.max(h.length + 2, 16) }));
    XLSX.utils.book_append_sheet(wb, wsB2B, 'B2B');
  }

  // B2C Large Sheet
  const b2clInvoices = allInvoices.filter(inv =>
    (!inv.customerGSTIN || !inv.customerGSTIN.trim()) &&
    (parseFloat(inv.totalAmount) || 0) > 250000
  );

  if (b2clInvoices.length > 0) {
    const b2clHeaders = [
      'Invoice Number', 'Invoice Date', 'Invoice Value',
      'Place of Supply', 'Rate', 'Taxable Value',
      'IGST Amount', 'Cess Amount'
    ];

    const b2clRows = b2clInvoices.map(inv => [
      inv.invoiceNo, inv.date, parseFloat(inv.totalAmount) || 0,
      inv.placeOfSupply || '', 18, parseFloat(inv.taxableAmount) || 0,
      parseFloat(inv.igst) || 0, 0
    ]);

    const wsB2CL = XLSX.utils.aoa_to_sheet([b2clHeaders, ...b2clRows]);
    wsB2CL['!cols'] = b2clHeaders.map(h => ({ wch: Math.max(h.length + 2, 16) }));
    XLSX.utils.book_append_sheet(wb, wsB2CL, 'B2CL');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate PDF summary report using pdfmake
 */
function generatePDFReport(reconciliationResult, period) {
  const PdfPrinter = require('pdfmake');
  const { summary, mismatched, missingSalesInGSTR1, validationIssues } = reconciliationResult;

  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  };
  const printer = new PdfPrinter(fonts);

  const matchRate = summary.totalSalesInvoices > 0
    ? ((summary.matched / summary.totalSalesInvoices) * 100).toFixed(1) : '0';

  const content = [
    { text: 'GST Reconciliation Report', style: 'header' },
    { text: `Period: ${period || 'Not specified'}`, style: 'subheader' },
    { text: `Generated: ${new Date().toLocaleDateString('en-IN')}`, margin: [0, 0, 0, 20] },

    { text: 'Summary', style: 'sectionHeader' },
    {
      table: {
        widths: ['*', 'auto'],
        body: [
          ['Total Sales Invoices', { text: String(summary.totalSalesInvoices), alignment: 'right' }],
          ['Total GSTR-1 Invoices', { text: String(summary.totalGSTR1Invoices), alignment: 'right' }],
          ['Matched', { text: String(summary.matched), alignment: 'right', color: 'green' }],
          ['Mismatched', { text: String(summary.mismatched), alignment: 'right', color: 'red' }],
          ['Missing in GSTR-1', { text: String(summary.missingSalesInGSTR1), alignment: 'right', color: 'red' }],
          ['Extra in GSTR-1', { text: String(summary.missingGSTR1InSales), alignment: 'right', color: 'orange' }],
          ['Match Rate', { text: `${matchRate}%`, alignment: 'right', bold: true }],
          ['Total Discrepancy (Rs.)', { text: `Rs. ${summary.totalDiscrepancyAmount.toLocaleString('en-IN')}`, alignment: 'right', bold: true }]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 20]
    }
  ];

  // Mismatched details (top 20)
  if (mismatched && mismatched.length > 0) {
    content.push({ text: `Mismatched Invoices (${mismatched.length})`, style: 'sectionHeader' });

    const tableBody = [
      [
        { text: 'Invoice No', bold: true },
        { text: 'Customer', bold: true },
        { text: 'Sales Amt', bold: true },
        { text: 'GSTR-1 Amt', bold: true },
        { text: 'Difference', bold: true }
      ]
    ];

    mismatched.slice(0, 20).forEach(item => {
      tableBody.push([
        item.invoiceNo,
        (item.salesInvoice.customerName || '').substring(0, 20),
        { text: `Rs. ${(item.salesInvoice.totalAmount || 0).toLocaleString('en-IN')}`, alignment: 'right' },
        { text: `Rs. ${(item.gstr1Invoice.totalAmount || 0).toLocaleString('en-IN')}`, alignment: 'right' },
        { text: `Rs. ${item.totalDifference.toLocaleString('en-IN')}`, alignment: 'right', color: 'red' }
      ]);
    });

    content.push({
      table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto'], body: tableBody },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 20]
    });

    if (mismatched.length > 20) {
      content.push({ text: `... and ${mismatched.length - 20} more mismatched invoices`, italics: true, margin: [0, 0, 0, 20] });
    }
  }

  // Missing invoices (top 20)
  if (missingSalesInGSTR1 && missingSalesInGSTR1.length > 0) {
    content.push({ text: `Missing in GSTR-1 (${missingSalesInGSTR1.length})`, style: 'sectionHeader' });

    const tableBody = [
      [
        { text: 'Invoice No', bold: true },
        { text: 'Date', bold: true },
        { text: 'Customer', bold: true },
        { text: 'Amount', bold: true }
      ]
    ];

    missingSalesInGSTR1.slice(0, 20).forEach(inv => {
      tableBody.push([
        inv.invoiceNo,
        inv.date || '',
        (inv.customerName || '').substring(0, 25),
        { text: `Rs. ${(inv.totalAmount || 0).toLocaleString('en-IN')}`, alignment: 'right' }
      ]);
    });

    content.push({
      table: { headerRows: 1, widths: ['auto', 'auto', '*', 'auto'], body: tableBody },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 20]
    });
  }

  // Validation issues count
  if (validationIssues && validationIssues.length > 0) {
    content.push({ text: `Validation Issues (${validationIssues.length})`, style: 'sectionHeader' });

    const issueTypes = {};
    validationIssues.forEach(i => {
      issueTypes[i.type] = (issueTypes[i.type] || 0) + 1;
    });

    const issueBody = [
      [{ text: 'Issue Type', bold: true }, { text: 'Count', bold: true }]
    ];
    Object.entries(issueTypes).forEach(([type, count]) => {
      issueBody.push([type.replace(/_/g, ' '), { text: String(count), alignment: 'right' }]);
    });

    content.push({
      table: { widths: ['*', 'auto'], body: issueBody },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 20]
    });
  }

  // Footer disclaimer
  content.push({
    text: 'This report is generated for reconciliation purposes. Please verify all data before filing returns.',
    italics: true, fontSize: 8, margin: [0, 30, 0, 0], color: '#666'
  });

  const docDefinition = {
    content,
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 12, color: '#555', margin: [0, 0, 0, 5] },
      sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 8], color: '#1a56db' }
    },
    pageMargins: [40, 40, 40, 40]
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];

  return new Promise((resolve, reject) => {
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

module.exports = {
  generateExcelReport,
  generateCorrectedGSTR1,
  generatePDFReport
};
