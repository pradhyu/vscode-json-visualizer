/**
 * Standardized mock configuration utilities for consistent testing
 * These utilities provide complete mock setups that can be reused across test files
 */

import { vi, expect } from 'vitest';

/**
 * Standardized fs mock setup with both sync and async operations
 * @returns Mock fs object with all required methods
 */
export function setupFsMocks() {
    return {
        existsSync: vi.fn().mockReturnValue(true),
        readFileSync: vi.fn().mockReturnValue('{"test": "data"}'),
        writeFileSync: vi.fn(),
        readFile: vi.fn().mockResolvedValue('{"test": "data"}'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false }),
        promises: {
            readFile: vi.fn().mockResolvedValue('{"test": "data"}'),
            writeFile: vi.fn().mockResolvedValue(undefined),
            access: vi.fn().mockResolvedValue(undefined),
            stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false })
        },
        constants: {
            F_OK: 0,
            R_OK: 4,
            W_OK: 2,
            X_OK: 1
        }
    };
}

/**
 * Standardized VSCode API mock with all required methods and properties
 * @returns Complete VSCode API mock object
 */
export function setupVSCodeMocks() {
    const mockWebviewPanel = {
        webview: {
            html: '',
            onDidReceiveMessage: vi.fn(),
            postMessage: vi.fn().mockResolvedValue(true),
            asWebviewUri: vi.fn((uri) => uri),
            cspSource: 'vscode-webview:'
        },
        title: 'Medical Claims Timeline',
        viewType: 'medicalClaimsTimeline',
        active: true,
        visible: true,
        viewColumn: 1,
        onDidDispose: vi.fn(),
        onDidChangeViewState: vi.fn(),
        reveal: vi.fn(),
        dispose: vi.fn()
    };

    const mockTextDocument = {
        uri: { fsPath: '/test/path.json', scheme: 'file' },
        fileName: '/test/path.json',
        isUntitled: false,
        languageId: 'json',
        version: 1,
        isDirty: false,
        isClosed: false,
        save: vi.fn().mockResolvedValue(true),
        eol: 1,
        lineCount: 10,
        getText: vi.fn().mockReturnValue('{"test": "data"}'),
        getWordRangeAtPosition: vi.fn(),
        validateRange: vi.fn(),
        validatePosition: vi.fn(),
        positionAt: vi.fn(),
        offsetAt: vi.fn(),
        lineAt: vi.fn()
    };

    return {
        window: {
            createWebviewPanel: vi.fn().mockReturnValue(mockWebviewPanel),
            showErrorMessage: vi.fn().mockResolvedValue(undefined),
            showWarningMessage: vi.fn().mockResolvedValue(undefined),
            showInformationMessage: vi.fn().mockResolvedValue(undefined),
            showOpenDialog: vi.fn().mockResolvedValue([{ fsPath: '/test/path.json' }]),
            withProgress: vi.fn().mockImplementation((options, task) => task()),
            activeTextEditor: {
                document: mockTextDocument
            },
            visibleTextEditors: [],
            onDidChangeActiveTextEditor: vi.fn(),
            onDidChangeVisibleTextEditors: vi.fn(),
            createStatusBarItem: vi.fn().mockReturnValue({
                text: '',
                tooltip: '',
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn()
            }),
            createOutputChannel: vi.fn().mockReturnValue({
                append: vi.fn(),
                appendLine: vi.fn(),
                clear: vi.fn(),
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn()
            })
        },
        ViewColumn: {
            Active: -1,
            Beside: -2,
            One: 1,
            Two: 2,
            Three: 3,
            Four: 4,
            Five: 5,
            Six: 6,
            Seven: 7,
            Eight: 8,
            Nine: 9
        },
        Uri: {
            file: vi.fn((path) => ({ fsPath: path, scheme: 'file' })),
            parse: vi.fn((uri) => ({ fsPath: uri, scheme: 'file' })),
            joinPath: vi.fn((...paths) => ({ fsPath: paths.join('/'), scheme: 'file' })),
            from: vi.fn((components) => components)
        },
        workspace: {
            getConfiguration: vi.fn(() => ({
                get: vi.fn().mockReturnValue(undefined),
                update: vi.fn().mockResolvedValue(undefined),
                has: vi.fn().mockReturnValue(false),
                inspect: vi.fn()
            })),
            openTextDocument: vi.fn().mockResolvedValue(mockTextDocument),
            onDidOpenTextDocument: vi.fn(),
            onDidCloseTextDocument: vi.fn(),
            onDidChangeTextDocument: vi.fn(),
            onDidSaveTextDocument: vi.fn(),
            textDocuments: [mockTextDocument],
            workspaceFolders: [{
                uri: { fsPath: '/test/workspace', scheme: 'file' },
                name: 'test-workspace',
                index: 0
            }],
            onDidChangeWorkspaceFolders: vi.fn(),
            getWorkspaceFolder: vi.fn(),
            asRelativePath: vi.fn((path) => path),
            findFiles: vi.fn().mockResolvedValue([]),
            createFileSystemWatcher: vi.fn().mockReturnValue({
                onDidCreate: vi.fn(),
                onDidChange: vi.fn(),
                onDidDelete: vi.fn(),
                dispose: vi.fn()
            })
        },
        commands: {
            registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            executeCommand: vi.fn().mockResolvedValue(undefined),
            getCommands: vi.fn().mockResolvedValue([])
        },
        extensions: {
            getExtension: vi.fn(),
            all: [],
            onDidChange: vi.fn()
        },
        env: {
            clipboard: {
                readText: vi.fn().mockResolvedValue(''),
                writeText: vi.fn().mockResolvedValue(undefined)
            },
            openExternal: vi.fn().mockResolvedValue(true),
            asExternalUri: vi.fn((uri) => uri)
        },
        languages: {
            registerDocumentSymbolProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            registerHoverProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            registerCompletionItemProvider: vi.fn().mockReturnValue({ dispose: vi.fn() })
        },
        // Additional properties needed for integration tests
        ProgressLocation: {
            Notification: 15,
            SourceControl: 1,
            Window: 10
        },
        ConfigurationTarget: {
            Global: 1,
            Workspace: 2,
            WorkspaceFolder: 3
        }
    };
}

