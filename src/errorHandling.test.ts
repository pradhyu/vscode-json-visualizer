import { describe, it, expect, beforeEach } from 'vitest';
import { 
    ParseError, 
    ValidationError, 
    DateParseError, 
    FileReadError, 
    StructureValidationError,
    ErrorHandler 
} from './types';
import { ClaimsParser } from './claimsParser';
import { ParserConfig } from './types';

describe('Error Handling', () => {
    let claimsParser: ClaimsParser;
    let testConfig: ParserConfig;

    beforeEach(() => {
        testConfig = {
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
        claimsParser = new ClaimsParser(testConfig);
    });

    describe('ErrorHandler', () => {
        it('should provide user-friendly messages for StructureValidationError', () => {
            const error = new StructureValidationError(
                'Missing required arrays',
                ['rxTba', 'rxHistory'],
                ['Add rxTba array', 'Add rxHistory array']
            );

            const message = ErrorHandler.getUserFriendlyMessage(error);
            expect(message).toContain('Invalid JSON structure');
            expect(message).toContain('Missing required fields: rxTba, rxHistory');
            expect(message).toContain('• Add rxTba array');
        });

        it('should provide user-friendly messages for DateParseError', () => {
            const error = new DateParseError(
                'Invalid date format',
                { 
                    suggestedFormats: ['YYYY-MM-DD', 'MM/DD/YYYY'],
                    originalValue: 'invalid-date'
                }
            );

            const message = ErrorHandler.getUserFriendlyMessage(error);
            expect(message).toContain('Date parsing error');
            expect(message).toContain('• YYYY-MM-DD');
            expect(message).toContain('• MM/DD/YYYY');
        });

        it('should provide recovery suggestions for different error types', () => {
            const structureError = new StructureValidationError('Invalid structure', [], []);
            const suggestions = ErrorHandler.getRecoverySuggestions(structureError);
            
            expect(suggestions).toContain('Verify your JSON file contains medical claims data');
            expect(suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('ClaimsParser Error Handling', () => {
        it('should throw StructureValidationError for invalid JSON structure', () => {
            const invalidJson = { invalid: 'structure' };
            
            expect(() => claimsParser.validateStructure(invalidJson))
                .toThrow(StructureValidationError);
        });

        it('should throw StructureValidationError for null input', () => {
            expect(() => claimsParser.validateStructure(null))
                .toThrow(StructureValidationError);
        });

        it('should throw StructureValidationError for non-object input', () => {
            expect(() => claimsParser.validateStructure('not an object'))
                .toThrow(StructureValidationError);
        });

        it('should validate structure with at least one valid array', () => {
            const validJson = {
                rxTba: [
                    { id: '1', dos: '2024-01-01', dayssupply: 30, medication: 'Test Med' }
                ]
            };
            
            expect(() => claimsParser.validateStructure(validJson)).not.toThrow();
        });




    });

    describe('Date Parsing Error Handling', () => {
        it('should handle empty date strings', () => {
            const rxData = [{
                id: '1',
                dos: '',
                dayssupply: 30,
                medication: 'Test Med'
            }];

            expect(() => claimsParser.extractClaims({ rxTba: rxData }, testConfig))
                .toThrow(DateParseError);
        });

        it('should handle null date values', () => {
            const rxData = [{
                id: '1',
                dos: null,
                dayssupply: 30,
                medication: 'Test Med'
            }];

            expect(() => claimsParser.extractClaims({ rxTba: rxData }, testConfig))
                .toThrow(DateParseError);
        });

        it('should handle invalid date formats', () => {
            const rxData = [{
                id: '1',
                dos: 'invalid-date-format',
                dayssupply: 30,
                medication: 'Test Med'
            }];

            expect(() => claimsParser.extractClaims({ rxTba: rxData }, testConfig))
                .toThrow(DateParseError);
        });

        it('should provide format suggestions in date errors', () => {
            // Create data with no fallback date fields to ensure DateParseError is thrown
            const rxData = [{
                id: '1',
                dos: 'invalid-date-format-xyz',
                dayssupply: 30,
                medication: 'Test Med'
                // No fallback date fields like fillDate, prescriptionDate, etc.
            }];

            try {
                claimsParser.extractClaims({ rxTba: rxData }, testConfig);
                expect.fail('Should have thrown DateParseError');
            } catch (error) {
                expect(error).toBeInstanceOf(DateParseError);
                
                // Debug: log the actual error structure
                console.log('Error details structure:', JSON.stringify((error as DateParseError).details, null, 2));
                
                // The error should contain format suggestions from the original parseDate error
                const details = (error as DateParseError).details;
                
                // When all claims fail, the error details contain the errors array
                expect(details?.type).toBe('rxTba');
                expect(details?.totalClaims).toBe(1);
                expect(details?.errors).toBeDefined();
                expect(details?.errors[0]).toContain('Unable to parse date');
                expect(details?.errors[0]).toContain('YYYY-MM-DD');
            }
        });
    });

    describe('Fallback Mechanisms', () => {




        it('should use fallback display names', () => {
            const rxData = [{
                id: '1',
                dos: '2024-01-01',
                dayssupply: 30
                // Missing medication name
            }];

            const result = claimsParser.extractClaims({ rxTba: rxData }, testConfig);
            expect(result).toHaveLength(1);
            expect(result[0].displayName).toBe('rxTba Claim 1');
        });






    });

    describe('Partial Data Recovery', () => {
        it('should process valid claims and skip invalid ones', () => {
            const mixedData = {
                rxTba: [
                    { id: '1', dos: '2024-01-01', dayssupply: 30, medication: 'Valid Med' },
                    { id: '2', dos: 'invalid-date', dayssupply: 30, medication: 'Invalid Med' },
                    { id: '3', dos: '2024-01-03', dayssupply: 30, medication: 'Another Valid Med' }
                ]
            };

            // Should process 2 valid claims and skip 1 invalid
            const result = claimsParser.extractClaims(mixedData, testConfig);
            expect(result).toHaveLength(2);
            expect(result[0].displayName).toBe('Valid Med');
            expect(result[1].displayName).toBe('Another Valid Med');
        });

        it('should throw error when all claims are invalid', () => {
            const allInvalidData = {
                rxTba: [
                    { id: '1', dos: 'invalid-date1', dayssupply: 30, medication: 'Med 1' },
                    { id: '2', dos: 'invalid-date2', dayssupply: 30, medication: 'Med 2' }
                ]
            };

            expect(() => claimsParser.extractClaims(allInvalidData, testConfig))
                .toThrow(DateParseError);
        });
    });
});