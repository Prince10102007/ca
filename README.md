# GST Reconciliation Tool

A modern web application that helps Chartered Accountants (CAs) and accountants reconcile sales invoices with GSTR-1 data, identify discrepancies, and prepare error-free GST returns. Designed to save 70-80% of manual reconciliation time.

## Features

### Data Import
- Upload Sales Register (Excel/CSV) with automatic column mapping
- Upload GSTR-1 data (JSON from GST portal or Excel)
- Upload Purchase Register for ITC reconciliation (optional)
- Drag-and-drop file upload with format validation
- Handles various column naming conventions (e.g., "Invoice No", "Inv No", "Bill No")
- Downloadable Excel templates with sample data

### Reconciliation Engine
- Auto-match invoices between sales register and GSTR-1
- Exact matching by invoice number + fuzzy matching as fallback
- Identifies discrepancies: amount differences, GSTIN mismatches, missing invoices, duplicates
- Color-coded status: Green (matched), Red (mismatch), Yellow (missing)
- Configurable tolerance for rounding differences

### Validation Checks
- GSTIN format validation (15 characters with checksum verification)
- State code validation with state name lookup
- Duplicate invoice detection
- Tax calculation verification (CGST = SGST, CGST+SGST vs IGST exclusivity)
- GST rate validation (5%, 12%, 18%, 28%)
- High-value invoice flagging (e-invoice compliance > Rs.50,000)
- B2B vs B2C classification checks

### Reporting & Export
- **Discrepancy Report (Excel)**: Multi-sheet workbook with Summary, Mismatched, Missing, Duplicates, Validation Issues
- **Corrected GSTR-1 (Excel)**: B2B and B2CL sheets formatted for GSTR-1 filing
- **PDF Summary Report**: Professional report for client review with key metrics
- Interactive dashboard with charts:
  - Reconciliation status pie chart
  - Monthly mismatch trend line chart
  - Top 10 customers with errors bar chart

### User Interface
- Clean, professional 4-step wizard: Upload → Process → Review → Export
- Side-by-side invoice comparison view
- Searchable, sortable data tables with pagination
- Responsive design (laptop/tablet)
- Reconciliation session persistence (resume later)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Backend | Node.js + Express |
| File Processing | xlsx, papaparse |
| PDF Generation | pdfmake |

## Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Clone/download the project
cd CA

