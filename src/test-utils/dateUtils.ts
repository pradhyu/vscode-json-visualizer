/**
 * Test utility functions for consistent date handling across test suites
 * These utilities match the parser's date normalization behavior
 */

import { expect } from 'vitest';

/**
 * Create a date that matches parser behavior - normalized to local midnight
 * The parser creates dates using new Date(year, month, date) which creates local midnight
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object normalized to local midnight
 */
export function createParserDate(dateString: string): Date {
    const date = new Date(dateString);
    // Normalize to local midnight to match parser behavior
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Test utility for comparing dates with timezone tolerance
 * Compares dates by their normalized local midnight values
 * @param actual Actual date from parser
 * @param expected Expected date string
 */
export function expectDateToEqual(actual: Date, expected: string): void {
    const expectedDate = createParserDate(expected);
    expect(actual.getTime()).toBe(expectedDate.getTime());
}

/**
 * Create a date range for testing that matches parser behavior
 * @param startDateString Start date string
 * @param endDateString End date string
 * @returns Object with start and end Date objects
 */
export function createDateRange(startDateString: string, endDateString: string): { start: Date; end: Date } {
    return {
        start: createParserDate(startDateString),
        end: createParserDate(endDateString)
    };
}

/**
 * Calculate end date from start date and days supply (matches parser logic)
 * @param startDateString Start date string
 * @param daysSupply Number of days to add
 * @returns End date as Date object
 */
export function calculateEndDate(startDateString: string, daysSupply: number): Date {
    const startDate = createParserDate(startDateString);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysSupply);
    return endDate;
}

/**
 * Parse days supply with fallback (matches parser behavior)
 * @param daysSupplyValue Value from JSON
 * @param fallbackDays Default days if invalid
 * @returns Parsed days supply number
 */
export function parseDaysSupply(daysSupplyValue: any, fallbackDays: number = 30): number {
    if (daysSupplyValue === undefined || daysSupplyValue === null) {
        return fallbackDays;
    }

    if (typeof daysSupplyValue === 'number' && daysSupplyValue > 0) {
        return Math.min(daysSupplyValue, 365); // Cap at 365 days
    }

    const parsed = parseInt(String(daysSupplyValue), 10);
    if (!isNaN(parsed) && parsed > 0) {
        return Math.min(parsed, 365); // Cap at 365 days
    }

    return fallbackDays;
}

/**
 * Create test data with consistent date formatting
 * @param baseDate Base date string for generating test data
 * @param count Number of items to generate
 * @returns Array of test claim objects
 */
export function generateTestClaimData(baseDate: string, count: number = 3): any[] {
    const claims = [];
    const base = new Date(baseDate);
    
    for (let i = 0; i < count; i++) {
        const claimDate = new Date(base);
        claimDate.setDate(base.getDate() + i);
        
        claims.push({
            id: `test-${i + 1}`,
            dos: claimDate.toISOString().split('T')[0], // YYYY-MM-DD format
            medication: `Test Medication ${i + 1}`,
            dayssupply: 30,
            dosage: '10mg daily'
        });
    }
    
    return claims;
}

/**
 * Create medical history test data with consistent dates
 * @param baseDate Base date string
 * @param count Number of claims to generate
 * @returns Medical history test data structure
 */
export function generateMedHistoryTestData(baseDate: string, count: number = 2): any {
    const base = new Date(baseDate);
    const claims = [];
    
    for (let i = 0; i < count; i++) {
        const serviceDate = new Date(base);
        serviceDate.setDate(base.getDate() + i);
        const serviceDateStr = serviceDate.toISOString().split('T')[0];
        
        claims.push({
            claimId: `med-${i + 1}`,
            lines: [
                {
                    lineId: `line-${i + 1}`,
                    srvcStart: serviceDateStr,
                    srvcEnd: serviceDateStr,
                    description: `Medical Service ${i + 1}`,
                    procedureCode: `99213${i}`,
                    chargedAmount: 150 + (i * 25)
                }
            ]
        });
    }
    
    return { claims };
}

/**
 * Validate that dates in timeline data are properly normalized
 * @param timelineData Timeline data to validate
 * @throws Error if dates are not properly normalized
 */
