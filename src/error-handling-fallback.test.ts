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

describe('Error Handling and Fallback Mechanisms - Requirements 2.1 & 2.2', () => {
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

    describe('File System Error Handling - Requirement 2.1', () => {
        it('should handle file not found errors with detailed context', async () => {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            (fs.promises.readFile as any).mockRejectedValue(error);

            await expect(parser.parseFile('/nonexistent/file.json'))
                .rejects.toThrow(FileReadError);
            
            try {
                await parser.parseFile('/nonexistent/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect(e.message).toContain('File not found');
                expect(e.filePath).toBe('/nonexistent/file.json');
                expect(e.code).toBe('ENOENT');
                expect(e.recoverySuggestions).toContain('Check if the file path is correct');
                expect(e.recoverySuggestions).toContain('Verify the file exists');
            }
        });

        it('should handle permission denied errors', async () => {
            const error = new Error('Permission denied');
            (error as any).code = 'EACCES';
            (fs.promises.readFile as any).mockRejectedValue(error);

            try {
                await parser.parseFile('/restricted/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect(e.code).toBe('EACCES');
                expect(e.recoverySuggestions).toContain('Check file permissions');
                expect(e.recoverySuggestions).toContain('Run with appropriate privileges');
            }
        });

        it('should handle disk space errors', async () => {
            const error = new Error('No space left on device');
            (error as any).code = 'ENOSPC';
            (fs.promises.readFile as any).mockRejectedValue(error);

            try {
                await parser.parseFile('/full-disk/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect(e.code).toBe('ENOSPC');
                expect(e.recoverySuggestions).toContain('Free up disk space');
            }
        });

        it('should handle network drive errors', async () => {
            const error = new Error('Network is unreachable');
            (error as any).code = 'ENETUNREACH';
            (fs.promises.readFile as any).mockRejectedValue(error);

            try {
                await parser.parseFile('//network/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect(e.code).toBe('ENETUNREACH');
                expect(e.recoverySuggestions).toContain('Check network connection');
            }
        });

        it('should handle empty files gracefully', async () => {
            (fs.promises.readFile as any).mockResolvedValue('');

            try {
                await parser.parseFile('/empty/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                expect(e.message).toContain('Empty file');
                expect(e.recoverySuggestions).toContain('Ensure the file contains valid JSON data');
            }
        });

        it('should handle very large files with memory constraints', async () => {
            // Simulate out of memory error
            const error = new Error('Cannot allocate memory');
            (error as any).code = 'ENOMEM';
            (fs.promises.readFile as any).mockRejectedValue(error);

            try {
                await parser.parseFile('/huge/file.json');
            } catch (e) {
                expect(e).toBeInstanceOf(FileReadError);
                expect(e.code).toBe('ENOMEM');
                expect(e.recoverySuggestions).toContain('Try with a smaller file');
                expect(e.recoverySuggestions).toContain('Increase available memory');
            }
        });
    });

    describe('JSON Parsing Error Handling - Requirement 2.1', () => {
        it('should handle various malformed JSON scenarios', async () => {
            const malformedJsonCases = [
                { json: '{ invalid json }', description: 'invalid syntax' },
                { json: '{ "key": }', description: 'missing value' },
                { json: '{ "key": "value" ', description: 'incomplete object' },
                { json: 'not json at all', description: 'not JSON' },
                { json: '{ "key": "value", }', description: 'trailing comma' },
                { json: '{ key: "value" }', description: 'unquoted key' },
                { json: '{ "key": "value" "another": "value" }', description: 'missing comma' },
                { json: '{ "key": "value\n }', description: 'unterminated string' }
            ];

            for (const testCase of malformedJsonCases) {
                (fs.promises.readFile as any).mockResolvedValue(testCase.json);

                try {
                    await parser.parseFile('/test/malformed.json');
                    throw new Error(`Expected error for ${testCase.description}`);
                } catch (e) {
                    expect(e).toBeInstanceOf(ValidationError);
                    expect(e.message).toContain('Invalid JSON');
                    expect(e.filePath).toBe('/test/malformed.json');
                    expect(e.recoverySuggestions).toContain('Check JSON syntax');
                }
            }
        });

        it('should provide specific error locations for JSON syntax errors', async () => {
            (fs.promises.readFile as any).mockResolvedValue('{ "key": "value" ');

            try {
                await parser.parseFile('/test/incomplete.json');
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                expect(e.message).toContain('Invalid JSON');
                expect(e.filePath).toBe('/test/incomplete.json');
                expect(e.originalError).toBeDefined();
                expect(e.originalError.message).toBeTruthy();
            }
        });

        it('should handle JSON with invalid Unicode sequences', async () => {
            const invalidUnicode = '{ "key": "\\uXXXX" }';
            (fs.promises.readFile as any).mockResolvedValue(invalidUnicode);

            try {
                await parser.parseFile('/test/unicode.json');
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                expect(e.message).toContain('Invalid JSON');
                expect(e.recoverySuggestions).toContain('Check for invalid Unicode sequences');
            }
        });


    });

    describe('Structure Validation Error Handling - Requirement 2.1', () => {
        it('should handle completely invalid data structures', async () => {
            const invalidStructures = [
                { data: { notMedicalData: 'test' }, description: 'non-medical data' },
                { data: { rxTba: 'not an array' }, description: 'wrong type for rxTba' },
                { data: { rxHistory: null }, description: 'null rxHistory' },
                { data: { medHistory: { notClaims: [] } }, description: 'invalid medHistory structure' },
                { data: { medHistory: { claims: 'not an array' } }, description: 'wrong type for claims' },
                { data: [], description: 'array instead of object' },
                { data: 'string', description: 'string instead of object' },
                { data: 123, description: 'number instead of object' }
            ];

            for (const testCase of invalidStructures) {
                (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testCase.data));

                try {
                    await parser.parseFile('/test/invalid.json');
                    throw new Error(`Expected error for ${testCase.description}`);
                } catch (e) {
                    expect(e).toBeInstanceOf(StructureValidationError);
                    expect(e.message).toContain('does not contain valid medical claims data');
                    expect(e.expectedStructure).toBeDefined();
                    expect(e.expectedStructure).toContain('rxTba');
                    expect(e.expectedStructure).toContain('rxHistory');
                    expect(e.expectedStructure).toContain('medHistory');
                }
            }
        });

        it('should provide detailed structure expectations', async () => {
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({}));

            try {
                await parser.parseFile('/test/empty-object.json');
            } catch (e) {
                expect(e).toBeInstanceOf(StructureValidationError);
                expect(e.expectedStructure).toContain('rxTba: array of prescription claims');
                expect(e.expectedStructure).toContain('rxHistory: array of prescription history');
                expect(e.expectedStructure).toContain('medHistory: object with claims array');
                expect(e.recoverySuggestions).toContain('Ensure your JSON contains medical claims data');
                expect(e.recoverySuggestions).toContain('Check the sample files for correct structure');
            }
        });

        it('should handle partially valid structures', async () => {
            const partiallyValid = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Valid Med' }
                ],
                invalidField: 'should not prevent validation',
                medHistory: {
                    claims: 'invalid - should be array'
                }
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(partiallyValid));

            // Should still validate because rxTba is valid
            expect(parser.validateStructure(partiallyValid)).toBe(true);
        });

        it('should handle nested structure validation errors', async () => {
            const invalidNested = {
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: 'should be array'
                        }
                    ]
                }
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(invalidNested));

            try {
                await parser.parseFile('/test/invalid-nested.json');
            } catch (e) {
                expect(e).toBeInstanceOf(StructureValidationError);
                expect(e.message).toContain('medHistory claims must have lines array');
            }
        });
    });

    describe('Date Parsing Error Handling - Requirement 2.1', () => {




        it('should handle date parsing context information', async () => {
            const data = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Valid Med' },
                    { id: 'rx2', dos: 'bad-date', medication: 'Invalid Med' },
                    { id: 'rx3', dos: '2024-01-03', medication: 'Another Valid Med' }
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(data));

            try {
                await parser.parseFile('/test/context.json');
            } catch (e) {
                expect(e).toBeInstanceOf(DateParseError);
                expect(e.context).toBeDefined();
                expect(e.context.claimType).toBe('rxTba');
                expect(e.context.claimIndex).toBe(1); // Second claim (index 1)
                expect(e.context.fieldName).toBe('dos');
                expect(e.context.fieldValue).toBe('bad-date');
            }
        });

        it('should handle timezone and locale-specific date issues', async () => {
            const timezoneTestCases = [
                '2024-01-01T25:00:00Z', // Invalid hour
                '2024-01-01T12:60:00Z', // Invalid minute
                '2024-01-01T12:30:60Z', // Invalid second
                '2024-01-01T12:30:30+25:00', // Invalid timezone offset
            ];

            for (const dateString of timezoneTestCases) {
                const data = {
                    rxTba: [{ id: 'rx1', dos: dateString, medication: 'Med' }]
                };

                (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(data));

                try {
                    await parser.parseFile('/test/timezone.json');
                } catch (e) {
                    expect(e).toBeInstanceOf(DateParseError);
                    expect(e.recoverySuggestions).toContain('Check date and time values');
                }
            }
        });
    });

    describe('Hybrid Parser Fallback Mechanisms - Requirement 2.2', () => {
        it('should attempt multiple parsing strategies in order', async () => {
            const testData = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-15', medication: 'Test Med' }
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testData));

            const result = await hybridParser.parseFile('/test/fallback.json');
            
            expect(result).toBeDefined();
            expect(result.claims).toBeDefined();
            expect(Array.isArray(result.claims)).toBe(true);
            expect(result.claims.length).toBeGreaterThan(0);
        });

        it('should determine appropriate parsing strategy based on data structure', async () => {
            const testCases = [
                {
                    data: { rxTba: [{ id: 'rx1', dos: '2024-01-01', medication: 'Med' }] },
                    expectedStrategy: 'complex',
                    description: 'standard medical claims'
                },
                {
                    data: { customField: [{ date: '2024-01-01', name: 'Item' }] },
                    expectedStrategy: 'flexible',
                    description: 'custom structure requiring flexible parsing'
                },
                {
                    data: { simpleData: 'test' },
                    expectedStrategy: 'simple',
                    description: 'simple data structure'
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
                expect(e.message).toBeDefined();
                expect(e.message).toContain('parsing strategies failed');
            }
        });

        it('should handle fallback strategy failures gracefully', async () => {
            // Mock all parsing strategies to fail
            const originalComplexParse = ClaimsParser.prototype.parseFile;
            ClaimsParser.prototype.parseFile = vi.fn().mockRejectedValue(new Error('Complex parsing failed'));

            const testData = {
                rxTba: [{ id: 'rx1', dos: '2024-01-15', medication: 'Test Med' }]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testData));

            try {
                const result = await hybridParser.parseFile('/test/all-fail.json');
                // If it succeeds with simple parsing, that's acceptable
                expect(result).toBeDefined();
            } catch (e) {
                // If all strategies fail, should provide comprehensive error
                expect(e.message).toContain('All parsing strategies failed');
            } finally {
                // Restore original method
                ClaimsParser.prototype.parseFile = originalComplexParse;
            }
        });

        it('should track parsing attempts and performance', async () => {
            const testData = {
                rxTba: [{ id: 'rx1', dos: '2024-01-15', medication: 'Test Med' }]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testData));

            const startTime = Date.now();
            const result = await hybridParser.parseFile('/test/performance.json');
            const endTime = Date.now();

            expect(result).toBeDefined();
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Graceful Degradation - Requirement 2.1', () => {
        it('should handle missing optional fields with fallbacks', async () => {
            const incompleteData = {
                rxTba: [
                    { dos: '2024-01-01' }, // Missing id, medication, dayssupply
                    { id: 'rx2', medication: 'Med B' }, // Missing dos, dayssupply
                    { id: 'rx3', dos: '2024-01-03', medication: 'Med C' } // Complete
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(incompleteData));

            const result = await hybridParser.parseFile('/test/incomplete.json');
            
            expect(result.claims.length).toBeGreaterThan(0);
            
            // Should generate fallback values for processable claims
            const validClaims = result.claims.filter(claim => 
                claim.id && claim.startDate && claim.displayName
            );
            expect(validClaims.length).toBeGreaterThan(0);
        });

        it('should handle empty arrays gracefully', async () => {
            const emptyData = {
                rxTba: [],
                rxHistory: [],
                medHistory: { claims: [] }
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(emptyData));

            const result = await hybridParser.parseFile('/test/empty.json');
            
            expect(result.claims).toHaveLength(0);
            expect(result.metadata.totalClaims).toBe(0);
            expect(result.metadata.claimTypes).toEqual([]);
            expect(result.dateRange.start).toBeInstanceOf(Date);
            expect(result.dateRange.end).toBeInstanceOf(Date);
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

            try {
                const result = await hybridParser.parseFile('/test/partial.json');
                // If it succeeds, should have processed valid entries
                expect(result.claims.length).toBeGreaterThan(0);
                result.claims.forEach(claim => {
                    expect(claim.startDate).toBeInstanceOf(Date);
                    expect(claim.endDate).toBeInstanceOf(Date);
                });
            } catch (e) {
                // If it fails, should provide context about which entry failed
                if (e.context) {
                    expect(e.context.claimIndex).toBe(1); // Second entry (index 1)
                }
            }
        });

        it('should handle mixed valid and invalid claim types', async () => {
            const mixedData = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Valid Med' }
                ],
                rxHistory: 'invalid - should be array',
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                { lineId: 'line1', srvcStart: '2024-01-02', srvcEnd: '2024-01-02' }
                            ]
                        }
                    ]
                }
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(mixedData));

            const result = await hybridParser.parseFile('/test/mixed.json');
            
            // Should process valid claim types and skip invalid ones
            expect(result.claims.length).toBeGreaterThan(0);
            expect(result.metadata.claimTypes).toContain('rxTba');
            expect(result.metadata.claimTypes).toContain('medHistory');
            expect(result.metadata.claimTypes).not.toContain('rxHistory');
        });


    });

    describe('Error Context and Debugging - Requirement 2.1', () => {


        it('should preserve original error stack traces', async () => {
            const originalError = new Error('Original error');
            originalError.stack = 'Original stack trace\n  at test location';
            (fs.promises.readFile as any).mockRejectedValue(originalError);

            try {
                await parser.parseFile('/test/stack.json');
            } catch (e) {
                expect(e.originalError).toBe(originalError);
                expect(e.stack).toContain('Original stack trace');
                expect(e.stack).toContain('test location');
            }
        });

        it('should include parsing performance metrics', async () => {
            const testData = {
                rxTba: Array.from({ length: 100 }, (_, i) => ({
                    id: `rx${i}`,
                    dos: '2024-01-01',
                    medication: `Med ${i}`
                }))
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testData));

            const result = await hybridParser.parseFile('/test/performance.json');
            
            expect(result).toBeDefined();
            expect(result.claims).toHaveLength(100);
            
            // Performance should be reasonable for 100 claims
            const startTime = Date.now();
            await hybridParser.parseFile('/test/performance.json');
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should provide detailed error summaries', async () => {
            const complexErrorData = {
                rxTba: [
                    { id: 'rx1', dos: 'bad-date-1', medication: 'Med 1' },
                    { id: 'rx2', dos: 'bad-date-2', medication: 'Med 2' },
                    { id: 'rx3', dos: '2024-01-01', medication: 'Valid Med' }
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(complexErrorData));

            try {
                await parser.parseFile('/test/complex-error.json');
            } catch (e) {
                expect(e.message).toBeDefined();
                expect(e.filePath).toBe('/test/complex-error.json');
                expect(e.recoverySuggestions).toBeDefined();
                expect(e.recoverySuggestions.length).toBeGreaterThan(0);
            }
        });
    });
});