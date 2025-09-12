import { describe, it, expect, beforeEach } from 'vitest';
import { HybridParser } from './hybridParser';
import * as fs from 'fs';
import * as path from 'path';

describe('HybridParser', () => {
    let hybridParser: HybridParser;
    let testFilePath: string;

    beforeEach(() => {
        hybridParser = new HybridParser();
        testFilePath = path.join(__dirname, '..', 'test-claims.json');
    });

    it('should create a HybridParser instance', () => {
        expect(hybridParser).toBeDefined();
        expect(hybridParser).toBeInstanceOf(HybridParser);
    });

    it('should parse test-claims.json using fallback mechanism', async () => {
        // Check if test file exists
        if (!fs.existsSync(testFilePath)) {
            console.log('test-claims.json not found, skipping test');
            return;
        }

        const result = await hybridParser.parseFile(testFilePath);
        
        expect(result).toBeDefined();
        expect(result.claims).toBeDefined();
        expect(Array.isArray(result.claims)).toBe(true);
        expect(result.claims.length).toBeGreaterThan(0);
        
        // Verify claim structure
        const firstClaim = result.claims[0];
        expect(firstClaim.id).toBeDefined();
        expect(firstClaim.type).toBeDefined();
        expect(firstClaim.startDate).toBeInstanceOf(Date);
        expect(firstClaim.endDate).toBeInstanceOf(Date);
        expect(firstClaim.displayName).toBeDefined();
        expect(firstClaim.color).toBeDefined();
        expect(firstClaim.details).toBeDefined();
        
        // Verify timeline data structure
        expect(result.dateRange).toBeDefined();
        expect(result.dateRange.start).toBeInstanceOf(Date);
        expect(result.dateRange.end).toBeInstanceOf(Date);
        expect(result.metadata).toBeDefined();
        expect(result.metadata.totalClaims).toBe(result.claims.length);
    });

    it('should determine parsing strategy', async () => {
        if (!fs.existsSync(testFilePath)) {
            console.log('test-claims.json not found, skipping test');
            return;
        }

        const strategy = await hybridParser.getParsingStrategy(testFilePath);
        expect(strategy).toBeDefined();
        expect(['complex', 'flexible', 'simple', 'none']).toContain(strategy);
    });

    it('should handle invalid file gracefully', async () => {
        const invalidPath = 'non-existent-file.json';
        
        await expect(hybridParser.parseFile(invalidPath)).rejects.toThrow();
    });

    it('should handle malformed JSON gracefully', async () => {
        // Create a temporary malformed JSON file
        const tempPath = path.join(__dirname, 'temp-malformed.json');
        fs.writeFileSync(tempPath, '{ invalid json }');
        
        try {
            await expect(hybridParser.parseFile(tempPath)).rejects.toThrow();
        } finally {
            // Clean up
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    });
});