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
import { ParserConfig } from './types';

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
        const enableDiagnosticLogging = process.env.NODE_ENV === 'development' || process.env.CLAIMS_PARSER_DEBUG === 'true';
        
        if (enableDiagnosticLogging) {
            console.log('=== DIAGNOSTIC: ClaimsParser.validateStructure started ===');
            console.log('DIAGNOSTIC: Input JSON type:', typeof json);
            console.log('DIAGNOSTIC: Input JSON keys:', json ? Object.keys(json) : 'null/undefined');
        }
        
        if (!json || typeof json !== 'object') {
            if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: JSON validation failed - not an object');
            }
            throw new StructureValidationError(
                'Invalid JSON: Expected an object but received ' + typeof json,
                ['root object'],
                ['Ensure the JSON file contains a valid object structure']
            );
        }

        const missingFields: string[] = [];
        const suggestions: string[] = [];

        if (enableDiagnosticLogging) {
            console.log('DIAGNOSTIC: Checking for claim arrays with config:', {
                rxTbaPath: this.config.rxTbaPath,
                rxHistoryPath: this.config.rxHistoryPath,
                medHistoryPath: this.config.medHistoryPath
            });
        }

        // Check if at least one of the expected claim arrays exists
        const rxTbaValue = this.config.rxTbaPath ? this.getNestedValue(json, this.config.rxTbaPath) : null;
        const hasRxTba = Array.isArray(rxTbaValue);
        
        if (enableDiagnosticLogging) {
            console.log('DIAGNOSTIC: rxTba check:', {
                path: this.config.rxTbaPath,
                value: hasRxTba ? `Array with ${rxTbaValue.length} items` : rxTbaValue,
                isArray: hasRxTba,
                length: hasRxTba ? rxTbaValue.length : 'N/A'
            });
        }
        
        const rxHistoryValue = this.config.rxHistoryPath ? this.getNestedValue(json, this.config.rxHistoryPath) : null;
        const hasRxHistory = Array.isArray(rxHistoryValue);
        
        if (enableDiagnosticLogging) {
            console.log('DIAGNOSTIC: rxHistory check:', {
                path: this.config.rxHistoryPath,
                value: hasRxHistory ? `Array with ${rxHistoryValue.length} items` : rxHistoryValue,
                isArray: hasRxHistory,
                length: hasRxHistory ? rxHistoryValue.length : 'N/A'
            });
        }
        
        const hasMedHistory = this.validateMedHistoryStructure(json);
        
        if (enableDiagnosticLogging) {
            console.log('DIAGNOSTIC: medHistory check result:', hasMedHistory);
        }

        // Build missing fields list for informational purposes
        if (!hasRxTba) {
            missingFields.push(`${this.config.rxTbaPath || 'rxTba'} (prescription claims - rxTba)`);
        }

        if (!hasRxHistory) {
            missingFields.push(`${this.config.rxHistoryPath || 'rxHistory'} (prescription history - rxHistory)`);
        }

        if (!hasMedHistory) {
            missingFields.push(`${this.config.medHistoryPath || 'medHistory'} (medical claims - medHistory)`);
        }

        const validArrayCount = [hasRxTba, hasRxHistory, hasMedHistory].filter(Boolean).length;
        
        if (enableDiagnosticLogging) {
            console.log('DIAGNOSTIC: Validation summary:', {
                hasRxTba,
                hasRxHistory,
                hasMedHistory,
                totalValidArrays: validArrayCount,
                missingFields: missingFields.length > 0 ? missingFields : 'none'
            });
        }

        // Validation passes if at least one valid array exists
        if (validArrayCount === 0) {
            if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: No valid arrays found - throwing StructureValidationError');
            }
            
            suggestions.push('Ensure your JSON contains at least one of the following arrays: rxTba, rxHistory, or medHistory');
            suggestions.push('Check that the array paths in your configuration match your JSON structure');
            suggestions.push('Verify that the arrays contain valid claim objects');
            
            throw new StructureValidationError(
                'No valid medical claims arrays found in JSON',
                missingFields,
                suggestions
            );
        }

        if (enableDiagnosticLogging) {
            console.log(`DIAGNOSTIC: Found ${validArrayCount} valid array(s), validating array structures`);
        }
        
        // Validate structure of existing arrays
        this.validateArrayStructures(json, hasRxTba, hasRxHistory, hasMedHistory);

        if (enableDiagnosticLogging) {
            console.log('=== DIAGNOSTIC: ClaimsParser.validateStructure completed successfully ===');
        }
        
        return true;
    }

    /**
     * Validate the structure of claim arrays that exist
     */
    private validateArrayStructures(json: any, hasRxTba: boolean, hasRxHistory: boolean, hasMedHistory: boolean): void {
        const enableDiagnosticLogging = process.env.NODE_ENV === 'development' || process.env.CLAIMS_PARSER_DEBUG === 'true';
        const errors: string[] = [];

        if (hasRxTba && this.config.rxTbaPath) {
            if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: Validating rxTba array structure...');
            }
            const rxTbaData = this.getNestedValue(json, this.config.rxTbaPath);
            const rxTbaErrors = this.validateRxArrayStructure(rxTbaData, 'rxTba');
            if (rxTbaErrors.length > 0) {
                errors.push(...rxTbaErrors);
                if (enableDiagnosticLogging) {
                    console.log('DIAGNOSTIC: rxTba validation errors:', rxTbaErrors);
                }
            } else if (enableDiagnosticLogging) {
                console.log(`DIAGNOSTIC: rxTba array structure valid (${rxTbaData.length} items)`);
            }
        }

        if (hasRxHistory && this.config.rxHistoryPath) {
            if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: Validating rxHistory array structure...');
            }
            const rxHistoryData = this.getNestedValue(json, this.config.rxHistoryPath);
            const rxHistoryErrors = this.validateRxArrayStructure(rxHistoryData, 'rxHistory');
            if (rxHistoryErrors.length > 0) {
                errors.push(...rxHistoryErrors);
                if (enableDiagnosticLogging) {
                    console.log('DIAGNOSTIC: rxHistory validation errors:', rxHistoryErrors);
                }
            } else if (enableDiagnosticLogging) {
                console.log(`DIAGNOSTIC: rxHistory array structure valid (${rxHistoryData.length} items)`);
            }
        }

        if (hasMedHistory && this.config.medHistoryPath) {
            if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: Validating medHistory array structure...');
            }
            const medHistoryData = this.getNestedValue(json, this.config.medHistoryPath);
            const medHistoryErrors = this.validateMedHistoryArrayStructure(medHistoryData);
            if (medHistoryErrors.length > 0) {
                errors.push(...medHistoryErrors);
                if (enableDiagnosticLogging) {
                    console.log('DIAGNOSTIC: medHistory validation errors:', medHistoryErrors);
                }
            } else if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: medHistory array structure valid');
            }
        }

        if (errors.length > 0) {
            if (enableDiagnosticLogging) {
                console.log('DIAGNOSTIC: Array structure validation failed with errors:', errors);
            }
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

        if (enableDiagnosticLogging) {
            console.log('DIAGNOSTIC: All array structures validated successfully');
        }
    }

    /**
     * Validate prescription claim array structure
     */
    private validateRxArrayStructure(rxData: any[], type: string): string[] {
        const enableDiagnosticLogging = process.env.NODE_ENV === 'development' || process.env.CLAIMS_PARSER_DEBUG === 'true';
        const errors: string[] = [];

        if (!Array.isArray(rxData) || rxData.length === 0) {
            if (enableDiagnosticLogging && rxData.length === 0) {
                console.log(`DIAGNOSTIC: ${type} array is empty - this is valid`);
            }
            return errors; // Empty arrays are valid
        }

        if (enableDiagnosticLogging) {
            console.log(`DIAGNOSTIC: Validating ${rxData.length} items in ${type} array`);
        }

        let validItems = 0;
        rxData.forEach((claim, index) => {
            if (!claim || typeof claim !== 'object') {
                errors.push(`${type}[${index}]: Expected object but found ${typeof claim}`);
                return;
            }

            let itemValid = true;

            // Validate required 'dos' field
            if (!claim.dos) {
                errors.push(`${type}[${index}]: Missing required field 'dos' (date of service)`);
                itemValid = false;
            } else if (typeof claim.dos !== 'string') {
                errors.push(`${type}[${index}]: Field 'dos' must be a string, found ${typeof claim.dos}`);
                itemValid = false;
            }

            // Validate optional 'dayssupply' field
            if (claim.dayssupply !== undefined && typeof claim.dayssupply !== 'number') {
                errors.push(`${type}[${index}]: Field 'dayssupply' must be a number, found ${typeof claim.dayssupply}`);
                itemValid = false;
            }

            if (itemValid) {
                validItems++;
            }
        });

        if (enableDiagnosticLogging) {
            console.log(`DIAGNOSTIC: ${type} validation complete - ${validItems}/${rxData.length} items valid, ${errors.length} errors`);
            if (errors.length > 0) {
                console.log(`DIAGNOSTIC: ${type} validation errors:`, errors);
            }
        }

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
            if (config.rxTbaPath) {
                const rxTbaData = this.getNestedValue(json, config.rxTbaPath);
                if (Array.isArray(rxTbaData)) {
                    claims.push(...this.transformRxClaims(rxTbaData, 'rxTba', config.colors?.rxTba || '#FF6B6B'));
                }
            }

            // Extract rxHistory claims
            if (config.rxHistoryPath) {
                const rxHistoryData = this.getNestedValue(json, config.rxHistoryPath);
                if (Array.isArray(rxHistoryData)) {
                    claims.push(...this.transformRxClaims(rxHistoryData, 'rxHistory', config.colors?.rxHistory || '#4ECDC4'));
                }
            }

            // Extract medHistory claims
            if (config.medHistoryPath) {
                const medHistoryData = this.getNestedValue(json, config.medHistoryPath);
                if (medHistoryData && medHistoryData.claims && Array.isArray(medHistoryData.claims)) {
                    claims.push(...this.transformMedClaims(medHistoryData.claims, config.colors?.medHistory || '#45B7D1'));
                }
            }

            // Standardize output format to match simple version
            const standardizedClaims = this.standardizeClaimFormat(claims);
            
            // Validate output format before returning
            this.validateOutputFormat(standardizedClaims);

            return standardizedClaims;

        } catch (error) {
            if (error instanceof ParseError) {
                throw error;
            }
            throw new ParseError(`Error extracting claims: ${error}`, 'EXTRACTION_ERROR');
        }
    }

    /**
     * Standardize claim format to match working simple version
     * @param claims Array of ClaimItem objects with Date objects
     * @returns Array of ClaimItem objects with ISO string dates
     */
    private standardizeClaimFormat(claims: ClaimItem[]): ClaimItem[] {
        const enableDiagnosticLogging = process.env.NODE_ENV === 'development' || process.env.CLAIMS_PARSER_DEBUG === 'true';
        
        if (enableDiagnosticLogging) {
            console.log('=== DIAGNOSTIC: Standardizing claim format ===');
            console.log(`Processing ${claims.length} claims`);
        }

        return claims.map((claim, index) => {
            if (enableDiagnosticLogging) {
                console.log(`DIAGNOSTIC: Standardizing claim ${index}:`, {
                    id: claim.id,
                    type: claim.type,
                    originalStartDate: claim.startDate,
                    originalEndDate: claim.endDate
                });
            }

            // Ensure dates are Date objects
            const standardizedClaim: ClaimItem = {
                id: claim.id,
                type: claim.type,
                startDate: claim.startDate instanceof Date ? claim.startDate : new Date(claim.startDate),
                endDate: claim.endDate instanceof Date ? claim.endDate : new Date(claim.endDate),
                displayName: claim.displayName,
                color: claim.color,
                details: { ...claim.details }
            };

            if (enableDiagnosticLogging) {
                console.log(`DIAGNOSTIC: Standardized claim ${index}:`, {
                    id: standardizedClaim.id,
                    type: standardizedClaim.type,
                    startDate: standardizedClaim.startDate,
                    endDate: standardizedClaim.endDate,
                    displayName: standardizedClaim.displayName
                });
            }

            return standardizedClaim;
        });
    }

    /**
     * Validate output format matches expected structure
     * @param claims Array of standardized ClaimItem objects
     * @throws ValidationError if format is invalid
     */
    private validateOutputFormat(claims: ClaimItem[]): void {
        const enableDiagnosticLogging = process.env.NODE_ENV === 'development' || process.env.CLAIMS_PARSER_DEBUG === 'true';
        
        if (enableDiagnosticLogging) {
            console.log('=== DIAGNOSTIC: Validating output format ===');
            console.log(`Validating ${claims.length} claims`);
        }

        claims.forEach((claim, index) => {
            // Validate required fields
            if (!claim.id || typeof claim.id !== 'string') {
                throw new ValidationError(`Claim ${index}: Invalid or missing id field`);
            }

            if (!claim.type || typeof claim.type !== 'string') {
                throw new ValidationError(`Claim ${index}: Invalid or missing type field`);
            }

            if (!claim.displayName || typeof claim.displayName !== 'string') {
                throw new ValidationError(`Claim ${index}: Invalid or missing displayName field`);
            }

            if (!claim.color || typeof claim.color !== 'string') {
                throw new ValidationError(`Claim ${index}: Invalid or missing color field`);
            }

            // Validate date format (should be ISO strings after standardization)
            if (typeof claim.startDate !== 'string') {
                throw new ValidationError(`Claim ${index}: startDate must be ISO string, got ${typeof claim.startDate}`);
            }

            if (typeof claim.endDate !== 'string') {
                throw new ValidationError(`Claim ${index}: endDate must be ISO string, got ${typeof claim.endDate}`);
            }

            // Validate ISO date format
            const startDateTest = new Date(claim.startDate as any);
            const endDateTest = new Date(claim.endDate as any);
            
            if (isNaN(startDateTest.getTime())) {
                throw new ValidationError(`Claim ${index}: Invalid startDate ISO format: ${claim.startDate}`);
            }

            if (isNaN(endDateTest.getTime())) {
                throw new ValidationError(`Claim ${index}: Invalid endDate ISO format: ${claim.endDate}`);
            }

            // Validate date range
            if (endDateTest < startDateTest) {
                throw new ValidationError(`Claim ${index}: endDate cannot be before startDate`);
            }

            // Validate details object
            if (!claim.details || typeof claim.details !== 'object') {
                throw new ValidationError(`Claim ${index}: details must be an object`);
            }

            if (enableDiagnosticLogging && index < 3) { // Log first 3 claims for debugging
                console.log(`DIAGNOSTIC: Claim ${index} validation passed:`, {
                    id: claim.id,
                    type: claim.type,
                    startDate: claim.startDate,
                    endDate: claim.endDate,
                    displayName: claim.displayName,
                    color: claim.color,
                    detailsKeys: Object.keys(claim.details)
                });
            }
        });

        if (enableDiagnosticLogging) {
            console.log('=== DIAGNOSTIC: Output format validation completed successfully ===');
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

        // Calculate date range - handle both Date objects and ISO strings
        const dates = claims.flatMap(claim => {
            const startDate = claim.startDate instanceof Date ? claim.startDate : new Date(claim.startDate);
            const endDate = claim.endDate instanceof Date ? claim.endDate : new Date(claim.endDate);
            return [startDate, endDate];
        });
        const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Get unique claim types
        const claimTypes = Array.from(new Set(claims.map(claim => claim.type)));

        // Sort claims by start date (most recent first) - handle both Date objects and ISO strings
        const sortedClaims = claims.sort((a, b) => {
            const aStartDate = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
            const bStartDate = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
            return bStartDate.getTime() - aStartDate.getTime();
        });

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
        const configFormat = this.config.dateFormat || 'YYYY-MM-DD';
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
        if (!this.config.medHistoryPath) return false;
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