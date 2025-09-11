import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { activate, deactivate } from './extension';
import { TimelineRenderer } from './timelineRenderer';
import { ClaimsParser } from './claimsParser';
import { ConfigManager } from './configManager';

// Mock VSCode API
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    window: {
        createWebviewPanel: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        withProgress: vi.fn(),
        activeTextEditor: null
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn()
        }))
    },
    ProgressLocation: {
        Notification: 15
    },
    ViewColumn: {
        One: 1
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
        parse: vi.fn(),
        joinPath: vi.fn()
    },
    env: {
        openExternal: vi.fn()
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    },
    extensions: {
        getExtension: vi.fn()
    }
}));

// Mock fs module
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        access: vi.fn()
    }
}));

describe('Integration Tests - Complete Extension Workflow', () => {
    let mockContext: vscode.ExtensionContext;
    let mockPanel: any;

    beforeEach(() => {
        vi.clearAllMocks();

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

        (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);
        (vscode.window.withProgress as any).mockImplementation(async (options, callback) => {
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
                'medicalClaimsTimeline.viewTimeline',
                expect.any(Function)
            );
            expect(mockContext.subscriptions).toHaveLength(2); // Command + renderer
        });

        it('should handle activation without errors', () => {
            expect(() => activate(mockContext)).not.toThrow();
        });
    });

    describe('Complete File Processing Workflow', () => {
        it('should process valid rxTba file end-to-end', async () => {
            const sampleData = {
                rxTba: [
                    {
                        id: 'rx1',
                        dos: '2024-01-15',
                        dayssupply: 30,
                        medication: 'Test Medication',
                        dosage: '10mg once daily'
                    }
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(sampleData));

            activate(mockContext);

            // Get the registered command handler
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/file.json' };

            // Execute the command
            await commandHandler(testUri);

            // Verify file was read
            expect(fs.promises.readFile).toHaveBeenCalledWith('/test/file.json', 'utf-8');

            // Verify webview was created
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'medicalClaimsTimeline',
                'Medical Claims Timeline',
                vscode.ViewColumn.One,
                expect.objectContaining({
                    enableScripts: true,
                    retainContextWhenHidden: true
                })
            );

            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Timeline created successfully')
            );
        });

        it('should process comprehensive claims file with all types', async () => {
            const comprehensiveData = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-15', dayssupply: 30, medication: 'Med A' }
                ],
                rxHistory: [
                    { id: 'rxh1', dos: '2024-01-10', dayssupply: 7, medication: 'Med B' }
                ],
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                { lineId: 'line1', srvcStart: '2024-01-08', srvcEnd: '2024-01-08', description: 'Office Visit' }
                            ]
                        }
                    ]
                }
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(comprehensiveData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/comprehensive.json' };

            await commandHandler(testUri);

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('3 claims (rxTba, rxHistory, medHistory)')
            );
        });

        it('should handle invalid JSON file gracefully', async () => {
            (fs.promises.readFile as any).mockResolvedValue('invalid json {');

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/invalid.json' };

            await commandHandler(testUri);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Validation Error')
            );
        });

        it('should handle non-medical JSON file appropriately', async () => {
            const nonMedicalData = { someOtherData: 'not medical claims' };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(nonMedicalData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/other.json' };

            await commandHandler(testUri);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('does not appear to contain medical claims data'),
                'View Sample Files',
                'Learn More'
            );
        });

        it('should handle file read errors', async () => {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            (fs.promises.readFile as any).mockRejectedValue(error);

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/nonexistent.json' };

            await commandHandler(testUri);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('File Access Error')
            );
        });
    });

    describe('Webview Integration', () => {
        it('should create webview with correct HTML content', async () => {
            const sampleData = {
                rxTba: [{ id: 'rx1', dos: '2024-01-15', dayssupply: 30, medication: 'Test Med' }]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(sampleData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/file.json' };

            await commandHandler(testUri);

            expect(mockPanel.webview.html).toContain('Medical Claims Timeline');
            expect(mockPanel.webview.html).toContain('d3js.org/d3.v7.min.js');
            expect(mockPanel.webview.html).toContain('timeline-container');
        });

        it('should handle webview messages correctly', async () => {
            const sampleData = {
                rxTba: [{ id: 'rx1', dos: '2024-01-15', dayssupply: 30, medication: 'Test Med' }]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(sampleData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/file.json' };

            await commandHandler(testUri);

            // Get the message handler
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];

            // Test ready message
            messageHandler({ command: 'ready' });
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: 'updateData',
                payload: expect.any(Object)
            });

            // Test select message
            messageHandler({ command: 'select', payload: 'rx1' });
            expect(vscode.window.showInformationMessage).toHaveBeenCalled();

            // Test error message
            messageHandler({ command: 'error', payload: { message: 'Test error' } });
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Timeline Error: Test error');
        });
    });

    describe('Configuration Integration', () => {
        it('should use custom configuration for parsing', async () => {
            const customData = {
                customRxTba: [
                    { id: 'rx1', dos: '2024-01-15', dayssupply: 30, medication: 'Custom Med' }
                ]
            };

            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(customData));

            // Mock custom configuration
            (vscode.workspace.getConfiguration as any).mockReturnValue({
                get: vi.fn((key: string) => {
                    if (key === 'rxTbaPath') return 'customRxTba';
                    return undefined;
                }),
                update: vi.fn()
            });

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/custom.json' };

            await commandHandler(testUri);

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Timeline created successfully')
            );
        });
    });

    describe('Error Recovery Workflows', () => {
        it('should provide recovery options for structure validation errors', async () => {
            const invalidData = { invalidStructure: 'test' };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(invalidData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/invalid.json' };

            await commandHandler(testUri);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Invalid JSON Structure',
                'View Sample Files',
                'Open Settings',
                'Show Details'
            );
        });

        it('should provide recovery options for date parsing errors', async () => {
            const invalidDateData = {
                rxTba: [
                    { id: 'rx1', dos: 'invalid-date', dayssupply: 30, medication: 'Test Med' }
                ]
            };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(invalidDateData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/invalid-dates.json' };

            await commandHandler(testUri);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Date Format Error',
                'Open Settings',
                'Show Examples',
                'Show Details'
            );
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large datasets efficiently', async () => {
            // Generate large dataset
            const largeClaims = Array.from({ length: 1000 }, (_, i) => ({
                id: `rx${i}`,
                dos: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
                dayssupply: 30,
                medication: `Medication ${i}`
            }));

            const largeData = { rxTba: largeClaims };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(largeData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/large.json' };

            const startTime = Date.now();
            await commandHandler(testUri);
            const endTime = Date.now();

            // Should complete within reasonable time (5 seconds)
            expect(endTime - startTime).toBeLessThan(5000);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('1000 claims')
            );
        });

        it('should handle empty claims arrays', async () => {
            const emptyData = {
                rxTba: [],
                rxHistory: [],
                medHistory: { claims: [] }
            };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(emptyData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/empty.json' };

            await commandHandler(testUri);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('No medical claims found')
            );
        });

        it('should handle overlapping date ranges correctly', async () => {
            const overlappingData = {
                rxTba: [
                    { id: 'rx1', dos: '2024-01-01', dayssupply: 30, medication: 'Med A' },
                    { id: 'rx2', dos: '2024-01-15', dayssupply: 30, medication: 'Med B' },
                    { id: 'rx3', dos: '2024-01-10', dayssupply: 45, medication: 'Med C' }
                ]
            };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(overlappingData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/overlapping.json' };

            await commandHandler(testUri);

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('3 claims')
            );
        });
    });

    describe('Command Palette Integration', () => {
        it('should handle command execution without URI parameter', async () => {
            // Mock active editor
            (vscode.window as any).activeTextEditor = {
                document: {
                    uri: { fsPath: '/test/active.json' }
                }
            };

            const sampleData = {
                rxTba: [{ id: 'rx1', dos: '2024-01-15', dayssupply: 30, medication: 'Test Med' }]
            };
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(sampleData));

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];

            // Execute without URI (simulating command palette)
            await commandHandler();

            expect(fs.promises.readFile).toHaveBeenCalledWith('/test/active.json', 'utf-8');
        });

        it('should show error when no file is available', async () => {
            (vscode.window as any).activeTextEditor = null;

            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];

            await commandHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No JSON file selected')
            );
        });

        it('should validate file extension', async () => {
            activate(mockContext);
            const commandHandler = (vscode.commands.registerCommand as any).mock.calls[0][1];
            const testUri = { fsPath: '/test/file.txt' };

            await commandHandler(testUri);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Please select a JSON file')
            );
        });
    });
});