import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TimelineRenderer } from './timelineRenderer';
import { TimelineData, ClaimItem } from './types';

// Mock VSCode API
vi.mock('vscode', () => ({
    window: {
        createWebviewPanel: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn()
    },
    ViewColumn: { One: 1 },
    Uri: { joinPath: vi.fn() }
}));

describe('Comprehensive Webview Communication Tests - Requirement 2.4', () => {
    let renderer: TimelineRenderer;
    let mockContext: any;
    let mockPanel: any;

    beforeEach(() => {
        mockContext = {
            extensionUri: { fsPath: '/test/path' },
            subscriptions: []
        };

        mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: vi.fn(),
                postMessage: vi.fn(),
                options: {}
            },
            onDidDispose: vi.fn(),
            reveal: vi.fn(),
            dispose: vi.fn()
        };

        (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);
        renderer = new TimelineRenderer(mockContext);
        vi.clearAllMocks();
    });

    describe('Message Protocol Implementation', () => {
        it('should handle ready message and send initial data', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Verify message handler was registered
            expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
            
            // Get message handler before clearing mocks
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Clear initial postMessage calls
            vi.clearAllMocks();
            
            // Send ready message
            messageHandler({ command: 'ready' });
            
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: 'updateData',
                payload: expect.objectContaining({
                    claims: expect.any(Array),
                    dateRange: expect.any(Object),
                    metadata: expect.any(Object)
                })
            });
        });

        it('should handle claim selection with valid ID', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            messageHandler({ command: 'select', payload: 'rx1' });
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Selected rxTba claim'),
                expect.objectContaining({
                    modal: false,
                    detail: expect.any(String)
                })
            );
        });

        it('should handle claim selection with invalid ID', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            messageHandler({ command: 'select', payload: 'nonexistent' });
            
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'Selected claim not found: nonexistent'
            );
        });

        it('should handle error messages from webview', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            messageHandler({ 
                command: 'error', 
                payload: { 
                    message: 'D3.js failed to render timeline',
                    type: 'RENDER_ERROR',
                    details: { error: 'SVG element not found' }
                } 
            });
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Timeline Error: D3.js failed to render timeline',
                'Retry',
                'Report Issue'
            );
        });

        it('should handle unknown message commands gracefully', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Should not throw error for unknown commands
            expect(() => {
                messageHandler({ command: 'unknown', payload: 'test' });
                messageHandler({ command: 'invalid' });
                messageHandler({ command: 'custom', payload: { data: 'test' } });
            }).not.toThrow();
        });

        it('should handle malformed messages safely', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Test various malformed message scenarios
            expect(() => {
                messageHandler({}); // Empty object
                messageHandler({ payload: 'no command' }); // Missing command
                messageHandler({ command: 'test' }); // Missing payload for some commands
            }).not.toThrow();
        });

        it('should handle multiple rapid messages', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Send multiple messages rapidly
            expect(() => {
                for (let i = 0; i < 10; i++) {
                    messageHandler({ command: 'ready' });
                    messageHandler({ command: 'select', payload: 'rx1' });
                }
            }).not.toThrow();
            
            // Should have handled all messages
            expect(mockPanel.webview.postMessage).toHaveBeenCalledTimes(10);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(10);
        });
    });

    describe('Data Serialization and Communication', () => {
        it('should serialize dates to ISO strings for webview', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    
                    // Verify date serialization
                    expect(typeof payload.claims[0].startDate).toBe('string');
                    expect(typeof payload.claims[0].endDate).toBe('string');
                    expect(typeof payload.dateRange.start).toBe('string');
                    expect(typeof payload.dateRange.end).toBe('string');
                    
                    // Verify ISO format
                    expect(payload.claims[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                    expect(payload.claims[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                    expect(payload.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                    expect(payload.dateRange.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                    
                    resolve();
                }, 100);
            });
        });

        it('should preserve all claim properties during serialization', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    const claim = payload.claims[0];
                    
                    // Verify all required properties are present
                    expect(claim).toHaveProperty('id', 'rx1');
                    expect(claim).toHaveProperty('type', 'rxTba');
                    expect(claim).toHaveProperty('startDate');
                    expect(claim).toHaveProperty('endDate');
                    expect(claim).toHaveProperty('displayName', 'Test Medication');
                    expect(claim).toHaveProperty('color', '#FF6B6B');
                    expect(claim).toHaveProperty('details');
                    
                    // Verify details structure
                    expect(claim.details).toMatchObject({
                        medication: 'Test Med',
                        dosage: '10mg',
                        daysSupply: 30
                    });
                    
                    resolve();
                }, 100);
            });
        });

        it('should handle complex nested data structures', () => {
            const complexData = createComplexTimelineData();
            renderer.createPanel(complexData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    
                    expect(payload.claims).toHaveLength(3);
                    expect(payload.metadata.claimTypes).toEqual(['rxTba', 'rxHistory', 'medHistory']);
                    
                    // Verify each claim type is properly serialized
                    const rxTbaClaim = payload.claims.find(c => c.type === 'rxTba');
                    const rxHistoryClaim = payload.claims.find(c => c.type === 'rxHistory');
                    const medHistoryClaim = payload.claims.find(c => c.type === 'medHistory');
                    
                    expect(rxTbaClaim).toBeDefined();
                    expect(rxHistoryClaim).toBeDefined();
                    expect(medHistoryClaim).toBeDefined();
                    
                    // Verify nested details are preserved
                    expect(medHistoryClaim.details).toHaveProperty('claimId');
                    expect(medHistoryClaim.details).toHaveProperty('provider');
                    
                    resolve();
                }, 100);
            });
        });

        it('should handle large datasets without data loss', () => {
            const largeData = createLargeTimelineData(500);
            renderer.createPanel(largeData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    
                    expect(payload.claims).toHaveLength(500);
                    expect(payload.metadata.totalClaims).toBe(500);
                    
                    // Verify random samples are properly serialized
                    const randomIndex = Math.floor(Math.random() * 500);
                    const randomClaim = payload.claims[randomIndex];
                    
                    expect(randomClaim).toHaveProperty('id');
                    expect(randomClaim).toHaveProperty('type');
                    expect(typeof randomClaim.startDate).toBe('string');
                    expect(typeof randomClaim.endDate).toBe('string');
                    
                    resolve();
                }, 100);
            });
        });

        it('should handle special characters and unicode in data', () => {
            const unicodeData = createUnicodeTimelineData();
            renderer.createPanel(unicodeData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    
                    const claim = payload.claims[0];
                    expect(claim.displayName).toBe('Ibuprofen™ 200mg 💊');
                    expect(claim.details.medication).toBe('Ibuprofen™ 200mg 💊');
                    expect(claim.details.prescriber).toBe('Dr. José García-López');
                    
                    resolve();
                }, 100);
            });
        });

        it('should maintain data consistency across multiple updates', () => {
            const initialData = createTestTimelineData();
            renderer.createPanel(initialData);
            
            // Clear initial calls
            vi.clearAllMocks();
            
            // Update with new data multiple times
            for (let i = 0; i < 5; i++) {
                const updatedData = { 
                    ...initialData, 
                    metadata: { 
                        ...initialData.metadata, 
                        totalClaims: i + 1 
                    } 
                };
                renderer.updateData(updatedData);
            }
            
            expect(mockPanel.webview.postMessage).toHaveBeenCalledTimes(5);
            
            // Verify last update has correct data
            const lastCall = (mockPanel.webview.postMessage as any).mock.calls[4];
            const lastPayload = lastCall[0].payload;
            expect(lastPayload.metadata.totalClaims).toBe(5);
        });
    });

    describe('Panel Lifecycle Management', () => {
        it('should create panel with correct configuration', () => {
            const sampleData = createTestTimelineData();
            
            const panel = renderer.createPanel(sampleData);
            
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'medicalClaimsTimeline',
                'Medical Claims Timeline',
                vscode.ViewColumn.One,
                expect.objectContaining({
                    enableScripts: true,
                    retainContextWhenHidden: true
                })
            );
            
            expect(panel).toBe(mockPanel);
        });

        it('should reuse existing panel when creating multiple times', () => {
            const sampleData = createTestTimelineData();
            
            const panel1 = renderer.createPanel(sampleData);
            const panel2 = renderer.createPanel(sampleData);
            
            expect(panel1).toBe(panel2);
            expect(mockPanel.reveal).toHaveBeenCalled();
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        });

        it('should handle panel disposal and recreation', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Verify disposal handler was registered
            expect(mockPanel.onDidDispose).toHaveBeenCalled();
            
            // Simulate panel disposal
            const disposeHandler = (mockPanel.onDidDispose as any).mock.calls[0][0];
            disposeHandler();
            
            // Should be able to create new panel after disposal
            const newPanel = renderer.createPanel(sampleData);
            expect(newPanel).toBeDefined();
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
        });

        it('should dispose panel when renderer is disposed', () => {
            const sampleData = createTestTimelineData();
            mockPanel.dispose = vi.fn();
            
            renderer.createPanel(sampleData);
            renderer.dispose();
            
            expect(mockPanel.dispose).toHaveBeenCalled();
        });

        it('should handle multiple panel operations safely', () => {
            const sampleData = createTestTimelineData();
            
            // Create, dispose, recreate multiple times
            for (let i = 0; i < 3; i++) {
                const panel = renderer.createPanel(sampleData);
                expect(panel).toBeDefined();
                
                const disposeHandler = (mockPanel.onDidDispose as any).mock.calls[i][0];
                disposeHandler();
            }
            
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(3);
        });
    });

    describe('HTML Generation and Content', () => {
        it('should generate valid HTML structure', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            
            // Basic HTML structure
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html');
            expect(html).toContain('<head>');
            expect(html).toContain('<body>');
            expect(html).toContain('</html>');
            
            // Required elements
            expect(html).toContain('Medical Claims Timeline');
            expect(html).toContain('timeline-container');
            expect(html).toContain('Loading timeline data...');
        });

        it('should include D3.js library', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            expect(html).toContain('d3js.org/d3.v7.min.js');
        });

        it('should include comprehensive error handling JavaScript', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            
            // Error handling patterns
            expect(html).toContain('try {');
            expect(html).toContain('catch');
            expect(html).toContain('postMessage');
            expect(html).toContain('error');
            
            // Specific error handling functions
            expect(html).toContain('showError');
            expect(html).toContain('showErrorInWebview');
        });

        it('should include message listener setup', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            
            expect(html).toContain('addEventListener');
            expect(html).toContain('message');
            expect(html).toContain('updateTimelineData');
            expect(html).toContain('acquireVsCodeApi');
        });

        it('should include diagnostic logging', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            
            expect(html).toContain('WEBVIEW DIAGNOSTIC');
            expect(html).toContain('console.log');
            expect(html).toContain('console.error');
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle webview creation failure gracefully', () => {
            (vscode.window.createWebviewPanel as any).mockReturnValue(null);
            
            const sampleData = createTestTimelineData();
            
            // Should handle null panel gracefully
            const panel = renderer.createPanel(sampleData);
            expect(panel).toBeNull();
        });

        it('should handle postMessage failures gracefully', () => {
            mockPanel.webview.postMessage = vi.fn().mockImplementation(() => {
                throw new Error('postMessage failed');
            });
            
            const sampleData = createTestTimelineData();
            
            expect(() => {
                renderer.createPanel(sampleData);
                renderer.updateData(sampleData);
            }).not.toThrow();
        });

        it('should handle message handler registration failure', () => {
            mockPanel.webview.onDidReceiveMessage = vi.fn().mockImplementation(() => {
                throw new Error('Handler registration failed');
            });
            
            const sampleData = createTestTimelineData();
            
            // The createPanel method catches errors and returns null instead of throwing
            const result = renderer.createPanel(sampleData);
            expect(result).toBeNull();
        });

        it('should handle dispose handler registration failure', () => {
            mockPanel.onDidDispose = vi.fn().mockImplementation(() => {
                throw new Error('Dispose handler registration failed');
            });
            
            const sampleData = createTestTimelineData();
            
            // The createPanel method catches errors and returns null instead of throwing
            const result = renderer.createPanel(sampleData);
            expect(result).toBeNull();
        });
    });
});

