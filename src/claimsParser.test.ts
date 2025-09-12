import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { ClaimsParser } from './claimsParser';
import { ParserConfig } from './types';
import { 
    ClaimItem, 
    TimelineData, 
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

describe('ClaimsParser', () => {
    let parser: ClaimsParser;
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
        vi.clearAllMocks();
    });

    describe('validateStructure', () => {
        it('should return true for valid rxTba structure', () => {
            const validJson = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Test Med' }
                ]
            };
            
            expect(parser.validateStructure(validJson)).toBe(true);
        });

        it('should return true for valid rxHistory structure', () => {
            const validJson = {
                rxHistory: [
                    { id: 'rxh1', dos: '2024-01-01', dayssupply: 30, medication: 'Test Med' }
                ]
            };
            
            expect(parser.validateStructure(validJson)).toBe(true);
        });

        it('should return true for valid medHistory structure', () => {
            const validJson = {
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                { lineId: 'line1', srvcStart: '2024-01-01', srvcEnd: '2024-01-01' }
                            ]
                        }
                    ]
                }
            };
            
            expect(parser.validateStructure(validJson)).toBe(true);
        });

        it('should throw error for invalid structure', () => {
            expect(() => parser.validateStructure(null)).toThrow(StructureValidationError);
            expect(() => parser.validateStructure({})).toThrow(StructureValidationError);
            expect(() => parser.validateStructure({ invalidField: 'test' })).toThrow(StructureValidationError);
        });

        it('should throw error for medHistory without claims array', () => {
            const invalidJson = {
                medHistory: {
                    invalidField: 'test'
                }
            };
            
            expect(() => parser.validateStructure(invalidJson)).toThrow(StructureValidationError);
        });
    });

    describe('extractClaims', () => {
        it('should extract rxTba claims correctly', () => {
            const json = {
                rxTba: [
                    {
                        id: 'rx1',
                        dos: '2024-01-15',
                        dayssupply: 30,
                        medication: 'Lisinopril 10mg',
                        dosage: '10mg once daily'
                    }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            expect(claims[0]).toMatchObject({
                id: 'rx1',
                type: 'rxTba',
                displayName: 'Lisinopril 10mg',
                color: '#FF6B6B'
            });
            expect(claims[0].startDate).toEqual(new Date('2024-01-15'));
            expect(claims[0].endDate).toEqual(new Date('2024-02-14')); // 30 days later
        });

        it('should extract rxHistory claims correctly', () => {
            const json = {
                rxHistory: [
                    {
                        id: 'rxh1',
                        dos: '2024-01-10',
                        dayssupply: 7,
                        medication: 'Amoxicillin 500mg'
                    }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            expect(claims[0]).toMatchObject({
                id: 'rxh1',
                type: 'rxHistory',
                displayName: 'Amoxicillin 500mg',
                color: '#4ECDC4'
            });
            expect(claims[0].startDate).toEqual(new Date('2024-01-10'));
            expect(claims[0].endDate).toEqual(new Date('2024-01-17')); // 7 days later
        });

        it('should extract medHistory claims correctly', () => {
            const json = {
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            provider: 'Test Hospital',
                            lines: [
                                {
                                    lineId: 'line1',
                                    srvcStart: '2024-01-08',
                                    srvcEnd: '2024-01-08',
                                    serviceType: 'Office Visit',
                                    description: 'Routine checkup'
                                }
                            ]
                        }
                    ]
                }
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            expect(claims[0]).toMatchObject({
                id: 'line1',
                type: 'medHistory',
                displayName: 'Routine checkup',
                color: '#45B7D1'
            });
            expect(claims[0].startDate).toEqual(new Date('2024-01-08'));
            expect(claims[0].endDate).toEqual(new Date('2024-01-08'));
            expect(claims[0].details.claimId).toBe('med1');
            expect(claims[0].details.provider).toBe('Test Hospital');
        });

        it('should handle multiple claim types in one file', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Med A' }
                ],
                rxHistory: [
                    { id: 'rxh1', dos: '2024-01-05', dayssupply: 7, medication: 'Med B' }
                ],
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                { lineId: 'line1', srvcStart: '2024-01-10', srvcEnd: '2024-01-10', description: 'Visit' }
                            ]
                        }
                    ]
                }
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(3);
            expect(claims.map(c => c.type)).toEqual(['rxTba', 'rxHistory', 'medHistory']);
        });

        it('should handle missing dayssupply gracefully', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Test Med' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            expect(claims[0].startDate).toEqual(new Date('2024-01-01'));
            expect(claims[0].endDate).toEqual(new Date('2024-01-31')); // 30 days default when dayssupply is missing
        });

        it('should generate fallback IDs when missing', () => {
            const json = {
                rxTba: [
                    { dos: '2024-01-01', dayssupply: 30, medication: 'Test Med' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            expect(claims[0].id).toBe('rxTba_0');
        });

        it('should generate fallback display names when missing', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30 }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            expect(claims[0].displayName).toBe('rxTba Claim rx1');
        });
    });

    describe('parseFile', () => {
        it('should successfully parse a valid JSON file', async () => {
            const mockFileContent = JSON.stringify({
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Test Med' }
                ]
            });

            (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

            const result = await parser.parseFile('/test/file.json');
            
            expect(result.claims).toHaveLength(1);
            expect(result.metadata.totalClaims).toBe(1);
            expect(result.metadata.claimTypes).toEqual(['rxTba']);
        });

        it('should throw FileReadError for non-existent file', async () => {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            (fs.promises.readFile as any).mockRejectedValue(error);

            await expect(parser.parseFile('/nonexistent/file.json'))
                .rejects.toThrow(FileReadError);
        });

        it('should throw ValidationError for invalid JSON', async () => {
            (fs.promises.readFile as any).mockResolvedValue('invalid json {');

            await expect(parser.parseFile('/test/file.json'))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError for invalid structure', async () => {
            const mockFileContent = JSON.stringify({ invalidField: 'test' });
            (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

            await expect(parser.parseFile('/test/file.json'))
                .rejects.toThrow(ValidationError);
        });

        it('should throw DateParseError for invalid dates', async () => {
            const mockFileContent = JSON.stringify({
                rxTba: [
                    { id: 'rx1', dos: 'invalid-date', dayssupply: 30, medication: 'Test Med' }
                ]
            });
            (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

            await expect(parser.parseFile('/test/file.json'))
                .rejects.toThrow(DateParseError);
        });
    });

    describe('date parsing', () => {
        it('should parse ISO dates correctly', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-15', dayssupply: 30, medication: 'Test Med' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            expect(claims[0].startDate).toEqual(new Date('2024-01-15'));
        });

        it('should parse different date formats', () => {
            const testCases = [
                { format: 'MM/DD/YYYY', date: '01/15/2024', expected: new Date(Date.UTC(2024, 0, 15)) },
                { format: 'DD-MM-YYYY', date: '15-01-2024', expected: new Date(Date.UTC(2024, 0, 15)) },
                { format: 'YYYY/MM/DD', date: '2024/01/15', expected: new Date(Date.UTC(2024, 0, 15)) }
            ];

            testCases.forEach(({ format, date, expected }) => {
                const configWithFormat = { ...mockConfig, dateFormat: format };
                const parserWithFormat = new ClaimsParser(configWithFormat);
                
                const json = {
                    rxTba: [
                        { id: 'rx1', dos: date, dayssupply: 30, medication: 'Test Med' }
                    ]
                };

                const claims = parserWithFormat.extractClaims(json, configWithFormat);
                expect(claims[0].startDate).toEqual(expected);
            });
        });

        it('should handle invalid date formats gracefully', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: 'not-a-date', dayssupply: 30, medication: 'Test Med' }
                ]
            };

            expect(() => parser.extractClaims(json, mockConfig)).toThrow(DateParseError);
        });
    });

    describe('timeline data generation', () => {
        it('should generate correct timeline data with date range', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Med A' },
                    { id: 'rx2', dos: '2024-03-01', dayssupply: 7, medication: 'Med B' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            const timelineData = parser['generateTimelineData'](claims);

            expect(timelineData.dateRange.start).toEqual(new Date('2024-01-01'));
            expect(timelineData.dateRange.end).toEqual(new Date('2024-03-08')); // March 1 + 7 days
            expect(timelineData.metadata.totalClaims).toBe(2);
            expect(timelineData.metadata.claimTypes).toEqual(['rxTba']);
        });

        it('should sort claims by start date (most recent first)', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Med A' },
                    { id: 'rx2', dos: '2024-03-01', dayssupply: 7, medication: 'Med B' },
                    { id: 'rx3', dos: '2024-02-01', dayssupply: 14, medication: 'Med C' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            const timelineData = parser['generateTimelineData'](claims);

            expect(timelineData.claims[0].id).toBe('rx2'); // March 1 (most recent)
            expect(timelineData.claims[1].id).toBe('rx3'); // February 1
            expect(timelineData.claims[2].id).toBe('rx1'); // January 1 (oldest)
        });

        it('should handle empty claims array', () => {
            const timelineData = parser['generateTimelineData']([]);

            expect(timelineData.claims).toHaveLength(0);
            expect(timelineData.metadata.totalClaims).toBe(0);
            expect(timelineData.metadata.claimTypes).toEqual([]);
        });
    });

    describe('configuration updates', () => {
        it('should update configuration correctly', () => {
            const newConfig: ParserConfig = {
                ...mockConfig,
                rxTbaPath: 'customRxTba',
                colors: { 
                    rxTba: '#000000',
                    rxHistory: mockConfig.colors?.rxHistory || '#4ECDC4',
                    medHistory: mockConfig.colors?.medHistory || '#45B7D1'
                }
            };

            parser.updateConfig(newConfig);

            const json = {
                customRxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Test Med' }
                ]
            };

            const claims = parser.extractClaims(json, newConfig);
            expect(claims).toHaveLength(1);
            expect(claims[0].color).toBe('#000000');
        });
    });

    describe('custom path configuration', () => {
        it('should handle nested paths correctly', () => {
            const customConfig = {
                ...mockConfig,
                medHistoryPath: 'data.medical.history'
            };
            const customParser = new ClaimsParser(customConfig);

            const json = {
                data: {
                    medical: {
                        history: {
                            claims: [
                                {
                                    claimId: 'med1',
                                    lines: [
                                        { lineId: 'line1', srvcStart: '2024-01-01', srvcEnd: '2024-01-01', description: 'Test' }
                                    ]
                                }
                            ]
                        }
                    }
                }
            };

            const claims = customParser.extractClaims(json, customConfig);
            expect(claims).toHaveLength(1);
            expect(claims[0].type).toBe('medHistory');
        });
    });
});