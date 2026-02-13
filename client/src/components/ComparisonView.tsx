import React from 'react';
import { MatchedInvoice } from '../types';
import { formatCurrency } from '../utils/format';

interface ComparisonViewProps {
  item: MatchedInvoice;
  onClose: () => void;
}

export default function ComparisonView({ item, onClose }: ComparisonViewProps) {
  const { salesInvoice: sales, gstr1Invoice: gstr1, discrepancies } = item;

  const rows = [
    { label: 'Invoice No', salesVal: sales.invoiceNo, gstr1Val: gstr1.invoiceNo, key: 'invoiceNo' },
    { label: 'Date', salesVal: sales.date, gstr1Val: gstr1.date, key: 'date' },
    { label: 'Customer GSTIN', salesVal: sales.customerGSTIN, gstr1Val: gstr1.customerGSTIN, key: 'customerGSTIN' },
    { label: 'Customer Name', salesVal: sales.customerName, gstr1Val: gstr1.customerName, key: 'customerName' },
    { label: 'Taxable Amount', salesVal: formatCurrency(sales.taxableAmount), gstr1Val: formatCurrency(gstr1.taxableAmount), key: 'taxableAmount', isAmount: true },
    { label: 'CGST', salesVal: formatCurrency(sales.cgst), gstr1Val: formatCurrency(gstr1.cgst), key: 'cgst', isAmount: true },
    { label: 'SGST', salesVal: formatCurrency(sales.sgst), gstr1Val: formatCurrency(gstr1.sgst), key: 'sgst', isAmount: true },
    { label: 'IGST', salesVal: formatCurrency(sales.igst), gstr1Val: formatCurrency(gstr1.igst), key: 'igst', isAmount: true },
    { label: 'Total Amount', salesVal: formatCurrency(sales.totalAmount), gstr1Val: formatCurrency(gstr1.totalAmount), key: 'totalAmount', isAmount: true },
  ];

  function hasDiscrepancy(key: string): boolean {
    return discrepancies.some(d => d.field === key);
  }

  function getDiscrepancy(key: string) {
    return discrepancies.find(d => d.field === key);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Invoice Comparison</h2>
            <p className="text-sm text-gray-500">
              {item.invoiceNo} — {item.status === 'MATCHED' ? '✅ Matched' : `⚠️ ${discrepancies.length} discrepancies found`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2 w-1/4">Field</th>
                <th className="text-left text-xs font-semibold text-blue-600 uppercase pb-2 w-1/3">Sales Register</th>
                <th className="text-left text-xs font-semibold text-purple-600 uppercase pb-2 w-1/3">GSTR-1</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase pb-2 w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => {
                const disc = hasDiscrepancy(row.key);
                const discDetail = getDiscrepancy(row.key);
                return (
                  <tr key={row.key} className={disc ? 'bg-red-50' : ''}>
                    <td className="py-2.5 text-sm font-medium text-gray-600">{row.label}</td>
                    <td className={`py-2.5 text-sm ${disc ? 'text-red-700 font-semibold' : 'text-gray-800'}`}>
                      {row.salesVal}
                    </td>
                    <td className={`py-2.5 text-sm ${disc ? 'text-red-700 font-semibold' : 'text-gray-800'}`}>
                      {row.gstr1Val}
                    </td>
                    <td className="py-2.5 text-center">
                      {disc ? (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full
                          ${discDetail?.severity === 'high' ? 'bg-red-100 text-red-700' : ''}
                          ${discDetail?.severity === 'medium' ? 'bg-amber-100 text-amber-700' : ''}
                          ${discDetail?.severity === 'low' ? 'bg-blue-100 text-blue-700' : ''}
                        `}>
                          ✗ {typeof discDetail?.difference === 'number'
                            ? formatCurrency(discDetail.difference)
                            : discDetail?.difference}
                        </span>
                      ) : (
                        <span className="text-green-500 text-sm">✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Discrepancy details */}
          {discrepancies.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <h4 className="text-sm font-semibold text-red-700 mb-2">Discrepancies Found</h4>
              <ul className="space-y-1">
                {discrepancies.map((d, i) => (
                  <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <span className={`inline-flex px-1.5 py-0.5 text-xs rounded mt-0.5
                      ${d.severity === 'high' ? 'bg-red-200 text-red-800' : ''}
                      ${d.severity === 'medium' ? 'bg-amber-200 text-amber-800' : ''}
                      ${d.severity === 'low' ? 'bg-blue-200 text-blue-800' : ''}
                    `}>
                      {d.severity}
                    </span>
                    <span>
                      <strong>{d.label}:</strong> Sales = {d.salesValue}, GSTR-1 = {d.gstr1Value}
                      {typeof d.difference === 'number' && ` (Diff: ${formatCurrency(d.difference)})`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.matchType === 'fuzzy' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> This was a fuzzy match (confidence: {((item.matchConfidence || 0) * 100).toFixed(0)}%).
                Invoice numbers may differ slightly between sources.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
