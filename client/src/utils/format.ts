/**
 * Formatting utilities for Indian currency and numbers
 */

export function formatCurrency(amount: number): string {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function formatNumber(num: number): string {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('en-IN');
}

export function formatPercent(value: number, total: number): string {
  if (!total) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high': return '#dc2626';
    case 'medium': return '#d97706';
    case 'low': return '#2563eb';
    case 'info': return '#6366f1';
    default: return '#64748b';
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'MATCHED': return 'badge-matched';
    case 'MISMATCHED': return 'badge-mismatched';
    case 'MISSING_IN_GSTR1':
    case 'MISSING_IN_SALES': return 'badge-missing';
    default: return 'badge-info';
  }
}
