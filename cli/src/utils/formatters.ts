export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

export function formatClaimType(type: string): string {
  const typeLabels: Record<string, string> = {
    rxTba: 'Prescription (TBA)',
    rxHistory: 'Prescription History',
    medHistory: 'Medical History'
  };

  return typeLabels[type] || type;
}

export function formatCurrency(amount: string | number): string {
  if (typeof amount === 'string') {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    amount = num;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function formatNumber(value: string | number): string {
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    value = num;
  }

  return new Intl.NumberFormat('en-US').format(value);
}