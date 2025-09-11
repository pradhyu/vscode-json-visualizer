import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TimelineRenderer } from './timelineRenderer';
import { TimelineData, ClaimItem } from './types';

// Mock VSCode API
vi.mock('vscode', () => ({
    window: {
        createWebviewPanel: vi.fn(),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn()
    },
    ViewColumn: {
        One: 1
    },
    Uri: {
        joinPath: vi.fn()
    }
}));

describe('TimelineRenderer', () => {
    let renderer: TimelineRenderer;
    let mockContext: vscode.ExtensionContext;
    let mockPanel: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock context
        mockContext = {
            extensionUri: { fsPath: '/test/path' },
            subscriptions: []
        } as any;

        // Create mock webview panel
        mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: vi.fn(),
                postMessage: vi.fn()
            },
            onDidDispose: vi.fn(),
            reveal: vi.fn()
        };

        // Mock createWebviewPanel to return our mock panel
        (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);

        renderer = new TimelineRenderer(mockContext);
    });

    describe('createPanel', () => {
        it('should create a new webview panel with correct configuration', () => {
            const sampleData = createSampleTimelineData();
            
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

        it('should set HTML content for the webview', () => {
            const sampleData = createSampleTimelineData();
            
            renderer.createPanel(sampleData);

            expect(mockPanel.webview.html).toContain('Medical Claims Timeline');
            expect(mockPanel.webview.html).toContain('d3js.org/d3.v7.min.js');
            expect(mockPanel.webview.html).toContain('timeline-container');
        });

        it('should reuse existing panel if one exists', () => {
            const sampleData = createSampleTimelineData();
            
            // Create first panel
            const panel1 = renderer.createPanel(sampleData);
            
            // Create second panel - should reuse the first
            const panel2 = renderer.createPanel(sampleData);

            expect(panel1).toBe(panel2);
            expect(mockPanel.reveal).toHaveBeenCalled();
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateData', () => {
        it('should send updateData message to webview', () => {
            const sampleData = createSampleTimelineData();
            
            renderer.createPanel(sampleData);
            renderer.updateData(sampleData);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: 'updateData',
                payload: expect.objectContaining({
                    claims: expect.any(Array),
                    dateRange: expect.any(Object),
                    metadata: expect.any(Object)
                })
            });
        });

        it('should serialize dates to ISO strings', () => {
            const sampleData = createSampleTimelineData();
            
            renderer.createPanel(sampleData);
            renderer.updateData(sampleData);

            const call = (mockPanel.webview.postMessage as any).mock.calls[0];
            const payload = call[0].payload;

            expect(payload.claims[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(payload.claims[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(payload.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(payload.dateRange.end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('message handling', () => {
        it('should handle ready message by sending initial data', () => {
            const sampleData = createSampleTimelineData();
            renderer.createPanel(sampleData);

            // Get the message handler
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Simulate ready message
            messageHandler({ command: 'ready' });

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: 'updateData',
                payload: expect.any(Object)
            });
        });

        it('should handle select message by showing claim details', () => {
            const sampleData = createSampleTimelineData();
            renderer.createPanel(sampleData);

            // Get the message handler
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Simulate select message
            messageHandler({ command: 'select', payload: 'rx1' });

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Selected rxTba claim'),
                expect.any(Object)
            );
        });

        it('should handle error message by showing error notification', () => {
            const sampleData = createSampleTimelineData();
            renderer.createPanel(sampleData);

            // Get the message handler
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Simulate error message
            messageHandler({ command: 'error', payload: { message: 'Test error' } });

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Timeline Error: Test error');
        });
    });

    describe('dispose', () => {
        it('should dispose the panel when dispose is called', () => {
            const sampleData = createSampleTimelineData();
            mockPanel.dispose = vi.fn();
            
            renderer.createPanel(sampleData);
            renderer.dispose();

            expect(mockPanel.dispose).toHaveBeenCalled();
        });
    });
});

/**
 * Helper function to create sample timeline data for testing
 */
function createSampleTimelineData(): TimelineData {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sampleClaims: ClaimItem[] = [
        {
            id: 'rx1',
            type: 'rxTba',
            startDate: oneMonthAgo,
            endDate: now,
            displayName: 'Test Medication',
            color: '#FF6B6B',
            details: {
                medication: 'Test Med',
                dosage: '10mg',
                dayssupply: 30
            }
        }
    ];

    return {
        claims: sampleClaims,
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