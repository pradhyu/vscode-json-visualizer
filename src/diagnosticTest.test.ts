import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DiagnosticTest } from './diagnosticTest';
import * as path from 'path';

// Mock fs module properly
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        // Keep original implementations for the test
    };
});

describe('DiagnosticTest', () => {
    const testFilePath = path.join(process.cwd(), 'test-claims.json');

    beforeAll(async () => {
        // Import fs after mocking
        const fs = await import('fs');
        
        // Ensure test-claims.json exists for testing
        if (!fs.existsSync(testFilePath)) {
            const testData = {
                "rxTba": [
                    {
                        "id": "rx1",
                        "dos": "2024-01-15",
                        "dayssupply": 30,
                        "medication": "Test Medication",
                        "dosage": "10mg once daily"
                    },
                    {
                        "id": "rx2", 
                        "dos": "2024-02-01",
                        "dayssupply": 7,
                        "medication": "Another Medication",
                        "dosage": "5mg twice daily"
                    }
                ]
            };
            fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
        }
    });

    it('should run diagnostic test successfully', async () => {
        const result = await DiagnosticTest.runDiagnostic(testFilePath);
        
        expect(result).toBeDefined();
        expect(result.filePath).toBe(testFilePath);
        expect(result.fileExists).toBe(true);
        expect(result.fileContent).toBeDefined();
        expect(result.recommendations).toBeInstanceOf(Array);
        
        console.log('=== DIAGNOSTIC TEST RESULTS ===');
        console.log('File Path:', result.filePath);
        console.log('File Exists:', result.fileExists);
        console.log('File Content:', JSON.stringify(result.fileContent, null, 2));
        
        if (result.simpleParserResult) {
            console.log('\n--- Simple Parser Result ---');
            console.log('Success:', result.simpleParserResult.success);
            console.log('Error:', result.simpleParserResult.error);
            console.log('Claim Count:', result.simpleParserResult.claimCount);
            console.log('Processing Steps:', result.simpleParserResult.processingSteps);
            if (result.simpleParserResult.outputFormat) {
                console.log('Output Format:', JSON.stringify(result.simpleParserResult.outputFormat, null, 2));
            }
        }
        
        if (result.complexParserResult) {
            console.log('\n--- Complex Parser Result ---');
            console.log('Success:', result.complexParserResult.success);
            console.log('Error:', result.complexParserResult.error);
            console.log('Claim Count:', result.complexParserResult.claimCount);
            console.log('Processing Steps:', result.complexParserResult.processingSteps);
            if (result.complexParserResult.outputFormat) {
                console.log('Output Format:', JSON.stringify(result.complexParserResult.outputFormat, null, 2));
            }
        }
        
        if (result.flexibleParserResult) {
            console.log('\n--- Flexible Parser Result ---');
            console.log('Success:', result.flexibleParserResult.success);
            console.log('Error:', result.flexibleParserResult.error);
            console.log('Claim Count:', result.flexibleParserResult.claimCount);
            console.log('Processing Steps:', result.flexibleParserResult.processingSteps);
            if (result.flexibleParserResult.outputFormat) {
                console.log('Output Format:', JSON.stringify(result.flexibleParserResult.outputFormat, null, 2));
            }
        }
        
        console.log('\n--- Data Structure Differences ---');
        result.dataStructureDifferences.forEach(diff => {
            console.log(`${diff.field}: ${diff.parser1}=${diff.value1} vs ${diff.parser2}=${diff.value2} (${diff.impact})`);
        });
        
        console.log('\n--- Recommendations ---');
        result.recommendations.forEach(rec => {
            console.log(`• ${rec}`);
        });
    });

    it('should handle missing file gracefully', async () => {
        const nonExistentPath = 'non-existent-file.json';
        const result = await DiagnosticTest.runDiagnostic(nonExistentPath);
        
        expect(result.fileExists).toBe(false);
        expect(result.recommendations).toContain('File does not exist - create test-claims.json with sample data');
    });

    it('should identify differences between parser outputs', async () => {
        const result = await DiagnosticTest.runDiagnostic(testFilePath);
        
        // At least one parser should work
        const workingParsers = [
            result.simpleParserResult?.success,
            result.complexParserResult?.success,
            result.flexibleParserResult?.success
        ].filter(Boolean);
        
        expect(workingParsers.length).toBeGreaterThan(0);
        
        // Should have recommendations
        expect(result.recommendations.length).toBeGreaterThan(0);
    });
});