/**
 * Setup parser mocks with consistent return data
 * @param mockData Optional mock data to return
 * @returns Mock parser configuration
 */
export function setupParserMocks(mockData?: any) {
    const defaultMockData = {
        claims: [
            {
                id: 'test-1',
                type: 'rxTba',
                startDate: new Date(2024, 0, 15), // Local midnight
                endDate: new Date(2024, 1, 14),   // Local midnight
                displayName: 'Test Medication',
                color: '#FF6B6B',
                details: {
                    dosage: '10mg daily',
                    daysSupply: 30
                }
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

    const data = mockData || defaultMockData;

    return {
        parseFile: vi.fn().mockResolvedValue(data),
        validateStructure: vi.fn().mockReturnValue(true),
        extractClaims: vi.fn().mockReturnValue(data.claims),
        generateTimelineData: vi.fn().mockReturnValue(data)
    };
}

/**
 * Setup parser mocks for error scenarios
 * @param errorType Type of error to simulate
 * @returns Parser mock configured for error scenarios
 */
export function setupParserErrorMocks(errorType: 'structure-validation' | 'date-parse' | 'file-read' | 'json-parse') {
    const baseMocks = setupParserMocks();
    
    switch (errorType) {
        case 'structure-validation':
            baseMocks.validateStructure.mockReturnValue(false);
            baseMocks.parseFile.mockRejectedValue(new Error('Structure validation failed'));
            break;
            
        case 'date-parse':
            baseMocks.parseFile.mockRejectedValue(new Error('Date parsing failed'));
            break;
            
        case 'file-read':
            baseMocks.parseFile.mockRejectedValue(new Error('File read error'));
            break;
            
        case 'json-parse':
            baseMocks.parseFile.mockRejectedValue(new SyntaxError('Unexpected token in JSON'));
            break;
    }
    
    return baseMocks;
}

/**
 * Setup hybrid parser mocks that handle fallback scenarios
 * @param shouldFallback Whether the parser should use fallback behavior
 * @returns Hybrid parser mock configuration
 */
export function setupHybridParserMocks(shouldFallback: boolean = false) {
    const baseMocks = setupParserMocks();
    
    if (shouldFallback) {
        // First call fails, second succeeds with fallback data
        baseMocks.parseFile
            .mockRejectedValueOnce(new Error('Primary parser failed'))
            .mockResolvedValue({
                claims: [{
                    id: 'fallback-1',
                    type: 'rxTba',
                    startDate: new Date(2024, 0, 15),
                    endDate: new Date(2024, 1, 14),
                    displayName: 'Fallback Medication',
                    color: '#FF6B6B',
                    details: { dosage: 'N/A', daysSupply: 30 }
                }],
                dateRange: { start: new Date(2024, 0, 15), end: new Date(2024, 1, 14) },
                metadata: { totalClaims: 1, claimTypes: ['rxTba'] }
            });
    }
    
    return {
        ...baseMocks,
        determineParsing: vi.fn().mockReturnValue(shouldFallback ? 'flexible' : 'standard')
    };
}

/**
 * Setup extension context mock
 * @returns Mock extension context
 */
export function setupExtensionContextMock() {
    return {
        subscriptions: [],
        workspaceState: {
            get: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockReturnValue([])
        },
        globalState: {
            get: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockReturnValue([]),
            setKeysForSync: vi.fn()
        },
        extensionPath: '/test/extension/path',
        extensionUri: { fsPath: '/test/extension/path', scheme: 'file' },
        environmentVariableCollection: {
            persistent: true,
            replace: vi.fn(),
            append: vi.fn(),
            prepend: vi.fn(),
            get: vi.fn(),
            forEach: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn()
        },
        asAbsolutePath: vi.fn((relativePath) => `/test/extension/path/${relativePath}`),
        storageUri: { fsPath: '/test/storage', scheme: 'file' },
        globalStorageUri: { fsPath: '/test/global-storage', scheme: 'file' },
        logUri: { fsPath: '/test/logs', scheme: 'file' }
    };
}

/**
 * Create a complete test environment with all mocks configured
 * @param options Configuration options for the test environment
 * @returns Object containing all configured mocks
 */
export function createTestEnvironment(options: {
    mockData?: any;
    fsReturnValue?: string;
    shouldThrowError?: boolean;
    errorType?: string;
} = {}) {
    const { mockData, fsReturnValue, shouldThrowError, errorType } = options;

    // Setup all mocks
    const fsMocks = setupFsMocks();
    const vscodeMocks = setupVSCodeMocks();
    const parserMocks = setupParserMocks(mockData);
    const contextMock = setupExtensionContextMock();

    // Configure fs mock behavior
    if (fsReturnValue) {
        fsMocks.readFileSync.mockReturnValue(fsReturnValue);
        fsMocks.promises.readFile.mockResolvedValue(fsReturnValue);
    }

    if (shouldThrowError) {
        const error = new Error(`Test ${errorType || 'generic'} error`);
        if (errorType === 'ENOENT') {
            (error as any).code = 'ENOENT';
        } else if (errorType === 'EACCES') {
            (error as any).code = 'EACCES';
        }
        
        fsMocks.readFileSync.mockImplementation(() => { throw error; });
        fsMocks.promises.readFile.mockRejectedValue(error);
    }

    return {
        fs: fsMocks,
        vscode: vscodeMocks,
        parser: parserMocks,
        context: contextMock,
        
        // Convenience methods for common test scenarios
        expectFileRead: (filePath: string, content: string) => {
            fsMocks.readFileSync.mockReturnValue(content);
            fsMocks.promises.readFile.mockResolvedValue(content);
        },
        
        expectFileError: (errorCode: string) => {
            const error = new Error(`File error: ${errorCode}`);
            (error as any).code = errorCode;
            fsMocks.readFileSync.mockImplementation(() => { throw error; });
            fsMocks.promises.readFile.mockRejectedValue(error);
        },
        
        expectParserSuccess: (data: any) => {
            parserMocks.parseFile.mockResolvedValue(data);
        },
        
        expectParserError: (error: Error) => {
            parserMocks.parseFile.mockRejectedValue(error);
        },
        
        // Reset all mocks
        reset: () => {
            vi.clearAllMocks();
        }
    };
}

/**
 * Create mock JSON data for testing
 * @param type Type of mock data to create
 * @returns Mock JSON data structure
 */
export function createMockJsonData(type: 'valid' | 'invalid' | 'empty' | 'malformed' | 'non-medical' | 'incomplete' = 'valid'): string {
    switch (type) {
        case 'valid':
            return JSON.stringify({
                rxTba: [
                    {
                        id: 'rx1',
                        dos: '2024-01-15',
                        medication: 'Test Medication',
                        dayssupply: 30,
                        dosage: '10mg daily'
                    }
                ],
                rxHistory: [
                    {
                        id: 'rxh1',
                        dos: '2024-01-10',
                        medication: 'Historical Med',
                        dayssupply: 7
                    }
                ],
                medHistory: {
                    claims: [
                        {
                            claimId: 'med1',
                            lines: [
                                {
                                    lineId: 'line1',
                                    srvcStart: '2024-01-08',
                                    srvcEnd: '2024-01-08',
                                    description: 'Medical Service'
                                }
                            ]
                        }
                    ]
                }
            });
            
        case 'invalid':
            return JSON.stringify({
                notMedicalData: {
                    someField: 'someValue'
                }
            });
            
        case 'non-medical':
            return JSON.stringify({
                users: [
                    { id: 1, name: 'John Doe', email: 'john@example.com' }
                ],
                products: [
                    { id: 1, name: 'Widget', price: 19.99 }
                ]
            });
            
        case 'incomplete':
            return JSON.stringify({
                rxTba: [
                    {
                        // Missing required fields
                        dos: '2024-01-01'
                    },
                    {
                        id: 'rx2',
                        medication: 'Incomplete Med'
                        // Missing dos and dayssupply
                    }
                ]
            });
            
        case 'empty':
            return JSON.stringify({});
            
        case 'malformed':
            return '{"invalid": json, "missing": quotes}';
            
        default:
            return '{}';
    }
}

/**
 * Setup comprehensive mock environment for specific test scenarios
 * This addresses common mock configuration issues found in failing tests
 * @param scenario Test scenario to configure
 * @returns Configured mock environment
 */
export function setupTestScenarioMocks(scenario: 'integration' | 'error-handling' | 'performance' | 'regression') {
    const vscode = setupVSCodeMocks();
    const fs = setupFsMocks();
    const context = setupEnhancedExtensionContextMock();
    
    // Configure VSCode mocks for integration tests
    if (scenario === 'integration') {
        // Fix workspace.openTextDocument to handle file extension validation
        vscode.workspace.openTextDocument.mockImplementation((uri) => {
            const filePath = typeof uri === 'string' ? uri : uri.fsPath;
            if (!filePath.endsWith('.json')) {
                return Promise.reject(new Error('Please select a JSON file'));
            }
            return Promise.resolve({
                uri: typeof uri === 'string' ? { fsPath: uri } : uri,
                fileName: filePath,
                getText: vi.fn().mockReturnValue(createMockJsonData('valid')),
                languageId: 'json'
            });
        });
        
        // Configure command registration to track subscriptions properly
        vscode.commands.registerCommand.mockImplementation((command, handler) => {
            const disposable = { dispose: vi.fn() };
            context.subscriptions.push(disposable);
            return disposable;
        });
    }
    
    // Configure for error handling tests
    if (scenario === 'error-handling') {
        // Setup fs mocks to simulate various error conditions
        fs.readFileSync.mockImplementation((path) => {
            if (path.includes('nonexistent')) {
                const error = new Error('ENOENT: no such file or directory');
                (error as any).code = 'ENOENT';
                throw error;
            }
            if (path.includes('malformed')) {
                return '{ invalid json }';
            }
            if (path.includes('incomplete')) {
                return createMockJsonData('incomplete');
            }
            return createMockJsonData('valid');
        });
    }
    
    return {
        vscode,
        fs,
        context,
        // Helper methods for common test operations
        mockFileContent: (content: string) => {
            fs.readFileSync.mockReturnValue(content);
            fs.promises.readFile.mockResolvedValue(content);
        },
        mockFileError: (errorCode: string) => {
            const error = new Error(`File error: ${errorCode}`);
            (error as any).code = errorCode;
            fs.readFileSync.mockImplementation(() => { throw error; });
            fs.promises.readFile.mockRejectedValue(error);
        },
        expectSubscriptions: (count: number) => {
            expect(context.subscriptions).toHaveLength(count);
        },
        reset: () => {
            vi.clearAllMocks();
            context.subscriptions.length = 0;
        }
    };
}

/**
 * Setup global VSCode mock for tests that use vi.mock('vscode')
 * This creates a global mock that can be used across test files
 * @returns VSCode mock object
 */
export function setupGlobalVSCodeMock() {
    const vscode = setupVSCodeMocks();
    
    // Make it available globally for tests that import vscode directly
    (global as any).vscode = vscode;
    
    return vscode;
}

/**
 * Setup mock for extension context with proper subscription tracking
 * @returns Enhanced extension context mock
 */
export function setupEnhancedExtensionContextMock() {
    const subscriptions: any[] = [];
    
    return {
        subscriptions,
        workspaceState: {
            get: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockReturnValue([])
        },
        globalState: {
            get: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockReturnValue([]),
            setKeysForSync: vi.fn()
        },
        extensionPath: '/test/extension/path',
        extensionUri: { fsPath: '/test/extension/path', scheme: 'file' },
        environmentVariableCollection: {
            persistent: true,
            replace: vi.fn(),
            append: vi.fn(),
            prepend: vi.fn(),
            get: vi.fn(),
            forEach: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn()
        },
        asAbsolutePath: vi.fn((relativePath) => `/test/extension/path/${relativePath}`),
        storageUri: { fsPath: '/test/storage', scheme: 'file' },
        globalStorageUri: { fsPath: '/test/global-storage', scheme: 'file' },
        logUri: { fsPath: '/test/logs', scheme: 'file' }
    };
}

/**
 * Setup comprehensive mock environment for integration tests
 * @param options Configuration options
 * @returns Complete mock environment
 */
export function setupIntegrationTestEnvironment(options: {
    expectCommandRegistration?: boolean;
    expectWebviewCreation?: boolean;
    expectFileOperations?: boolean;
    mockFileContent?: string;
} = {}) {
    const vscode = setupVSCodeMocks();
    const fs = setupFsMocks();
    const context = setupEnhancedExtensionContextMock();
    
    // Configure specific behaviors based on options
    if (options.mockFileContent) {
        fs.readFileSync.mockReturnValue(options.mockFileContent);
        fs.promises.readFile.mockResolvedValue(options.mockFileContent);
    }
    
    if (options.expectCommandRegistration) {
        // Track command registrations in context subscriptions
        vscode.commands.registerCommand.mockImplementation((command, handler) => {
            const disposable = { dispose: vi.fn() };
            context.subscriptions.push(disposable);
            return disposable;
        });
    }
    
    if (options.expectWebviewCreation) {
        // Track webview panel creation in context subscriptions
        const originalCreatePanel = vscode.window.createWebviewPanel;
        vscode.window.createWebviewPanel.mockImplementation((...args) => {
            const panel = originalCreatePanel.getMockImplementation()?.(...args) || {
                webview: { html: '', onDidReceiveMessage: vi.fn(), postMessage: vi.fn() },
                onDidDispose: vi.fn(),
                reveal: vi.fn(),
                dispose: vi.fn()
            };
            context.subscriptions.push({ dispose: panel.dispose });
            return panel;
        });
    }
    
    return {
        vscode,
        fs,
        context,
        // Helper to reset all mocks
        reset: () => {
            vi.clearAllMocks();
            context.subscriptions.length = 0;
        }
    };
}

/**
 * Setup mock for error scenarios in tests
 * @param errorType Type of error to simulate
 * @returns Mock environment configured for error scenarios
 */
export function setupErrorTestEnvironment(errorType: 'file-not-found' | 'invalid-json' | 'permission-denied' | 'network-error') {
    const env = createTestEnvironment();
    
    switch (errorType) {
        case 'file-not-found':
            const enoentError = new Error('ENOENT: no such file or directory');
            (enoentError as any).code = 'ENOENT';
            env.fs.readFileSync.mockImplementation(() => { throw enoentError; });
            env.fs.promises.readFile.mockRejectedValue(enoentError);
            break;
            
        case 'invalid-json':
            env.fs.readFileSync.mockReturnValue('{ invalid json }');
            env.fs.promises.readFile.mockResolvedValue('{ invalid json }');
            break;
            
        case 'permission-denied':
            const eaccesError = new Error('EACCES: permission denied');
            (eaccesError as any).code = 'EACCES';
            env.fs.readFileSync.mockImplementation(() => { throw eaccesError; });
            env.fs.promises.readFile.mockRejectedValue(eaccesError);
            break;
            
        case 'network-error':
            const networkError = new Error('Network request failed');
            env.vscode.workspace.openTextDocument.mockRejectedValue(networkError);
            break;
    }
    
    return env;
}

/**
 * Create mock for specific VSCode API methods that are commonly missing
 * @returns Object with commonly needed mock methods
 */
export function createAdditionalVSCodeMocks() {
    return {
        // Progress API
        withProgress: vi.fn().mockImplementation((options, task) => {
            return task({
                report: vi.fn()
            });
        }),
        
        // Configuration API enhancements
        getConfiguration: vi.fn((section?: string) => ({
            get: vi.fn().mockImplementation((key: string, defaultValue?: any) => defaultValue),
            update: vi.fn().mockResolvedValue(undefined),
            has: vi.fn().mockReturnValue(true),
            inspect: vi.fn().mockImplementation((key: string) => ({
                key: section ? `${section}.${key}` : key,
                defaultValue: undefined,
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            }))
        })),
        
        // File system watcher
        createFileSystemWatcher: vi.fn().mockReturnValue({
            onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            dispose: vi.fn()
        }),
        
        // Text document API
        openTextDocument: vi.fn().mockImplementation((uri) => {
            const filePath = typeof uri === 'string' ? uri : uri?.fsPath || '';
            if (!filePath.endsWith('.json')) {
                return Promise.reject(new Error('Please select a JSON file'));
            }
            return Promise.resolve({
                uri: typeof uri === 'string' ? { fsPath: uri } : uri,
                fileName: filePath,
                getText: vi.fn().mockReturnValue('{"test": "data"}'),
                languageId: 'json'
            });
        })
    };
}

/**
 * Assert that VSCode API methods were called correctly
 * @param vscode VSCode mock object
 * @param expectations Object describing expected calls
 */
export function assertVSCodeCalls(vscode: any, expectations: {
    showErrorMessage?: boolean;
    showWarningMessage?: boolean;
    showInformationMessage?: boolean;
    createWebviewPanel?: boolean;
    registerCommand?: boolean;
    commandCount?: number;
}) {
    if (expectations.showErrorMessage) {
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    }
    
    if (expectations.showWarningMessage) {
        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    }
    
    if (expectations.showInformationMessage) {
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    }
    
    if (expectations.createWebviewPanel) {
        expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
    }
    
    if (expectations.registerCommand) {
        expect(vscode.commands.registerCommand).toHaveBeenCalled();
    }
    
    if (expectations.commandCount !== undefined) {
        expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(expectations.commandCount);
    }
}

/**
 * Create a mock that tracks subscription count for extension context
 * @param expectedSubscriptions Number of expected subscriptions
 * @returns Mock context with subscription tracking
 */
export function createSubscriptionTrackingContext(expectedSubscriptions: number = 2) {
    const context = setupEnhancedExtensionContextMock();
    
    // Override registerCommand to automatically add to subscriptions
    const originalRegisterCommand = vi.fn().mockImplementation((command, handler) => {
        const disposable = { dispose: vi.fn() };
        context.subscriptions.push(disposable);
        return disposable;
    });
    
    return {
        context,
        registerCommand: originalRegisterCommand,
        expectSubscriptionCount: () => {
            expect(context.subscriptions).toHaveLength(expectedSubscriptions);
        }
    };
}
/**

 * Create mock environment specifically for integration tests
 * This addresses the specific issues found in integration test failures
 * @returns Mock environment configured for integration tests
 */
export function createIntegrationMockEnvironment() {
    const vscode = setupVSCodeMocks();
    const fs = setupFsMocks();
    const subscriptions: any[] = [];
    
    // Create context that properly tracks subscriptions
    const context = {
        subscriptions,
        workspaceState: {
            get: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockReturnValue([])
        },
        globalState: {
            get: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockReturnValue([]),
            setKeysForSync: vi.fn()
        },
        extensionPath: '/test/extension/path',
        extensionUri: { fsPath: '/test/extension/path', scheme: 'file' },
        environmentVariableCollection: {
            persistent: true,
            replace: vi.fn(),
            append: vi.fn(),
            prepend: vi.fn(),
            get: vi.fn(),
            forEach: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn()
        },
        asAbsolutePath: vi.fn((relativePath) => `/test/extension/path/${relativePath}`),
        storageUri: { fsPath: '/test/storage', scheme: 'file' },
        globalStorageUri: { fsPath: '/test/global-storage', scheme: 'file' },
        logUri: { fsPath: '/test/logs', scheme: 'file' }
    };
    
    // Override registerCommand to track subscriptions correctly
    vscode.commands.registerCommand.mockImplementation((command, handler) => {
        const disposable = { dispose: vi.fn() };
        subscriptions.push(disposable);
        return disposable;
    });
    
    // Configure workspace.openTextDocument for file extension validation
    vscode.workspace.openTextDocument.mockImplementation((uri) => {
        const filePath = typeof uri === 'string' ? uri : uri?.fsPath || '';
        if (!filePath.endsWith('.json')) {
            return Promise.reject(new Error('Please select a JSON file'));
        }
        
        // Return different content based on file path for testing
        let content = '{"test": "data"}';
        if (filePath.includes('non-medical')) {
            content = createMockJsonData('non-medical');
        } else if (filePath.includes('empty')) {
            content = createMockJsonData('empty');
        } else if (filePath.includes('valid')) {
            content = createMockJsonData('valid');
        }
        
        return Promise.resolve({
            uri: typeof uri === 'string' ? { fsPath: uri } : uri,
            fileName: filePath,
            getText: vi.fn().mockReturnValue(content),
            languageId: 'json'
        });
    });
    
    // Configure fs mocks for different file scenarios
    fs.readFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('non-medical')) {
            return createMockJsonData('non-medical');
        } else if (pathStr.includes('empty')) {
            return createMockJsonData('empty');
        } else if (pathStr.includes('incomplete')) {
            return createMockJsonData('incomplete');
        }
        return createMockJsonData('valid');
    });
    
    return {
        vscode,
        fs,
        context,
        // Helper to check subscription count
        expectSubscriptionCount: (expected: number) => {
            expect(subscriptions).toHaveLength(expected);
        },
        // Helper to simulate different file types
        mockFileType: (type: 'valid' | 'non-medical' | 'empty' | 'incomplete') => {
            const content = createMockJsonData(type);
            fs.readFileSync.mockReturnValue(content);
            fs.promises.readFile.mockResolvedValue(content);
        },
        reset: () => {
            vi.clearAllMocks();
            subscriptions.length = 0;
        }
    };
}

/**
 * Setup mocks for VSCode module using vi.mock
 * This creates the mock structure that vi.mock expects
 * @returns Mock module structure
 */
export function createVSCodeModuleMock() {
    const vscode = setupVSCodeMocks();
    
    return {
        ...vscode,
        // Ensure all required exports are available
        default: vscode
    };
}

/**
 * Setup mocks for fs module using vi.mock
 * This creates the mock structure that vi.mock expects
 * @returns Mock module structure
 */
export function createFsModuleMock() {
    const fs = setupFsMocks();
    
    return {
        ...fs,
        // Ensure all required exports are available
        default: fs
    };
}