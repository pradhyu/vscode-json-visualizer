"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNumber = exports.formatCurrency = exports.formatClaimType = exports.formatDate = exports.formatDuration = exports.formatFileSize = void 0;
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
exports.formatFileSize = formatFileSize;
function formatDuration(milliseconds) {
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
exports.formatDuration = formatDuration;
function formatDate(date, format = 'YYYY-MM-DD') {
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
exports.formatDate = formatDate;
function formatClaimType(type) {
    const typeLabels = {
        rxTba: 'Prescription (TBA)',
        rxHistory: 'Prescription History',
        medHistory: 'Medical History'
    };
    return typeLabels[type] || type;
}
exports.formatClaimType = formatClaimType;
function formatCurrency(amount) {
    if (typeof amount === 'string') {
        const num = parseFloat(amount);
        if (isNaN(num))
            return amount;
        amount = num;
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
exports.formatCurrency = formatCurrency;
function formatNumber(value) {
    if (typeof value === 'string') {
        const num = parseFloat(value);
        if (isNaN(num))
            return value;
        value = num;
    }
    return new Intl.NumberFormat('en-US').format(value);
}
exports.formatNumber = formatNumber;
//# sourceMappingURL=formatters.js.map