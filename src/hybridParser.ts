import * as fs from 'fs';
import { ClaimsParser } from './claimsParser';
import { FlexibleClaimsParser } from './flexibleClaimsParser';
import { TimelineData, ClaimItem, ParserConfig, ParseError, ValidationError } from './types';

/**
 * Hybrid parser that tries complex parsing first, then falls back to simple parsing
 * This ensures we get the advanced features when possible, but maintain basic functionality
 */
export class HybridParser {
    private complexParser: ClaimsParser;
    private flexibleParser: FlexibleClaimsParser;
    private enableDiagnosticLogging: boolean;

    constructor() {
        // Initialize with default configurations
        const defaultConfig: ParserConfig = {
            rxTbaPath: 'rxTba',
            rxHistoryPath: 'rxHistory',
            medHistoryPath: 'medHistory',
            dateFormat: 'YYYY-MM-DD',
            colors: {
                rxTba: '#FF6B6B',
                rxHistory: '#4ECDC4',
                medHistory: '#45B7D1'
            }
        };

        const flexibleConfig: ParserConfig = {
            globalDateFormat: 'YYYY-MM-DD',
            claimTypes: [
                {
                    name: 'rxTba',
                    arrayPath: 'rxTba',
                    color: '#FF6B6B',
                    idField: {
                        path: 'id',
                        defaultValue: 'auto-generated'
                    },
                    startDate: {
                        type: 'field',
                        field: 'dos'
                    },
                    endDate: {
                        type: 'calculation',
                        calculation: {
                            baseField: 'dos',
                            operation: 'add',
                            value: 'dayssupply',
                            unit: 'days'
                        }
                    },
                    displayName: {
                        path: 'medication',
                        defaultValue: 'Unknown Medication'
                    },
                    displayFields: []
                },
                {
                    name: 'rxHistory',
                    arrayPath: 'rxHistory',
                    color: '#4ECDC4',
                    idField: {
                        path: 'id',
                        defaultValue: 'auto-generated'
                    },
                    startDate: {
                        type: 'field',
                        field: 'dos'
                    },
                    endDate: {
                        type: 'calculation',
                        calculation: {
                            baseField: 'dos',
                            operation: 'add',
                            value: 'dayssupply',
                            unit: 'days'
                        }
                    },
                    displayName: {
                        path: 'medication',
                        defaultValue: 'Unknown Medication'
                    },
                    displayFields: []
                },
                {
                    name: 'medHistory',
                    arrayPath: 'medHistory.claims',
                    color: '#45B7D1',
                    idField: {
                        path: 'lines[0].lineId',
                        defaultValue: 'auto-generated'
                    },
                    startDate: {
                        type: 'field',
                        field: 'lines[0].srvcStart'
                    },
                    endDate: {
                        type: 'field',
                        field: 'lines[0].srvcEnd'
                    },
                    displayName: {
                        path: 'lines[0].description',
                        defaultValue: 'Medical Service'
                    },
                    displayFields: []
                }
            ]
        };

        this.complexParser = new ClaimsParser(defaultConfig);
        this.flexibleParser = new FlexibleClaimsParser(flexibleConfig);
        this.enableDiagnosticLogging = process.env.NODE_ENV === 'development' || process.env.CLAIMS_PARSER_DEBUG === 'true';
    }

