import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts';
import { ReconciliationResult } from '../types';

interface ChartsProps {
  result: ReconciliationResult;
}

const COLORS = {
  matched: '#22c55e',
  mismatched: '#ef4444',
  missingSales: '#f59e0b',
  missingGSTR1: '#f97316'
};

export function ReconciliationPieChart({ result }: ChartsProps) {
  const { summary } = result;
  const data = [
    { name: 'Matched', value: summary.matched, color: COLORS.matched },
    { name: 'Mismatched', value: summary.mismatched, color: COLORS.mismatched },
    { name: 'Missing in GSTR-1', value: summary.missingSalesInGSTR1, color: COLORS.missingSales },
    { name: 'Extra in GSTR-1', value: summary.missingGSTR1InSales, color: COLORS.missingGSTR1 },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Reconciliation Status</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={true}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => [value, 'Invoices']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyTrendChart({ result }: ChartsProps) {
  const { monthlyBreakdown } = result;
  const data = Object.entries(monthlyBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month: formatMonthLabel(month),
      Matched: vals.matched,
      Mismatched: vals.mismatched,
      Missing: vals.missing,
      Total: vals.total
    }));

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Trend</h3>
        <p className="text-sm text-gray-400 py-8 text-center">No monthly data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Matched" stroke={COLORS.matched} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Mismatched" stroke={COLORS.mismatched} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Missing" stroke={COLORS.missingSales} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopCustomerErrorsChart({ result }: ChartsProps) {
  const { customerBreakdown } = result;
  const data = Object.values(customerBreakdown)
    .filter(c => c.mismatched > 0 || c.discrepancyAmount > 0)
    .sort((a, b) => b.mismatched - a.mismatched)
    .slice(0, 10)
    .map(c => ({
      name: (c.name || c.gstin || 'Unknown').substring(0, 18),
      Errors: c.mismatched,
      Amount: Math.round(c.discrepancyAmount)
    }));

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Customers with Errors</h3>
        <p className="text-sm text-gray-400 py-8 text-center">No customer errors found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 10 Customers with Errors</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Errors" fill="#ef4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatMonthLabel(month: string): string {
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = month.split('-');
  if (parts.length === 2) {
    const m = parseInt(parts[1]);
    return `${months[m] || parts[1]} ${parts[0].slice(2)}`;
  }
  return month;
}
