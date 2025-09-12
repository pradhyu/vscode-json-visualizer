import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimsParser } from './claimsParser';
import { ParserConfig } from './types';

describe('Performance and Edge Cases', () => {
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
            }
        };
        parser = new ClaimsParser(mockConfig);
    });

    it('should handle large datasets efficiently', () => {
        // Generate large dataset
        const largeDataset = {
            rxTba: Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                dos: '2024-01-01',
                medication: `Medication ${i}`,
                dayssupply: 30
            }))
        };

        const startTime = Date.now();
        const result = parser.extractClaims(largeDataset, mockConfig);
        const endTime = Date.now();

        expect(result).toHaveLength(1000);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle empty datasets gracefully', () => {
        const emptyData = {
            rxTba: [],
            rxHistory: [],
            medHistory: { claims: [] }
        };

        const result = parser.extractClaims(emptyData, mockConfig);
        expect(result).toHaveLength(0);
    });
});