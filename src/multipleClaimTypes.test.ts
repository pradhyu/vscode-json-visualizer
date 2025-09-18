import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HybridParser } from './hybridParser';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module properly
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        promises: {
            ...actual.promises,
            readFile: vi.fn()
        }
    };
});

describe('HybridParser - Multiple Claim Types', () => {
    let hybridParser: HybridParser;
    let testFilePath: string;

    beforeEach(() => {
        hybridParser = new HybridParser();
        testFilePath = path.join(__dirname, '..', 'test-multiple-claims.json');
    });

    it('should parse all three claim types (rxTba, rxHistory, medHistory)', async () => {
        const testData = {
            rxTba: [
                {
                    id: 'rx1',
                    dos: '2024-01-15',
                    medication: 'Lisinopril 10mg',
                    dayssupply: 30,
                    dosage: '10mg daily',
                    quantity: 30,
                    prescriber: 'Dr. Smith',
                    pharmacy: 'CVS Pharmacy',
                    copay: 10.00
                },
                {
                    id: 'rx2',
                    dos: '2024-02-01',
                    medication: 'Metformin 500mg',
                    dayssupply: 90,
                    dosage: '500mg twice daily',
                    quantity: 180,
                    prescriber: 'Dr. Johnson',
                    pharmacy: 'Walgreens',
                    copay: 15.00
                }
            ],
            rxHistory: [
                {
                    id: 'rxh1',
                    dos: '2023-12-01',
                    medication: 'Atorvastatin 20mg',
                    dayssupply: 30,
                    dosage: '20mg daily',
                    quantity: 30,
                    prescriber: 'Dr. Brown',
                    pharmacy: 'Rite Aid',
                    copay: 5.00,
                    fillDate: '2023-12-01',
                    refillsRemaining: 2
                }
            ],
            medHistory: {
                claims: [
                    {
                        claimId: 'med1',
                        claimDate: '2024-01-10',
                        provider: 'City Medical Center',
                        totalAmount: 250.00,
                        lines: [
                            {
                                lineId: 'line1',
                                srvcStart: '2024-01-10',
                                srvcEnd: '2024-01-10',
                                description: 'Annual Physical Exam',
                                serviceType: 'Preventive Care',
                                procedureCode: '99395',
                                chargedAmount: 250.00,
                                allowedAmount: 200.00,
                                paidAmount: 180.00
                            }
                        ]
                    },
                    {
                        claimId: 'med2',
                        claimDate: '2024-01-20',
                        provider: 'Diagnostic Lab Services',
                        totalAmount: 150.00,
                        lines: [
                            {
                                lineId: 'line2',
                                srvcStart: '2024-01-20',
                                srvcEnd: '2024-01-20',
                                description: 'Blood Chemistry Panel',
                                serviceType: 'Laboratory',
                                procedureCode: '80053',
                                chargedAmount: 150.00,
                                allowedAmount: 120.00,
                                paidAmount: 108.00
                            }
                        ]
                    }
                ]
            }
        };

        // Mock file content
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testData));

        const result = await hybridParser.parseFile(testFilePath);
        
        expect(result).toBeDefined();
        expect(result.claims).toBeDefined();
        expect(Array.isArray(result.claims)).toBe(true);
        
        // Should have 5 total claims: 2 rxTba + 1 rxHistory + 2 medHistory lines
        expect(result.claims.length).toBe(5);
        
        // Verify claim types are present
        const claimTypes = result.claims.map(c => c.type);
        expect(claimTypes).toContain('rxTba');
        expect(claimTypes).toContain('rxHistory');
        expect(claimTypes).toContain('medHistory');
        
        // Verify metadata
        expect(result.metadata.totalClaims).toBe(5);
        expect(result.metadata.claimTypes).toContain('rxTba');
        expect(result.metadata.claimTypes).toContain('rxHistory');
        expect(result.metadata.claimTypes).toContain('medHistory');
    });

    it('should assign correct colors to each claim type', async () => {
        const testData = {
            rxTba: [{ id: 'rx1', dos: '2024-01-15', medication: 'Test Med', dayssupply: 30 }],
            rxHistory: [{ id: 'rxh1', dos: '2023-12-01', medication: 'Test Med History', dayssupply: 30 }],
            medHistory: {
                claims: [{
                    claimId: 'med1',
                    lines: [{
                        lineId: 'line1',
                        srvcStart: '2024-01-10',
                        srvcEnd: '2024-01-10',
                        description: 'Test Service'
                    }]
                }]
            }
        };

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testData));

        const result = await hybridParser.parseFile(testFilePath);
        
        // Find claims by type and verify colors
        const rxTbaClaim = result.claims.find(c => c.type === 'rxTba');
        const rxHistoryClaim = result.claims.find(c => c.type === 'rxHistory');
        const medHistoryClaim = result.claims.find(c => c.type === 'medHistory');
        
        expect(rxTbaClaim?.color).toBe('#FF6B6B');      // Red for current prescriptions
        expect(rxHistoryClaim?.color).toBe('#4ECDC4');   // Teal for prescription history
        expect(medHistoryClaim?.color).toBe('#45B7D1');  // Blue for medical history
    });

    it('should handle missing claim types gracefully', async () => {
        // Test with only rxTba
        const testDataRxOnly = {
            rxTba: [{ id: 'rx1', dos: '2024-01-15', medication: 'Test Med', dayssupply: 30 }]
        };

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testDataRxOnly));

        const result = await hybridParser.parseFile(testFilePath);
        
        expect(result.claims.length).toBe(1);
        expect(result.claims[0].type).toBe('rxTba');
        expect(result.metadata.claimTypes).toEqual(['rxTba']);
    });

    it('should handle empty claim arrays', async () => {
        const testDataEmpty = {
            rxTba: [],
            rxHistory: [],
            medHistory: { claims: [] }
        };

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testDataEmpty));

        await expect(hybridParser.parseFile(testFilePath)).rejects.toThrow('All parsing strategies failed');
    });

    it('should validate claim type structures correctly', async () => {
        // Test invalid rxTba structure (missing required fields)
        const testDataInvalid = {
            rxTba: [{ id: 'rx1' }], // Missing dos and medication
            rxHistory: [{ id: 'rxh1', dos: '2023-12-01', medication: 'Valid Med', dayssupply: 30 }]
        };

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testDataInvalid));

        const result = await hybridParser.parseFile(testFilePath);
        
        // Parser uses fallback values, so both claims are processed
        // rxTba will get fallback values for missing fields
        expect(result.claims.length).toBe(2);
        
        const rxTbaClaim = result.claims.find(c => c.type === 'rxTba');
        const rxHistoryClaim = result.claims.find(c => c.type === 'rxHistory');
        
        expect(rxTbaClaim).toBeDefined();
        expect(rxHistoryClaim).toBeDefined();
        
        // rxTba should have fallback values
        expect(rxTbaClaim?.displayName).toBe('Medication 1'); // Fallback name
        expect(rxHistoryClaim?.displayName).toBe('Valid Med'); // Original name
    });

    it('should handle complex medHistory structure with multiple lines per claim', async () => {
        const testData = {
            medHistory: {
                claims: [
                    {
                        claimId: 'med1',
                        claimDate: '2024-01-10',
                        provider: 'Test Hospital',
                        totalAmount: 500.00,
                        lines: [
                            {
                                lineId: 'line1',
                                srvcStart: '2024-01-10',
                                srvcEnd: '2024-01-10',
                                description: 'Service 1',
                                chargedAmount: 250.00
                            },
                            {
                                lineId: 'line2',
                                srvcStart: '2024-01-10',
                                srvcEnd: '2024-01-11',
                                description: 'Service 2',
                                chargedAmount: 250.00
                            }
                        ]
                    }
                ]
            }
        };

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testData));

        const result = await hybridParser.parseFile(testFilePath);
        
        // Should create separate claims for each line
        expect(result.claims.length).toBe(2);
        expect(result.claims[0].type).toBe('medHistory');
        expect(result.claims[1].type).toBe('medHistory');
        expect(result.claims[0].id).toBe('line1');
        expect(result.claims[1].id).toBe('line2');
    });

    it('should preserve detailed information for each claim type', async () => {
        const testData = {
            rxTba: [{
                id: 'rx1',
                dos: '2024-01-15',
                medication: 'Test Medication',
                dayssupply: 30,
                dosage: '10mg daily',
                quantity: 30,
                prescriber: 'Dr. Test',
                pharmacy: 'Test Pharmacy',
                copay: 10.00
            }],
            medHistory: {
                claims: [{
                    claimId: 'med1',
                    provider: 'Test Provider',
                    totalAmount: 100.00,
                    lines: [{
                        lineId: 'line1',
                        srvcStart: '2024-01-10',
                        srvcEnd: '2024-01-10',
                        description: 'Test Service',
                        procedureCode: '12345',
                        chargedAmount: 100.00
                    }]
                }]
            }
        };

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testData));

        const result = await hybridParser.parseFile(testFilePath);
        
        const rxClaim = result.claims.find(c => c.type === 'rxTba');
        const medClaim = result.claims.find(c => c.type === 'medHistory');
        
        // Verify rxTba details
        expect(rxClaim?.details.dosage).toBe('10mg daily');
        expect(rxClaim?.details.prescriber).toBe('Dr. Test');
        expect(rxClaim?.details.pharmacy).toBe('Test Pharmacy');
        expect(rxClaim?.details.copay).toBe(10.00);
        
        // Verify medHistory details
        expect(medClaim?.details.procedureCode).toBe('12345');
        expect(medClaim?.details.provider).toBe('Test Provider');
        expect(medClaim?.details.chargedAmount).toBe(100.00);
    });
});