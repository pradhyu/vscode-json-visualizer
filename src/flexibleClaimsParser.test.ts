import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlexibleClaimsParser } from './flexibleClaimsParser';
import { ClaimTypeConfig, ParserConfig } from './types';

describe('FlexibleClaimsParser', () => {
    let parser: FlexibleClaimsParser;
    let testConfig: ParserConfig;

    beforeEach(() => {
        testConfig = {
            claimTypes: [
                {
                    name: 'prescriptions',
                    arrayPath: 'patient.medications',
                    color: '#FF6B6B',
                    idField: { path: 'prescriptionId', defaultValue: 'auto-generated' },
                    startDate: { type: 'field', field: 'startDate' },
                    endDate: {
                        type: 'calculation',
                        calculation: {
                            baseField: 'startDate',
                            operation: 'add',
                            value: 'daysSupply',
                            unit: 'days'
                        }
                    },
                    displayName: { path: 'drugName', defaultValue: 'Prescription' },
                    displayFields: [
                        { label: 'Drug Name', path: 'drugName', format: 'text', showInTooltip: true, showInDetails: true },
                        { label: 'Days Supply', path: 'daysSupply', format: 'number', showInTooltip: true, showInDetails: true }
                    ]
                }
            ],
            globalDateFormat: 'YYYY-MM-DD'
        };

        parser = new FlexibleClaimsParser(testConfig);
    });

    describe('validateStructure', () => {
        it('should validate structure with flexible configuration', () => {
            const validJson = {
                patient: {
                    medications: [
                        {
                            prescriptionId: 'RX001',
                            drugName: 'Test Drug',
                            startDate: '2024-01-15',
                            daysSupply: 30
                        }
                    ]
                }
            };

            expect(() => parser.validateStructure(validJson)).not.toThrow();
        });

        it('should throw error for missing arrays', () => {
            const invalidJson = {
                patient: {
                    // Missing medications array
                }
            };

            expect(() => parser.validateStructure(invalidJson)).toThrow();
        });
    });

    describe('extractClaims', () => {
        it('should extract claims using flexible configuration', () => {
            const jsonData = {
                patient: {
                    medications: [
                        {
                            prescriptionId: 'RX001',
                            drugName: 'Lisinopril 10mg',
                            startDate: '2024-01-15',
                            daysSupply: 30
                        },
                        {
                            prescriptionId: 'RX002',
                            drugName: 'Metformin 500mg',
                            startDate: '2024-01-20',
                            daysSupply: 90
                        }
                    ]
                }
            };

            const claims = parser.extractClaims(jsonData);

            expect(claims).toHaveLength(2);
            expect(claims[0].id).toBe('RX001');
            expect(claims[0].type).toBe('prescriptions');
            expect(claims[0].displayName).toBe('Lisinopril 10mg');
            expect(claims[0].color).toBe('#FF6B6B');
            expect(claims[0].startDate.toISOString().split('T')[0]).toBe('2024-01-15');
            expect(claims[0].endDate.toISOString().split('T')[0]).toBe('2024-02-14'); // 30 days later
        });

        it('should handle date calculations correctly', () => {
            const jsonData = {
                patient: {
                    medications: [
                        {
                            prescriptionId: 'RX001',
                            drugName: 'Test Drug',
                            startDate: '2024-01-01',
                            daysSupply: 7
                        }
                    ]
                }
            };

            const claims = parser.extractClaims(jsonData);

            expect(claims).toHaveLength(1);
            expect(claims[0].startDate.toISOString().split('T')[0]).toBe('2024-01-01');
            expect(claims[0].endDate.toISOString().split('T')[0]).toBe('2024-01-08'); // 7 days later
        });

        it('should generate auto IDs when missing', () => {
            const jsonData = {
                patient: {
                    medications: [
                        {
                            // Missing prescriptionId
                            drugName: 'Test Drug',
                            startDate: '2024-01-01',
                            daysSupply: 30
                        }
                    ]
                }
            };

            const claims = parser.extractClaims(jsonData);

            expect(claims).toHaveLength(1);
            expect(claims[0].id).toBe('prescriptions_0');
        });

        it('should handle multiple claim types', () => {
            const multiTypeConfig: ParserConfig = {
                claimTypes: [
                    {
                        name: 'prescriptions',
                        arrayPath: 'patient.medications',
                        color: '#FF6B6B',
                        idField: { path: 'id' },
                        startDate: { type: 'field', field: 'startDate' },
                        endDate: { type: 'field', field: 'endDate' },
                        displayName: { path: 'name' },
                        displayFields: []
                    },
                    {
                        name: 'appointments',
                        arrayPath: 'patient.appointments',
                        color: '#4ECDC4',
                        idField: { path: 'id' },
                        startDate: { type: 'field', field: 'date' },
                        endDate: { type: 'field', field: 'date' },
                        displayName: { path: 'type' },
                        displayFields: []
                    }
                ],
                globalDateFormat: 'YYYY-MM-DD'
            };

            const multiParser = new FlexibleClaimsParser(multiTypeConfig);

            const jsonData = {
                patient: {
                    medications: [
                        { id: 'rx1', name: 'Drug A', startDate: '2024-01-01', endDate: '2024-01-31' }
                    ],
                    appointments: [
                        { id: 'apt1', type: 'Checkup', date: '2024-01-15' }
                    ]
                }
            };

            const claims = multiParser.extractClaims(jsonData);

            expect(claims).toHaveLength(2);
            expect(claims.map(c => c.type)).toEqual(expect.arrayContaining(['prescriptions', 'appointments']));
        });
    });

    describe('display fields', () => {
        it('should extract and format display fields', () => {
            const jsonData = {
                patient: {
                    medications: [
                        {
                            prescriptionId: 'RX001',
                            drugName: 'Lisinopril 10mg',
                            startDate: '2024-01-15',
                            daysSupply: 30,
                            cost: 15.50
                        }
                    ]
                }
            };

            // Add cost field to configuration
            testConfig.claimTypes![0].displayFields!.push({
                label: 'Cost',
                path: 'cost',
                format: 'currency',
                showInTooltip: false,
                showInDetails: true
            });

            parser = new FlexibleClaimsParser(testConfig);
            const claims = parser.extractClaims(jsonData);

            expect(claims).toHaveLength(1);
            expect(claims[0].details.displayFields).toBeDefined();
            expect(claims[0].details.displayFields['Cost']).toEqual({
                raw: 15.50,
                formatted: '$15.50',
                showInTooltip: false,
                showInDetails: true
            });
        });
    });
});