// ─── Invoice Types ───

export interface Invoice {
  invoiceNo: string;
  date: string;
  customerGSTIN: string;
  customerName: string;
  hsnCode?: string;
  taxableAmount: number;
  cgstRate?: number;
  cgst: number;
  sgstRate?: number;
  sgst: number;
  igstRate?: number;
  igst: number;
  totalAmount: number;
  placeOfSupply?: string;
  reverseCharge?: string;
  _rowIndex?: number;
  _source?: string;
}

// ─── Validation Types ───

export interface GSTINValidation {
  isValid: boolean;
  gstin: string;
  errors: string[];
  details: {
    stateCode?: string;
    stateName?: string;
    pan?: string;
    entityType?: string;
  };
}

export interface ValidationReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  duplicateInvoices: DuplicateInvoice[];
  invalidGSTINs: InvalidGSTIN[];
  taxMismatches: TaxMismatch[];
  highValueWithoutEInvoice: HighValueInvoice[];
}

export interface ValidationIssue {
  row: number;
  field?: string;
  message: string;
  invoiceNo?: string;
}

export interface DuplicateInvoice {
  invoiceNo: string;
  rows: number[];
}

export interface InvalidGSTIN {
  row: number;
  invoiceNo: string;
  gstin: string;
  errors: string[];
}

export interface TaxMismatch {
  row: number;
  invoiceNo: string;
  message: string;
}

export interface HighValueInvoice {
  row: number;
  invoiceNo: string;
  amount: number;
  message: string;
}

// ─── Reconciliation Types ───

export interface Discrepancy {
  field: string;
  label: string;
  salesValue: number | string;
  gstr1Value: number | string;
  difference: number | string;
  severity: 'high' | 'medium' | 'low';
}

export interface MatchedInvoice {
  invoiceNo: string;
  salesInvoice: Invoice;
  gstr1Invoice: Invoice;
  discrepancies: Discrepancy[];
  totalDifference: number;
  status: 'MATCHED' | 'MISMATCHED';
  matchType: 'exact' | 'fuzzy';
  matchConfidence?: number;
}

export interface MissingInvoice extends Invoice {
  status: string;
  severity: string;
  suggestion: string;
}

export interface DuplicateRecord {
  type: string;
  invoiceNo: string;
  count: number;
  invoices: Invoice[];
}

export interface ValidationIssueDetail {
  type: string;
  invoiceNo: string;
  value?: string;
  amount?: number;
  message: string;
  severity: string;
}

export interface MonthlyBreakdown {
  [month: string]: {
    matched: number;
    mismatched: number;
    missing: number;
    total: number;
  };
}

export interface CustomerBreakdown {
  [key: string]: {
    name: string;
    gstin: string;
    total: number;
    matched: number;
    mismatched: number;
    discrepancyAmount: number;
  };
}

export interface ReconciliationSummary {
  totalSalesInvoices: number;
  totalGSTR1Invoices: number;
  matched: number;
  mismatched: number;
  missingSalesInGSTR1: number;
  missingGSTR1InSales: number;
  totalDiscrepancyAmount: number;
}

export interface ReconciliationResult {
  sessionId?: string;
  summary: ReconciliationSummary;
  matched: MatchedInvoice[];
  mismatched: MatchedInvoice[];
  missingSalesInGSTR1: MissingInvoice[];
  missingGSTR1InSales: MissingInvoice[];
  duplicates: DuplicateRecord[];
  validationIssues: ValidationIssueDetail[];
  monthlyBreakdown: MonthlyBreakdown;
  customerBreakdown: CustomerBreakdown;
}

// ─── Upload Types ───

export interface UploadResponse {
  success: boolean;
  fileName: string;
  recordCount: number;
  data: Invoice[];
  validation?: ValidationReport;
}

// ─── App State ───

export type WizardStep = 'upload' | 'process' | 'review' | 'export';

export interface AppState {
  currentStep: WizardStep;
  salesData: Invoice[] | null;
  gstr1Data: Invoice[] | null;
  purchaseData: Invoice[] | null;
  salesFileName: string;
  gstr1FileName: string;
  purchaseFileName: string;
  salesValidation: ValidationReport | null;
  reconciliationResult: ReconciliationResult | null;
  isProcessing: boolean;
  error: string | null;
}
