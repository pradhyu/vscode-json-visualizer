import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock VSCode API - must be defined before imports
const mockWorkspaceConfig = {
  get: vi.fn(),
  update: vi.fn(),
};

// Mock the vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => mockWorkspaceConfig),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
}));

import { ConfigManager } from './configManager';
import { ParserConfig } from './types';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    vi.clearAllMocks();
  });

  describe('getParserConfig', () => {
    it('should return default configuration when no settings are configured', () => {
      mockWorkspaceConfig.get.mockReturnValue(undefined);

      const config = configManager.getParserConfig();

      expect(config).toEqual({
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
      });
    });

    it('should return configured values when settings exist', () => {
      mockWorkspaceConfig.get.mockImplementation((key: string) => {
        const settings: Record<string, any> = {
          'rxTbaPath': 'customRxTba',
          'rxHistoryPath': 'customRxHistory',
          'medHistoryPath': 'customMedHistory',
          'dateFormat': 'MM/DD/YYYY',
          'colors': {
            rxTba: '#123456',
            rxHistory: '#789ABC',
            medHistory: '#DEF012'
          },
          'customMappings': { 'custom': 'mapping' }
        };
        return settings[key];
      });

      const config = configManager.getParserConfig();

      expect(config).toEqual({
        rxTbaPath: 'customRxTba',
        rxHistoryPath: 'customRxHistory',
        medHistoryPath: 'customMedHistory',
        dateFormat: 'MM/DD/YYYY',
        colors: {
          rxTba: '#123456',
          rxHistory: '#789ABC',
          medHistory: '#DEF012'
        },
        customMappings: { 'custom': 'mapping' }
      });
    });

    it('should use defaults for missing individual settings', () => {
      mockWorkspaceConfig.get.mockImplementation((key: string) => {
        if (key === 'rxTbaPath') return 'customRxTba';
        return undefined;
      });

      const config = configManager.getParserConfig();

      expect(config.rxTbaPath).toBe('customRxTba');
      expect(config.rxHistoryPath).toBe('rxHistory'); // default
      expect(config.medHistoryPath).toBe('medHistory'); // default
    });
  });

  describe('updateConfig', () => {
    it('should update individual configuration values', async () => {
      mockWorkspaceConfig.update.mockResolvedValue(undefined);

      const updates: Partial<ParserConfig> = {
        rxTbaPath: 'newRxTbaPath',
        dateFormat: 'DD-MM-YYYY'
      };

      await configManager.updateConfig(updates);

      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('rxTbaPath', 'newRxTbaPath', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('dateFormat', 'DD-MM-YYYY', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledTimes(2);
    });

    it('should update all configuration values when provided', async () => {
      mockWorkspaceConfig.update.mockResolvedValue(undefined);

      const updates: ParserConfig = {
        rxTbaPath: 'newRxTba',
        rxHistoryPath: 'newRxHistory',
        medHistoryPath: 'newMedHistory',
        dateFormat: 'MM/DD/YYYY',
        colors: {
          rxTba: '#111111',
          rxHistory: '#222222',
          medHistory: '#333333'
        },
        customMappings: { 'test': 'mapping' }
      };

      await configManager.updateConfig(updates);

      expect(mockWorkspaceConfig.update).toHaveBeenCalledTimes(6);
    });

    it('should use specified configuration target', async () => {
      mockWorkspaceConfig.update.mockResolvedValue(undefined);

      await configManager.updateConfig({ rxTbaPath: 'test' }, 1); // Global

      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('rxTbaPath', 'test', 1);
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct configuration', () => {
      const validConfig: ParserConfig = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
          rxTba: '#FF6B6B',
          rxHistory: '#4ECDC4',
          medHistory: '#45B7D1'
        },
        customMappings: { 'valid': 'mapping' }
      };

      const result = configManager.validateConfig(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty path configurations', () => {
      const invalidConfig: ParserConfig = {
        rxTbaPath: '',
        rxHistoryPath: '   ',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
          rxTba: '#FF6B6B',
          rxHistory: '#4ECDC4',
          medHistory: '#45B7D1'
        },
        customMappings: {}
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('rxTbaPath cannot be empty');
      expect(result.errors).toContain('rxHistoryPath cannot be empty');
    });

    it('should detect invalid date formats', () => {
      const invalidConfig: ParserConfig = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'INVALID-FORMAT',
        colors: {
          rxTba: '#FF6B6B',
          rxHistory: '#4ECDC4',
          medHistory: '#45B7D1'
        },
        customMappings: {}
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid date format'))).toBe(true);
    });

    it('should detect invalid color formats', () => {
      const invalidConfig: ParserConfig = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
          rxTba: 'invalid-color',
          rxHistory: '#4ECDC4',
          medHistory: '#45B7D1'
        },
        customMappings: {}
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid color for rxTba'))).toBe(true);
    });

    it('should validate various hex color formats', () => {
      const validConfig: ParserConfig = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
          rxTba: '#FFF',      // 3-digit hex
          rxHistory: '#4ECDC4', // 6-digit hex
          medHistory: '#45B7D1'
        },
        customMappings: {}
      };

      const result = configManager.validateConfig(validConfig);

      expect(result.isValid).toBe(true);
    });

    it('should detect invalid custom mappings', () => {
      const invalidConfig: ParserConfig = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
          rxTba: '#FF6B6B',
          rxHistory: '#4ECDC4',
          medHistory: '#45B7D1'
        },
        customMappings: {
          '': 'empty-key',
          'valid-key': '',
          'another-valid': 'valid-value'
        }
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Custom mapping keys and values cannot be empty'))).toBe(true);
    });

    it('should validate all supported date formats', () => {
      const supportedFormats = [
        'YYYY-MM-DD',
        'MM/DD/YYYY',
        'DD-MM-YYYY',
        'YYYY/MM/DD',
        'DD/MM/YYYY',
        'MM-DD-YYYY'
      ];

      supportedFormats.forEach(format => {
        const config: ParserConfig = {
          rxTbaPath: 'rxTba',
          rxHistoryPath: 'rxHistory',
          medHistoryPath: 'medHistory',
          dateFormat: format,
          colors: {
            rxTba: '#FF6B6B',
            rxHistory: '#4ECDC4',
            medHistory: '#45B7D1'
          },
          customMappings: {}
        };

        const result = configManager.validateConfig(config);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('getDefaultConfig', () => {
    it('should return a copy of default configuration', () => {
      const defaultConfig = configManager.getDefaultConfig();

      expect(defaultConfig).toEqual({
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
      });

      // Ensure it's a copy, not a reference
      defaultConfig.rxTbaPath = 'modified';
      const anotherDefault = configManager.getDefaultConfig();
      expect(anotherDefault.rxTbaPath).toBe('rxTba');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all configuration to defaults', async () => {
      mockWorkspaceConfig.update.mockResolvedValue(undefined);

      await configManager.resetToDefaults();

      expect(mockWorkspaceConfig.update).toHaveBeenCalledTimes(6);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('rxTbaPath', 'rxTba', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('rxHistoryPath', 'rxHistory', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('medHistoryPath', 'medHistory', 2);
    });
  });
});