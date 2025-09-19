/**
 * Standardized test data generation functions
 * These utilities create consistent test data that matches parser expectations
 */

import { expect } from 'vitest';
import { createParserDate, calculateEndDate, parseDaysSupply } from './dateUtils';

/**
 * Standard test claim data that matches parser expectations
 */
export const STANDARD_TEST_DATA = {
    rxTba: [
        {
            id: 'rx1',
            dos: '2024-01-15',
            medication: 'Test Medication',
            dayssupply: 30,
            dosage: '10mg daily',
            quantity: 30,
            prescriber: 'Dr. Smith',
            pharmacy: 'Test Pharmacy',
            copay: 10
        },
        {
            id: 'rx2',
            dos: '2024-03-01',
            medication: 'Another Medication',
            dayssupply: 90,
            dosage: '5mg twice daily',
            quantity: 180,
            prescriber: 'Dr. Johnson',
            pharmacy: 'Another Pharmacy',
            copay: 15
        }
    ],
    rxHistory: [
        {
            id: 'rxh1',
            dos: '2024-01-10',
            medication: 'Historical Med',
            dayssupply: 7,
            dosage: '20mg daily',
            fillDate: '2024-01-10',
            refillsRemaining: 2
        },
        {
            id: 'rxh2',
            dos: '2023-12-15',
            medication: 'Old Medication',
            dayssupply: 30,
            dosage: '15mg daily',
            fillDate: '2023-12-15',
            refillsRemaining: 0
        }
    ],
    medHistory: {
        claims: [
            {
                claimId: 'med1',
                provider: 'Test Hospital',
                claimDate: '2024-01-08',
                totalAmount: 250,
                lines: [
                    {
                        lineId: 'line1',
                        srvcStart: '2024-01-08',
                        srvcEnd: '2024-01-08',
                        description: 'Medical Service',
                        serviceType: 'Office Visit',
                        procedureCode: '99213',
                        chargedAmount: 150,
                        allowedAmount: 120,
                        paidAmount: 100
                    }
                ]
            },
            {
                claimId: 'med2',
                provider: 'Specialist Clinic',
                claimDate: '2024-02-15',
                totalAmount: 400,
                lines: [
                    {
                        lineId: 'line2',
                        srvcStart: '2024-02-15',
                        srvcEnd: '2024-02-15',
                        description: 'Specialist Consultation',
                        serviceType: 'Consultation',
                        procedureCode: '99214',
                        chargedAmount: 300,
                        allowedAmount: 250,
                        paidAmount: 200
                    }
                ]
            }
        ]
    }
};

/**
 * Generate test data with specific characteristics
 * @param options Configuration for test data generation
 * @returns Test data object
 */
export function generateTestData(options: {
    rxTbaCount?: number;
    rxHistoryCount?: number;
    medHistoryCount?: number;
    startDate?: string;
    includeInvalidData?: boolean;
    includeMissingFields?: boolean;
} = {}): any {
    const {
        rxTbaCount = 2,
        rxHistoryCount = 2,
        medHistoryCount = 2,
        startDate = '2024-01-15',
        includeInvalidData = false,
        includeMissingFields = false
    } = options;

    const baseDate = new Date(startDate);
    const data: any = {};

    // Generate rxTba data
    if (rxTbaCount > 0) {
        data.rxTba = [];
        for (let i = 0; i < rxTbaCount; i++) {
            const claimDate = new Date(baseDate);
            claimDate.setDate(baseDate.getDate() + (i * 30)); // Space claims 30 days apart
            
            const claim: any = {
                id: `rx${i + 1}`,
                dos: claimDate.toISOString().split('T')[0],
                medication: `Medication ${i + 1}`,
                dayssupply: 30 + (i * 10),
                dosage: `${10 + i}mg daily`
            };

            if (!includeMissingFields) {
                claim.quantity = 30 + (i * 10);
                claim.prescriber = `Dr. Smith ${i + 1}`;
                claim.pharmacy = `Pharmacy ${i + 1}`;
                claim.copay = 10 + i;
            }

            if (includeInvalidData && i === 0) {
                claim.dos = 'invalid-date';
                claim.dayssupply = 'not-a-number';
            }

            data.rxTba.push(claim);
        }
    }

    // Generate rxHistory data
    if (rxHistoryCount > 0) {
        data.rxHistory = [];
        for (let i = 0; i < rxHistoryCount; i++) {
            const claimDate = new Date(baseDate);
            claimDate.setDate(baseDate.getDate() - (30 + (i * 15))); // Historical dates
            
            const claim: any = {
                id: `rxh${i + 1}`,
                dos: claimDate.toISOString().split('T')[0],
                medication: `Historical Med ${i + 1}`,
                dayssupply: 7 + (i * 3)
            };

            if (!includeMissingFields) {
                claim.dosage = `${5 + i}mg daily`;
                claim.fillDate = claimDate.toISOString().split('T')[0];
                claim.refillsRemaining = Math.max(0, 3 - i);
            }

            if (includeInvalidData && i === 0) {
                claim.dos = null;
                claim.dayssupply = -1;
            }

            data.rxHistory.push(claim);
        }
    }

    // Generate medHistory data
    if (medHistoryCount > 0) {
        data.medHistory = { claims: [] };
        for (let i = 0; i < medHistoryCount; i++) {
            const serviceDate = new Date(baseDate);
            serviceDate.setDate(baseDate.getDate() - (10 + (i * 5)));
            const serviceDateStr = serviceDate.toISOString().split('T')[0];
            
            const claim: any = {
                claimId: `med${i + 1}`,
                lines: [
                    {
                        lineId: `line${i + 1}`,
                        srvcStart: serviceDateStr,
                        srvcEnd: serviceDateStr,
                        description: `Medical Service ${i + 1}`
                    }
                ]
            };

            if (!includeMissingFields) {
                claim.provider = `Provider ${i + 1}`;
                claim.claimDate = serviceDateStr;
                claim.totalAmount = 200 + (i * 50);
                claim.lines[0].serviceType = `Type ${i + 1}`;
                claim.lines[0].procedureCode = `9921${3 + i}`;
                claim.lines[0].chargedAmount = 150 + (i * 25);
                claim.lines[0].allowedAmount = 120 + (i * 20);
                claim.lines[0].paidAmount = 100 + (i * 15);
            }

            if (includeInvalidData && i === 0) {
                claim.lines[0].srvcStart = 'bad-date';
                claim.lines[0].srvcEnd = undefined;
            }

            data.medHistory.claims.push(claim);
        }
    }

    return data;
}