export function validateTimelineDates(timelineData: any): void {
    timelineData.claims.forEach((claim: any, index: number) => {
        if (!(claim.startDate instanceof Date)) {
            throw new Error(`Claim ${index} startDate is not a Date object: ${typeof claim.startDate}`);
        }
        
        if (!(claim.endDate instanceof Date)) {
            throw new Error(`Claim ${index} endDate is not a Date object: ${typeof claim.endDate}`);
        }
        
        if (isNaN(claim.startDate.getTime())) {
            throw new Error(`Claim ${index} has invalid startDate: ${claim.startDate}`);
        }
        
        if (isNaN(claim.endDate.getTime())) {
            throw new Error(`Claim ${index} has invalid endDate: ${claim.endDate}`);
        }
        
        if (claim.endDate < claim.startDate) {
            throw new Error(`Claim ${index} has endDate before startDate`);
        }
    });
}

/**
 * Sort claims by start date (most recent first) - matches parser behavior
 * @param claims Array of claims to sort
 * @returns Sorted array of claims
 */
export function sortClaimsByDate(claims: any[]): any[] {
    return [...claims].sort((a, b) => {
        const aTime = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
        const bTime = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
        return bTime - aTime; // Most recent first
    });
}

/**
 * Create comprehensive test data that matches all parser expectations
 * @param options Configuration options for test data generation
 * @returns Complete test data structure
 */
export function createComprehensiveTestData(options: {
    rxTbaCount?: number;
    rxHistoryCount?: number;
    medHistoryCount?: number;
    baseDate?: string;
} = {}): any {
    const {
        rxTbaCount = 2,
        rxHistoryCount = 2,
        medHistoryCount = 2,
        baseDate = '2024-01-15'
    } = options;
    
    const base = new Date(baseDate);
    
    // Generate rxTba data
    const rxTba = [];
    for (let i = 0; i < rxTbaCount; i++) {
        const claimDate = new Date(base);
        claimDate.setDate(base.getDate() + i);
        
        rxTba.push({
            id: `rx${i + 1}`,
            dos: claimDate.toISOString().split('T')[0],
            medication: `Medication ${i + 1}`,
            dayssupply: 30,
            dosage: '10mg daily',
            quantity: 30,
            prescriber: `Dr. Smith ${i + 1}`,
            pharmacy: `Pharmacy ${i + 1}`,
            copay: 10 + i
        });
    }
    
    // Generate rxHistory data
    const rxHistory = [];
    for (let i = 0; i < rxHistoryCount; i++) {
        const claimDate = new Date(base);
        claimDate.setDate(base.getDate() - (30 + i)); // Historical dates
        
        rxHistory.push({
            id: `rxh${i + 1}`,
            dos: claimDate.toISOString().split('T')[0],
            medication: `Historical Med ${i + 1}`,
            dayssupply: 7 + i,
            dosage: '5mg daily',
            fillDate: claimDate.toISOString().split('T')[0],
            refillsRemaining: 2 - i
        });
    }
    
    // Generate medHistory data
    const medHistoryClaims = [];
    for (let i = 0; i < medHistoryCount; i++) {
        const serviceDate = new Date(base);
        serviceDate.setDate(base.getDate() - (10 + i));
        const serviceDateStr = serviceDate.toISOString().split('T')[0];
        
        medHistoryClaims.push({
            claimId: `med${i + 1}`,
            provider: `Provider ${i + 1}`,
            claimDate: serviceDateStr,
            totalAmount: 200 + (i * 50),
            lines: [
                {
                    lineId: `line${i + 1}`,
                    srvcStart: serviceDateStr,
                    srvcEnd: serviceDateStr,
                    description: `Medical Service ${i + 1}`,
                    serviceType: `Type ${i + 1}`,
                    procedureCode: `9921${3 + i}`,
                    chargedAmount: 150 + (i * 25),
                    allowedAmount: 120 + (i * 20),
                    paidAmount: 100 + (i * 15)
                }
            ]
        });
    }
    
    return {
        rxTba,
        rxHistory,
        medHistory: {
            claims: medHistoryClaims
        }
    };
}