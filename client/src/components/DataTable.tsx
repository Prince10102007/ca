import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/format';

interface Column {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'badge' | 'severity';
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  title?: string;
  searchable?: boolean;
  pageSize?: number;
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
}

export default function DataTable({
  columns, data, title, searchable = true, pageSize = 20, onRowClick, emptyMessage
}: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          const val = row[col.key];
          return val && String(val).toLowerCase().includes(q);
        })
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function renderCell(col: Column, row: any) {
    const value = row[col.key];
    if (col.render) return col.render(value, row);

    switch (col.type) {
      case 'currency':
        return <span className="font-mono text-right">{formatCurrency(value || 0)}</span>;
      case 'badge':
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full
            ${value === 'MATCHED' ? 'bg-green-100 text-green-700' : ''}
            ${value === 'MISMATCHED' ? 'bg-red-100 text-red-700' : ''}
            ${value === 'MISSING_IN_GSTR1' ? 'bg-amber-100 text-amber-700' : ''}
            ${value === 'MISSING_IN_SALES' ? 'bg-orange-100 text-orange-700' : ''}
          `}>
            {value?.replace(/_/g, ' ')}
          </span>
        );
      case 'severity':
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full
            ${value === 'high' ? 'bg-red-100 text-red-700' : ''}
            ${value === 'medium' ? 'bg-amber-100 text-amber-700' : ''}
            ${value === 'low' ? 'bg-blue-100 text-blue-700' : ''}
            ${value === 'info' ? 'bg-gray-100 text-gray-700' : ''}
          `}>
            {value}
          </span>
        );
      default:
        return <span className="truncate">{value ?? '-'}</span>;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-sm font-semibold text-gray-700">{title}</h3>}
          <span className="text-xs text-gray-400">{filtered.length} records</span>
        </div>
        {searchable && (
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 w-56"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="bg-gray-50">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  {emptyMessage || 'No data available'}
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(row)}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-2 py-1 rounded border ${page === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
