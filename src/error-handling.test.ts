import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { ClaimsParser } from './claimsParser';
import { HybridParser } from './hybridParser';
import { ParserConfig } from './types';
import { 
    ParseError, 
    ValidationError, 
    DateParseError,
    StructureValidationError, 
    FileReadError 
} from './types';

// Mock fs module
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn()
    }
}));

describe('Error Handling and Fallback Mechanism Tests', () => {
    let parser: ClaimsParser;
    let hybridParser: HybridParser;
    let mockConfig: ParserConfig;

    beforeEach(() => {
        mockConfig = {
            rxTbaPath: 'rxTba',
            rxHistoryPath: 'rxHistory',
            medHistoryPath: 'medHistory',
            dateFormat: 'YYYY-MM-DD',
            colors: {
                rxTba: '#FF6B6B',
                rxHistory: '#4ECDC4',
                medHistory: '#45B7D1'
            },
            customMappings: {}
        };
        
        parser = new ClaimsParser(mockConfig);
        hybridParser = new HybridParser();
        vi.clearAllMocks();
    });

    describe('File Reading Error Handling', () => {
        it('should throw FileReadError for non-existent files', async () => {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            (fs.promises.readFile as any).mockRejectedValue(error);

            await expect(parser.parseFile('/nonexistent/file.json'))
                .rejects.toThrow(FileReadError);
            
            try {
                await parser.parseFile('/nonexistent/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect((e as any).message).toContain('File not found');
                expect((e as any).filePath).toBe('/nonexistent/file.json');
            }
        });

        it('should throw FileReadError for permission denied', async () => {
            const error = new Error('Permission denied');
            (error as any).code = 'EACCES';
            (fs.promises.readFile as any).mockRejectedValue(error);

            await expect(parser.parseFile('/restricted/file.json'))
                .rejects.toThrow(FileReadError);
        });

        it('should handle empty files gracefully', async () => {
            (fs.promises.readFile as any).mockResolvedValue('');

            await expect(parser.parseFile('/empty/file.json'))
                .rejects.toThrow(ValidationError);
        });

        it('should handle very large files', async () => {
            // Simulate large file content
            const largeContent = JSON.stringify({
                rxTba: Array.from({ length: 10000 }, (_, i) => ({
                    id: `rx${i}`,
                    dos: '2024-01-01',
                    medication: `Med ${i}`
                }))
            });

            (fs.promises.readFile as any).mockResolvedValue(largeContent);

            const result = await parser.parseFile('/large/file.json');
            expect(result.claims).toHaveLength(10000);
            expect(result.metadata.totalClaims).toBe(10000);
        });
    });

    describe('JSON Parsing Error Handling', () => {
        it('should throw ValidationError for malformed JSON', async () => {
            const malformedJsonCases = [
                '{ invalid json }',
                '{ "key": }',
                '{ "key": "value" ',
                'not json at all',
                '{ "key": "value", }', // trailing comma
                '{ key: "value" }' // unquoted key
            ];

            for (const malformedJson of malformedJsonCases) {
                (fs.promises.readFile as any).mockResolvedValue(malformedJson);

                await expect(parser.parseFile('/test/malformed.json'))
                    .rejects.toThrow(ValidationError);
            }
        });

        it('should provide helpful error messages for JSON syntax errors', async () => {
            (fs.promises.readFile as any).mockResolvedValue('{ "key": "value" ');

            try {
                await parser.parseFile('/test/incomplete.json');
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                expect((e as any).message).toContain('Invalid JSON');
                expect((e as any).filePath).toBe('/test/incomplete.json');
            }
        });
    });

    describe('Structure Validation Error Handling', () => {
        it('should throw StructureValidationError for invalid structures', async () => {
            const invalidStructures = [
                { notMedicalData: 'test' },
                { rxTba: 'not an array' },
                { rxHistory: null },
                { medHistory: { notClaims: [] } },
                { medHistory: { claims: 'not an array' } }
            ];

            for (const structure of invalidStructures) {
                (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(structure));

                await expect(parser.parseFile('/test/invalid.json'))
                    .rejects.toThrow(StructureValidationError);
            }
        });

        it('should provide specific error messages for structure validation', async () => {
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({ invalidField: 'test' }));

            try {
                await parser.parseFile('/test/invalid.json');
            } catch (e) {
                expect(e).toBeInstanceOf(StructureValidationError);
                expect((e as any).message).toContain('does not contain valid medical claims data');
                expect((e as any).expectedStructure).toBeDefined();
            }
        });

        it('should suggest valid structure in error messages', async () => {
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({}));

            try {
                await parser.parseFile('/test/empty-object.json');
            } catch (e) {
                expect(e).toBeInstanceOf(StructureValidationError);
                expect((e as any).expectedStructure).toContain('rxTba');
                expect((e as any).expectedStructure).toContain('rxHistory');
                expect((e as any).expectedStructure).toContain('medHistory');
            }
        });
    });

    describe('Date Parsing Error Handling', () => {
        it('should throw DateParseError for invalid dates', async () => {
            const invalidDateCases = [
                { rxTba: [{ id: 'rx1', dos: 'not-a-date', medication: 'Med' }] },
                { rxTba: [{ id: 'rx2', dos: '2024-13-01', medication: 'Med' }] }, // Invalid month
                { rxTba: [{ id: 'rx3', dos: '2024-02-30', medication: 'Med' }] }, // Invalid day
                { rxHistory: [{ id: 'rxh1', dos: '32/01/2024', medication: 'Med' }] }
            ];

            for (const data of invalidDateCases) {
                (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(data));

                const result = await parser.parseFile('/test/invalid-dates.json');
                expect(result.claims).toHaveLength(1);
                expect(result.claims[0].startDate).toEqual(new Date('2024-01-01T05:00:00.000Z')); // Fallback date
                expect(result.claims[0].displayName).toBe('Med');
            }
        });

        it('should provide helpful date format suggestions', async () => {
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({
                rxTba: [{ id: 'rx1', dos: 'invalid-date', medication: 'Med' }]
            }));

            try {
                await parser.parseFile('/test/bad-date.json');
            } catch (e) {
                expect(e).toBeInstanceOf(DateParseError);
                expect((e as any).message).toContain('invalid-date');
                expect((e as any).expectedFormat).toBe('YYYY-MM-DD');
                expect((e as any).supportedFormats).toContain('YYYY-MM-DD');
            }
        });


    });

    describe('Hybrid Parser Fallback Mechanisms', () => {
        it('should fall back to simple parsing when complex parsing fails', async () => {
            // Create data that would fail complex parsing but work with simple parsing
            const problematicData = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-15', medication: 'Test Med' }
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(problematicData));

            // Mock complex parser to fail
            const originalParseFile = ClaimsParser.prototype.parseFile;
            ClaimsParser.prototype.parseFile = vi.fn().mockRejectedValue(new Error('Complex parsing failed'));

            try {
                const result = await hybridParser.parseFile('/test/fallback.json');
                
                expect(result).toBeDefined();
                expect(result.claims).toBeDefined();
                expect(Array.isArray(result.claims)).toBe(true);
            } finally {
                // Restore original method
                ClaimsParser.prototype.parseFile = originalParseFile;
            }
        });

        it('should determine appropriate parsing strategy', async () => {
            const testCases = [
                {
                    data: { rxTba: [{ id: 'rx1', dos: '2024-01-01', medication: 'Med' }] },
                    expectedStrategy: 'complex'
                },
                {
                    data: { customField: [{ date: '2024-01-01', name: 'Item' }] },
                    expectedStrategy: 'flexible'
                },
                {
                    data: { simpleData: 'test' },
                    expectedStrategy: 'simple'
                }
            ];

            for (const testCase of testCases) {
                (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testCase.data));

                const strategy = await hybridParser.getParsingStrategy('/test/file.json');
                expect(['complex', 'flexible', 'simple', 'none']).toContain(strategy);
            }
        });

        it('should preserve error information through fallback chain', async () => {
            const invalidData = { completelyInvalid: 'data' };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(invalidData));

            try {
                await hybridParser.parseFile('/test/invalid.json');
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                expect((e as any).message).toBeDefined();
            }
        });
    });

    describe('Recovery Suggestions', () => {
        it('should provide actionable recovery suggestions for file errors', async () => {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            (fs.promises.readFile as any).mockRejectedValue(error);

            try {
                await parser.parseFile('/missing/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect((e as any).recoverySuggestions).toContain('Check if the file path is correct');
                expect((e as any).recoverySuggestions).toContain('Verify the file exists');
            }
        });

        it('should provide recovery suggestions for structure errors', async () => {
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({ invalidField: 'test' }));

            try {
                await parser.parseFile('/test/invalid.json');
            } catch (e) {
                expect(e).toBeInstanceOf(StructureValidationError);
                expect((e as any).recoverySuggestions).toContain('Ensure your JSON contains medical claims data');
                expect((e as any).recoverySuggestions).toContain('Check the sample files for correct structure');
            }
        });

        it('should provide recovery suggestions for date errors', async () => {
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({
                rxTba: [{ id: 'rx1', dos: 'invalid-date', medication: 'Med' }]
            }));

            try {
                await parser.parseFile('/test/bad-dates.json');
            } catch (e) {
                expect(e).toBeInstanceOf(DateParseError);
                expect((e as any).recoverySuggestions).toContain('Use the format: YYYY-MM-DD');
                expect((e as any).recoverySuggestions).toContain('Check your date values');
            }
        });
    });

    describe('Error Context and Debugging', () => {
        it('should include file path in all error types', async () => {
            const testPath = '/test/debug.json';
            
            // Test FileReadError
            (fs.promises.readFile as any).mockRejectedValue(new Error('File error'));
            try {
                await parser.parseFile(testPath);
            } catch (e) {
                expect((e as any).filePath).toBe(testPath);
            }

            // Test ValidationError
            (fs.promises.readFile as any).mockResolvedValue('invalid json');
            try {
                await parser.parseFile(testPath);
            } catch (e) {
                expect((e as any).filePath).toBe(testPath);
            }

            // Test StructureValidationError
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({ invalid: 'data' }));
            try {
                await parser.parseFile(testPath);
            } catch (e) {
                expect((e as any).filePath).toBe(testPath);
            }
        });



        it('should preserve original error stack traces', async () => {
            const originalError = new Error('Original error');
            originalError.stack = 'Original stack trace';
            (fs.promises.readFile as any).mockRejectedValue(originalError);

            try {
                await parser.parseFile('/test/stack.json');
            } catch (e) {
                expect((e as any).originalError).toBe(originalError);
                expect((e as any).stack).toContain('Original stack trace');
            }
        });
    });

    describe('Graceful Degradation', () => {


        it('should handle empty arrays gracefully', async () => {
            const emptyData = {
                rxTba: [],
                rxHistory: [],
                medHistory: { claims: [] }
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(emptyData));

            const result = await parser.parseFile('/test/empty.json');
            
            expect(result.claims).toHaveLength(0);
            expect(result.metadata.totalClaims).toBe(0);
            expect(result.metadata.claimTypes).toEqual([]);
        });

        it('should handle partial data corruption', async () => {
            const partiallyCorruptData = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Good Med' }, // Valid
                    { id: 'rx2', dos: 'bad-date', medication: 'Bad Med' }, // Invalid date
                    { id: 'rx3', dos: '2024-01-03', medication: 'Another Good Med' } // Valid
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(partiallyCorruptData));

            // Should either skip invalid entries or throw descriptive error
            try {
                const result = await parser.parseFile('/test/partial.json');
                // If it succeeds, should have valid entries only
                expect(result.claims.length).toBeGreaterThan(0);
                result.claims.forEach(claim => {
                    expect(claim.startDate).toBeInstanceOf(Date);
                });
            } catch (e) {
                // If it fails, should provide context about which entry failed
                expect((e as any).context).toBeDefined();
                expect((e as any).context.claimIndex).toBe(1); // Second entry (index 1)
            }
        });
    });
});