import React, { useState } from 'react';
import { ValidationReport } from '../types';

interface ValidationPanelProps {
  validation: ValidationReport;
  fileName: string;
}

export default function ValidationPanel({ validation, fileName }: ValidationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = validation.invalidRecords > 0 ||
    validation.duplicateInvoices.length > 0 ||
    validation.invalidGSTINs.length > 0 ||
    validation.taxMismatches.length > 0;

  if (!hasIssues && validation.warnings.length === 0) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-green-700">
            {fileName}: All {validation.totalRecords} records passed validation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl mb-4 ${hasIssues ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-5 h-5 ${hasIssues ? 'text-amber-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-sm font-medium ${hasIssues ? 'text-amber-700' : 'text-blue-700'}`}>
            {fileName}: {validation.validRecords}/{validation.totalRecords} valid
            {validation.errors.length > 0 && ` · ${validation.errors.length} errors`}
            {validation.warnings.length > 0 && ` · ${validation.warnings.length} warnings`}
            {validation.duplicateInvoices.length > 0 && ` · ${validation.duplicateInvoices.length} duplicates`}
            {validation.invalidGSTINs.length > 0 && ` · ${validation.invalidGSTINs.length} invalid GSTINs`}
          </span>
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Errors */}
          {validation.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-700 mb-1 uppercase">Errors</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validation.errors.slice(0, 50).map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    Row {err.row}: {err.message} {err.invoiceNo && `(${err.invoiceNo})`}
                  </p>
                ))}
                {validation.errors.length > 50 && (
                  <p className="text-xs text-red-500 italic">...and {validation.errors.length - 50} more</p>
                )}
              </div>
            </div>
          )}

          {/* Invalid GSTINs */}
          {validation.invalidGSTINs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-700 mb-1 uppercase">Invalid GSTINs</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validation.invalidGSTINs.map((g, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {g.invoiceNo}: GSTIN {g.gstin} — {g.errors.join(', ')}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Tax Mismatches */}
          {validation.taxMismatches.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-700 mb-1 uppercase">Tax Calculation Issues</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validation.taxMismatches.map((t, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    {t.invoiceNo}: {t.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Duplicates */}
          {validation.duplicateInvoices.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-700 mb-1 uppercase">Duplicate Invoice Numbers</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validation.duplicateInvoices.map((d, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    Invoice {d.invoiceNo} appears in rows: {d.rows.join(', ')}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* High value invoices */}
          {validation.highValueWithoutEInvoice.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-blue-700 mb-1 uppercase">E-Invoice Reminders</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validation.highValueWithoutEInvoice.map((h, i) => (
                  <p key={i} className="text-xs text-blue-600">
                    {h.invoiceNo}: {h.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1 uppercase">Warnings</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {validation.warnings.slice(0, 30).map((w, i) => (
                  <p key={i} className="text-xs text-gray-500">
                    {w.invoiceNo ? `${w.invoiceNo}: ` : `Row ${w.row}: `}{w.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
