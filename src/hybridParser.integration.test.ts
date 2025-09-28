import { describe, it, expect, vi } from 'vitest';
import { HybridParser } from './hybridParser';
import * as path from 'path';
import * as fs from 'fs';

// Mock fs module properly
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        promises: {
            ...actual.promises,
            readFile: vi.fn()
        }
    };
});

describe('HybridParser Integration', () => {
    it('should parse test-claims.json successfully', async () => {
        const hybridParser = new HybridParser();
        const testFilePath = path.join(process.cwd(), 'test-claims.json');
        
        // Mock the test-claims.json content
        const mockTestData = {
            rxTba: [
                {
                    id: 'rx1',
                    dos: '2024-01-15',
                    medication: 'Test Medication',
                    dosage: '10mg once daily',
                    dayssupply: 30
                },
                {
                    id: 'rx2', 
                    dos: '2024-01-20',
                    medication: 'Another Med',
                    dosage: '5mg twice daily',
                    dayssupply: 15
                }
            ]
        };
        
        (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(mockTestData));
        
        const result = await hybridParser.parseFile(testFilePath);
        
        expect(result).toBeDefined();
        expect(result.claims).toBeDefined();
        expect(Array.isArray(result.claims)).toBe(true);
        expect(result.claims.length).toBe(2);
        
        // Verify first claim (should be rx2 due to descending date sort - 2024-01-20 comes before 2024-01-15)
        const firstClaim = result.claims[0];
        expect(firstClaim.id).toBe('rx2');
        expect(firstClaim.type).toBe('rxTba');
        expect(firstClaim.startDate).toBeInstanceOf(Date);
        expect(firstClaim.endDate).toBeInstanceOf(Date);
        expect(firstClaim.displayName).toBe('Another Med');
        expect(firstClaim.details.dosage).toBe('5mg twice daily');
        
        // Verify timeline structure
        expect(result.dateRange).toBeDefined();
        expect(result.dateRange.start).toBeInstanceOf(Date);
        expect(result.dateRange.end).toBeInstanceOf(Date);
        expect(result.metadata.totalClaims).toBe(2);
        expect(result.metadata.claimTypes).toContain('rxTba');
        
        console.log('✓ HybridParser successfully parsed test-claims.json');
        console.log(`  - Found ${result.claims.length} claims`);
        console.log(`  - Date range: ${result.dateRange.start.toISOString()} to ${result.dateRange.end.toISOString()}`);
    });

    it('should determine parsing strategy for test-claims.json', async () => {
        const hybridParser = new HybridParser();
        const testFilePath = path.join(process.cwd(), 'test-claims.json');
        
        // Mock the same test data
        const mockTestData = {
            rxTba: [
                {
                    id: 'rx1',
                    dos: '2024-01-15',
                    medication: 'Test Medication',
                    dosage: '10mg once daily',
                    dayssupply: 30
                }
            ]
        };
        
        (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(mockTestData));
        
        const strategy = await hybridParser.getParsingStrategy(testFilePath);
        expect(['complex', 'flexible', 'simple']).toContain(strategy);
        
        console.log(`✓ HybridParser determined strategy: ${strategy}`);
    });
});