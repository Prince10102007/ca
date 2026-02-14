/**
 * Generate a sample GST invoice PDF and PNG for OCR testing
 */
const pdfmake = require('pdfmake');
const fs = require('fs');
const path = require('path');

// pdfmake fonts
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
const printer = new pdfmake(fonts);

const docDefinition = {
  defaultStyle: { font: 'Helvetica', fontSize: 9 },
  pageSize: 'A4',
  pageMargins: [40, 30, 40, 30],
  content: [
    { text: 'TAX INVOICE', style: 'title', alignment: 'center', margin: [0, 0, 0, 10] },
    {
      columns: [
        {
          width: '50%',
          stack: [
            { text: 'SHARMA ELECTRONICS PVT LTD', bold: true, fontSize: 12 },
            { text: '45, MG Road, Andheri East', margin: [0, 2, 0, 0] },
            { text: 'Mumbai, Maharashtra - 400069' },
            { text: 'GSTIN: 27AABCS1234R1ZP', bold: true, margin: [0, 4, 0, 0] },
            { text: 'PAN: AABCS1234R' },
            { text: 'State: 27 - Maharashtra' },
          ]
        },
        {
          width: '50%',
          stack: [
            { text: 'Invoice No: INV/2025/0847', bold: true, fontSize: 10 },
            { text: 'Date: 15-06-2025', margin: [0, 2, 0, 0] },
            { text: 'Place of Supply: Maharashtra (27)' },
            { text: 'Reverse Charge: No', margin: [0, 2, 0, 0] },
          ],
          alignment: 'right'
        }
      ],
      margin: [0, 0, 0, 15]
    },
    // Buyer Details
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'Bill To:', bold: true },
                { text: 'PATEL TRADING COMPANY', bold: true, fontSize: 10, margin: [0, 2, 0, 0] },
                { text: '78, Laxmi Nagar, Pune, Maharashtra - 411001' },
                { text: 'GSTIN: 27AABCP5678S1ZQ', bold: true },
                { text: 'State: 27 - Maharashtra' },
              ],
              margin: [5, 5, 5, 5]
            }
          ]
        ]
      },
      margin: [0, 0, 0, 15]
    },
    // Items Table
    {
      table: {
        headerRows: 1,
        widths: [20, '*', 50, 40, 60, 60, 30, 45, 45, 60],
        body: [
          [
            { text: '#', bold: true, fillColor: '#e8e8e8' },
            { text: 'Description', bold: true, fillColor: '#e8e8e8' },
            { text: 'HSN', bold: true, fillColor: '#e8e8e8' },
            { text: 'Qty', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
            { text: 'Rate', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
            { text: 'Amount', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
            { text: 'GST%', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
            { text: 'CGST', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
            { text: 'SGST', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
            { text: 'Total', bold: true, fillColor: '#e8e8e8', alignment: 'right' },
          ],
          [
            '1',
            'Samsung Galaxy M34 5G Mobile',
            '8517',
            { text: '5', alignment: 'right' },
            { text: '14,999.00', alignment: 'right' },
            { text: '74,995.00', alignment: 'right' },
            { text: '18%', alignment: 'right' },
            { text: '6,749.55', alignment: 'right' },
            { text: '6,749.55', alignment: 'right' },
            { text: '88,494.10', alignment: 'right' },
          ],
          [
            '2',
            'Boat Airdopes 141 Earbuds',
            '8518',
            { text: '10', alignment: 'right' },
            { text: '1,299.00', alignment: 'right' },
            { text: '12,990.00', alignment: 'right' },
            { text: '18%', alignment: 'right' },
            { text: '1,169.10', alignment: 'right' },
            { text: '1,169.10', alignment: 'right' },
            { text: '15,328.20', alignment: 'right' },
          ],
          [
            '3',
            'USB-C Charging Cable 1m',
            '8544',
            { text: '20', alignment: 'right' },
            { text: '199.00', alignment: 'right' },
            { text: '3,980.00', alignment: 'right' },
            { text: '18%', alignment: 'right' },
            { text: '358.20', alignment: 'right' },
            { text: '358.20', alignment: 'right' },
            { text: '4,696.40', alignment: 'right' },
          ],
        ]
      },
      margin: [0, 0, 0, 10]
    },
    // Summary
    {
      columns: [
        { width: '55%', text: '' },
        {
          width: '45%',
          table: {
            widths: ['*', 80],
            body: [
              [
                { text: 'Taxable Amount:', alignment: 'right' },
                { text: '91,965.00', alignment: 'right', bold: true }
              ],
              [
                { text: 'CGST @ 9%:', alignment: 'right' },
                { text: '8,276.85', alignment: 'right' }
              ],
              [
                { text: 'SGST @ 9%:', alignment: 'right' },
                { text: '8,276.85', alignment: 'right' }
              ],
              [
                { text: 'IGST:', alignment: 'right' },
                { text: '0.00', alignment: 'right' }
              ],
              [
                { text: 'Round Off:', alignment: 'right' },
                { text: '0.30', alignment: 'right' }
              ],
              [
                { text: 'TOTAL AMOUNT:', alignment: 'right', bold: true, fontSize: 11 },
                { text: '1,08,519.00', alignment: 'right', bold: true, fontSize: 11 }
              ],
            ]
          },
          layout: 'noBorders'
        }
      ],
      margin: [0, 0, 0, 15]
    },
    {
      text: 'Amount in Words: One Lakh Eight Thousand Five Hundred Nineteen Rupees Only',
      italics: true,
      margin: [0, 0, 0, 15]
    },
    // Bank Details
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            {
              stack: [
                { text: 'Bank Details:', bold: true },
                { text: 'Bank: State Bank of India' },
                { text: 'A/C No: 39876543210' },
                { text: 'IFSC: SBIN0001234' },
                { text: 'Branch: Andheri East' },
              ],
              margin: [5, 5, 5, 5]
            },
            {
              stack: [
                { text: 'For SHARMA ELECTRONICS PVT LTD', bold: true, alignment: 'right' },
                { text: '\n\n\n' },
                { text: 'Authorized Signatory', alignment: 'right' },
              ],
              margin: [5, 5, 5, 5]
            }
          ]
        ]
      }
    },
    { text: '\nThis is a computer generated invoice.', fontSize: 7, alignment: 'center', color: '#888888' }
  ],
  styles: {
    title: { fontSize: 16, bold: true }
  }
};

