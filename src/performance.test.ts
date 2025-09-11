import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimsParser } from './claimsParser';
import { TimelineRenderer } from './timelineRenderer';
import { ConfigManager, ParserConfig } from './configManager';
import { ClaimItem, TimelineData } from './types';

// Mock VSCode API
vi.mock('vscode', () => ({
    window: {
        createWebviewPanel: vi.fn(() => ({
            webview: {
                html: '',
                onDidReceiveMessage: vi.fn(),
                postMessage: vi.fn()
            },
            onDidDispose: vi.fn(),
            reveal: vi.fn()
        })),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn()
    },
    ViewColumn: { One: 1 },
    Uri: { joinPath: vi.fn() },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn()
        }))
    },
    ConfigurationTarget: { Workspace: 2 }
}));

describe('Performance and Edge Case Tests', () => {
    let parser: ClaimsParser;
    let renderer: TimelineRenderer;
    let config: ParserConfig;
    let mockContext: any;

    beforeEach(() => {
        config = {
            rxTbaPath: 'rxTba',
            rxHistoryPath: 'rxHistory',
            medHistoryPath: 'medHistory',
            dateFormat: 'YYYY-MM-DD',
            colors: {
                rxTba: '#FF6B6B',
                rxHistory: '#4ECDC4',
                medHistory: '#45B7D1'
            },
            customMappings: {}
        };

        parser = new ClaimsParser(config);
        
        mockContext = {
            extensionUri: { fsPath: '/test/path' },
            subscriptions: []
        };
        
        renderer = new TimelineRenderer(mockContext);
        vi.clearAllMocks();
    });

    describe('Large Dataset Performance', () => {
        it('should handle 1000+ prescription claims efficiently', () => {
            const startTime = Date.now();
            
            // Generate 1000 prescription claims
            const largeClaims = Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                dos: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
                dayssupply: 30,
                medication: `Medication ${i}`,
                dosage: '10mg once daily'
            }));

            const largeData = { rxTba: largeClaims };
            const result = parser.extractClaims(largeData, config);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(result).toHaveLength(1000);
            expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
            expect(result[0].type).toBe('rxTba');
        });

        it('should handle 500+ medical claims with multiple lines efficiently', () => {
            const startTime = Date.now();

            // Generate 500 medical claims with 2-5 lines each
            const medicalClaims = Array.from({ length: 500 }, (_, i) => ({
                claimId: `med${i}`,
                provider: `Provider ${i}`,
                lines: Array.from({ length: Math.floor(Math.random() * 4) + 2 }, (_, j) => ({
                    lineId: `line${i}_${j}`,
                    srvcStart: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
                    srvcEnd: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
                    serviceType: `Service ${j}`,
                    description: `Medical service ${i}-${j}`
                }))
            }));

            const largeData = { medHistory: { claims: medicalClaims } };
            const result = parser.extractClaims(largeData, config);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(result.length).toBeGreaterThan(1000); // Should have 1000+ line items
            expect(processingTime).toBeLessThan(2000); // Should complete within 2 seconds
        });

        it('should handle mixed large dataset with all claim types', () => {
            const startTime = Date.now();

            const mixedLargeData = {
                rxTba: Array.from({ length: 300 }, (_, i) => ({
                    id: `rx${i}`,
                    dos: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
                    dayssupply: 30,
                    medication: `RxTba Med ${i}`
                })),
                rxHistory: Array.from({ length: 300 }, (_, i) => ({
                    id: `rxh${i}`,
                    dos: `2024-02-${String((i % 28) + 1).padStart(2, '0')}`,
                    dayssupply: 7,
                    medication: `RxHistory Med ${i}`
                })),
                medHistory: {
                    claims: Array.from({ length: 200 }, (_, i) => ({
                        claimId: `med${i}`,
                        lines: [{
                            lineId: `line${i}`,
                            srvcStart: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`,
                            srvcEnd: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`,
                            description: `Med Service ${i}`
                        }]
                    }))
                }
            };

            const result = parser.extractClaims(mixedLargeData, config);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(result).toHaveLength(800); // 300 + 300 + 200
            expect(processingTime).toBeLessThan(1500);
            
            const claimTypes = [...new Set(result.map(c => c.type))];
            expect(claimTypes).toEqual(expect.arrayContaining(['rxTba', 'rxHistory', 'medHistory']));
        });

        it('should efficiently sort large datasets chronologically', () => {
            const startTime = Date.now();

            // Generate unsorted claims across different months
            const unsortedClaims = Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                dos: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                dayssupply: 30,
                medication: `Med ${i}`
            }));

            const data = { rxTba: unsortedClaims };
            const claims = parser.extractClaims(data, config);
            const timelineData = parser['generateTimelineData'](claims);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(processingTime).toBeLessThan(500);
            
            // Verify sorting (most recent first)
            for (let i = 0; i < timelineData.claims.length - 1; i++) {
                expect(timelineData.claims[i].startDate.getTime())
                    .toBeGreaterThanOrEqual(timelineData.claims[i + 1].startDate.getTime());
            }
        });
    });

    describe('Memory Usage and Optimization', () => {
        it('should handle timeline data generation without memory leaks', () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Process multiple datasets
            for (let batch = 0; batch < 10; batch++) {
                const claims = Array.from({ length: 100 }, (_, i) => ({
                    id: `rx${batch}_${i}`,
                    dos: '2024-01-15',
                    dayssupply: 30,
                    medication: `Med ${i}`
                }));

                const data = { rxTba: claims };
                const result = parser.extractClaims(data, config);
                const timelineData = parser['generateTimelineData'](result);

                expect(timelineData.claims).toHaveLength(100);
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });

        it('should efficiently handle webview data serialization for large datasets', () => {
            const largeClaims: ClaimItem[] = Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                type: 'rxTba',
                startDate: new Date(`2024-01-${String((i % 28) + 1).padStart(2, '0')}`),
                endDate: new Date(`2024-02-${String((i % 28) + 1).padStart(2, '0')}`),
                displayName: `Medication ${i}`,
                color: '#FF6B6B',
                details: {
                    medication: `Med ${i}`,
                    dosage: '10mg',
                    dayssupply: 30
                }
            }));

            const timelineData: TimelineData = {
                claims: largeClaims,
                dateRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-02-28')
                },
                metadata: {
                    totalClaims: 1000,
                    claimTypes: ['rxTba']
                }
            };

            const startTime = Date.now();
            renderer.createPanel(timelineData);
            renderer.updateData(timelineData);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(500);
        });
    });

    describe('Edge Cases and Boundary Conditions', () => {
        it('should handle claims with same start and end dates', () => {
            const sameDate = '2024-01-15';
            const sameDateClaims = {
                rxTba: [
                    { id: 'rx1', dos: sameDate, dayssupply: 0, medication: 'Same Day Med 1' },
                    { id: 'rx2', dos: sameDate, dayssupply: 1, medication: 'Same Day Med 2' }
                ],
                medHistory: {
                    claims: [{
                        claimId: 'med1',
                        lines: [{
                            lineId: 'line1',
                            srvcStart: sameDate,
                            srvcEnd: sameDate,
                            description: 'Same Day Service'
                        }]
                    }]
                }
            };

            const result = parser.extractClaims(sameDateClaims, config);
            expect(result).toHaveLength(3);
            
            // All should have same start date
            result.forEach(claim => {
                expect(claim.startDate).toEqual(new Date(sameDate));
            });
        });

        it('should handle extreme date ranges (100+ years)', () => {
            const extremeRangeClaims = {
                rxTba: [
                    { id: 'rx1', dos: '1920-01-01', dayssupply: 30, medication: 'Old Med' },
                    { id: 'rx2', dos: '2024-01-01', dayssupply: 30, medication: 'Current Med' },
                    { id: 'rx3', dos: '2050-01-01', dayssupply: 30, medication: 'Future Med' }
                ]
            };

            const result = parser.extractClaims(extremeRangeClaims, config);
            const timelineData = parser['generateTimelineData'](result);

            expect(result).toHaveLength(3);
            expect(timelineData.dateRange.start).toEqual(new Date('1920-01-01'));
            expect(timelineData.dateRange.end).toEqual(new Date('2050-01-31'));
        });

        it('should handle claims with maximum days supply values', () => {
            const maxSupplyClaims = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 365, medication: 'Max Supply Med' },
                    { id: 'rx2', dos: '2024-01-01', dayssupply: 1000, medication: 'Excessive Supply Med' }
                ]
            };

            const result = parser.extractClaims(maxSupplyClaims, config);
            
            expect(result).toHaveLength(2);
            
            // First claim should have 365 days
            const expectedEnd1 = new Date('2024-01-01');
            expectedEnd1.setDate(expectedEnd1.getDate() + 365);
            expect(result[0].endDate).toEqual(expectedEnd1);
            
            // Second claim should be capped at 365 days
            const expectedEnd2 = new Date('2024-01-01');
            expectedEnd2.setDate(expectedEnd2.getDate() + 365);
            expect(result[1].endDate).toEqual(expectedEnd2);
        });

        it('should handle empty and null values gracefully', () => {
            const edgeCaseClaims = {
                rxTba: [
                    { id: '', dos: '2024-01-01', dayssupply: 30, medication: '' },
                    { id: 'rx2', dos: '2024-01-02', dayssupply: null, medication: null },
                    { id: 'rx3', dos: '2024-01-03', dayssupply: undefined, medication: undefined }
                ]
            };

            const result = parser.extractClaims(edgeCaseClaims, config);
            
            expect(result).toHaveLength(3);
            
            // Should generate fallback IDs and names
            expect(result[0].id).toBe('rxTba_0');
            expect(result[0].displayName).toBe('rxTba Claim rxTba_0');
            
            expect(result[1].displayName).toBe('rxTba Claim rx2');
            expect(result[2].displayName).toBe('rxTba Claim rx3');
        });

        it('should handle deeply nested medical history structures', () => {
            const deepNestedClaims = {
                medHistory: {
                    claims: Array.from({ length: 50 }, (_, i) => ({
                        claimId: `claim${i}`,
                        provider: `Provider ${i}`,
                        lines: Array.from({ length: 10 }, (_, j) => ({
                            lineId: `line${i}_${j}`,
                            srvcStart: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
                            srvcEnd: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
                            serviceType: `Service Type ${j}`,
                            description: `Service ${i}-${j}`,
                            procedureCode: `CODE${i}${j}`,
                            chargedAmount: Math.random() * 1000,
                            allowedAmount: Math.random() * 800,
                            paidAmount: Math.random() * 600
                        }))
                    }))
                }
            };

            const startTime = Date.now();
            const result = parser.extractClaims(deepNestedClaims, config);
            const endTime = Date.now();

            expect(result).toHaveLength(500); // 50 claims * 10 lines each
            expect(endTime - startTime).toBeLessThan(200); // Should be fast even with nesting
            
            // Verify all claims have proper structure
            result.forEach(claim => {
                expect(claim.type).toBe('medHistory');
                expect(claim.details.claimId).toBeDefined();
                expect(claim.details.provider).toBeDefined();
            });
        });

        it('should handle overlapping claims with identical time periods', () => {
            const overlappingClaims = {
                rxTba: Array.from({ length: 20 }, (_, i) => ({
                    id: `rx${i}`,
                    dos: '2024-01-15', // All same start date
                    dayssupply: 30,    // All same duration
                    medication: `Medication ${i}`
                }))
            };

            const result = parser.extractClaims(overlappingClaims, config);
            const timelineData = parser['generateTimelineData'](result);

            expect(result).toHaveLength(20);
            
            // All should have same date range
            result.forEach(claim => {
                expect(claim.startDate).toEqual(new Date('2024-01-15'));
                expect(claim.endDate).toEqual(new Date('2024-02-14'));
            });

            expect(timelineData.dateRange.start).toEqual(new Date('2024-01-15'));
            expect(timelineData.dateRange.end).toEqual(new Date('2024-02-14'));
        });

        it('should handle unicode and special characters in medication names', () => {
            const unicodeClaims = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Médication Spéciále' },
                    { id: 'rx2', dos: '2024-01-02', dayssupply: 30, medication: '薬物治療' },
                    { id: 'rx3', dos: '2024-01-03', dayssupply: 30, medication: 'Лекарство' },
                    { id: 'rx4', dos: '2024-01-04', dayssupply: 30, medication: 'Med with "quotes" & symbols!' }
                ]
            };

            const result = parser.extractClaims(unicodeClaims, config);
            
            expect(result).toHaveLength(4);
            expect(result[0].displayName).toBe('Médication Spéciále');
            expect(result[1].displayName).toBe('薬物治療');
            expect(result[2].displayName).toBe('Лекарство');
            expect(result[3].displayName).toBe('Med with "quotes" & symbols!');
        });
    });

    describe('Stress Testing', () => {
        it('should handle rapid successive parsing operations', () => {
            const operations = 100;
            const startTime = Date.now();

            for (let i = 0; i < operations; i++) {
                const data = {
                    rxTba: [
                        { id: `rx${i}`, dos: '2024-01-01', dayssupply: 30, medication: `Med ${i}` }
                    ]
                };
                
                const result = parser.extractClaims(data, config);
                expect(result).toHaveLength(1);
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(1000); // Should complete 100 operations in under 1 second
        });

        it('should handle concurrent timeline data generation', async () => {
            const concurrentOperations = 10;
            const promises: Promise<TimelineData>[] = [];

            for (let i = 0; i < concurrentOperations; i++) {
                const claims: ClaimItem[] = [{
                    id: `rx${i}`,
                    type: 'rxTba',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    displayName: `Med ${i}`,
                    color: '#FF6B6B',
                    details: { medication: `Med ${i}` }
                }];

                promises.push(Promise.resolve(parser['generateTimelineData'](claims)));
            }

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const endTime = Date.now();

            expect(results).toHaveLength(concurrentOperations);
            expect(endTime - startTime).toBeLessThan(100);
            
            results.forEach(result => {
                expect(result.claims).toHaveLength(1);
                expect(result.metadata.totalClaims).toBe(1);
            });
        });
    });
});