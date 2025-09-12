import * as fs from 'fs';
import { ClaimsParser } from './claimsParser';
import { FlexibleClaimsParser } from './flexibleClaimsParser';
import { ParserConfig, TimelineData, ClaimItem } from './types';

/**
 * Diagnostic test function to compare parsing outputs and identify data structure differences
 */
export class DiagnosticTest {
    
    /**
     * Run comprehensive diagnostic test with test-claims.json
     * @param filePath Path to test-claims.json
     * @returns Diagnostic results comparing parsers
     */
    public static async runDiagnostic(filePath: string): Promise<DiagnosticResult> {
        console.log('=== DIAGNOSTIC TEST STARTED ===');
        console.log(`Testing file: ${filePath}`);
        
        const result: DiagnosticResult = {
            filePath,
            fileExists: false,
            fileContent: null,
            simpleParserResult: null,
            complexParserResult: null,
            flexibleParserResult: null,
            dataStructureDifferences: [],
            recommendations: []
        };

        try {
            // 1. Check if file exists and read content
            result.fileExists = fs.existsSync(filePath);
            if (!result.fileExists) {
                result.recommendations.push('File does not exist - create test-claims.json with sample data');
                return result;
            }

            const fileContent = await fs.promises.readFile(filePath, 'utf-8');
            result.fileContent = JSON.parse(fileContent);
            console.log('File content loaded:', JSON.stringify(result.fileContent, null, 2));

            // 2. Test simple parsing approach (what would work)
            result.simpleParserResult = await this.testSimpleParsing(result.fileContent);
            console.log('Simple parser result:', result.simpleParserResult);

            // 3. Test complex ClaimsParser
            result.complexParserResult = await this.testComplexParsing(filePath);
            console.log('Complex parser result:', result.complexParserResult);

            // 4. Test FlexibleClaimsParser
            result.flexibleParserResult = await this.testFlexibleParsing(filePath);
            console.log('Flexible parser result:', result.flexibleParserResult);

            // 5. Compare data structures and identify differences
            result.dataStructureDifferences = this.compareDataStructures(
                result.simpleParserResult,
                result.complexParserResult,
                result.flexibleParserResult
            );

            // 6. Generate recommendations
            result.recommendations = this.generateRecommendations(result);

        } catch (error) {
            console.error('Diagnostic test failed:', error);
            result.recommendations.push(`Diagnostic test failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        console.log('=== DIAGNOSTIC TEST COMPLETED ===');
        return result;
    }

    /**
     * Test simple parsing approach that should work with test-claims.json
     */
    private static async testSimpleParsing(jsonData: any): Promise<ParserTestResult> {
        const result: ParserTestResult = {
            success: false,
            error: null,
            timelineData: null,
            outputFormat: null,
            claimCount: 0,
            processingSteps: []
        };

        try {
            result.processingSteps.push('Starting simple parsing approach');
            
            // Simple approach: directly process rxTba array
            if (!jsonData.rxTba || !Array.isArray(jsonData.rxTba)) {
                throw new Error('No rxTba array found in JSON data');
            }

            result.processingSteps.push(`Found rxTba array with ${jsonData.rxTba.length} items`);

            const claims: ClaimItem[] = [];
            
            jsonData.rxTba.forEach((item: any, index: number) => {
                result.processingSteps.push(`Processing item ${index}: ${JSON.stringify(item)}`);
                
                // Parse dates
                const startDate = new Date(item.dos);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + (item.dayssupply || 30));

                const claim: ClaimItem = {
                    id: item.id || `rx_${index}`,
                    type: 'rxTba',
                    startDate,
                    endDate,
                    displayName: item.medication || `Medication ${index + 1}`,
                    color: '#FF6B6B',
                    details: { ...item }
                };

                claims.push(claim);
                result.processingSteps.push(`Created claim: ${JSON.stringify({
                    id: claim.id,
                    type: claim.type,
                    startDate: claim.startDate.toISOString(),
                    endDate: claim.endDate.toISOString(),
                    displayName: claim.displayName
                })}`);
            });

            // Create timeline data
            const timelineData: TimelineData = {
                claims,
                dateRange: {
                    start: new Date(Math.min(...claims.map(c => c.startDate.getTime()))),
                    end: new Date(Math.max(...claims.map(c => c.endDate.getTime())))
                },
                metadata: {
                    totalClaims: claims.length,
                    claimTypes: ['rxTba']
                }
            };

            result.success = true;
            result.timelineData = timelineData;
            result.claimCount = claims.length;
            result.outputFormat = this.analyzeOutputFormat(timelineData);
            result.processingSteps.push('Simple parsing completed successfully');

        } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.processingSteps.push(`Simple parsing failed: ${result.error}`);
        }

        return result;
    }

    /**
     * Test complex ClaimsParser
     */
    private static async testComplexParsing(filePath: string): Promise<ParserTestResult> {
        const result: ParserTestResult = {
            success: false,
            error: null,
            timelineData: null,
            outputFormat: null,
            claimCount: 0,
            processingSteps: []
        };

        try {
            result.processingSteps.push('Starting complex ClaimsParser test');

            // Create default config for ClaimsParser
            const config: ParserConfig = {
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

            result.processingSteps.push(`Using config: ${JSON.stringify(config)}`);

            const parser = new ClaimsParser(config);
            const timelineData = await parser.parseFile(filePath);

            result.success = true;
            result.timelineData = timelineData;
            result.claimCount = timelineData.claims.length;
            result.outputFormat = this.analyzeOutputFormat(timelineData);
            result.processingSteps.push('Complex parsing completed successfully');

        } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.processingSteps.push(`Complex parsing failed: ${result.error}`);
        }

        return result;
    }

    /**
     * Test FlexibleClaimsParser
     */
    private static async testFlexibleParsing(filePath: string): Promise<ParserTestResult> {
        const result: ParserTestResult = {
            success: false,
            error: null,
            timelineData: null,
            outputFormat: null,
            claimCount: 0,
            processingSteps: []
        };

        try {
            result.processingSteps.push('Starting FlexibleClaimsParser test');

            // Create flexible config for test-claims.json
            const config: ParserConfig = {
                globalDateFormat: 'YYYY-MM-DD',
                claimTypes: [{
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
                    displayFields: [
                        {
                            label: 'Dosage',
                            path: 'dosage',
                            showInTooltip: true
                        },
                        {
                            label: 'Days Supply',
                            path: 'dayssupply',
                            format: 'number',
                            showInTooltip: true
                        }
                    ]
                }]
            };

            result.processingSteps.push(`Using flexible config: ${JSON.stringify(config, null, 2)}`);

            const parser = new FlexibleClaimsParser(config);
            const timelineData = await parser.parseFile(filePath);

            result.success = true;
            result.timelineData = timelineData;
            result.claimCount = timelineData.claims.length;
            result.outputFormat = this.analyzeOutputFormat(timelineData);
            result.processingSteps.push('Flexible parsing completed successfully');

        } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.processingSteps.push(`Flexible parsing failed: ${result.error}`);
        }

        return result;
    }

    /**
     * Analyze the output format of timeline data
     */
    private static analyzeOutputFormat(timelineData: TimelineData): OutputFormatAnalysis {
        const analysis: OutputFormatAnalysis = {
            claimsStructure: {},
            dateFormats: {},
            fieldTypes: {},
            sampleClaim: null
        };

        if (timelineData.claims.length > 0) {
            const sampleClaim = timelineData.claims[0];
            analysis.sampleClaim = {
                id: sampleClaim.id,
                type: sampleClaim.type,
                startDate: sampleClaim.startDate.toISOString(),
                endDate: sampleClaim.endDate.toISOString(),
                displayName: sampleClaim.displayName,
                color: sampleClaim.color,
                detailsKeys: Object.keys(sampleClaim.details)
            };

            // Analyze claims structure
            analysis.claimsStructure = {
                totalClaims: timelineData.claims.length,
                claimTypes: timelineData.metadata.claimTypes,
                dateRange: {
                    start: timelineData.dateRange.start.toISOString(),
                    end: timelineData.dateRange.end.toISOString()
                }
            };

            // Analyze date formats
            analysis.dateFormats = {
                startDateType: typeof sampleClaim.startDate,
                endDateType: typeof sampleClaim.endDate,
                startDateISO: sampleClaim.startDate.toISOString(),
                endDateISO: sampleClaim.endDate.toISOString()
            };

            // Analyze field types
            analysis.fieldTypes = {
                id: typeof sampleClaim.id,
                type: typeof sampleClaim.type,
                displayName: typeof sampleClaim.displayName,
                color: typeof sampleClaim.color,
                details: typeof sampleClaim.details
            };
        }

        return analysis;
    }

    /**
     * Compare data structures between different parsing approaches
     */
    private static compareDataStructures(
        simple: ParserTestResult | null,
        complex: ParserTestResult | null,
        flexible: ParserTestResult | null
    ): DataStructureDifference[] {
        const differences: DataStructureDifference[] = [];

        // Compare simple vs complex
        if (simple && complex) {
            const diff = this.compareParserResults('Simple', 'Complex', simple, complex);
            differences.push(...diff);
        }

        // Compare simple vs flexible
        if (simple && flexible) {
            const diff = this.compareParserResults('Simple', 'Flexible', simple, flexible);
            differences.push(...diff);
        }

        // Compare complex vs flexible
        if (complex && flexible) {
            const diff = this.compareParserResults('Complex', 'Flexible', complex, flexible);
            differences.push(...diff);
        }

        return differences;
    }

    /**
     * Compare two parser results
     */
    private static compareParserResults(
        name1: string,
        name2: string,
        result1: ParserTestResult,
        result2: ParserTestResult
    ): DataStructureDifference[] {
        const differences: DataStructureDifference[] = [];

        // Compare success status
        if (result1.success !== result2.success) {
            differences.push({
                field: 'success',
                parser1: name1,
                parser2: name2,
                value1: result1.success,
                value2: result2.success,
                impact: 'critical'
            });
        }

        // Compare claim counts
        if (result1.claimCount !== result2.claimCount) {
            differences.push({
                field: 'claimCount',
                parser1: name1,
                parser2: name2,
                value1: result1.claimCount,
                value2: result2.claimCount,
                impact: 'high'
            });
        }

        // Compare output formats if both succeeded
        if (result1.success && result2.success && result1.outputFormat && result2.outputFormat) {
            const formatDiffs = this.compareOutputFormats(name1, name2, result1.outputFormat, result2.outputFormat);
            differences.push(...formatDiffs);
        }

        return differences;
    }

    /**
     * Compare output formats between parsers
     */
    private static compareOutputFormats(
        name1: string,
        name2: string,
        format1: OutputFormatAnalysis,
        format2: OutputFormatAnalysis
    ): DataStructureDifference[] {
        const differences: DataStructureDifference[] = [];

        // Compare sample claim structures
        if (format1.sampleClaim && format2.sampleClaim) {
            const claim1 = format1.sampleClaim;
            const claim2 = format2.sampleClaim;

            // Compare field types
            Object.keys(format1.fieldTypes).forEach(field => {
                if (format1.fieldTypes[field] !== format2.fieldTypes[field]) {
                    differences.push({
                        field: `fieldType.${field}`,
                        parser1: name1,
                        parser2: name2,
                        value1: format1.fieldTypes[field],
                        value2: format2.fieldTypes[field],
                        impact: 'medium'
                    });
                }
            });

            // Compare date formats
            if (claim1.startDate !== claim2.startDate) {
                differences.push({
                    field: 'startDate.format',
                    parser1: name1,
                    parser2: name2,
                    value1: claim1.startDate,
                    value2: claim2.startDate,
                    impact: 'high'
                });
            }
        }

        return differences;
    }

    /**
     * Generate recommendations based on diagnostic results
     */
    private static generateRecommendations(result: DiagnosticResult): string[] {
        const recommendations: string[] = [];

        // Check if file exists
        if (!result.fileExists) {
            recommendations.push('Create test-claims.json file with sample rxTba data');
            return recommendations;
        }

        // Check simple parsing
        if (result.simpleParserResult?.success) {
            recommendations.push('✓ Simple parsing approach works - use this as reference format');
        } else {
            recommendations.push('✗ Simple parsing failed - check test-claims.json structure');
        }

        // Check complex parsing
        if (result.complexParserResult?.success) {
            recommendations.push('✓ Complex ClaimsParser works correctly');
        } else {
            recommendations.push('✗ Complex ClaimsParser failed - needs fixing');
            if (result.complexParserResult?.error) {
                recommendations.push(`  Error: ${result.complexParserResult.error}`);
            }
        }

        // Check flexible parsing
        if (result.flexibleParserResult?.success) {
            recommendations.push('✓ FlexibleClaimsParser works correctly');
        } else {
            recommendations.push('✗ FlexibleClaimsParser failed - check configuration');
            if (result.flexibleParserResult?.error) {
                recommendations.push(`  Error: ${result.flexibleParserResult.error}`);
            }
        }

        // Analyze differences
        if (result.dataStructureDifferences.length > 0) {
            recommendations.push('Data structure differences found:');
            result.dataStructureDifferences.forEach(diff => {
                if (diff.impact === 'critical') {
                    recommendations.push(`  ⚠️  CRITICAL: ${diff.field} differs between ${diff.parser1} and ${diff.parser2}`);
                } else if (diff.impact === 'high') {
                    recommendations.push(`  ⚠️  HIGH: ${diff.field} differs between ${diff.parser1} and ${diff.parser2}`);
                } else {
                    recommendations.push(`  ℹ️  ${diff.field} differs between ${diff.parser1} and ${diff.parser2}`);
                }
            });
        } else {
            recommendations.push('✓ No significant data structure differences found');
        }

        return recommendations;
    }
}

/**
 * Result of diagnostic test
 */
export interface DiagnosticResult {
    filePath: string;
    fileExists: boolean;
    fileContent: any;
    simpleParserResult: ParserTestResult | null;
    complexParserResult: ParserTestResult | null;
    flexibleParserResult: ParserTestResult | null;
    dataStructureDifferences: DataStructureDifference[];
    recommendations: string[];
}

/**
 * Result of testing a single parser
 */
export interface ParserTestResult {
    success: boolean;
    error: string | null;
    timelineData: TimelineData | null;
    outputFormat: OutputFormatAnalysis | null;
    claimCount: number;
    processingSteps: string[];
}

/**
 * Analysis of output format structure
 */
export interface OutputFormatAnalysis {
    claimsStructure: any;
    dateFormats: any;
    fieldTypes: Record<string, string>;
    sampleClaim: any;
}

/**
 * Difference between parser outputs
 */
export interface DataStructureDifference {
    field: string;
    parser1: string;
    parser2: string;
    value1: any;
    value2: any;
    impact: 'low' | 'medium' | 'high' | 'critical';
}