const outputDir = path.join(__dirname);

// Generate PDF
const pdfDoc = printer.createPdfKitDocument(docDefinition);
const pdfPath = path.join(outputDir, 'sample-invoice.pdf');
pdfDoc.pipe(fs.createWriteStream(pdfPath));
pdfDoc.end();
console.log('Generated:', pdfPath);

// Also generate a second invoice as simple text-based image simulation
// Create a text file that shows what the invoice data should extract to
const expectedData = {
  invoiceNo: 'INV/2025/0847',
  date: '15-06-2025',
  sellerName: 'SHARMA ELECTRONICS PVT LTD',
  sellerGSTIN: '27AABCS1234R1ZP',
  buyerName: 'PATEL TRADING COMPANY',
  buyerGSTIN: '27AABCP5678S1ZQ',
  placeOfSupply: 'Maharashtra',
  items: [
    { description: 'Samsung Galaxy M34 5G Mobile', hsn: '8517', qty: 5, rate: 14999, amount: 74995 },
    { description: 'Boat Airdopes 141 Earbuds', hsn: '8518', qty: 10, rate: 1299, amount: 12990 },
    { description: 'USB-C Charging Cable 1m', hsn: '8544', qty: 20, rate: 199, amount: 3980 },
  ],
  taxableAmount: 91965,
  cgstRate: 9,
  cgst: 8276.85,
  sgstRate: 9,
  sgst: 8276.85,
  igst: 0,
  totalAmount: 108519,
  reverseCharge: 'N'
};

fs.writeFileSync(
  path.join(outputDir, 'sample-invoice-expected.json'),
  JSON.stringify(expectedData, null, 2)
);
console.log('Generated: sample-invoice-expected.json (expected OCR output)');
console.log('\nTest files ready! Upload sample-invoice.pdf to the OCR page.');
