import moment from 'moment';
import { FieldConfig, DateFieldConfig, DateCalculation, DisplayFieldConfig } from './types';
import { DateParseError } from './types';

/**
 * Utility class for extracting and processing field values from JSON objects
 */
export class FieldExtractor {
    /**
     * Extract a field value from an object using a JSON path
     * @param obj Object to extract from
     * @param path JSON path (e.g., "field", "nested.field", "array[0].field")
     * @param defaultValue Default value if field is not found
     * @returns Extracted value or default
     */
    public static extractField(obj: any, path: string, defaultValue?: any): any {
        if (!obj || !path) {
            return defaultValue;
        }

        try {
            const keys = this.parsePath(path);
            let current = obj;

            for (const key of keys) {
                if (current === null || current === undefined) {
                    return defaultValue;
                }

                if (key.isArray) {
                    if (!Array.isArray(current)) {
                        return defaultValue;
                    }
                    current = current[key.index];
                } else {
                    current = current[key.name];
                }
            }

            return current !== undefined ? current : defaultValue;
        } catch (error) {
            console.warn(`Error extracting field '${path}':`, error);
            return defaultValue;
        }
    }

    /**
     * Extract field value using FieldConfig
     * @param obj Object to extract from
     * @param config Field configuration
     * @returns Extracted value
     */
    public static extractWithConfig(obj: any, config: FieldConfig): any {
        const value = this.extractField(obj, config.path, config.defaultValue);
        
        if (value === undefined || value === null) {
            if (config.required) {
                throw new Error(`Required field '${config.path}' is missing`);
            }
            return config.defaultValue;
        }

        return value;
    }

    /**
     * Extract and parse a date field
     * @param obj Object to extract from
     * @param config Date field configuration
     * @param globalDateFormat Global date format to use
     * @param claimId Claim ID for error reporting
     * @returns Parsed Date object
     */
    public static extractDate(obj: any, config: DateFieldConfig, globalDateFormat: string, claimId: string): Date {
        try {
            switch (config.type) {
                case 'field':
                    return this.extractDateFromField(obj, config, globalDateFormat, claimId);
                
                case 'calculation':
                    return this.calculateDate(obj, config, globalDateFormat, claimId);
                
                case 'fixed':
                    return this.parseFixedDate(config.value!, globalDateFormat);
                
                default:
                    throw new Error(`Unknown date field type: ${(config as any).type}`);
            }
        } catch (error) {
            throw new DateParseError(
                `Error extracting date for claim ${claimId}: ${error instanceof Error ? error.message : String(error)}`,
                {
                    claimId,
                    config,
                    originalError: error,
                    suggestedFormats: this.getSupportedDateFormats(),
                    examples: this.getDateFormatExamples()
                }
            );
        }
    }

    /**
     * Extract date from a field with fallback support
     */
    private static extractDateFromField(obj: any, config: DateFieldConfig, globalDateFormat: string, claimId: string): Date {
        const dateFormat = config.format || globalDateFormat;
        
        // Try primary field
        if (config.field) {
            const primaryValue = this.extractField(obj, config.field);
            if (primaryValue) {
                const date = this.parseDate(primaryValue, dateFormat);
                if (date) {
                    return date;
                }
            }
        }

        // Try fallback fields
        if (config.fallbacks) {
            for (const fallbackField of config.fallbacks) {
                const fallbackValue = this.extractField(obj, fallbackField);
                if (fallbackValue) {
                    const date = this.parseDate(fallbackValue, dateFormat);
                    if (date) {
                        console.warn(`Using fallback date field '${fallbackField}' for claim ${claimId}`);
                        return date;
                    }
                }
            }
        }

        throw new Error(`No valid date found in field '${config.field}' or fallbacks for claim ${claimId}`);
    }

    /**
     * Calculate date using base field and calculation
     */
    private static calculateDate(obj: any, config: DateFieldConfig, globalDateFormat: string, claimId: string): Date {
        if (!config.calculation) {
            throw new Error('Calculation configuration is required for calculation type');
        }

        const calc = config.calculation;
        
        // Get base date
        const baseDateValue = this.extractField(obj, calc.baseField);
        if (!baseDateValue) {
            throw new Error(`Base date field '${calc.baseField}' not found`);
        }

        const baseDate = this.parseDate(baseDateValue, config.format || globalDateFormat);
        if (!baseDate) {
            throw new Error(`Could not parse base date '${baseDateValue}' from field '${calc.baseField}'`);
        }

        // Get calculation value
        let calcValue: number;
        if (typeof calc.value === 'string') {
            // Value is a field path
            const fieldValue = this.extractField(obj, calc.value);
            calcValue = this.parseNumber(fieldValue);
            if (isNaN(calcValue)) {
                throw new Error(`Could not parse numeric value from field '${calc.value}': ${fieldValue}`);
            }
        } else {
            calcValue = calc.value;
        }

        // Perform calculation
        const resultDate = moment(baseDate);
        
        switch (calc.operation) {
            case 'add':
                resultDate.add(calcValue, calc.unit);
                break;
            case 'subtract':
                resultDate.subtract(calcValue, calc.unit);
                break;
            default:
                throw new Error(`Unknown calculation operation: ${calc.operation}`);
        }

        return resultDate.toDate();
    }

