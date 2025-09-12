import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ClaimsParser } from './claimsParser';
import { HybridParser } from './hybridParser';
import { TimelineRenderer } from './timelineRenderer';
import { ParserConfig, TimelineData, ClaimItem } from './types';
import { 
    ParseError, 
    ValidationError, 
    DateParseError,
    FileReadError,
    StructureValidationError
} from './types';

// Mock vscode
vi.mock('vscode', () => ({
    window: {
        createWebviewPanel: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn()
    },
    ViewColumn: {
        One: 1
    },
    Uri: {
        file: vi.fn()
    }
}));

// Mock fs
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        promises: {
            ...actual.promises,
            readFile: vi.fn()
        },
        readFileSync: vi.fn(),
        existsSync: vi.fn()
    };
});

describe('Comprehensive Regression Tests', () => {
    let parser: ClaimsParser;
    let hybridParser: HybridParser;
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
            }
        };
        parser = new ClaimsParser(mockConfig);
        hybridParser = new HybridParser();
        vi.clearAllMocks();
    });

    it('should handle basic parsing regression test', async () => {
        const testData = {
            rxTba: [
                {
                    id: 'rx1',
                    dos: '2024-01-15',
                    medication: 'Test Med',
                    dayssupply: 30
                }
            ]
        };

        (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(testData));
        (fs.readFileSync as any).mockReturnValue(JSON.stringify(testData));

        const result = await hybridParser.parseFile('/test/file.json');
        
        expect(result).toBeDefined();
        expect(result.claims).toHaveLength(1);
        expect(result.claims[0].id).toBe('rx1');
    });

    it('should handle error scenarios gracefully', async () => {
        (fs.promises.readFile as any).mockRejectedValue(new Error('File not found'));
        (fs.readFileSync as any).mockImplementation(() => {
            throw new Error('File not found');
        });

        await expect(hybridParser.parseFile('/nonexistent.json')).rejects.toThrow();
    });
});