import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimsParser } from './claimsParser';
import { ParserConfig } from './types';
import { StructureValidationError } from './types';

describe('Parser Validation Fixes - Unit Tests', () => {
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

    describe('Fixed validateStructure method - Requirement 1.1', () => {
        it('should accept test-claims.json exact structure', () => {
            const testClaimsStructure = {
                rxTba: [
                    {
                        id: 'rx1',
                        dos: '2024-01-15',
                        dayssupply: 30,
                        medication: 'Test Medication',
                        dosage: '10mg once daily'
                    },
                    {
                        id: 'rx2', 
                        dos: '2024-02-01',
                        dayssupply: 7,
                        medication: 'Another Medication',
                        dosage: '5mg twice daily'
                    }
                ]
            };

            expect(() => parser.validateStructure(testClaimsStructure)).not.toThrow();
            expect(parser.validateStructure(testClaimsStructure)).toBe(true);
        });

        it('should validate rxTba with minimal required fields', () => {
            const minimalRxTba = {
                rxTba: [
                    { dos: '2024-01-01' }, // Only date
                    { medication: 'Med A' }, // Only medication
                    { id: 'rx1' } // Only id
                ]
            };

            expect(parser.validateStructure(minimalRxTba)).toBe(true);
        });

        it('should validate rxHistory array structure', () => {
            const validRxHistory = {
                rxHistory: [
                    { id: 'rxh1', dos: '2024-01-01', dayssupply: 7, medication: 'Med A' },
                    { dos: '2024-01-02', medication: 'Med B' } // Missing id and dayssupply
                ]
            };

            expect(parser.validateStructure(validRxHistory)).toBe(true);
        });

        it('should validate medHistory with nested claims structure', () => {
            const validMedHistory = {
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            provider: 'Hospital A',
                            lines: [
                                { 
                                    lineId: 'line1', 
                                    srvcStart: '2024-01-01', 
                                    srvcEnd: '2024-01-01',
                                    description: 'Office Visit'
                                }
                            ]
                        },
                        {
                            claimId: 'med2',
                            lines: [
                                { 
                                    lineId: 'line2', 
                                    srvcStart: '2024-01-02', 
                                    srvcEnd: '2024-01-02'
                                }
                            ]
                        }
                    ]
                }
            };

            expect(parser.validateStructure(validMedHistory)).toBe(true);
        });

        it('should validate combined claim types', () => {
            const combinedStructure = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Med A' }
                ],
                rxHistory: [
                    { id: 'rxh1', dos: '2024-01-02', medication: 'Med B' }
                ],
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                { lineId: 'line1', srvcStart: '2024-01-03', srvcEnd: '2024-01-03' }
                            ]
                        }
                    ]
                }
            };

            expect(parser.validateStructure(combinedStructure)).toBe(true);
        });

        it('should reject null and undefined inputs', () => {
            expect(() => parser.validateStructure(null)).toThrow(StructureValidationError);
            expect(() => parser.validateStructure(undefined)).toThrow(StructureValidationError);
        });

        it('should reject empty objects', () => {
            expect(() => parser.validateStructure({})).toThrow(StructureValidationError);
        });

        it('should reject objects with no valid medical claim arrays', () => {
            const invalidStructures = [
                { invalidField: 'test' },
                { someData: { nested: 'value' } },
                { rxTba: 'not an array' },
                { rxHistory: null },
                { medHistory: 'invalid' },
                { medHistory: { notClaims: [] } },
                { medHistory: { claims: 'not an array' } }
            ];

            invalidStructures.forEach(structure => {
                expect(() => parser.validateStructure(structure)).toThrow(StructureValidationError);
            });
        });

        it('should accept arrays with mixed valid and invalid items', () => {
            const mixedValidStructure = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Valid Med' },
                    { invalidField: 'this should not prevent validation' },
                    { dos: '2024-01-02' } // Minimal valid item
                ]
            };

            expect(parser.validateStructure(mixedValidStructure)).toBe(true);
        });

        it('should handle edge cases in medHistory structure', () => {
            const edgeCases = [
                // Empty claims array
                {
                    medHistory: {
                        claims: []
                    }
                },
                // Claims with empty lines array
                {
                    medHistory: {
                        claims: [
                            {
                                claimId: 'med1',
                                lines: []
                            }
                        ]
                    }
                },
                // Claims with mixed valid/invalid lines
                {
                    medHistory: {
                        claims: [
                            {
                                claimId: 'med1',
                                lines: [
                                    { lineId: 'line1', srvcStart: '2024-01-01', srvcEnd: '2024-01-01' },
                                    { invalidLine: 'should not break validation' }
                                ]
                            }
                        ]
                    }
                }
            ];

            edgeCases.forEach(structure => {
                expect(parser.validateStructure(structure)).toBe(true);
            });
        });
    });

    describe('Output format standardization - Requirement 1.1', () => {
        it('should produce consistent ClaimItem structure for rxTba', () => {
            const json = {
                rxTba: [
                    {
                        id: 'rx1',
                        dos: '2024-01-15',
                        dayssupply: 30,
                        medication: 'Lisinopril 10mg',
                        dosage: '10mg once daily',
                        prescriber: 'Dr. Smith'
                    }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            const claim = claims[0];
            
            // Verify required ClaimItem properties
            expect(claim).toHaveProperty('id', 'rx1');
            expect(claim).toHaveProperty('type', 'rxTba');
            expect(claim).toHaveProperty('startDate');
            expect(claim).toHaveProperty('endDate');
            expect(claim).toHaveProperty('displayName', 'Lisinopril 10mg');
            expect(claim).toHaveProperty('color', '#FF6B6B');
            expect(claim).toHaveProperty('details');
            
            // Verify date types
            expect(claim.startDate).toBeInstanceOf(Date);
            expect(claim.endDate).toBeInstanceOf(Date);
            
            // Verify details structure
            expect(claim.details).toMatchObject({
                medication: 'Lisinopril 10mg',
                dosage: '10mg once daily',
                daysSupply: 30,
                prescriber: 'Dr. Smith'
            });
        });

        it('should produce consistent ClaimItem structure for rxHistory', () => {
            const json = {
                rxHistory: [
                    {
                        id: 'rxh1',
                        dos: '2024-01-10',
                        dayssupply: 7,
                        medication: 'Amoxicillin 500mg',
                        pharmacy: 'CVS Pharmacy'
                    }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            const claim = claims[0];
            
            expect(claim).toMatchObject({
                id: 'rxh1',
                type: 'rxHistory',
                displayName: 'Amoxicillin 500mg',
                color: '#4ECDC4'
            });
            
            expect(claim.startDate).toBeInstanceOf(Date);
            expect(claim.endDate).toBeInstanceOf(Date);
            expect(claim.details.pharmacy).toBe('CVS Pharmacy');
        });

        it('should produce consistent ClaimItem structure for medHistory', () => {
            const json = {
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            provider: 'General Hospital',
                            totalAmount: 150.00,
                            lines: [
                                {
                                    lineId: 'line1',
                                    srvcStart: '2024-01-08',
                                    srvcEnd: '2024-01-08',
                                    serviceType: 'Office Visit',
                                    description: 'Annual physical exam',
                                    amount: 150.00
                                }
                            ]
                        }
                    ]
                }
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(1);
            const claim = claims[0];
            
            expect(claim).toMatchObject({
                id: 'line1',
                type: 'medHistory',
                displayName: 'Annual physical exam',
                color: '#45B7D1'
            });
            
            expect(claim.startDate).toBeInstanceOf(Date);
            expect(claim.endDate).toBeInstanceOf(Date);
            expect(claim.details).toMatchObject({
                claimId: 'med1',
                provider: 'General Hospital',
                serviceType: 'Office Visit',
                amount: 150.00
            });
        });

        it('should handle missing fields with appropriate fallbacks', () => {
            const json = {
                rxTba: [
                    { dos: '2024-01-01' }, // Missing id, medication, dayssupply
                    { id: 'rx2', medication: 'Med B' }, // Missing dos, dayssupply
                    { id: 'rx3', dos: '2024-01-03', dayssupply: 14 } // Missing medication
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(3);
            
            // First claim - should have generated ID and fallback values
            expect(claims[0].id).toBeTruthy();
            expect(claims[0].id).toMatch(/^rxTba_/);
            expect(claims[0].displayName).toBeTruthy();
            expect(claims[0].startDate).toBeInstanceOf(Date);
            expect(claims[0].endDate).toBeInstanceOf(Date);
            
            // Second claim - should have fallback date
            expect(claims[1].id).toBe('rx2');
            expect(claims[1].displayName).toBe('Med B');
            expect(claims[1].startDate).toBeInstanceOf(Date);
            
            // Third claim - should have fallback medication name
            expect(claims[2].id).toBe('rx3');
            expect(claims[2].displayName).toBeTruthy();
            expect(claims[2].details.daysSupply).toBe(14);
        });

        it('should maintain consistent property types across all claims', () => {
            const json = {
                rxTba: [{ id: 'rx1', dos: '2024-01-01', medication: 'Med A' }],
                rxHistory: [{ id: 'rxh1', dos: '2024-01-02', medication: 'Med B' }],
                medHistory: {
                    claims: [{
                        claimId: 'med1',
                        lines: [{ lineId: 'line1', srvcStart: '2024-01-03', srvcEnd: '2024-01-03', description: 'Visit' }]
                    }]
                }
            };

            const claims = parser.extractClaims(json, mockConfig);
            
            expect(claims).toHaveLength(3);
            
            claims.forEach((claim, index) => {
                // Type checks
                expect(typeof claim.id).toBe('string');
                expect(typeof claim.type).toBe('string');
                expect(typeof claim.displayName).toBe('string');
                expect(typeof claim.color).toBe('string');
                expect(typeof claim.details).toBe('object');
                
                // Date checks
                expect(claim.startDate).toBeInstanceOf(Date);
                expect(claim.endDate).toBeInstanceOf(Date);
                expect(claim.startDate.getTime()).toBeLessThanOrEqual(claim.endDate.getTime());
                
                // Required properties
                expect(claim.id).toBeTruthy();
                expect(claim.type).toBeTruthy();
                expect(claim.displayName).toBeTruthy();
                expect(claim.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
                expect(claim.details).toBeTruthy();
            });
        });

        it('should sort claims by start date (most recent first)', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', medication: 'Med A' },
                    { id: 'rx2', dos: '2024-03-01', medication: 'Med B' },
                    { id: 'rx3', dos: '2024-02-01', medication: 'Med C' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            const timelineData = parser['generateTimelineData'](claims);
            
            expect(timelineData.claims).toHaveLength(3);
            
            // Should be sorted by start date, most recent first
            expect(timelineData.claims[0].id).toBe('rx2'); // March 1
            expect(timelineData.claims[1].id).toBe('rx3'); // February 1
            expect(timelineData.claims[2].id).toBe('rx1'); // January 1
            
            // Verify sorting
            for (let i = 1; i < timelineData.claims.length; i++) {
                expect(timelineData.claims[i-1].startDate.getTime())
                    .toBeGreaterThanOrEqual(timelineData.claims[i].startDate.getTime());
            }
        });

        it('should calculate correct date ranges', () => {
            const json = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Med A' },
                    { id: 'rx2', dos: '2024-03-15', dayssupply: 7, medication: 'Med B' }
                ]
            };

            const claims = parser.extractClaims(json, mockConfig);
            const timelineData = parser['generateTimelineData'](claims);
            
            // Date range should span from earliest start to latest end
            expect(timelineData.dateRange.start).toEqual(new Date('2024-01-01'));
            expect(timelineData.dateRange.end).toEqual(new Date('2024-03-22')); // March 15 + 7 days
            
            // Metadata should be correct
            expect(timelineData.metadata.totalClaims).toBe(2);
            expect(timelineData.metadata.claimTypes).toEqual(['rxTba']);
        });
    });
});