    /**
     * Parse a fixed date value
     */
    private static parseFixedDate(value: string, dateFormat: string): Date {
        const date = this.parseDate(value, dateFormat);
        if (!date) {
            throw new Error(`Could not parse fixed date value: ${value}`);
        }
        return date;
    }

    /**
     * Parse a date string using multiple format attempts
     */
    private static parseDate(dateString: any, primaryFormat: string): Date | null {
        if (!dateString) {
            return null;
        }

        const dateStr = String(dateString).trim();
        if (dateStr === '') {
            return null;
        }

        // Try primary format first
        let date = moment(dateStr, primaryFormat, true);
        if (date.isValid()) {
            return date.toDate();
        }

        // Try other common formats
        const formats = this.getSupportedDateFormats().filter(f => f !== primaryFormat);
        for (const format of formats) {
            date = moment(dateStr, format, true);
            if (date.isValid()) {
                return date.toDate();
            }
        }

        // Try ISO parsing as last resort
        date = moment(dateStr);
        if (date.isValid()) {
            return date.toDate();
        }

        return null;
    }

    /**
     * Parse a numeric value with fallbacks
     */
    private static parseNumber(value: any): number {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        }

        return 0;
    }

    /**
     * Format a field value for display
     * @param value Raw field value
     * @param format Display format type
     * @returns Formatted string
     */
    public static formatForDisplay(value: any, format?: string): string {
        if (value === null || value === undefined) {
            return '';
        }

        switch (format) {
            case 'date':
                if (value instanceof Date) {
                    return value.toLocaleDateString();
                }
                const date = this.parseDate(value, 'YYYY-MM-DD');
                return date ? date.toLocaleDateString() : String(value);

            case 'currency':
                const num = this.parseNumber(value);
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(num);

            case 'number':
                return this.parseNumber(value).toLocaleString();

            case 'text':
            default:
                return String(value);
        }
    }

    /**
     * Extract display fields for a claim
     * @param obj Claim object
     * @param displayFields Display field configurations
     * @returns Object with formatted display values
     */
    public static extractDisplayFields(obj: any, displayFields: DisplayFieldConfig[]): Record<string, any> {
        const result: Record<string, any> = {};

        for (const fieldConfig of displayFields) {
            const rawValue = this.extractField(obj, fieldConfig.path);
            result[fieldConfig.label] = {
                raw: rawValue,
                formatted: this.formatForDisplay(rawValue, fieldConfig.format),
                showInTooltip: fieldConfig.showInTooltip !== false,
                showInDetails: fieldConfig.showInDetails !== false
            };
        }

        return result;
    }

    /**
     * Parse a JSON path into components
     */
    private static parsePath(path: string): Array<{ name: string; isArray: boolean; index: number }> {
        const parts: Array<{ name: string; isArray: boolean; index: number }> = [];
        const segments = path.split('.');

        for (const segment of segments) {
            const arrayMatch = segment.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) {
                parts.push({
                    name: arrayMatch[1],
                    isArray: true,
                    index: parseInt(arrayMatch[2], 10)
                });
            } else {
                parts.push({
                    name: segment,
                    isArray: false,
                    index: -1
                });
            }
        }

        return parts;
    }

    /**
     * Get supported date formats
     */
    private static getSupportedDateFormats(): string[] {
        return [
            'YYYY-MM-DD',
            'MM/DD/YYYY',
            'DD-MM-YYYY',
            'YYYY/MM/DD',
            'DD/MM/YYYY',
            'MM-DD-YYYY'
        ];
    }

    /**
     * Get date format examples
     */
    private static getDateFormatExamples(): Record<string, string> {
        return {
            'YYYY-MM-DD': '2024-03-15',
            'MM/DD/YYYY': '03/15/2024',
            'DD-MM-YYYY': '15-03-2024',
            'YYYY/MM/DD': '2024/03/15',
            'DD/MM/YYYY': '15/03/2024',
            'MM-DD-YYYY': '03-15-2024'
        };
    }
}