/**
 * Generate expected timeline data based on input test data
 * @param inputData Input test data
 * @returns Expected timeline data structure
 */
export function generateExpectedTimelineData(inputData: any): any {
    const claims: any[] = [];

    // Process rxTba claims
    if (inputData.rxTba) {
        inputData.rxTba.forEach((claim: any, index: number) => {
            if (claim.dos && !isNaN(new Date(claim.dos).getTime())) {
                const startDate = createParserDate(claim.dos);
                const daysSupply = parseDaysSupply(claim.dayssupply, 30);
                const endDate = calculateEndDate(claim.dos, daysSupply);

                claims.push({
                    id: claim.id || `rxTba_${index}`,
                    type: 'rxTba',
                    startDate,
                    endDate,
                    displayName: claim.medication || `Medication ${index + 1}`,
                    color: '#FF6B6B',
                    details: expect.objectContaining({
                        dosage: claim.dosage || 'N/A',
                        daysSupply: daysSupply
                    })
                });
            }
        });
    }

    // Process rxHistory claims
    if (inputData.rxHistory) {
        inputData.rxHistory.forEach((claim: any, index: number) => {
            if (claim.dos && !isNaN(new Date(claim.dos).getTime())) {
                const startDate = createParserDate(claim.dos);
                const daysSupply = parseDaysSupply(claim.dayssupply, 30);
                const endDate = calculateEndDate(claim.dos, daysSupply);

                claims.push({
                    id: claim.id || `rxHistory_${index}`,
                    type: 'rxHistory',
                    startDate,
                    endDate,
                    displayName: claim.medication || `Historical Medication ${index + 1}`,
                    color: '#4ECDC4',
                    details: expect.objectContaining({
                        dosage: claim.dosage || 'N/A',
                        daysSupply: daysSupply
                    })
                });
            }
        });
    }

    // Process medHistory claims
    if (inputData.medHistory && inputData.medHistory.claims) {
        inputData.medHistory.claims.forEach((claim: any, claimIndex: number) => {
            if (claim.lines && Array.isArray(claim.lines)) {
                claim.lines.forEach((line: any, lineIndex: number) => {
                    if (line.srvcStart && !isNaN(new Date(line.srvcStart).getTime())) {
                        const startDate = createParserDate(line.srvcStart);
                        const endDate = line.srvcEnd && !isNaN(new Date(line.srvcEnd).getTime()) 
                            ? createParserDate(line.srvcEnd) 
                            : startDate;

                        claims.push({
                            id: line.lineId || `medHistory_${claimIndex}_${lineIndex}`,
                            type: 'medHistory',
                            startDate,
                            endDate,
                            displayName: line.description || `Medical Service ${claimIndex + 1}-${lineIndex + 1}`,
                            color: '#45B7D1',
                            details: expect.objectContaining({
                                serviceType: line.serviceType || 'N/A',
                                procedureCode: line.procedureCode || 'N/A'
                            })
                        });
                    }
                });
            }
        });
    }

    // Sort claims by start date (most recent first)
    claims.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    // Calculate date range
    const allDates = claims.flatMap(c => [c.startDate, c.endDate]);
    const dateRange = allDates.length > 0 ? {
        start: new Date(Math.min(...allDates.map(d => d.getTime()))),
        end: new Date(Math.max(...allDates.map(d => d.getTime())))
    } : {
        start: expect.any(Date),
        end: expect.any(Date)
    };

    return {
        claims,
        dateRange,
        metadata: {
            totalClaims: claims.length,
            claimTypes: Array.from(new Set(claims.map(c => c.type)))
        }
    };
}