# Install all dependencies
cd server && npm install
cd ../client && npm install
```

### Running the Application

**Terminal 1 - Start the backend server:**
```bash
cd server
npm run dev
```
Server starts at http://localhost:5000

**Terminal 2 - Start the frontend:**
```bash
cd client
npm start
```
App opens at http://localhost:3000

### Generate Sample Data (for testing)

```bash
cd sample-data
node generate-samples.js
```

This creates:
- `sales-register-sample.xlsx` - 100+ sales invoices
- `gstr1-data-sample.xlsx` - Corresponding GSTR-1 data (with intentional mismatches)
- `gstr1-sample.json` - GSTR-1 in GST portal JSON format
- `sales-register-sample.csv` - CSV version of sales register

## How to Use

### Step 1: Upload Files
1. Upload your **Sales Register** (Excel or CSV)
2. Upload your **GSTR-1 data** (JSON from GST portal or Excel)
3. Optionally upload Purchase Register
4. Review the validation summary — fix any critical errors
5. Click "Continue to Reconciliation"

### Step 2: Reconcile
1. Review the file summary
2. Click "Start Reconciliation"
3. Wait for processing (handles 1000+ invoices smoothly)

### Step 3: Review Results
1. Check the **Summary Cards** — matched, mismatched, missing counts
2. Browse **Dashboard** charts for visual overview
3. Click the **Mismatched** tab to see invoice-level discrepancies
4. Click any row to see **side-by-side comparison**
5. Check **Missing in GSTR-1** for invoices to add to filing
6. Review **Validation Issues** for GSTIN errors, tax calc problems

### Step 4: Export
1. **Discrepancy Report (Excel)** — Share with team/client for corrections
2. **Corrected GSTR-1 (Excel)** — B2B/B2CL data ready for filing
3. **PDF Summary** — Professional report for client review

## File Format Guide

### Sales Register Columns (recognized automatically)
| Column | Aliases Recognized |
|--------|-------------------|
| Invoice No | Invoice Number, Inv No, Bill No, Voucher No |
| Date | Invoice Date, Bill Date |
| Customer GSTIN | GSTIN, GST No, GSTIN/UIN, Party GSTIN |
| Customer Name | Party Name, Buyer Name |
| Taxable Amount | Taxable Value, Base Amount |
| CGST | CGST Amount, Central Tax |
| SGST | SGST Amount, UTGST, State Tax |
| IGST | IGST Amount, Integrated Tax |
| Total Amount | Invoice Value, Net Amount, Gross Amount |

### GSTR-1 JSON Format
Standard JSON format as downloaded from the GST portal (with `b2b`, `b2cl` sections).

## API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/health` | Server health check |
| POST | `/api/upload/sales` | Upload sales register |
| POST | `/api/upload/gstr1` | Upload GSTR-1 data |
| POST | `/api/upload/purchase` | Upload purchase register |
| POST | `/api/validate/gstin` | Validate a GSTIN |
| POST | `/api/reconcile` | Run reconciliation |
| GET | `/api/sessions` | List saved sessions |
| GET | `/api/session/:id` | Get session details |
| POST | `/api/export/discrepancy` | Export discrepancy Excel |
| POST | `/api/export/corrected-gstr1` | Export corrected GSTR-1 |
| POST | `/api/export/pdf-summary` | Export PDF summary |
| GET | `/api/template/:type` | Download template (sales/purchase) |

## Project Structure

```
CA/
├── server/                    # Backend
│   ├── src/
│   │   ├── index.js          # Express server & routes
│   │   ├── validation.js     # GSTIN & invoice validation
│   │   ├── reconciliation.js # Core matching algorithm
│   │   ├── fileParser.js     # Excel/CSV/JSON parsing
│   │   └── export.js         # Report generation
│   ├── uploads/              # Uploaded files (temporary)
│   ├── exports/              # Generated exports
│   └── sessions/             # Saved reconciliation sessions
│
├── client/                    # Frontend
│   └── src/
│       ├── App.tsx           # Main application
│       ├── api/index.ts      # API client
│       ├── types/index.ts    # TypeScript interfaces
│       ├── utils/format.ts   # Formatting utilities
│       └── components/
│           ├── FileUpload.tsx      # Drag-drop uploader
│           ├── StepWizard.tsx      # Progress stepper
│           ├── SummaryCards.tsx     # Metric cards
│           ├── DataTable.tsx       # Sortable/searchable table
│           ├── Charts.tsx          # Pie, Line, Bar charts
│           ├── ComparisonView.tsx  # Side-by-side modal
│           └── ValidationPanel.tsx # Validation results
│
├── sample-data/               # Test data & generator
│   ├── generate-samples.js
│   ├── sales-register-sample.xlsx
│   ├── gstr1-data-sample.xlsx
│   └── gstr1-sample.json
│
└── README.md
```

## Future Enhancements

- **Database integration** (PostgreSQL/MongoDB) for persistent storage
- **Multi-client management** for CA firms handling multiple clients
- **GSTR-2A/2B reconciliation** for purchase-side matching
- **Automatic GSTR-1 JSON generation** for direct portal upload
- **Email reports** to clients directly from the tool
- **Tally/Busy integration** for direct ERP data import
- **User authentication** and role-based access
- **Batch processing** for multiple months at once
- **AI-powered** suggestions for common error patterns
- **Audit trail** for tracking changes and corrections

## License

MIT