    /**
     * Parse file using hybrid approach: try complex parsing first, fall back to simple parsing
     * @param filePath Path to the JSON file
     * @returns Promise<TimelineData> with parsed claims
     */
    public async parseFile(filePath: string): Promise<TimelineData> {
        if (this.enableDiagnosticLogging) {
            console.log('=== HYBRID PARSER: Starting hybrid parsing approach ===');
            console.log(`File: ${filePath}`);
        }

        let lastError: Error | null = null;

        // Strategy 1: Try ClaimsParser (complex parsing)
        try {
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Attempting complex ClaimsParser...');
            }
            
            const result = await this.complexParser.parseFile(filePath);
            
            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: Complex parsing succeeded with ${result.claims.length} claims`);
            }
            
            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Complex parsing failed:', lastError.message);
            }
        }

        // Strategy 2: Try FlexibleClaimsParser
        try {
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Attempting FlexibleClaimsParser...');
            }
            
            const result = await this.flexibleParser.parseFile(filePath);
            
            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: Flexible parsing succeeded with ${result.claims.length} claims`);
            }
            
            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Flexible parsing failed:', lastError.message);
            }
        }

        // Strategy 3: Fall back to simple parsing
        try {
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Attempting simple parsing fallback...');
            }
            
            const result = await this.parseSimple(filePath);
            
            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: Simple parsing succeeded with ${result.claims.length} claims`);
                console.log('HYBRID PARSER: Using fallback mechanism - advanced features may be limited');
            }
            
            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Simple parsing fallback failed:', lastError.message);
            }
        }

        // All strategies failed
        if (this.enableDiagnosticLogging) {
            console.log('HYBRID PARSER: All parsing strategies failed');
        }
        
        throw new ParseError(
            `All parsing strategies failed. Last error: ${lastError?.message || 'Unknown error'}`,
            'HYBRID_PARSE_FAILURE',
            { originalError: lastError }
        );
    }

    /**
     * Simple parsing fallback that mimics the working simple version
     * @param filePath Path to the JSON file
     * @returns Promise<TimelineData> with basic timeline data
     */
    private async parseSimple(filePath: string): Promise<TimelineData> {
        if (this.enableDiagnosticLogging) {
            console.log('=== HYBRID PARSER: Simple parsing fallback started ===');
        }

        try {
            // Read and parse JSON file
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            
            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: File content length: ${fileContent?.length || 'undefined'}`);
                console.log(`HYBRID PARSER: File content preview: ${fileContent?.substring(0, 100) || 'undefined'}`);
            }
            
            const jsonData = JSON.parse(fileContent);

            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: JSON loaded, keys:', Object.keys(jsonData));
            }

            // Validate multiple claim types
            const validation = this.validateMultipleClaimTypes(jsonData);
            
            if (!validation.isValid) {
                const errorMessage = validation.errors.length > 0 
                    ? `Validation failed: ${validation.errors.join(', ')}`
                    : 'No valid claim arrays found in JSON data (rxTba, rxHistory, or medHistory)';
                throw new ValidationError(errorMessage);
            }

            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: Validation passed - Found claim types: ${validation.availableTypes.join(', ')}`);
            }

            const claims: ClaimItem[] = [];

            // Process rxTba items
            if (jsonData.rxTba && Array.isArray(jsonData.rxTba)) {
                jsonData.rxTba.forEach((item: any, index: number) => {
                try {
                    if (this.enableDiagnosticLogging && index < 3) {
                        console.log(`HYBRID PARSER: Processing rxTba item ${index}:`, {
                            id: item.id,
                            dos: item.dos,
                            dayssupply: item.dayssupply,
                            medication: item.medication
                        });
                    }

                    // Parse dates with fallbacks
                    const startDate = this.parseSimpleDate(item.dos, `2024-01-0${(index % 9) + 1}`);
                    const daysSupply = this.parseSimpleDaysSupply(item.dayssupply, 30);
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + daysSupply);

                    // Create claim item matching simple version format
                    const claim: ClaimItem = {
                        id: item.id || `rxTba-${index}`,
                        type: 'rxTba',
                        startDate: startDate, // Keep as Date object internally
                        endDate: endDate,     // Keep as Date object internally
                        displayName: item.medication || `Medication ${index + 1}`,
                        color: this.getClaimTypeColor('rxTba'),
                        details: {
                            dosage: item.dosage || 'N/A',
                            daysSupply: daysSupply,
                            quantity: item.quantity || 'N/A',
                            prescriber: item.prescriber || 'N/A',
                            pharmacy: item.pharmacy || 'N/A',
                            copay: item.copay || 'N/A',
                            originalData: { ...item }
                        }
                    };

                    claims.push(claim);

                    if (this.enableDiagnosticLogging && index < 3) {
                        console.log(`HYBRID PARSER: Created claim ${index}:`, {
                            id: claim.id,
                            type: claim.type,
                            startDate: claim.startDate,
                            endDate: claim.endDate,
                            displayName: claim.displayName
                        });
                    }

                } catch (itemError) {
                    if (this.enableDiagnosticLogging) {
                        console.log(`HYBRID PARSER: Skipping invalid rxTba item ${index}:`, itemError);
                    }
                    // Skip invalid items but continue processing
                }
            });
            }

            // Process rxHistory items
            if (jsonData.rxHistory && Array.isArray(jsonData.rxHistory)) {
                jsonData.rxHistory.forEach((item: any, index: number) => {
                    try {
                        if (this.enableDiagnosticLogging && index < 3) {
                            console.log(`HYBRID PARSER: Processing rxHistory item ${index}:`, {
                                id: item.id,
                                dos: item.dos,
                                dayssupply: item.dayssupply,
                                medication: item.medication
                            });
                        }

                        // Parse dates with fallbacks
                        const startDate = this.parseSimpleDate(item.dos, `2023-01-0${(index % 9) + 1}`);
                        const daysSupply = this.parseSimpleDaysSupply(item.dayssupply, 30);
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + daysSupply);

                        // Create claim item for rxHistory
                        const claim: ClaimItem = {
                            id: item.id || `rxHistory-${index}`,
                            type: 'rxHistory',
                            startDate: startDate,
                            endDate: endDate,
                            displayName: item.medication || `Historical Medication ${index + 1}`,
                            color: this.getClaimTypeColor('rxHistory'),
                            details: {
                                dosage: item.dosage || 'N/A',
                                daysSupply: daysSupply,
                                quantity: item.quantity || 'N/A',
                                prescriber: item.prescriber || 'N/A',
                                pharmacy: item.pharmacy || 'N/A',
                                copay: item.copay || 'N/A',
                                fillDate: item.fillDate || 'N/A',
                                refillsRemaining: item.refillsRemaining || 'N/A',
                                originalData: { ...item }
                            }
                        };

                        claims.push(claim);

                        if (this.enableDiagnosticLogging && index < 3) {
                            console.log(`HYBRID PARSER: Created rxHistory claim ${index}:`, {
                                id: claim.id,
                                type: claim.type,
                                startDate: claim.startDate,
                                endDate: claim.endDate,
                                displayName: claim.displayName
                            });
                        }

                    } catch (itemError) {
                        if (this.enableDiagnosticLogging) {
                            console.log(`HYBRID PARSER: Skipping invalid rxHistory item ${index}:`, itemError);
                        }
                        // Skip invalid items but continue processing
                    }
                });
            }

            // Process medHistory items
            if (jsonData.medHistory && jsonData.medHistory.claims && Array.isArray(jsonData.medHistory.claims)) {
                jsonData.medHistory.claims.forEach((claim: any, claimIndex: number) => {
                    if (claim.lines && Array.isArray(claim.lines)) {
                        claim.lines.forEach((line: any, lineIndex: number) => {
                            try {
                                if (this.enableDiagnosticLogging && claimIndex < 2 && lineIndex < 2) {
                                    console.log(`HYBRID PARSER: Processing medHistory claim ${claimIndex}, line ${lineIndex}:`, {
                                        lineId: line.lineId,
                                        srvcStart: line.srvcStart,
                                        srvcEnd: line.srvcEnd,
                                        description: line.description
                                    });
                                }

                                // Parse dates
                                const startDate = this.parseSimpleDate(line.srvcStart, `2024-01-0${(lineIndex % 9) + 1}`);
                                const endDate = this.parseSimpleDate(line.srvcEnd, startDate.toISOString().split('T')[0]);

                                // Create claim item for medHistory line
                                const medClaim: ClaimItem = {
                                    id: line.lineId || `medHistory-${claimIndex}-${lineIndex}`,
                                    type: 'medHistory',
                                    startDate: startDate,
                                    endDate: endDate,
                                    displayName: line.description || `Medical Service ${claimIndex + 1}-${lineIndex + 1}`,
                                    color: this.getClaimTypeColor('medHistory'),
                                    details: {
                                        serviceType: line.serviceType || 'N/A',
                                        procedureCode: line.procedureCode || 'N/A',
                                        chargedAmount: line.chargedAmount || 0,
                                        allowedAmount: line.allowedAmount || 0,
                                        paidAmount: line.paidAmount || 0,
                                        provider: claim.provider || 'N/A',
                                        claimId: claim.claimId || 'N/A',
                                        claimDate: claim.claimDate || 'N/A',
                                        totalAmount: claim.totalAmount || 0,
                                        originalData: { ...line, claimData: { ...claim } }
                                    }
                                };

                                claims.push(medClaim);

                                if (this.enableDiagnosticLogging && claimIndex < 2 && lineIndex < 2) {
                                    console.log(`HYBRID PARSER: Created medHistory claim ${claimIndex}-${lineIndex}:`, {
                                        id: medClaim.id,
                                        type: medClaim.type,
                                        startDate: medClaim.startDate,
                                        endDate: medClaim.endDate,
                                        displayName: medClaim.displayName
                                    });
                                }

                            } catch (itemError) {
                                if (this.enableDiagnosticLogging) {
                                    console.log(`HYBRID PARSER: Skipping invalid medHistory claim ${claimIndex}, line ${lineIndex}:`, itemError);
                                }
                                // Skip invalid items but continue processing
                            }
                        });
                    }
                });
            }

            if (claims.length === 0) {
                throw new ValidationError('No valid claims could be extracted from any claim arrays (rxTba, rxHistory, medHistory)');
            }

            // Create timeline data with proper metadata
            const allDates = claims.flatMap(c => [c.startDate, c.endDate]);
            const uniqueClaimTypes = [...new Set(claims.map(c => c.type))];
            
            const timelineData: TimelineData = {
                claims,
                dateRange: {
                    start: new Date(Math.min(...allDates.map(d => d.getTime()))),
                    end: new Date(Math.max(...allDates.map(d => d.getTime())))
                },
                metadata: {
                    totalClaims: claims.length,
                    claimTypes: uniqueClaimTypes
                }
            };

            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: Simple parsing completed successfully with ${claims.length} claims`);
                console.log('HYBRID PARSER: Date range:', {
                    start: timelineData.dateRange.start.toISOString(),
                    end: timelineData.dateRange.end.toISOString()
                });
            }

            return timelineData;

        } catch (error) {
            if (this.enableDiagnosticLogging) {
                console.log('HYBRID PARSER: Simple parsing failed:', error);
            }
            
            if (error instanceof ValidationError) {
                throw error;
            }
            
            if (error instanceof SyntaxError) {
                throw new ValidationError(`Invalid JSON format: ${error.message}`);
            }
            
            throw new ParseError(
                `Simple parsing failed: ${error instanceof Error ? error.message : String(error)}`,
                'SIMPLE_PARSE_ERROR',
                { originalError: error }
            );
        }
    }

    /**
     * Parse date with fallback to default
     * @param dateValue Date value from JSON
     * @param fallbackDate Fallback date string
     * @returns Date object
     */
    private parseSimpleDate(dateValue: any, fallbackDate: string): Date {
        if (!dateValue) {
            return new Date(fallbackDate);
        }

        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) {
            if (this.enableDiagnosticLogging) {
                console.log(`HYBRID PARSER: Invalid date "${dateValue}", using fallback "${fallbackDate}"`);
            }
            return new Date(fallbackDate);
        }

        return parsed;
    }

    /**
     * Parse days supply with fallback to default
     * @param daysSupplyValue Days supply value from JSON
     * @param fallbackDays Fallback number of days
     * @returns Number of days
     */
    private parseSimpleDaysSupply(daysSupplyValue: any, fallbackDays: number): number {
        if (daysSupplyValue === undefined || daysSupplyValue === null) {
            return fallbackDays;
        }

        if (typeof daysSupplyValue === 'number' && daysSupplyValue > 0) {
            return Math.min(daysSupplyValue, 365); // Cap at 365 days
        }

        const parsed = parseInt(String(daysSupplyValue), 10);
        if (!isNaN(parsed) && parsed > 0) {
            return Math.min(parsed, 365); // Cap at 365 days
        }

        if (this.enableDiagnosticLogging) {
            console.log(`HYBRID PARSER: Invalid daysSupply "${daysSupplyValue}", using fallback ${fallbackDays}`);
        }
        
        return fallbackDays;
    }

    /**
     * Validate multiple claim type structures in JSON data
     * @param jsonData Parsed JSON data
     * @returns ValidationResult with details about available claim types
     */
    private validateMultipleClaimTypes(jsonData: any): { isValid: boolean; availableTypes: string[]; errors: string[] } {
        const result = {
            isValid: false,
            availableTypes: [] as string[],
            errors: [] as string[]
        };

        if (!jsonData || typeof jsonData !== 'object') {
            result.errors.push('Invalid JSON data: expected object');
            return result;
        }

        // Check rxTba
        if (jsonData.rxTba) {
            if (Array.isArray(jsonData.rxTba)) {
                if (jsonData.rxTba.length > 0) {
                    // Validate structure of first item
                    const firstItem = jsonData.rxTba[0];
                    if (firstItem.dos && firstItem.medication) {
                        result.availableTypes.push('rxTba');
                        if (this.enableDiagnosticLogging) {
                            console.log(`HYBRID PARSER: Valid rxTba array found with ${jsonData.rxTba.length} items`);
                        }
                    } else {
                        result.errors.push('rxTba items missing required fields (dos, medication)');
                    }
                } else {
                    if (this.enableDiagnosticLogging) {
                        console.log('HYBRID PARSER: rxTba array is empty');
                    }
                }
            } else {
                result.errors.push('rxTba is not an array');
            }
        }

        // Check rxHistory
        if (jsonData.rxHistory) {
            if (Array.isArray(jsonData.rxHistory)) {
                if (jsonData.rxHistory.length > 0) {
                    // Validate structure of first item
                    const firstItem = jsonData.rxHistory[0];
                    if (firstItem.dos && firstItem.medication) {
                        result.availableTypes.push('rxHistory');
                        if (this.enableDiagnosticLogging) {
                            console.log(`HYBRID PARSER: Valid rxHistory array found with ${jsonData.rxHistory.length} items`);
                        }
                    } else {
                        result.errors.push('rxHistory items missing required fields (dos, medication)');
                    }
                } else {
                    if (this.enableDiagnosticLogging) {
                        console.log('HYBRID PARSER: rxHistory array is empty');
                    }
                }
            } else {
                result.errors.push('rxHistory is not an array');
            }
        }

        // Check medHistory
        if (jsonData.medHistory) {
            if (typeof jsonData.medHistory === 'object' && jsonData.medHistory.claims) {
                if (Array.isArray(jsonData.medHistory.claims)) {
                    if (jsonData.medHistory.claims.length > 0) {
                        // Validate structure of first claim
                        const firstClaim = jsonData.medHistory.claims[0];
                        if (firstClaim.lines && Array.isArray(firstClaim.lines) && firstClaim.lines.length > 0) {
                            const firstLine = firstClaim.lines[0];
                            if (firstLine.srvcStart && firstLine.description) {
                                result.availableTypes.push('medHistory');
                                if (this.enableDiagnosticLogging) {
                                    console.log(`HYBRID PARSER: Valid medHistory found with ${jsonData.medHistory.claims.length} claims`);
                                }
                            } else {
                                result.errors.push('medHistory claim lines missing required fields (srvcStart, description)');
                            }
                        } else {
                            result.errors.push('medHistory claims missing lines array');
                        }
                    } else {
                        if (this.enableDiagnosticLogging) {
                            console.log('HYBRID PARSER: medHistory claims array is empty');
                        }
                    }
                } else {
                    result.errors.push('medHistory.claims is not an array');
                }
            } else {
                result.errors.push('medHistory is not an object or missing claims property');
            }
        }

        result.isValid = result.availableTypes.length > 0;

        if (this.enableDiagnosticLogging) {
            console.log(`HYBRID PARSER: Validation result - Available types: ${result.availableTypes.join(', ')}`);
            if (result.errors.length > 0) {
                console.log(`HYBRID PARSER: Validation errors: ${result.errors.join(', ')}`);
            }
        }

        return result;
    }

    /**
     * Get color for claim type with fallback
     * @param claimType Type of claim
     * @returns Color string
     */
    private getClaimTypeColor(claimType: string): string {
        const colorMap: Record<string, string> = {
            'rxTba': '#FF6B6B',      // Red for current prescriptions
            'rxHistory': '#4ECDC4',   // Teal for prescription history
            'medHistory': '#45B7D1'   // Blue for medical history
        };

        return colorMap[claimType] || '#999999'; // Gray fallback
    }

    /**
     * Get information about which parsing strategy was used
     * @param filePath Path to test
     * @returns Promise<string> describing the successful strategy
     */
    public async getParsingStrategy(filePath: string): Promise<string> {
        try {
            await this.complexParser.parseFile(filePath);
            return 'complex';
        } catch {
            try {
                await this.flexibleParser.parseFile(filePath);
                return 'flexible';
            } catch {
                try {
                    await this.parseSimple(filePath);
                    return 'simple';
                } catch {
                    return 'none';
                }
            }
        }
    }
}