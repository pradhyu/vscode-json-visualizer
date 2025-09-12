import { describe, it, expect } from 'vitest';
import { HybridParser } from './hybridParser';
import * as path from 'path';

describe('HybridParser Integration', () => {
    it('should parse test-claims.json successfully', async () => {
        const hybridParser = new HybridParser();
        const testFilePath = path.join(process.cwd(), 'test-claims.json');
        
        try {
            const result = await hybridParser.parseFile(testFilePath);
            
            expect(result).toBeDefined();
            expect(result.claims).toBeDefined();
            expect(Array.isArray(result.claims)).toBe(true);
            expect(result.claims.length).toBe(2); // Based on test-claims.json content
            
            // Verify first claim
            const firstClaim = result.claims[0];
            expect(firstClaim.id).toBe('rx1');
            expect(firstClaim.type).toBe('rxTba');
            expect(firstClaim.startDate).toBeInstanceOf(Date);
            expect(firstClaim.endDate).toBeInstanceOf(Date);
            expect(firstClaim.displayName).toBe('Test Medication');
            expect(firstClaim.color).toBe('#007acc');
            expect(firstClaim.details.dosage).toBe('10mg once daily');
            expect(firstClaim.details.daysSupply).toBe(30);
            
            // Verify timeline structure
            expect(result.dateRange).toBeDefined();
            expect(result.dateRange.start).toBeInstanceOf(Date);
            expect(result.dateRange.end).toBeInstanceOf(Date);
            expect(result.metadata.totalClaims).toBe(2);
            expect(result.metadata.claimTypes).toContain('rxTba');
            
            console.log('✓ HybridParser successfully parsed test-claims.json');
            console.log(`  - Found ${result.claims.length} claims`);
            console.log(`  - Date range: ${result.dateRange.start.toISOString()} to ${result.dateRange.end.toISOString()}`);
            
        } catch (error) {
            console.error('HybridParser test failed:', error);
            throw error;
        }
    });

    it('should determine parsing strategy for test-claims.json', async () => {
        const hybridParser = new HybridParser();
        const testFilePath = path.join(process.cwd(), 'test-claims.json');
        
        const strategy = await hybridParser.getParsingStrategy(testFilePath);
        expect(['complex', 'flexible', 'simple']).toContain(strategy);
        
        console.log(`✓ HybridParser determined strategy: ${strategy}`);
    });
});