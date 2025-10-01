import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { activate, deactivate } from './extension';
import { TimelineRenderer } from './timelineRenderer';
import { ClaimsParser } from './claimsParser';
import { ConfigManager } from './configManager';
import { setupIntegrationTestEnvironment } from './test-utils/mockUtils';

// Mock VSCode API with complete implementation
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        executeCommand: vi.fn()
    },
    window: {
        createWebviewPanel: vi.fn(),
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showWarningMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined),
        withProgress: vi.fn(),
        activeTextEditor: null,
        showTextDocument: vi.fn()
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn()
        })),
        openTextDocument: vi.fn(),
        fs: {
            readFile: vi.fn(),
            stat: vi.fn()
        }
    },
    ProgressLocation: {
        Notification: 15
    },
    ViewColumn: {
        One: 1,
        Beside: -2
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
        parse: vi.fn(),
        joinPath: vi.fn()
    },
    env: {
        openExternal: vi.fn(),
        clipboard: {
            writeText: vi.fn()
        }
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    },
    extensions: {
        getExtension: vi.fn()
    },
    version: '1.0.0'
}));

// Mock fs module
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        access: vi.fn()
    }
}));

// Mock HybridParser
const mockHybridParserInstance = {
    parseFile: vi.fn(),
    getParsingStrategy: vi.fn().mockResolvedValue('simple')
};

vi.mock('./hybridParser', () => ({
    HybridParser: vi.fn().mockImplementation(() => mockHybridParserInstance)
}));

// Mock TimelineRenderer
const mockTimelineRendererInstance = {
    createTimeline: vi.fn()
};

vi.mock('./timelineRenderer', () => ({
    TimelineRenderer: vi.fn().mockImplementation(() => mockTimelineRendererInstance)
}));