/**
 * Create test data for specific error scenarios
 * @param errorType Type of error to simulate
 * @returns Test data that should trigger the specified error
 */
export function createErrorTestData(errorType: 'empty' | 'invalid-structure' | 'invalid-dates' | 'missing-fields'): any {
    switch (errorType) {
        case 'empty':
            return {};

        case 'invalid-structure':
            return {
                notMedicalData: {
                    someField: 'someValue'
                }
            };

        case 'invalid-dates':
            return {
                rxTba: [
                    {
                        id: 'rx1',
                        dos: 'not-a-date',
                        medication: 'Test Med',
                        dayssupply: 30
                    }
                ]
            };

        case 'missing-fields':
            return {
                rxTba: [
                    {
                        // Missing required fields
                        id: 'rx1'
                    }
                ],
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                {
                                    // Missing required date fields
                                    lineId: 'line1',
                                    description: 'Service'
                                }
                            ]
                        }
                    ]
                }
            };

        default:
            return {};
    }
}

/**
 * Create test data for performance testing
 * @param size Size of dataset to generate
 * @returns Large test dataset
 */
export function createPerformanceTestData(size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium'): any {
    const counts = {
        small: { rxTba: 10, rxHistory: 10, medHistory: 5 },
        medium: { rxTba: 100, rxHistory: 100, medHistory: 50 },
        large: { rxTba: 1000, rxHistory: 1000, medHistory: 500 },
        xlarge: { rxTba: 5000, rxHistory: 5000, medHistory: 2500 }
    };

    const config = counts[size];
    return generateTestData({
        rxTbaCount: config.rxTba,
        rxHistoryCount: config.rxHistory,
        medHistoryCount: config.medHistory,
        startDate: '2020-01-01' // Use older start date for large datasets
    });
}

/**
 * Validate test data structure matches parser expectations
 * @param data Test data to validate
 * @throws Error if data structure is invalid
 */
export function validateTestDataStructure(data: any): void {
    if (!data || typeof data !== 'object') {
        throw new Error('Test data must be an object');
    }

    // Validate rxTba structure
    if (data.rxTba) {
        if (!Array.isArray(data.rxTba)) {
            throw new Error('rxTba must be an array');
        }
        data.rxTba.forEach((claim: any, index: number) => {
            if (!claim.dos) {
                throw new Error(`rxTba[${index}] missing dos field`);
            }
            if (!claim.medication) {
                throw new Error(`rxTba[${index}] missing medication field`);
            }
        });
    }

    // Validate rxHistory structure
    if (data.rxHistory) {
        if (!Array.isArray(data.rxHistory)) {
            throw new Error('rxHistory must be an array');
        }
        data.rxHistory.forEach((claim: any, index: number) => {
            if (!claim.dos) {
                throw new Error(`rxHistory[${index}] missing dos field`);
            }
            if (!claim.medication) {
                throw new Error(`rxHistory[${index}] missing medication field`);
            }
        });
    }

    // Validate medHistory structure
    if (data.medHistory) {
        if (!data.medHistory.claims || !Array.isArray(data.medHistory.claims)) {
            throw new Error('medHistory must have claims array');
        }
        data.medHistory.claims.forEach((claim: any, claimIndex: number) => {
            if (!claim.lines || !Array.isArray(claim.lines)) {
                throw new Error(`medHistory.claims[${claimIndex}] must have lines array`);
            }
            claim.lines.forEach((line: any, lineIndex: number) => {
                if (!line.srvcStart) {
                    throw new Error(`medHistory.claims[${claimIndex}].lines[${lineIndex}] missing srvcStart field`);
                }
                if (!line.description) {
                    throw new Error(`medHistory.claims[${claimIndex}].lines[${lineIndex}] missing description field`);
                }
            });
        });
    }
}