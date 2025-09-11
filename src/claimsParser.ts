import * as fs from 'fs';
import { 
    ClaimItem, 
    TimelineData, 
    RxClaimData, 
    MedClaimData,
    ParseError,
    ValidationError,
    DateParseError,
    FileReadError,
    StructureValidationError
} from './types';
import { ParserConfig } from './configManager';

/**
 * ClaimsParser class for reading and transforming medical claims JSON files
 */
export class ClaimsParser {
    private config: ParserConfig;

    constructor(config: ParserConfig) {
        this.config = config;
    }

    /**
     * Parse a JSON file and extract timeline data
     * @param filePath Path to the JSON file
     * @returns Promise<TimelineData> containing parsed claims
     */
    public async parseFile(filePath: string): Promise<TimelineData> {
        try {
            // Read and parse JSON file
            const fileContent = await fs.promises.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);

            // Validate JSON structure
            if (!this.validateStructure(jsonData)) {
                throw new ValidationError('Invalid JSON structure for medical claims data');
            }

            // Extract claims from JSON
            const claims = this.extractClaims(jsonData, this.config);

            // Generate timeline data
            return this.generateTimelineData(claims);

        } catch (error) {
            if (error instanceof ParseError) {
                throw error;
            }
            
            if (error instanceof SyntaxError) {
                throw new ValidationError(`Invalid JSON format: ${error.message}`);
            }
            
            if ((error as any).code === 'ENOENT') {
                throw new FileReadError(`File not found: ${filePath}`);
            }
            
            if ((error as any).code === 'EACCES') {
                throw new FileReadError(`Permission denied reading file: ${filePath}`);
            }
            
            throw new ParseError(`Unexpected error parsing file: ${error}`, 'UNKNOWN_ERROR');
        }
    }

    /**
     * Validate that JSON has expected structure for medical claims
     * @param json Parsed JSON object
     * @returns boolean indicating if structure is valid
     * @throws StructureValidationError with detailed information about missing fields
     */
    public validateStructure(json: any): boolean {
        if (!json || typeof json !== 'object') {
            throw new StructureValidationError(
                'Invalid JSON: Expected an object but received ' + typeof json,
                ['root object'],
                ['Ensure the JSON file contains a valid object structure']
            );
        }

        const missingFields: string[] = [];
        const suggestions: string[] = [];

        // Check if at least one of the expected claim arrays exists
        const hasRxTba = Array.isArray(this.getNestedValue(json, this.config.rxTbaPath));
        const hasRxHistory = Array.isArray(this.getNestedValue(json, this.config.rxHistoryPath));
        const hasMedHistory = this.validateMedHistoryStructure(json);

        if (!hasRxTba) {
            missingFields.push(`${this.config.rxTbaPath} (prescription claims - rxTba)`);
        }

        if (!hasRxHistory) {
            missingFields.push(`${this.config.rxHistoryPath} (prescription history - rxHistory)`);
        }

        if (!hasMedHistory) {
            missingFields.push(`${this.config.medHistoryPath} (medical claims - medHistory)`);
        }

        if (!hasRxTba && !hasRxHistory && !hasMedHistory) {
            suggestions.push('Ensure your JSON contains at least one of the following arrays: rxTba, rxHistory, or medHistory');
            suggestions.push('Check that the array paths in your configuration match your JSON structure');
            suggestions.push('Verify that the arrays contain valid claim objects');
            
            throw new StructureValidationError(
                'No valid medical claims arrays found in JSON',
                missingFields,
                suggestions
            );
        }

        // Validate structure of existing arrays
        this.validateArrayStructures(json, hasRxTba, hasRxHistory, hasMedHistory);

        return true;
    }

    /**
     * Validate the structure of claim arrays that exist
     */
    private validateArrayStructures(json: any, hasRxTba: boolean, hasRxHistory: boolean, hasMedHistory: boolean): void {
        const errors: string[] = [];

        if (hasRxTba) {
            const rxTbaData = this.getNestedValue(json, this.config.rxTbaPath);
            const rxTbaErrors = this.validateRxArrayStructure(rxTbaData, 'rxTba');
            errors.push(...rxTbaErrors);
        }

        if (hasRxHistory) {
            const rxHistoryData = this.getNestedValue(json, this.config.rxHistoryPath);
            const rxHistoryErrors = this.validateRxArrayStructure(rxHistoryData, 'rxHistory');
            errors.push(...rxHistoryErrors);
        }

        if (hasMedHistory) {
            const medHistoryData = this.getNestedValue(json, this.config.medHistoryPath);
            const medHistoryErrors = this.validateMedHistoryArrayStructure(medHistoryData);
            errors.push(...medHistoryErrors);
        }

        if (errors.length > 0) {
            throw new StructureValidationError(
                'Invalid claim array structures found',
                errors,
                [
                    'Ensure prescription claims have required fields: dos, dayssupply',
                    'Ensure medical claims have required fields: claims[].lines[].srvcStart, srvcEnd',
                    'Check that all date fields contain valid date strings'
                ]
            );
        }
    }

    /**
     * Validate prescription claim array structure
     */
    private validateRxArrayStructure(rxData: any[], type: string): string[] {
        const errors: string[] = [];

        if (!Array.isArray(rxData) || rxData.length === 0) {
            return errors; // Empty arrays are valid
        }

        rxData.forEach((claim, index) => {
            if (!claim || typeof claim !== 'object') {
                errors.push(`${type}[${index}]: Expected object but found ${typeof claim}`);
                return;
            }

            if (!claim.dos) {
                errors.push(`${type}[${index}]: Missing required field 'dos' (date of service)`);
            } else if (typeof claim.dos !== 'string') {
                errors.push(`${type}[${index}]: Field 'dos' must be a string, found ${typeof claim.dos}`);
            }

            if (claim.dayssupply !== undefined && typeof claim.dayssupply !== 'number') {
                errors.push(`${type}[${index}]: Field 'dayssupply' must be a number, found ${typeof claim.dayssupply}`);
            }
        });

        return errors;
    }

    /**
     * Validate medical history array structure
     */
    private validateMedHistoryArrayStructure(medHistoryData: any): string[] {
        const errors: string[] = [];

        if (!medHistoryData || typeof medHistoryData !== 'object') {
            errors.push('medHistory: Expected object structure');
            return errors;
        }

        if (!Array.isArray(medHistoryData.claims)) {
            errors.push('medHistory.claims: Expected array');
            return errors;
        }

        medHistoryData.claims.forEach((claim: any, claimIndex: number) => {
            if (!claim || typeof claim !== 'object') {
                errors.push(`medHistory.claims[${claimIndex}]: Expected object but found ${typeof claim}`);
                return;
            }

            if (!Array.isArray(claim.lines)) {
                errors.push(`medHistory.claims[${claimIndex}].lines: Expected array`);
                return;
            }

            claim.lines.forEach((line: any, lineIndex: number) => {
                if (!line || typeof line !== 'object') {
                    errors.push(`medHistory.claims[${claimIndex}].lines[${lineIndex}]: Expected object but found ${typeof line}`);
                    return;
                }

                if (!line.srvcStart) {
                    errors.push(`medHistory.claims[${claimIndex}].lines[${lineIndex}]: Missing required field 'srvcStart'`);
                } else if (typeof line.srvcStart !== 'string') {
                    errors.push(`medHistory.claims[${claimIndex}].lines[${lineIndex}]: Field 'srvcStart' must be a string`);
                }

                if (!line.srvcEnd) {
                    errors.push(`medHistory.claims[${claimIndex}].lines[${lineIndex}]: Missing required field 'srvcEnd'`);
                } else if (typeof line.srvcEnd !== 'string') {
                    errors.push(`medHistory.claims[${claimIndex}].lines[${lineIndex}]: Field 'srvcEnd' must be a string`);
                }
            });
        });

        return errors;
    }

    /**
     * Extract claims from JSON data using configuration paths
     * @param json Parsed JSON object
     * @param config Parser configuration
     * @returns Array of ClaimItem objects
     */
    public extractClaims(json: any, config: ParserConfig): ClaimItem[] {
        const claims: ClaimItem[] = [];

        try {
            // Extract rxTba claims
            const rxTbaData = this.getNestedValue(json, config.rxTbaPath);
            if (Array.isArray(rxTbaData)) {
                claims.push(...this.transformRxClaims(rxTbaData, 'rxTba', config.colors.rxTba));
            }

            // Extract rxHistory claims
            const rxHistoryData = this.getNestedValue(json, config.rxHistoryPath);
            if (Array.isArray(rxHistoryData)) {
                claims.push(...this.transformRxClaims(rxHistoryData, 'rxHistory', config.colors.rxHistory));
            }

            // Extract medHistory claims
            const medHistoryData = this.getNestedValue(json, config.medHistoryPath);
            if (medHistoryData && medHistoryData.claims && Array.isArray(medHistoryData.claims)) {
                claims.push(...this.transformMedClaims(medHistoryData.claims, config.colors.medHistory));
            }

            return claims;

        } catch (error) {
            if (error instanceof ParseError) {
                throw error;
            }
            throw new ParseError(`Error extracting claims: ${error}`, 'EXTRACTION_ERROR');
        }
    }

    /**
     * Transform prescription claims (rxTba and rxHistory) into ClaimItem objects with fallback mechanisms
     * @param rxData Array of prescription claim data
     * @param type Claim type ('rxTba' or 'rxHistory')
     * @param color Color for this claim type
     * @returns Array of ClaimItem objects
     */
    private transformRxClaims(rxData: RxClaimData[], type: 'rxTba' | 'rxHistory', color: string): ClaimItem[] {
        const transformedClaims: ClaimItem[] = [];
        const errors: string[] = [];

        rxData.forEach((claim, index) => {
            try {
                // Parse start date (dos - date of service) with fallback
                let startDate: Date;
                try {
                    startDate = this.parseDate(claim.dos);
                } catch (dateError) {
                    // Try fallback date fields
                    const fallbackDate = this.tryFallbackDateFields(claim, ['fillDate', 'prescriptionDate', 'serviceDate']);
                    if (fallbackDate) {
                        startDate = fallbackDate;
                        console.warn(`Using fallback date for ${type} claim ${claim.id || index}: ${fallbackDate.toISOString()}`);
                    } else {
                        // Preserve original DateParseError details if available
                        if (dateError instanceof DateParseError) {
                            throw new DateParseError(
                                `Error parsing dates for ${type} claim ${claim.id || index}: ${dateError.message}`,
                                { 
                                    claim, 
                                    type,
                                    originalError: dateError,
                                    suggestedFormats: dateError.details?.suggestedFormats,
                                    examples: dateError.details?.examples
                                }
                            );
                        } else {
                            errors.push(`${type} claim ${claim.id || index}: ${dateError instanceof Error ? dateError.message : String(dateError)}`);
                            return; // Skip this claim
                        }
                    }
                }
                
                // Calculate end date (dos + dayssupply) with fallback
                const endDate = new Date(startDate);
                const daysSupply = this.validateAndGetDaysSupply(claim.dayssupply, type, claim.id || index.toString());
                endDate.setDate(endDate.getDate() + daysSupply);

                // Create display name with fallbacks
                const displayName = this.createDisplayName(claim, type, index);

                // Validate date range
                if (endDate < startDate) {
                    console.warn(`Invalid date range for ${type} claim ${claim.id || index}: end date before start date. Using 1-day duration.`);
                    endDate.setTime(startDate.getTime() + (24 * 60 * 60 * 1000)); // Add 1 day
                }

                transformedClaims.push({
                    id: claim.id || `${type}_${index}`,
                    type,
                    startDate,
                    endDate,
                    details: { ...claim },
                    displayName,
                    color
                });

            } catch (error) {
                const errorMessage = `Error transforming ${type} claim ${claim.id || index}: ${error instanceof Error ? error.message : String(error)}`;
                errors.push(errorMessage);
                console.error(errorMessage, { claim, error });
            }
        });

        // If we have some successful transformations but also errors, log warnings
        if (errors.length > 0 && transformedClaims.length > 0) {
            console.warn(`Skipped ${errors.length} invalid ${type} claims out of ${rxData.length} total:`, errors);
        }

        // If all claims failed, throw an error
        if (errors.length > 0 && transformedClaims.length === 0) {
            throw new DateParseError(
                `Failed to transform any ${type} claims. Errors: ${errors.join('; ')}`,
                { type, totalClaims: rxData.length, errors }
            );
        }

        return transformedClaims;
    }

    /**
     * Try to find a valid date in fallback fields
     */
    private tryFallbackDateFields(claim: any, fallbackFields: string[]): Date | null {
        for (const field of fallbackFields) {
            if (claim[field]) {
                try {
                    return this.parseDate(claim[field]);
                } catch {
                    continue; // Try next field
                }
            }
        }
        return null;
    }

    /**
     * Validate and get days supply with fallback
     */
    private validateAndGetDaysSupply(daysSupply: any, type: string, claimId: string): number {
        if (daysSupply === undefined || daysSupply === null) {
            console.warn(`Missing daysSupply for ${type} claim ${claimId}, using default of 30 days`);
            return 30; // Default fallback
        }

        if (typeof daysSupply !== 'number') {
            const parsed = parseInt(String(daysSupply), 10);
            if (isNaN(parsed)) {
                console.warn(`Invalid daysSupply "${daysSupply}" for ${type} claim ${claimId}, using default of 30 days`);
                return 30;
            }
            return parsed;
        }

        if (daysSupply <= 0) {
            console.warn(`Invalid daysSupply ${daysSupply} for ${type} claim ${claimId}, using default of 30 days`);
            return 30;
        }

        if (daysSupply > 365) {
            console.warn(`Unusually large daysSupply ${daysSupply} for ${type} claim ${claimId}, capping at 365 days`);
            return 365;
        }

        return daysSupply;
    }

    /**
     * Create display name with fallbacks
     */
    private createDisplayName(claim: any, type: string, index: number): string {
        // Try various fields for a meaningful display name
        const nameFields = ['medication', 'drugName', 'productName', 'description', 'name'];
        
        for (const field of nameFields) {
            if (claim[field] && typeof claim[field] === 'string' && claim[field].trim()) {
                return claim[field].trim();
            }
        }

        // Fallback to generic name
        return `${type} Claim ${claim.id || index + 1}`;
    }

    /**
     * Transform medical claims into ClaimItem objects with comprehensive error handling
     * @param medData Array of medical claim data
     * @param color Color for medical claims
     * @returns Array of ClaimItem objects
     */
    private transformMedClaims(medData: MedClaimData[], color: string): ClaimItem[] {
        const claims: ClaimItem[] = [];
        const errors: string[] = [];

        medData.forEach((claim, claimIndex) => {
            if (!claim.lines || !Array.isArray(claim.lines)) {
                console.warn(`Medical claim ${claim.claimId || claimIndex} has no lines array, skipping`);
                return; // Skip claims without lines
            }

            if (claim.lines.length === 0) {
                console.warn(`Medical claim ${claim.claimId || claimIndex} has empty lines array, skipping`);
                return;
            }

            claim.lines.forEach((line, lineIndex) => {
                try {
                    const lineId = line.lineId || `${claimIndex}_${lineIndex}`;

                    // Parse service start date with fallbacks
                    let startDate: Date;
                    try {
                        startDate = this.parseDate(line.srvcStart);
                    } catch (startDateError) {
                        // Try fallback date fields
                        const fallbackDate = this.tryFallbackDateFields(line, ['serviceDate', 'admissionDate', 'procedureDate']) ||
                                           this.tryFallbackDateFields(claim, ['claimDate', 'serviceDate']);
                        
                        if (fallbackDate) {
                            startDate = fallbackDate;
                            console.warn(`Using fallback start date for medical claim line ${lineId}: ${fallbackDate.toISOString()}`);
                        } else {
                            errors.push(`Medical claim line ${lineId}: ${startDateError instanceof Error ? startDateError.message : String(startDateError)}`);
                            return; // Skip this line
                        }
                    }

                    // Parse service end date with fallbacks
                    let endDate: Date;
                    try {
                        endDate = this.parseDate(line.srvcEnd);
                    } catch (endDateError) {
                        // If no end date, use start date (same-day service)
                        endDate = new Date(startDate);
                        console.warn(`Using start date as end date for medical claim line ${lineId} due to parsing error: ${endDateError instanceof Error ? endDateError.message : String(endDateError)}`);
                    }

                    // Validate date range
                    if (endDate < startDate) {
                        console.warn(`Invalid date range for medical claim line ${lineId}: end date before start date. Using same-day service.`);
                        endDate = new Date(startDate);
                    }

                    // Create display name with fallbacks
                    const displayName = this.createMedicalDisplayName(line, claim, lineId);

                    claims.push({
                        id: lineId,
                        type: 'medHistory',
                        startDate,
                        endDate,
                        details: {
                            ...line,
                            claimId: claim.claimId,
                            provider: claim.provider,
                            claimDate: claim.claimDate,
                            totalAmount: claim.totalAmount
                        },
                        displayName,
                        color
                    });

                } catch (error) {
                    const lineId = line.lineId || `${claimIndex}_${lineIndex}`;
                    const errorMessage = `Error transforming medical claim line ${lineId}: ${error instanceof Error ? error.message : String(error)}`;
                    errors.push(errorMessage);
                    console.error(errorMessage, { claim, line, error });
                }
            });
        });

        // If we have some successful transformations but also errors, log warnings
        if (errors.length > 0 && claims.length > 0) {
            const totalLines = medData.reduce((sum, claim) => sum + (claim.lines?.length || 0), 0);
            console.warn(`Skipped ${errors.length} invalid medical claim lines out of ${totalLines} total:`, errors);
        }

        // If all lines failed, throw an error
        if (errors.length > 0 && claims.length === 0) {
            throw new DateParseError(
                `Failed to transform any medical claim lines. Errors: ${errors.join('; ')}`,
                { totalClaims: medData.length, errors }
            );
        }

        return claims;
    }

    /**
     * Create display name for medical claims with fallbacks
     */
    private createMedicalDisplayName(line: any, claim: any, lineId: string): string {
        // Try various fields for a meaningful display name
        const nameFields = [
            'description', 
            'serviceType', 
            'procedureDescription',
            'serviceName',
            'procedureCode'
        ];
        
        for (const field of nameFields) {
            if (line[field] && typeof line[field] === 'string' && line[field].trim()) {
                return line[field].trim();
            }
        }

        // Try claim-level fields
        if (claim.provider && typeof claim.provider === 'string' && claim.provider.trim()) {
            return `${claim.provider.trim()} Service`;
        }

        // Fallback to generic name
        return `Medical Service ${lineId}`;
    }

    /**
     * Generate TimelineData from array of ClaimItem objects
     * @param claims Array of ClaimItem objects
     * @returns TimelineData with metadata
     */
    private generateTimelineData(claims: ClaimItem[]): TimelineData {
        if (claims.length === 0) {
            return {
                claims: [],
                dateRange: {
                    start: new Date(),
                    end: new Date()
                },
                metadata: {
                    totalClaims: 0,
                    claimTypes: []
                }
            };
        }

        // Calculate date range
        const dates = claims.flatMap(claim => [claim.startDate, claim.endDate]);
        const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Get unique claim types
        const claimTypes = Array.from(new Set(claims.map(claim => claim.type)));

        // Sort claims by start date (most recent first)
        const sortedClaims = claims.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        return {
            claims: sortedClaims,
            dateRange: {
                start: startDate,
                end: endDate
            },
            metadata: {
                totalClaims: claims.length,
                claimTypes
            }
        };
    }

    /**
     * Parse date string using configured format with comprehensive error handling
     * @param dateStr Date string to parse
     * @returns Date object
     * @throws DateParseError with format suggestions
     */
    private parseDate(dateStr: string): Date {
        if (!dateStr) {
            throw new DateParseError(
                'Date string is empty or null',
                { 
                    originalValue: dateStr,
                    suggestedFormats: this.getDateFormats()
                }
            );
        }

        if (typeof dateStr !== 'string') {
            throw new DateParseError(
                `Expected date string but received ${typeof dateStr}: ${dateStr}`,
                { 
                    originalValue: dateStr,
                    suggestedFormats: this.getDateFormats()
                }
            );
        }

        // Trim whitespace
        const trimmedDateStr = dateStr.trim();
        if (trimmedDateStr === '') {
            throw new DateParseError(
                'Date string is empty after trimming whitespace',
                { 
                    originalValue: dateStr,
                    suggestedFormats: this.getDateFormats()
                }
            );
        }

        // Try parsing as ISO date first (YYYY-MM-DD)
        const isoDate = new Date(trimmedDateStr);
        if (!isNaN(isoDate.getTime()) && this.isValidDateString(trimmedDateStr)) {
            return isoDate;
        }

        // Try parsing with different formats based on configuration
        const formats = this.getDateFormats();
        const attemptedFormats: string[] = [];
        
        for (const format of formats) {
            try {
                attemptedFormats.push(format);
                const parsed = this.parseDateWithFormat(trimmedDateStr, format);
                if (parsed && !isNaN(parsed.getTime())) {
                    return parsed;
                }
            } catch (error) {
                // Continue to next format, but log the attempt
                continue;
            }
        }

        // If all formats failed, provide detailed error with suggestions
        throw new DateParseError(
            `Unable to parse date: "${trimmedDateStr}". Tried formats: ${attemptedFormats.join(', ')}`,
            { 
                originalValue: dateStr,
                attemptedFormats,
                suggestedFormats: this.getDateFormats(),
                examples: this.getDateFormatExamples()
            }
        );
    }

    /**
     * Validate that a date string looks reasonable before parsing
     */
    private isValidDateString(dateStr: string): boolean {
        // Check for reasonable date patterns
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
            /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
            /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY or DD-MM-YYYY
            /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
            /^\d{2}\/\d{2}\/\d{4}$/          // DD/MM/YYYY
        ];

        return datePatterns.some(pattern => pattern.test(dateStr));
    }

    /**
     * Get examples for each supported date format
     */
    private getDateFormatExamples(): Record<string, string> {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        return {
            'YYYY-MM-DD': `${year}-${month}-${day}`,
            'MM/DD/YYYY': `${month}/${day}/${year}`,
            'DD-MM-YYYY': `${day}-${month}-${year}`,
            'YYYY/MM/DD': `${year}/${month}/${day}`,
            'DD/MM/YYYY': `${day}/${month}/${year}`,
            'MM-DD-YYYY': `${month}-${day}-${year}`
        };
    }

    /**
     * Get array of date formats to try based on configuration
     * @returns Array of date format strings
     */
    private getDateFormats(): string[] {
        const configFormat = this.config.dateFormat;
        const commonFormats = [
            'YYYY-MM-DD',
            'MM/DD/YYYY',
            'DD-MM-YYYY',
            'YYYY/MM/DD',
            'DD/MM/YYYY',
            'MM-DD-YYYY'
        ];

        // Put configured format first, then try others
        const formats = [configFormat];
        commonFormats.forEach(format => {
            if (format !== configFormat) {
                formats.push(format);
            }
        });

        return formats;
    }

    /**
     * Parse date string with specific format
     * @param dateStr Date string
     * @param format Format string
     * @returns Date object or null if parsing fails
     */
    private parseDateWithFormat(dateStr: string, format: string): Date | null {
        const parts = dateStr.split(/[-\/]/);
        
        if (parts.length !== 3) {
            return null;
        }

        let year: number, month: number, day: number;

        switch (format) {
            case 'YYYY-MM-DD':
            case 'YYYY/MM/DD':
                year = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1; // Month is 0-indexed
                day = parseInt(parts[2]);
                break;
            case 'MM/DD/YYYY':
            case 'MM-DD-YYYY':
                month = parseInt(parts[0]) - 1;
                day = parseInt(parts[1]);
                year = parseInt(parts[2]);
                break;
            case 'DD-MM-YYYY':
            case 'DD/MM/YYYY':
                day = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
                year = parseInt(parts[2]);
                break;
            default:
                return null;
        }

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            return null;
        }

        const date = new Date(year, month, day);
        
        // Validate the date is correct (handles invalid dates like Feb 30)
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
            return null;
        }

        return date;
    }

    /**
     * Get nested value from object using dot notation path
     * @param obj Object to search
     * @param path Dot notation path (e.g., 'medHistory.claims')
     * @returns Value at path or undefined
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Validate medical history structure
     * @param json JSON object to validate
     * @returns boolean indicating if medHistory structure is valid
     */
    private validateMedHistoryStructure(json: any): boolean {
        const medHistoryData = this.getNestedValue(json, this.config.medHistoryPath);
        
        if (!medHistoryData || typeof medHistoryData !== 'object') {
            return false;
        }

        // Check if it has claims array
        if (!Array.isArray(medHistoryData.claims)) {
            return false;
        }

        // Validate at least one claim has lines array
        return medHistoryData.claims.some((claim: any) => 
            claim && Array.isArray(claim.lines) && claim.lines.length > 0
        );
    }

    /**
     * Update parser configuration
     * @param newConfig New parser configuration
     */
    public updateConfig(newConfig: ParserConfig): void {
        this.config = newConfig;
    }
}