// Helper functions for creating test data

function createTestTimelineData(): TimelineData {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
        claims: [{
            id: 'rx1',
            type: 'rxTba',
            startDate: oneMonthAgo,
            endDate: now,
            displayName: 'Test Medication',
            color: '#FF6B6B',
            details: {
                medication: 'Test Med',
                dosage: '10mg',
                daysSupply: 30
            }
        }],
        dateRange: {
            start: oneMonthAgo,
            end: now
        },
        metadata: {
            totalClaims: 1,
            claimTypes: ['rxTba']
        }
    };
}

function createComplexTimelineData(): TimelineData {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const claims: ClaimItem[] = [
        {
            id: 'rx1',
            type: 'rxTba',
            startDate: oneMonthAgo,
            endDate: now,
            displayName: 'Lisinopril 10mg',
            color: '#FF6B6B',
            details: {
                medication: 'Lisinopril 10mg',
                dosage: '10mg once daily',
                daysSupply: 30,
                prescriber: 'Dr. Smith'
            }
        },
        {
            id: 'rxh1',
            type: 'rxHistory',
            startDate: twoWeeksAgo,
            endDate: now,
            displayName: 'Amoxicillin 500mg',
            color: '#4ECDC4',
            details: {
                medication: 'Amoxicillin 500mg',
                dosage: '500mg three times daily',
                daysSupply: 7,
                pharmacy: 'CVS Pharmacy'
            }
        },
        {
            id: 'line1',
            type: 'medHistory',
            startDate: twoWeeksAgo,
            endDate: twoWeeksAgo,
            displayName: 'Annual Physical',
            color: '#45B7D1',
            details: {
                claimId: 'med1',
                provider: 'General Hospital',
                serviceType: 'Office Visit',
                description: 'Annual Physical',
                amount: 150.00
            }
        }
    ];

    return {
        claims,
        dateRange: {
            start: oneMonthAgo,
            end: now
        },
        metadata: {
            totalClaims: 3,
            claimTypes: ['rxTba', 'rxHistory', 'medHistory']
        }
    };
}