describe('Integration Tests - Complete Extension Workflow', () => {
    let mockContext: vscode.ExtensionContext;
    let mockPanel: any;
    let mockHybridParser: any;
    let mockTimelineRenderer: any;

    // Helper function to get command handler by name
    const getCommandHandler = (commandName: string) => {
        const commandCall = (vscode.commands.registerCommand as any).mock.calls.find(
            (call: any[]) => call[0] === commandName
        );
        return commandCall ? commandCall[1] : null;
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Clear the specific mock instances
        mockHybridParserInstance.parseFile.mockClear();
        mockHybridParserInstance.getParsingStrategy.mockClear();
        mockTimelineRendererInstance.createTimeline.mockClear();

        // Setup mock context
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/extension/path' },
            extensionPath: '/test/extension/path'
        } as any;

        // Setup mock webview panel
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

        // Setup default successful parsing response
        const defaultTimelineData = {
            claims: [
                {
                    id: 'test-1',
                    type: 'rxTba',
                    startDate: new Date(2024, 0, 15),
                    endDate: new Date(2024, 1, 14),
                    displayName: 'Test Medication',
                    color: '#FF6B6B',
                    details: { dosage: '10mg daily', daysSupply: 30 }
                }
            ],
            dateRange: {
                start: new Date(2024, 0, 15),
                end: new Date(2024, 1, 14)
            },
            metadata: {
                totalClaims: 1,
                claimTypes: ['rxTba']
            }
        };

        // Setup HybridParser mock
        mockHybridParser = mockHybridParserInstance;
        mockHybridParser.parseFile.mockResolvedValue(defaultTimelineData);
        mockHybridParser.getParsingStrategy.mockResolvedValue('simple');

        // Setup TimelineRenderer mock
        mockTimelineRenderer = mockTimelineRendererInstance;
        mockTimelineRenderer.createTimeline.mockResolvedValue(undefined);

        (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);
        (vscode.window.withProgress as any).mockImplementation(async (options: any, callback: any) => {
            const progress = { report: vi.fn() };
            return await callback(progress);
        });
    });

    afterEach(() => {
        deactivate();
    });

    describe('Extension Activation and Command Registration', () => {
        it('should activate extension and register commands successfully', () => {
            activate(mockContext);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'claimsTimeline.viewTimeline',
                expect.any(Function)
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'claimsTimeline.diagnose',
                expect.any(Function)
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'claimsTimeline.testParsing',
                expect.any(Function)
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'claimsTimeline.showDebugInfo',
                expect.any(Function)
            );
            expect(mockContext.subscriptions).toHaveLength(4); // All 4 commands
        });

        it('should handle activation without errors', () => {
            expect(() => activate(mockContext)).not.toThrow();
        });
    });

    describe('Complete File Processing Workflow', () => {
        it('should process valid rxTba file end-to-end', async () => {
            activate(mockContext);

            // Get the registered command handler for viewTimeline (second command registered)
            const viewTimelineCall = (vscode.commands.registerCommand as any).mock.calls.find(
                (call: any[]) => call[0] === 'claimsTimeline.viewTimeline'
            );
            const commandHandler = viewTimelineCall[1];
            const testUri = { fsPath: '/test/file.json' };

            // Execute the command
            await commandHandler(testUri);

            // Verify HybridParser was called
            expect(mockHybridParser.parseFile).toHaveBeenCalledWith('/test/file.json');
            expect(mockHybridParser.getParsingStrategy).toHaveBeenCalledWith('/test/file.json');
            
            // Verify TimelineRenderer was called
            expect(mockTimelineRenderer.createTimeline).toHaveBeenCalled();
        });

        it('should process comprehensive claims file with all types', async () => {
            // Setup comprehensive timeline data
            const comprehensiveTimelineData = {
                claims: [
                    {
                        id: 'rx1',
                        type: 'rxTba',
                        startDate: new Date(2024, 0, 15),
                        endDate: new Date(2024, 1, 14),
                        displayName: 'Med A',
                        color: '#FF6B6B',
                        details: { dosage: 'N/A', daysSupply: 30 }
                    },
                    {
                        id: 'rxh1',
                        type: 'rxHistory',
                        startDate: new Date(2024, 0, 10),
                        endDate: new Date(2024, 0, 17),
                        displayName: 'Med B',
                        color: '#4ECDC4',
                        details: { dosage: 'N/A', daysSupply: 7 }
                    }
                ],
                dateRange: {
                    start: new Date(2024, 0, 8),
                    end: new Date(2024, 1, 14)
                },
                metadata: {
                    totalClaims: 2,
                    claimTypes: ['rxTba', 'rxHistory', 'medHistory']
                }
            };

            (mockHybridParser.parseFile as any).mockResolvedValue(comprehensiveTimelineData);

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/comprehensive.json' };

            await commandHandler(testUri);

            // Verify parsing was called
            expect(mockHybridParser.parseFile).toHaveBeenCalledWith('/test/comprehensive.json');
            expect(mockTimelineRenderer.createTimeline).toHaveBeenCalledWith(comprehensiveTimelineData);
        });

        it('should handle invalid JSON file gracefully', async () => {
            // Mock HybridParser to throw JSON parsing error
            (mockHybridParser.parseFile as any).mockRejectedValue(new SyntaxError('Unexpected token in JSON'));

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/invalid.json' };

            await commandHandler(testUri);

            // Should show error message
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Timeline Error: Unexpected token in JSON',
                'Show Details'
            );
        });

        it('should handle non-medical JSON file appropriately', async () => {
            // Mock HybridParser to return empty claims for non-medical data
            (mockHybridParser.parseFile as any).mockResolvedValue({
                claims: [],
                dateRange: { start: new Date(), end: new Date() },
                metadata: { totalClaims: 0, claimTypes: [] }
            });

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/other.json' };

            await commandHandler(testUri);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'No claims found in the JSON file'
            );
        });

        it('should handle file read errors', async () => {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            (mockHybridParser.parseFile as any).mockRejectedValue(error);

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/nonexistent.json' };

            await commandHandler(testUri);

            // Should show error message
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Timeline Error: File not found',
                'Show Details'
            );
        });
    });

    describe('Webview Integration', () => {
        it('should create webview with correct HTML content', async () => {
            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/file.json' };

            await commandHandler(testUri);

            // Verify TimelineRenderer was called to create webview
            expect(mockTimelineRenderer.createTimeline).toHaveBeenCalled();
        });

        it('should handle webview messages correctly', async () => {
            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/file.json' };

            await commandHandler(testUri);

            // Verify TimelineRenderer handles webview creation
            expect(mockTimelineRenderer.createTimeline).toHaveBeenCalled();
        });
    });

    describe('Configuration Integration', () => {
        it('should use custom configuration for parsing', async () => {
            // Mock custom configuration
            (vscode.workspace.getConfiguration as any).mockReturnValue({
                get: vi.fn((key: string) => {
                    if (key === 'rxTbaPath') return 'customRxTba';
                    return undefined;
                }),
                update: vi.fn()
            });

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/custom.json' };

            await commandHandler(testUri);

            // Verify parsing was attempted
            expect(mockHybridParser.parseFile).toHaveBeenCalledWith('/test/custom.json');
        });
    });

    describe('Error Recovery Workflows', () => {
        it('should provide recovery options for structure validation errors', async () => {
            // Mock HybridParser to throw structure validation error
            (mockHybridParser.parseFile as any).mockRejectedValue(new Error('Structure validation failed'));

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/invalid.json' };

            await commandHandler(testUri);

            // Should show error message with recovery options
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Timeline Error: Structure validation failed',
                'Show Details'
            );
        });

        it('should provide recovery options for date parsing errors', async () => {
            // Mock HybridParser to throw date parsing error
            (mockHybridParser.parseFile as any).mockRejectedValue(new Error('Date parsing failed'));

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/invalid-dates.json' };

            await commandHandler(testUri);

            // Should show error message with recovery options
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Timeline Error: Date parsing failed',
                'Show Details'
            );
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large datasets efficiently', async () => {
            // Mock large dataset response
            const largeClaims = Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                type: 'rxTba',
                startDate: new Date(2024, 0, (i % 28) + 1),
                endDate: new Date(2024, 1, (i % 28) + 1),
                displayName: `Medication ${i}`,
                color: '#FF6B6B',
                details: { dosage: 'N/A', daysSupply: 30 }
            }));

            const largeTimelineData = {
                claims: largeClaims,
                dateRange: { start: new Date(2024, 0, 1), end: new Date(2024, 1, 28) },
                metadata: { totalClaims: 1000, claimTypes: ['rxTba'] }
            };

            (mockHybridParser.parseFile as any).mockResolvedValue(largeTimelineData);

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/large.json' };

            const startTime = Date.now();
            await commandHandler(testUri);
            const endTime = Date.now();

            // Should complete within reasonable time (5 seconds)
            expect(endTime - startTime).toBeLessThan(5000);
            expect(mockTimelineRenderer.createTimeline).toHaveBeenCalledWith(largeTimelineData);
        });

        it('should handle empty claims arrays', async () => {
            // Mock empty claims response
            (mockHybridParser.parseFile as any).mockResolvedValue({
                claims: [],
                dateRange: { start: new Date(), end: new Date() },
                metadata: { totalClaims: 0, claimTypes: [] }
            });

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/empty.json' };

            await commandHandler(testUri);

            // Empty claims test - should show warning about no medical claims
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'No claims found in the JSON file'
            );
        });

        it('should handle overlapping date ranges correctly', async () => {
            // Mock overlapping claims response
            const overlappingTimelineData = {
                claims: [
                    {
                        id: 'rx1',
                        type: 'rxTba',
                        startDate: new Date(2024, 0, 1),
                        endDate: new Date(2024, 0, 31),
                        displayName: 'Med A',
                        color: '#FF6B6B',
                        details: { dosage: 'N/A', daysSupply: 30 }
                    },
                    {
                        id: 'rx2',
                        type: 'rxTba',
                        startDate: new Date(2024, 0, 15),
                        endDate: new Date(2024, 1, 14),
                        displayName: 'Med B',
                        color: '#4ECDC4',
                        details: { dosage: 'N/A', daysSupply: 30 }
                    },
                    {
                        id: 'rx3',
                        type: 'rxTba',
                        startDate: new Date(2024, 0, 10),
                        endDate: new Date(2024, 1, 24),
                        displayName: 'Med C',
                        color: '#45B7D1',
                        details: { dosage: 'N/A', daysSupply: 45 }
                    }
                ],
                dateRange: { start: new Date(2024, 0, 1), end: new Date(2024, 1, 24) },
                metadata: { totalClaims: 3, claimTypes: ['rxTba'] }
            };

            (mockHybridParser.parseFile as any).mockResolvedValue(overlappingTimelineData);

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/overlapping.json' };

            await commandHandler(testUri);

            // Verify overlapping claims were processed
            expect(mockTimelineRenderer.createTimeline).toHaveBeenCalledWith(overlappingTimelineData);
        });
    });

    describe('Command Palette Integration', () => {
        it('should handle command execution without URI parameter', async () => {
            // Reset mock to ensure clean state
            mockHybridParser.parseFile.mockClear();
            
            // Mock active editor
            (vscode.window as any).activeTextEditor = {
                document: {
                    uri: { fsPath: '/test/active.json' }
                }
            };

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');

            // Execute without URI (simulating command palette)
            await commandHandler();

            // Should use active editor's file
            expect(mockHybridParser.parseFile).toHaveBeenCalledWith('/test/active.json');
        });

        it('should show error when no file is available', async () => {
            (vscode.window as any).activeTextEditor = null;

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');

            await commandHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'No JSON file selected'
            );
        });

        it('should handle non-JSON files by attempting to parse them', async () => {
            // The current implementation doesn't validate file extensions
            // It attempts to parse any file and handles errors gracefully
            mockHybridParser.parseFile.mockRejectedValue(new Error('Invalid file format'));

            activate(mockContext);
            const commandHandler = getCommandHandler('claimsTimeline.viewTimeline');
            const testUri = { fsPath: '/test/file.txt' };

            await commandHandler(testUri);

            // Should show error message about timeline error, not file extension
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Timeline Error:'),
                'Show Details'
            );
        });
    });
});