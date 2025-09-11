/**
 * Type definitions for Medical Claims Timeline extension
 */

/**
 * Represents a single claim item in the timeline
 */
export interface ClaimItem {
    id: string;
    type: 'rxTba' | 'rxHistory' | 'medHistory';
    startDate: Date;
    endDate: Date;
    details: Record<string, any>;
    displayName: string;
    color: string;
}

/**
 * Timeline data structure containing all claims and metadata
 */
export interface TimelineData {
    claims: ClaimItem[];
    dateRange: {
        start: Date;
        end: Date;
    };
    metadata: {
        totalClaims: number;
        claimTypes: string[];
    };
}

/**
 * Raw prescription claim data structure (rxTba and rxHistory)
 */
export interface RxClaimData {
    id: string;
    dos: string; // date of service
    dayssupply: number;
    medication: string;
    dosage?: string;
    quantity?: number;
    prescriber?: string;
    pharmacy?: string;
    ndc?: string;
    copay?: number;
    fillDate?: string;
    refillsRemaining?: number;
}

/**
 * Raw medical claim line data structure
 */
export interface MedClaimLineData {
    lineId: string;
    srvcStart: string;
    srvcEnd: string;
    serviceType: string;
    procedureCode?: string;
    description?: string;
    chargedAmount?: number;
    allowedAmount?: number;
    paidAmount?: number;
}

/**
 * Raw medical claim data structure
 */
export interface MedClaimData {
    claimId: string;
    provider?: string;
    claimDate?: string;
    totalAmount?: number;
    lines: MedClaimLineData[];
}

/**
 * Medical history structure containing claims array
 */
export interface MedHistoryData {
    claims: MedClaimData[];
}

/**
 * Error types for parsing operations
 */
export class ParseError extends Error {
    constructor(message: string, public readonly code: string, public readonly details?: any) {
        super(message);
        this.name = 'ParseError';
    }
}

export class ValidationError extends ParseError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', details);
    }
}

export class DateParseError extends ParseError {
    constructor(message: string, details?: any) {
        super(message, 'DATE_PARSE_ERROR', details);
    }
}

export class FileReadError extends ParseError {
    constructor(message: string, details?: any) {
        super(message, 'FILE_READ_ERROR', details);
    }
}

export class StructureValidationError extends ValidationError {
    constructor(message: string, public readonly missingFields: string[], public readonly suggestions: string[]) {
        super(message, { missingFields, suggestions });
    }
}

export class ConfigurationError extends ParseError {
    constructor(message: string, details?: any) {
        super(message, 'CONFIGURATION_ERROR', details);
    }
}

/**
 * Error handler utility for user-friendly error messages
 */
export class ErrorHandler {
    /**
     * Convert technical errors to user-friendly messages
     */
    static getUserFriendlyMessage(error: Error): string {
        if (error instanceof StructureValidationError) {
            let message = `Invalid JSON structure: ${error.message}`;
            if (error.missingFields.length > 0) {
                message += `\n\nMissing required fields: ${error.missingFields.join(', ')}`;
            }
            if (error.suggestions.length > 0) {
                message += `\n\nSuggestions:\n${error.suggestions.map(s => `• ${s}`).join('\n')}`;
            }
            return message;
        }

        if (error instanceof DateParseError) {
            let message = `Date parsing error: ${error.message}`;
            if (error.details?.suggestedFormats) {
                message += `\n\nSupported date formats:\n${error.details.suggestedFormats.map((f: string) => `• ${f}`).join('\n')}`;
            }
            return message;
        }

        if (error instanceof FileReadError) {
            return `File access error: ${error.message}`;
        }

        if (error instanceof ConfigurationError) {
            return `Configuration error: ${error.message}`;
        }

        if (error instanceof ValidationError) {
            return `Validation error: ${error.message}`;
        }

        if (error instanceof ParseError) {
            return `Parsing error: ${error.message}`;
        }

        return `Unexpected error: ${error.message}`;
    }

    /**
     * Get error recovery suggestions
     */
    static getRecoverySuggestions(error: Error): string[] {
        const suggestions: string[] = [];

        if (error instanceof StructureValidationError) {
            suggestions.push('Verify your JSON file contains medical claims data');
            suggestions.push('Check that at least one of rxTba, rxHistory, or medHistory arrays exists');
            suggestions.push('Ensure the JSON structure matches the expected format');
        }

        if (error instanceof DateParseError) {
            suggestions.push('Check date formats in your JSON file');
            suggestions.push('Ensure dates are in YYYY-MM-DD format or configure a different format');
            suggestions.push('Verify all date fields contain valid dates');
        }

        if (error instanceof FileReadError) {
            suggestions.push('Check that the file exists and is accessible');
            suggestions.push('Verify you have read permissions for the file');
            suggestions.push('Ensure the file is not corrupted or locked by another application');
        }

        if (error instanceof ConfigurationError) {
            suggestions.push('Review your extension settings');
            suggestions.push('Reset configuration to defaults if needed');
            suggestions.push('Check that all required configuration fields are set');
        }

        return suggestions;
    }
}