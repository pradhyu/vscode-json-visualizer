/**
 * Type definitions for Medical Claims Timeline extension
 */

/**
 * Represents a single claim item in the timeline
 */
export interface ClaimItem {
    id: string;
    type: string; // Now flexible instead of fixed enum
    startDate: Date; // Always Date objects internally
    endDate: Date;   // Always Date objects internally
    details: Record<string, any>;
    displayName: string;
    color: string;
}

/**
 * Serialized version of ClaimItem for JSON/webview communication
 */
export interface SerializedClaimItem {
    id: string;
    type: string;
    startDate: string; // ISO string format
    endDate: string;   // ISO string format
    details: Record<string, any>;
    displayName: string;
    color: string;
}

/**
 * Configuration for a custom claim type
 */
export interface ClaimTypeConfig {
    /** Name/key of the claim type */
    name: string;
    /** JSON path to the array containing claims of this type */
    arrayPath: string;
    /** Color for this claim type in timeline */
    color: string;
    /** Configuration for ID field */
    idField: FieldConfig;
    /** Configuration for start date */
    startDate: DateFieldConfig;
    /** Configuration for end date */
    endDate: DateFieldConfig;
    /** Configuration for display name */
    displayName: FieldConfig;
    /** Fields to show in tooltips and detail panels */
    displayFields: DisplayFieldConfig[];
}

/**
 * Configuration for a data field
 */
export interface FieldConfig {
    /** JSON path to the field (e.g., "id", "medication", "details.drugName") */
    path: string;
    /** Default value if field is missing */
    defaultValue?: any;
    /** Whether this field is required */
    required?: boolean;
}

/**
 * Configuration for date fields with calculation support
 */
export interface DateFieldConfig {
    /** Type of date configuration */
    type: 'field' | 'calculation' | 'fixed';
    /** For type 'field': JSON path to date field */
    field?: string;
    /** For type 'calculation': calculation expression */
    calculation?: DateCalculation;
    /** For type 'fixed': fixed date value */
    value?: string;
    /** Fallback date fields to try if primary fails */
    fallbacks?: string[];
    /** Date format for parsing */
    format?: string;
}

/**
 * Date calculation configuration
 */
export interface DateCalculation {
    /** Base date field path */
    baseField: string;
    /** Operation to perform */
    operation: 'add' | 'subtract';
    /** Value to add/subtract */
    value: number | string; // Can be number or path to field
    /** Unit for the operation */
    unit: 'days' | 'weeks' | 'months' | 'years';
}

/**
 * Configuration for display fields in tooltips/details
 */
export interface DisplayFieldConfig {
    /** Label to show for this field */
    label: string;
    /** JSON path to the field value */
    path: string;
    /** Format type for display */
    format?: 'text' | 'date' | 'currency' | 'number';
    /** Whether to show this field in tooltips */
    showInTooltip?: boolean;
    /** Whether to show this field in detail panel */
    showInDetails?: boolean;
    /** Custom formatter function name */
    formatter?: string;
}

/**
 * Configuration interface for parser settings
 */
export interface ParserConfig {
    // Legacy configuration (for backward compatibility)
    rxTbaPath?: string;
    rxHistoryPath?: string;
    medHistoryPath?: string;
    dateFormat?: string;
    colors?: {
        rxTba: string;
        rxHistory: string;
        medHistory: string;
    };
    customMappings?: Record<string, string>;
    
    // New flexible configuration
    claimTypes?: ClaimTypeConfig[];
    globalDateFormat?: string;
    defaultColors?: string[];
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
    public filePath?: string;
    public timestamp?: Date;
    public originalError?: Error;
    public recoverySuggestions?: string[];
    public context?: any;

    constructor(message: string, public readonly code: string, public readonly details?: any) {
        super(message);
        this.name = 'ParseError';
        this.timestamp = new Date();
    }

    setFilePath(filePath: string): this {
        this.filePath = filePath;
        return this;
    }

    setOriginalError(error: Error): this {
        this.originalError = error;
        if (error.stack) {
            this.stack = error.stack;
        }
        return this;
    }

    setRecoverySuggestions(suggestions: string[]): this {
        this.recoverySuggestions = suggestions;
        return this;
    }

    setContext(context: any): this {
        this.context = context;
        return this;
    }
}

export class ValidationError extends ParseError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', details);
        this.recoverySuggestions = [
            'Check JSON syntax and structure',
            'Verify the file contains valid medical claims data',
            'Ensure all required fields are present'
        ];
    }
}

export class DateParseError extends ParseError {
    public expectedFormat?: string;
    public supportedFormats?: string[];

    constructor(message: string, details?: any) {
        super(message, 'DATE_PARSE_ERROR', details);
        this.expectedFormat = details?.expectedFormat || 'YYYY-MM-DD';
        this.supportedFormats = details?.supportedFormats || [
            'YYYY-MM-DD',
            'MM/DD/YYYY', 
            'DD-MM-YYYY',
            'YYYY/MM/DD',
            'DD/MM/YYYY',
            'MM-DD-YYYY'
        ];
        this.recoverySuggestions = [
            `Use the format: ${this.expectedFormat}`,
            'Check your date values',
            'Ensure dates are valid calendar dates'
        ];
        
        // Set context if provided
        if (details?.claimType || details?.claimIndex !== undefined || details?.fieldName || details?.fieldValue) {
            this.context = {
                claimType: details.claimType,
                claimIndex: details.claimIndex,
                fieldName: details.fieldName,
                fieldValue: details.fieldValue
            };
        }
    }
}

export class FileReadError extends ParseError {
    constructor(message: string, details?: any) {
        super(message, 'FILE_READ_ERROR', details);
        this.recoverySuggestions = [
            'Check if the file path is correct',
            'Verify the file exists',
            'Ensure you have read permissions'
        ];
    }
}

export class StructureValidationError extends ValidationError {
    public expectedStructure?: string;

    constructor(message: string, public readonly missingFields: string[], public readonly suggestions: string[]) {
        super(message, { missingFields, suggestions });
        this.expectedStructure = 'Expected structure:\n' +
            '• rxTba: array of prescription claims\n' +
            '• rxHistory: array of prescription history\n' +
            '• medHistory: object with claims array';
        this.recoverySuggestions = [
            'Ensure your JSON contains medical claims data',
            'Check the sample files for correct structure',
            'Verify that arrays contain valid claim objects',
            ...suggestions // Include the specific suggestions passed in
        ];
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