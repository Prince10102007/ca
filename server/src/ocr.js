/**
 * OCR Module — Hybrid Invoice Data Extraction
 * Tier 1: Tesseract.js (free, local) for clean digital PDFs
 * Tier 2: Claude Vision API for photos/scans/handwritten
 */

const Tesseract = require('tesseract.js');
const Anthropic = require('@anthropic-ai/sdk').default;
const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Claude client — supports per-request API key from user or env fallback
let claude = null;
function getClaudeClient(requestApiKey) {
  // Per-request key takes priority (user-provided from Settings page)
  if (requestApiKey) {
    return new Anthropic({ apiKey: requestApiKey });
  }
  // Fallback to server env var
  if (!claude && process.env.ANTHROPIC_API_KEY) {
    claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return claude;
}

// Tesseract worker pool
let tesseractWorker = null;
async function getTesseractWorker() {
  if (!tesseractWorker) {
    try {
      // Try eng+hin first, fall back to eng only
      tesseractWorker = await Tesseract.createWorker('eng+hin');
    } catch (err) {
      console.log('Hindi language data not available, using English only:', err.message);
      try {
        tesseractWorker = await Tesseract.createWorker('eng');
      } catch (err2) {
        console.error('Tesseract worker creation failed:', err2.message);
        throw err2;
      }
    }
  }
  return tesseractWorker;
}

/**
 * Extract invoice data from a file (image or PDF)
 * Automatically chooses the best OCR backend
 */
async function extractInvoiceData(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const forceAI = options.forceAI || false;
  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'].includes(ext);
  const isPDF = ext === '.pdf';

  if (!isImage && !isPDF) {
    throw new Error(`Unsupported file type: ${ext}. Use JPG, PNG, or PDF.`);
  }

  let tesseractResult = null;

  // Step 1: Try Tesseract first (free, local) unless forceAI
  if (!forceAI) {
    try {
      tesseractResult = await extractWithTesseract(filePath, isPDF);
      // If good confidence and found invoice number, return immediately
      if (tesseractResult && tesseractResult.confidence >= 70 && tesseractResult.data.invoiceNo) {
        tesseractResult.method = 'tesseract';
        return tesseractResult;
      }
    } catch (err) {
      console.log('Tesseract OCR failed:', err.message);
    }
  }

  // Step 2: Try Claude Vision API (more accurate) — uses per-request key or env key
  const requestApiKey = options.anthropicKey || null;
  const client = getClaudeClient(requestApiKey);
  if (client) {
    try {
      const aiResult = await extractWithClaude(filePath, isPDF, requestApiKey);
      aiResult.method = 'claude-vision';
      return aiResult;
    } catch (err) {
      console.error('Claude Vision failed:', err.message);
    }
  }

  // Step 3: Return whatever Tesseract got (even low confidence / partial data)
  if (tesseractResult && tesseractResult.data) {
    tesseractResult.method = 'tesseract-only';
    if (!client) {
      tesseractResult.warning = 'For better accuracy on photos/scans, add your Anthropic API key in Settings';
    }
    return tesseractResult;
  }

  // Step 4: Nothing worked — return a helpful error
  throw new Error(
    'Could not extract data from this file. ' +
    (isPDF ? 'PDF conversion may not be supported — try uploading as JPG/PNG instead. ' : '') +
    'For best results, upload a clear, high-resolution image of the invoice.'
  );
}

/**
 * Extract using Tesseract.js (local, free)
 */
async function extractWithTesseract(filePath, isPDF) {
  let imagePath = filePath;
  let pdfTextFallback = null;

  // If PDF, try to extract embedded text directly first (works great for digital PDFs)
  if (isPDF) {
    try {
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      if (pdfData.text && pdfData.text.trim().length > 50) {
        // Digital PDF with embedded text — parse directly, no OCR needed
        console.log('PDF text extracted directly, length:', pdfData.text.length);
        const extracted = parseOCRText(pdfData.text);
        return {
          data: extracted,
          rawText: pdfData.text,
          confidence: 85,
          method: 'pdf-text'
        };
      }
      pdfTextFallback = pdfData.text;
    } catch (err) {
      console.log('PDF text extraction failed, trying image conversion:', err.message);
    }

    // Scanned PDF — try converting to image for OCR
    try {
      imagePath = filePath + '.png';
      await pdfToImage(filePath, imagePath);
    } catch (err) {
      console.log('PDF to image failed:', err.message);
      // Return whatever pdf-parse got
      if (pdfTextFallback && pdfTextFallback.trim().length > 10) {
        const extracted = parseOCRText(pdfTextFallback);
        return {
          data: extracted,
          rawText: pdfTextFallback,
          confidence: 40,
          method: 'pdf-text-partial',
          warning: 'Limited text extracted from PDF. For scanned PDFs, convert to JPG/PNG for better results.'
        };
      }
      throw new Error('Cannot process this PDF. Please convert to JPG/PNG and re-upload.');
    }
  }

  const worker = await getTesseractWorker();
  const { data } = await worker.recognize(imagePath);

  // Clean up temp image
  if (isPDF && imagePath !== filePath && fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }

  const text = data.text;
  const confidence = data.confidence;

  // Parse the OCR text to extract invoice fields
  const extracted = parseOCRText(text);

  return {
    data: extracted,
    rawText: text,
    confidence: confidence,
    method: 'tesseract'
  };
}

/**
 * Extract using Claude Vision API (AI-powered)
 */
async function extractWithClaude(filePath, isPDF, requestApiKey) {
  const client = getClaudeClient(requestApiKey);
  if (!client) throw new Error('No API key configured. Add your Anthropic API key in Settings.');

  let imageData, mediaType;

  if (isPDF) {
    // Convert PDF first page to image for Claude
    const imagePath = filePath + '.claude.png';
    await pdfToImage(filePath, imagePath);
    imageData = fs.readFileSync(imagePath).toString('base64');
    mediaType = 'image/png';
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  } else {
    // Optimize image for API (resize if too large)
    const optimized = await optimizeImage(filePath);
    imageData = optimized.buffer.toString('base64');
    mediaType = optimized.mediaType;
  }

  const prompt = `Extract ALL data from this Indian GST invoice image. Return ONLY a JSON object with these exact fields:

{
  "invoiceNo": "invoice/bill number",
  "date": "DD-MM-YYYY format",
  "sellerName": "seller/supplier company name",
  "sellerGSTIN": "15-character GSTIN of seller",
  "buyerName": "buyer/customer company name",
  "buyerGSTIN": "15-character GSTIN of buyer",
  "placeOfSupply": "state name",
  "hsnCode": "HSN/SAC code if visible",
  "items": [
    {
      "description": "item name",
      "hsn": "HSN code",
      "qty": 0,
      "rate": 0,
      "amount": 0
    }
  ],
  "taxableAmount": 0,
  "cgstRate": 0,
  "cgst": 0,
  "sgstRate": 0,
  "sgst": 0,
  "igstRate": 0,
  "igst": 0,
  "cess": 0,
  "totalAmount": 0,
  "roundOff": 0,
  "reverseCharge": "N",
  "irn": "IRN number if present",
  "ewaybill": "e-way bill number if present"
}

Important:
- All amounts must be numbers (not strings)
- Date must be DD-MM-YYYY
- GSTIN must be exactly 15 characters
- If a field is not visible, use null
- Return ONLY valid JSON, no other text`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageData }
        },
        { type: 'text', text: prompt }
      ]
    }]
  });

  // Parse Claude's response
  const responseText = response.content[0].text;
  let parsed;
  try {
    // Extract JSON from response (Claude sometimes adds markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (err) {
    throw new Error('Failed to parse AI response: ' + err.message);
  }

  // Normalize the extracted data
  const normalized = {
    invoiceNo: parsed.invoiceNo || null,
    date: parsed.date || null,
    sellerName: parsed.sellerName || null,
    sellerGSTIN: parsed.sellerGSTIN ? parsed.sellerGSTIN.replace(/[^A-Z0-9]/gi, '').toUpperCase() : null,
    customerName: parsed.buyerName || null,
    customerGSTIN: parsed.buyerGSTIN ? parsed.buyerGSTIN.replace(/[^A-Z0-9]/gi, '').toUpperCase() : null,
    placeOfSupply: parsed.placeOfSupply || null,
    hsnCode: parsed.hsnCode || (parsed.items && parsed.items[0] ? parsed.items[0].hsn : null),
    items: parsed.items || [],
    taxableAmount: parseFloat(parsed.taxableAmount) || 0,
    cgstRate: parseFloat(parsed.cgstRate) || 0,
    cgst: parseFloat(parsed.cgst) || 0,
    sgstRate: parseFloat(parsed.sgstRate) || 0,
    sgst: parseFloat(parsed.sgst) || 0,
    igstRate: parseFloat(parsed.igstRate) || 0,
    igst: parseFloat(parsed.igst) || 0,
    cess: parseFloat(parsed.cess) || 0,
    totalAmount: parseFloat(parsed.totalAmount) || 0,
    reverseCharge: parsed.reverseCharge || 'N',
    irn: parsed.irn || null,
    ewaybill: parsed.ewaybill || null
  };

  return {
    data: normalized,
    confidence: 95, // Claude typically very accurate
    method: 'claude-vision',
    tokensUsed: response.usage ? response.usage.input_tokens + response.usage.output_tokens : 0
  };
}

