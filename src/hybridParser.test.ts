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
        // Mock file existence and content
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({
            rxTba: [
                { id: 'rx1', dos: '2024-01-15', medication: 'Test Med', dayssupply: 30 }
            ]
        }));

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
        // Mock file existence and content
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.readFile as any).mockResolvedValue(JSON.stringify({
            rxTba: [
                { id: 'rx1', dos: '2024-01-15', medication: 'Test Med', dayssupply: 30 }
            ]
        }));

        const strategy = await hybridParser.getParsingStrategy(testFilePath);
        expect(strategy).toBeDefined();
        expect(['complex', 'flexible', 'simple', 'none']).toContain(strategy);
    });

    it('should handle invalid file gracefully', async () => {
        const invalidPath = 'non-existent-file.json';
        
        // Mock fs to throw ENOENT error for non-existent file
        const mockError = new Error('ENOENT: no such file or directory');
        (mockError as any).code = 'ENOENT';
        
        // Mock both sync and async fs methods to throw the error
        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (path.toString().includes('non-existent-file.json')) {
                throw mockError;
            }
            return '{"rxTba": [{"id": "rx1", "dos": "2024-01-15", "dayssupply": 30, "medication": "Test Med"}]}';
        });
        
        vi.mocked(fs.promises.readFile).mockImplementation((path) => {
            if (path.toString().includes('non-existent-file.json')) {
                return Promise.reject(mockError);
            }
            return Promise.resolve('{"rxTba": [{"id": "rx1", "dos": "2024-01-15", "dayssupply": 30, "medication": "Test Med"}]}');
        });
        
        await expect(hybridParser.parseFile(invalidPath)).rejects.toThrow();
    });

    it('should handle malformed JSON gracefully', async () => {
        const malformedJson = '{ invalid json }';
        
        // Mock both sync and async fs methods to return malformed JSON
        vi.mocked(fs.readFileSync).mockReturnValue(malformedJson);
        vi.mocked(fs.promises.readFile).mockResolvedValue(malformedJson);
        
        const tempPath = path.join(__dirname, 'temp-malformed.json');
        await expect(hybridParser.parseFile(tempPath)).rejects.toThrow();
    });
});