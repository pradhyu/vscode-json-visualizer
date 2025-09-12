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

describe('Webview Communication Tests', () => {
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

    describe('Message Protocol Tests', () => {
        it('should handle ready message correctly', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Verify message handler was registered
            expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
            
            // Clear initial postMessage calls
            vi.clearAllMocks();
            
            // Get message handler
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
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

        it('should handle select message with valid claim ID', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            messageHandler({ command: 'select', payload: 'rx1' });
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Selected rxTba claim: Test Medication',
                expect.objectContaining({
                    modal: false,
                    detail: expect.stringContaining('Test Med')
                })
            );
        });

        it('should handle select message with invalid claim ID', () => {
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
                    stack: 'Error at line 123'
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
            }).not.toThrow();
        });

        it('should handle malformed messages gracefully', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Should not throw error for malformed messages
            expect(() => {
                messageHandler(null);
                messageHandler(undefined);
                messageHandler({});
                messageHandler({ command: 'unknown' });
                messageHandler({ payload: 'no command' });
            }).not.toThrow();
        });
    });

    describe('Data Serialization Tests', () => {
        it('should serialize dates to ISO strings', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    
                    expect(typeof payload.claims[0].startDate).toBe('string');
                    expect(typeof payload.claims[0].endDate).toBe('string');
                    expect(typeof payload.dateRange.start).toBe('string');
                    expect(typeof payload.dateRange.end).toBe('string');
                    
                    // Verify ISO format
                    expect(payload.claims[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                    expect(payload.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                    
                    resolve();
                }, 100);
            });
        });

        it('should preserve all claim properties in serialization', () => {
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
                    
                    expect(claim).toHaveProperty('id');
                    expect(claim).toHaveProperty('type');
                    expect(claim).toHaveProperty('startDate');
                    expect(claim).toHaveProperty('endDate');
                    expect(claim).toHaveProperty('displayName');
                    expect(claim).toHaveProperty('color');
                    expect(claim).toHaveProperty('details');
                    
                    expect(claim.id).toBe('rx1');
                    expect(claim.type).toBe('rxTba');
                    expect(claim.displayName).toBe('Test Medication');
                    expect(claim.color).toBe('#FF6B6B');
                    expect(claim.details).toMatchObject({
                        medication: 'Test Med',
                        dosage: '10mg',
                        daysSupply: 30
                    });
                    
                    resolve();
                }, 100);
            });
        });

        it('should handle large datasets without truncation', () => {
            // Create large dataset
            const largeClaims: ClaimItem[] = Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                type: 'rxTba',
                startDate: new Date(2024, 0, i % 28 + 1),
                endDate: new Date(2024, 0, (i % 28 + 1) + 30),
                displayName: `Medication ${i}`,
                color: '#FF6B6B',
                details: {
                    medication: `Med ${i}`,
                    dosage: '10mg',
                    daysSupply: 30
                }
            }));

            const largeData: TimelineData = {
                claims: largeClaims,
                dateRange: {
                    start: new Date(2024, 0, 1),
                    end: new Date(2024, 11, 31)
                },
                metadata: {
                    totalClaims: 1000,
                    claimTypes: ['rxTba']
                }
            };

            renderer.createPanel(largeData);
            
            // Wait for the timeout to complete
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const calls = (mockPanel.webview.postMessage as any).mock.calls;
                    expect(calls.length).toBeGreaterThan(0);
                    
                    const call = calls[0];
                    const payload = call[0].payload;
                    
                    expect(payload.claims).toHaveLength(1000);
                    expect(payload.metadata.totalClaims).toBe(1000);
                    
                    resolve();
                }, 100);
            });
        });
    });

    describe('Panel Lifecycle Tests', () => {
        it('should reuse existing panel when creating multiple times', () => {
            const sampleData = createTestTimelineData();
            
            const panel1 = renderer.createPanel(sampleData);
            const panel2 = renderer.createPanel(sampleData);
            
            expect(panel1).toBe(panel2);
            expect(mockPanel.reveal).toHaveBeenCalled();
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        });

        it('should handle panel disposal correctly', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Simulate panel disposal
            const disposeHandler = (mockPanel.onDidDispose as any).mock.calls[0][0];
            disposeHandler();
            
            // Should be able to create new panel after disposal
            const newPanel = renderer.createPanel(sampleData);
            expect(newPanel).toBeDefined();
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
        });

        it('should update data on existing panel', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            // Clear initial calls
            vi.clearAllMocks();
            
            // Update with new data
            const updatedData = { ...sampleData, metadata: { ...sampleData.metadata, totalClaims: 2 } };
            renderer.updateData(updatedData);
            
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: 'updateData',
                payload: expect.objectContaining({
                    metadata: expect.objectContaining({
                        totalClaims: 2
                    })
                })
            });
        });
    });

    describe('HTML Generation Tests', () => {
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

        it('should include error handling JavaScript', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            
            expect(html).toContain('try {');
            expect(html).toContain('catch');
            expect(html).toContain('postMessage');
            expect(html).toContain('error');
        });

        it('should include message listener setup', () => {
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            const html = mockPanel.webview.html;
            
            expect(html).toContain('addEventListener');
            expect(html).toContain('message');
            expect(html).toContain('updateTimelineData');
        });
    });

    describe('Error Handling Tests', () => {
        it('should handle webview creation failure', () => {
            (vscode.window.createWebviewPanel as any).mockReturnValue(null);
            
            const sampleData = createTestTimelineData();
            
            const result = renderer.createPanel(sampleData);
            expect(result).toBeNull();
        });

        it('should handle postMessage failures gracefully', () => {
            mockPanel.webview.postMessage = vi.fn().mockImplementation(() => {
                throw new Error('postMessage failed');
            });
            
            const sampleData = createTestTimelineData();
            renderer.createPanel(sampleData);
            
            expect(() => renderer.updateData(sampleData)).not.toThrow();
        });

        it('should handle message handler registration failure', () => {
            mockPanel.webview.onDidReceiveMessage = vi.fn().mockImplementation(() => {
                throw new Error('Handler registration failed');
            });
            
            const sampleData = createTestTimelineData();
            
            expect(() => renderer.createPanel(sampleData)).not.toThrow();
        });
    });
});

/**
 * Helper function to create test timeline data
 */
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