/**
 * Parse OCR text from Tesseract to extract invoice fields using regex
 */
function parseOCRText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toUpperCase();

  const result = {
    invoiceNo: null,
    date: null,
    sellerName: null,
    sellerGSTIN: null,
    customerName: null,
    customerGSTIN: null,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount: 0,
    hsnCode: null,
    placeOfSupply: null,
    items: []
  };

  // Extract GSTINs (15 character pattern)
  const gstinPattern = /\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9])\b/g;
  const gstins = [];
  let match;
  while ((match = gstinPattern.exec(fullText)) !== null) {
    gstins.push(match[1]);
  }
  if (gstins.length >= 1) result.sellerGSTIN = gstins[0];
  if (gstins.length >= 2) result.customerGSTIN = gstins[1];

  // Extract Invoice Number
  const invPatterns = [
    /(?:INVOICE\s*(?:NO|NUMBER|#)[.:;\s]*)\s*([A-Z0-9\-\/]+)/i,
    /(?:BILL\s*(?:NO|NUMBER|#)[.:;\s]*)\s*([A-Z0-9\-\/]+)/i,
    /(?:INV[.\s\-]*(?:NO)?[.:;\s]*)\s*([A-Z0-9\-\/]+)/i,
    /(?:VOUCHER\s*(?:NO)?[.:;\s]*)\s*([A-Z0-9\-\/]+)/i
  ];
  for (const pat of invPatterns) {
    const m = text.match(pat);
    if (m) { result.invoiceNo = m[1].trim(); break; }
  }

  // Extract Date
  const datePatterns = [
    /(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/,
    /(\d{1,2}[-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]+\d{2,4})/i
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) { result.date = m[1].trim(); break; }
  }

  // Extract amounts
  const amountPattern = (label) => {
    const pat = new RegExp(label + '[\\s:]*[₹\\$]?\\s*([\\d,]+\\.?\\d*)', 'i');
    const m = text.match(pat);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };

  result.taxableAmount = amountPattern('(?:TAXABLE\\s*(?:VALUE|AMOUNT|AMT))');
  result.cgst = amountPattern('(?:CGST(?:\\s*@\\s*\\d+%)?|CENTRAL\\s*TAX)\\s*(?:AMOUNT|AMT)?');
  result.sgst = amountPattern('(?:SGST(?:\\s*@\\s*\\d+%)?|STATE\\s*TAX|UTGST)\\s*(?:AMOUNT|AMT)?');
  result.igst = amountPattern('(?:IGST(?:\\s*@\\s*\\d+%)?|INTEGRATED\\s*TAX)\\s*(?:AMOUNT|AMT)?');
  result.totalAmount = amountPattern('(?:TOTAL\\s*AMOUNT|GRAND\\s*TOTAL|NET\\s*AMOUNT|INVOICE\\s*VALUE|TOTAL\\s*INV)');

  // Fallback: try "TOTAL:" pattern for total amount
  if (!result.totalAmount) {
    result.totalAmount = amountPattern('TOTAL');
  }

  // Extract HSN
  const hsnMatch = text.match(/(?:HSN|SAC)[\/\s:]*(\d{4,8})/i);
  if (hsnMatch) result.hsnCode = hsnMatch[1];

  // If no total, calculate
  if (!result.totalAmount && result.taxableAmount) {
    result.totalAmount = result.taxableAmount + result.cgst + result.sgst + result.igst;
  }

  return result;
}

/**
 * Convert PDF first page to image using sharp
 */
async function pdfToImage(pdfPath, outputPath) {
  // Use pdf-parse to check if it's a valid PDF, then use sharp for conversion
  // sharp can handle PDFs if libvips has poppler support, otherwise fall back
  try {
    await sharp(pdfPath, { page: 0, density: 200 })
      .png()
      .toFile(outputPath);
  } catch (err) {
    // Fallback: read PDF and create a placeholder indicating manual review needed
    throw new Error('PDF image conversion not available. Please upload as JPG/PNG image.');
  }
}

/**
 * Optimize image for API (resize, compress)
 */
async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mediaTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif'
  };

  let buffer;
  try {
    buffer = await sharp(filePath)
      .resize(1600, 2200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    // If sharp fails, read raw file
    buffer = fs.readFileSync(filePath);
  }

  return {
    buffer,
    mediaType: mediaTypes[ext] || 'image/jpeg'
  };
}

/**
 * Process multiple invoices in bulk
 */
async function bulkExtract(filePaths, options = {}) {
  const results = [];
  const batchSize = options.batchSize || 3; // Process 3 at a time

  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(fp => extractInvoiceData(fp, options))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      results.push({
        file: path.basename(batch[j]),
        filePath: batch[j],
        index: i + j,
        success: r.status === 'fulfilled',
        ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Failed' })
      });
    }
  }

  return results;
}

/**
 * Cleanup: terminate Tesseract worker
 */
async function cleanup() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}

module.exports = {
  extractInvoiceData,
  bulkExtract,
  cleanup,
  extractWithTesseract,
  extractWithClaude
};
