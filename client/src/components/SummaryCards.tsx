import React from 'react';
import { ReconciliationSummary } from '../types';
import { formatCurrency, formatPercent } from '../utils/format';

interface SummaryCardsProps {
  summary: ReconciliationSummary;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const matchRate = summary.totalSalesInvoices > 0
    ? (summary.matched / summary.totalSalesInvoices) * 100 : 0;

  const cards = [
    {
      label: 'Total Sales Invoices',
      value: summary.totalSalesInvoices,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-500'
    },
    {
      label: 'Matched',
      value: summary.matched,
      subtitle: formatPercent(summary.matched, summary.totalSalesInvoices),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      iconColor: 'text-green-500'
    },
    {
      label: 'Mismatched',
      value: summary.mismatched,
      subtitle: formatPercent(summary.mismatched, summary.totalSalesInvoices),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'red',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      iconColor: 'text-red-500'
    },
    {
      label: 'Missing in GSTR-1',
      value: summary.missingSalesInGSTR1,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: 'yellow',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      iconColor: 'text-amber-500'
    },
    {
      label: 'Extra in GSTR-1',
      value: summary.missingGSTR1InSales,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'orange',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-500'
    },
    {
      label: 'Total Discrepancy',
      value: formatCurrency(summary.totalDiscrepancyAmount),
      isText: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-500'
    }
  ];

  return (
    <div>
      {/* Match rate bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Overall Match Rate</span>
          <span className={`text-lg font-bold ${matchRate >= 90 ? 'text-green-600' : matchRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
            {matchRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              matchRate >= 90 ? 'bg-green-500' : matchRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(matchRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card, i) => (
          <div key={i} className={`${card.bgColor} rounded-xl p-4 border border-gray-100`}>
            <div className="flex items-center justify-between mb-2">
              <span className={card.iconColor}>{card.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${card.textColor}`}>
              {(card as any).isText ? card.value : String(card.value)}
            </div>
            <div className="text-xs text-gray-500 mt-1">{card.label}</div>
            {(card as any).subtitle && (
              <div className="text-xs text-gray-400 mt-0.5">{(card as any).subtitle}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
