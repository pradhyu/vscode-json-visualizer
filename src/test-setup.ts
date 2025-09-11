import { vi } from 'vitest';

// Mock the vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => {
        // Return default values for configuration
        const defaults: Record<string, any> = {
          'rxTbaPath': 'rxTba',
          'rxHistoryPath': 'rxHistory',
          'medHistoryPath': 'medHistory',
          'dateFormat': 'YYYY-MM-DD',
          'colors': {
            rxTba: '#FF6B6B',
            rxHistory: '#4ECDC4',
            medHistory: '#45B7D1'
          },
          'customMappings': {}
        };
        return defaults[key];
      }),
      update: vi.fn()
    }))
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  },
  window: {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn()
  },
  commands: {
    executeCommand: vi.fn()
  },
  env: {
    openExternal: vi.fn()
  },
  Uri: {
    parse: vi.fn((uri: string) => ({ toString: () => uri })),
    file: vi.fn((path: string) => ({ fsPath: path })),
    joinPath: vi.fn()
  }
}));

// Mock fs module for file operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn()
  }
}));