function createLargeTimelineData(count: number): TimelineData {
    const now = new Date();
    const claims: ClaimItem[] = Array.from({ length: count }, (_, i) => ({
        id: `rx${i}`,
        type: 'rxTba',
        startDate: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)),
        endDate: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000) + (30 * 24 * 60 * 60 * 1000)),
        displayName: `Medication ${i}`,
        color: '#FF6B6B',
        details: {
            medication: `Med ${i}`,
            dosage: '10mg',
            daysSupply: 30
        }
    }));

    return {
        claims,
        dateRange: {
            start: new Date(now.getTime() - (count * 24 * 60 * 60 * 1000)),
            end: now
        },
        metadata: {
            totalClaims: count,
            claimTypes: ['rxTba']
        }
    };
}

function createUnicodeTimelineData(): TimelineData {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
        claims: [{
            id: 'rx1',
            type: 'rxTba',
            startDate: oneMonthAgo,
            endDate: now,
            displayName: 'Ibuprofen™ 200mg 💊',
            color: '#FF6B6B',
            details: {
                medication: 'Ibuprofen™ 200mg 💊',
                dosage: '200mg as needed',
                daysSupply: 30,
                prescriber: 'Dr. José García-López',
                notes: 'Take with food. Avoid alcohol. 注意事项：饭后服用'
            }
        }],
        dateRange: {
            start: oneMonthAgo,
            end: now
        },
        metadata: {
            totalClaims: 1,
            claimTypes: ['rxTba']
        }
    };
}