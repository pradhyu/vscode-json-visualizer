import * as fs from 'fs';
import { ClaimItem, TimelineData, ClaimTypeConfig, ParserConfig } from './types';
import { FileReadError, ValidationError, DateParseError, StructureValidationError } from './types';
import { FieldExtractor } from './fieldExtractor';

/**
 * Flexible Claims Parser that supports configurable data formats
 */
export class FlexibleClaimsParser {
    private config: ParserConfig;
    private globalDateFormat: string;

    constructor(config: ParserConfig) {
        this.config = config;
        this.globalDateFormat = config.globalDateFormat || 'YYYY-MM-DD';
    }

    /**
     * Parse a JSON file and extract claims using flexible configuration
     * @param filePath Path to the JSON file
     * @returns Promise<TimelineData> with parsed claims
     */
    public async parseFile(filePath: string): Promise<TimelineData> {
        try {
            // Read and parse JSON file
            const fileContent = await fs.promises.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);

            // Validate structure
            this.validateStructure(jsonData);

            // Extract claims using flexible configuration
            const claims = this.extractClaims(jsonData);

            // Generate timeline data
            return this.generateTimelineData(claims);

        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                throw new FileReadError('File not found: ' + filePath, { filePath });
            } else if (error instanceof SyntaxError) {
                throw new ValidationError('Invalid JSON format: ' + error.message, { filePath });
            } else if (error instanceof DateParseError || 
                       error instanceof ValidationError || 
                       error instanceof StructureValidationError) {
                throw error;
            } else {
                throw new ValidationError('Failed to parse file: ' + (error instanceof Error ? error.message : String(error)), { filePath, originalError: error });
            }
        }
    }

    /**
     * Validate JSON structure against flexible configuration
     * @param json JSON data to validate
     * @returns true if valid
     * @throws StructureValidationError if invalid
     */
    public validateStructure(json: any): boolean {
        if (!json || typeof json !== 'object') {
            throw new StructureValidationError(
                'Invalid JSON: Expected an object but received ' + typeof json,
                ['root object'],
                ['Ensure the JSON file contains a valid object structure']
            );
        }

        if (!this.config.claimTypes || this.config.claimTypes.length === 0) {
            throw new StructureValidationError(
                'No claim type configurations found',
                ['claimTypes configuration'],
                ['Configure at least one claim type in settings']
            );
        }

        const missingFields: string[] = [];
        const suggestions: string[] = [];
        let foundValidArray = false;

        // Check each configured claim type
        for (const claimType of this.config.claimTypes) {
            const arrayData = FieldExtractor.extractField(json, claimType.arrayPath);
            
            if (Array.isArray(arrayData) && arrayData.length > 0) {
                // Validate array contains valid objects
                const sampleItem = arrayData[0];
                if (this.validateClaimItem(sampleItem, claimType)) {
                    foundValidArray = true;
                } else {
                    missingFields.push(`${claimType.name} (${claimType.arrayPath}) - invalid item structure`);
                    suggestions.push(`Verify items in ${claimType.arrayPath} contain required fields`);
                }
            } else {
                missingFields.push(`${claimType.name} (${claimType.arrayPath})`);
                suggestions.push(`Add ${claimType.arrayPath} array with claim data`);
            }
        }

        if (!foundValidArray) {
            suggestions.push('Ensure your JSON contains at least one valid claim array');
            suggestions.push('Check that the array paths in your configuration match your JSON structure');
            suggestions.push('Verify that the arrays contain valid claim objects');

            throw new StructureValidationError(
                'No valid claim arrays found in JSON',
                missingFields,
                suggestions
            );
        }

        return true;
    }

    /**
     * Validate a single claim item against its configuration
     */
    private validateClaimItem(item: any, claimType: ClaimTypeConfig): boolean {
        if (!item || typeof item !== 'object') {
            return false;
        }

        // Check if required fields can be extracted
        try {
            // Try to extract ID (not required to exist, but path should be valid)
            FieldExtractor.extractField(item, claimType.idField.path);

            // Try to extract start date
            if (claimType.startDate.type === 'field' && claimType.startDate.field) {
                const startDateValue = FieldExtractor.extractField(item, claimType.startDate.field);
                if (!startDateValue && !claimType.startDate.fallbacks) {
                    return false;
                }
            }

            // Try to extract end date
            if (claimType.endDate.type === 'field' && claimType.endDate.field) {
                const endDateValue = FieldExtractor.extractField(item, claimType.endDate.field);
                if (!endDateValue && !claimType.endDate.fallbacks) {
                    return false;
                }
            } else if (claimType.endDate.type === 'calculation' && claimType.endDate.calculation) {
                const baseValue = FieldExtractor.extractField(item, claimType.endDate.calculation.baseField);
                if (!baseValue) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract claims from JSON data using flexible configuration
     * @param jsonData JSON data to extract from
     * @returns Array of ClaimItem objects
     */
    public extractClaims(jsonData: any): ClaimItem[] {
        const allClaims: ClaimItem[] = [];
        const errors: string[] = [];

        if (!this.config.claimTypes) {
            throw new ValidationError('No claim type configurations found');
        }

        // Process each configured claim type
        for (const claimType of this.config.claimTypes) {
            try {
                const claimArray = FieldExtractor.extractField(jsonData, claimType.arrayPath);
                
                if (!Array.isArray(claimArray)) {
                    console.warn(`No array found at path '${claimType.arrayPath}' for claim type '${claimType.name}'`);
                    continue;
                }

                const typeClaims = this.processClaimArray(claimArray, claimType);
                allClaims.push(...typeClaims);

            } catch (error) {
                const errorMsg = `Error processing ${claimType.name} claims: ${error instanceof Error ? error.message : String(error)}`;
                errors.push(errorMsg);
                console.error(errorMsg, error);
            }
        }

        // If we have some claims but also errors, log the errors but continue
        if (errors.length > 0 && allClaims.length > 0) {
            console.warn(`Processed ${allClaims.length} claims with ${errors.length} errors:`, errors);
        } else if (errors.length > 0 && allClaims.length === 0) {
            // If we have errors and no claims, throw the first error
            throw new ValidationError(`Failed to process any claims: ${errors[0]}`, { 
                allErrors: errors,
                totalErrors: errors.length 
            });
        }

        return allClaims;
    }

    /**
     * Process an array of claims for a specific claim type
     */
    private processClaimArray(claimArray: any[], claimType: ClaimTypeConfig): ClaimItem[] {
        const claims: ClaimItem[] = [];
        const errors: string[] = [];

        claimArray.forEach((claimData, index) => {
            try {
                const claim = this.processClaimItem(claimData, claimType, index);
                if (claim) {
                    claims.push(claim);
                }
            } catch (error) {
                const errorMsg = `Error processing ${claimType.name} claim ${index}: ${error instanceof Error ? error.message : String(error)}`;
                errors.push(errorMsg);
                console.error(errorMsg, error);
            }
        });

        // Log skipped claims if any
        if (errors.length > 0) {
            console.warn(`Skipped ${errors.length} invalid ${claimType.name} claims out of ${claimArray.length} total:`, errors);
        }

        return claims;
    }

    /**
     * Process a single claim item
     */
    private processClaimItem(claimData: any, claimType: ClaimTypeConfig, index: number): ClaimItem | null {
        try {
            // Extract ID
            let id = FieldExtractor.extractField(claimData, claimType.idField.path, claimType.idField.defaultValue);
            if (!id || id === 'auto-generated') {
                id = `${claimType.name}_${index}`;
            }

            // Extract dates
            const startDate = FieldExtractor.extractDate(claimData, claimType.startDate, this.globalDateFormat, id);
            const endDate = FieldExtractor.extractDate(claimData, claimType.endDate, this.globalDateFormat, id);

            // Validate date range
            if (endDate < startDate) {
                console.warn(`Claim ${id} has end date before start date, adjusting`);
                endDate.setTime(startDate.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
            }

            // Extract display name
            let displayName = FieldExtractor.extractField(claimData, claimType.displayName.path, claimType.displayName.defaultValue);
            if (!displayName) {
                displayName = `${claimType.name} Claim ${id}`;
            }

            // Extract display fields
            const displayFields = FieldExtractor.extractDisplayFields(claimData, claimType.displayFields || []);

            // Create claim item
            const claim: ClaimItem = {
                id: String(id),
                type: claimType.name,
                startDate,
                endDate,
                displayName: String(displayName),
                color: claimType.color,
                details: {
                    ...claimData, // Include all original data
                    displayFields // Add formatted display fields
                }
            };

            return claim;

        } catch (error) {
            if (error instanceof DateParseError) {
                throw error; // Re-throw date parsing errors
            }
            throw new Error(`Failed to process claim: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate timeline data from claims
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

        // Sort claims by start date (most recent first)
        const sortedClaims = claims.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        // Calculate date range
        const startDates = claims.map(c => c.startDate.getTime());
        const endDates = claims.map(c => c.endDate.getTime());
        
        const dateRange = {
            start: new Date(Math.min(...startDates)),
            end: new Date(Math.max(...endDates))
        };

        // Calculate metadata
        const claimTypes = [...new Set(claims.map(c => c.type))];
        
        return {
            claims: sortedClaims,
            dateRange,
            metadata: {
                totalClaims: claims.length,
                claimTypes
            }
        };
    }

    /**
     * Update configuration
     * @param newConfig New parser configuration
     */
    public updateConfig(newConfig: ParserConfig): void {
        this.config = newConfig;
        this.globalDateFormat = newConfig.globalDateFormat || 'YYYY-MM-DD';
    }
}