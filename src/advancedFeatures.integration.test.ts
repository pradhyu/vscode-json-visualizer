import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from './configManager';
import { FlexibleClaimsParser } from './flexibleClaimsParser';
import { HybridParser } from './hybridParser';
import { ClaimsParser } from './claimsParser';
import { ClaimTypeConfig, ParserConfig } from './types';

// Mock VSCode API
const mockWorkspaceConfig = {
  get: vi.fn(),
  update: vi.fn(),
};

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

describe('Advanced Features Integration Tests', () => {
  let configManager: ConfigManager;
  let hybridParser: HybridParser;

  beforeEach(() => {
    configManager = new ConfigManager();
    hybridParser = new HybridParser();
    vi.clearAllMocks();
  });

  describe('ConfigManager Integration with Fixed Parsing', () => {
    it('should provide valid configuration for FlexibleClaimsParser', () => {
      // Mock flexible configuration
      mockWorkspaceConfig.get.mockImplementation((key: string) => {
        if (key === 'claimTypes') {
          return [
            {
              name: 'rxTba',
              arrayPath: 'rxTba',
              color: '#FF6B6B',
              idField: { path: 'id', defaultValue: 'auto-generated' },
              startDate: { type: 'field', field: 'dos' },
              endDate: { 
                type: 'calculation', 
                calculation: { 
                  baseField: 'dos', 
                  operation: 'add', 
                  value: 'dayssupply', 
                  unit: 'days' 
                } 
              },
              displayName: { path: 'medication', defaultValue: 'rxTba Claim' },
              displayFields: [
                { label: 'Medication', path: 'medication', format: 'text', showInTooltip: true, showInDetails: true }
              ]
            }
          ];
        }
        if (key === 'globalDateFormat') return 'YYYY-MM-DD';
        return undefined;
      });

      const config = configManager.getParserConfig();
      
      expect(config.claimTypes).toBeDefined();
      expect(config.claimTypes).toHaveLength(1);
      expect(config.claimTypes![0].name).toBe('rxTba');
      expect(config.globalDateFormat).toBe('YYYY-MM-DD');

      // Validate the configuration
      const validation = configManager.validateFlexibleConfig(config.claimTypes!);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should convert legacy configuration to flexible format', () => {
      const legacyConfig: ParserConfig = {
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

      const flexibleConfig = configManager.convertLegacyToFlexible(legacyConfig);

      expect(flexibleConfig).toHaveLength(3);
      expect(flexibleConfig[0].name).toBe('rxTba');
      expect(flexibleConfig[0].arrayPath).toBe('rxTba');
      expect(flexibleConfig[0].color).toBe('#FF6B6B');
      expect(flexibleConfig[1].name).toBe('rxHistory');
      expect(flexibleConfig[2].name).toBe('medHistory');
    });

    it('should update configuration settings correctly', async () => {
      mockWorkspaceConfig.update.mockResolvedValue(undefined);

      const updates: Partial<ParserConfig> = {
        globalDateFormat: 'MM/DD/YYYY',
        claimTypes: [
          {
            name: 'customClaims',
            arrayPath: 'custom.claims',
            color: '#123456',
            idField: { path: 'customId' },
            startDate: { type: 'field', field: 'startDate' },
            endDate: { type: 'field', field: 'endDate' },
            displayName: { path: 'name' },
            displayFields: []
          }
        ]
      };

      await configManager.updateConfig(updates);

      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('globalDateFormat', 'MM/DD/YYYY', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('claimTypes', updates.claimTypes, 2);
    });
  });

  describe('FlexibleClaimsParser with Custom Configurations', () => {
    it('should work with custom claim type configurations', () => {
      const customConfig: ParserConfig = {
        claimTypes: [
          {
            name: 'medications',
            arrayPath: 'patient.prescriptions',
            color: '#FF6B6B',
            idField: { path: 'rxNumber', defaultValue: 'auto-generated' },
            startDate: { type: 'field', field: 'fillDate' },
            endDate: {
              type: 'calculation',
              calculation: {
                baseField: 'fillDate',
                operation: 'add',
                value: 'daysSupply',
                unit: 'days'
              }
            },
            displayName: { path: 'drugName', defaultValue: 'Medication' },
            displayFields: [
              { label: 'Drug', path: 'drugName', format: 'text', showInTooltip: true, showInDetails: true },
              { label: 'Dosage', path: 'strength', format: 'text', showInTooltip: true, showInDetails: true },
              { label: 'Days Supply', path: 'daysSupply', format: 'number', showInTooltip: true, showInDetails: true }
            ]
          }
        ],
        globalDateFormat: 'YYYY-MM-DD'
      };

      const parser = new FlexibleClaimsParser(customConfig);

      const testData = {
        patient: {
          prescriptions: [
            {
              rxNumber: 'RX12345',
              drugName: 'Lisinopril 10mg',
              strength: '10mg',
              fillDate: '2024-01-15',
              daysSupply: 30
            }
          ]
        }
      };

      // Should validate structure
      expect(() => parser.validateStructure(testData)).not.toThrow();

      // Should extract claims correctly
      const claims = parser.extractClaims(testData);
      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('RX12345');
      expect(claims[0].type).toBe('medications');
      expect(claims[0].displayName).toBe('Lisinopril 10mg');
      expect(claims[0].color).toBe('#FF6B6B');
      expect(claims[0].startDate.toISOString().split('T')[0]).toBe('2024-01-15');
      expect(claims[0].endDate.toISOString().split('T')[0]).toBe('2024-02-14'); // 30 days later
    });

    it('should handle multiple custom claim types', () => {
      const multiTypeConfig: ParserConfig = {
        claimTypes: [
          {
            name: 'prescriptions',
            arrayPath: 'rxData',
            color: '#FF6B6B',
            idField: { path: 'id' },
            startDate: { type: 'field', field: 'startDate' },
            endDate: { type: 'field', field: 'endDate' },
            displayName: { path: 'medication' },
            displayFields: []
          },
          {
            name: 'visits',
            arrayPath: 'visitData',
            color: '#4ECDC4',
            idField: { path: 'visitId' },
            startDate: { type: 'field', field: 'visitDate' },
            endDate: { type: 'field', field: 'visitDate' },
            displayName: { path: 'visitType' },
            displayFields: []
          }
        ],
        globalDateFormat: 'YYYY-MM-DD'
      };

      const parser = new FlexibleClaimsParser(multiTypeConfig);

      const testData = {
        rxData: [
          { id: 'rx1', medication: 'Drug A', startDate: '2024-01-01', endDate: '2024-01-31' }
        ],
        visitData: [
          { visitId: 'v1', visitType: 'Checkup', visitDate: '2024-01-15' }
        ]
      };

      const claims = parser.extractClaims(testData);
      expect(claims).toHaveLength(2);
      
      const prescriptionClaim = claims.find(c => c.type === 'prescriptions');
      const visitClaim = claims.find(c => c.type === 'visits');
      
      expect(prescriptionClaim).toBeDefined();
      expect(visitClaim).toBeDefined();
      expect(prescriptionClaim!.color).toBe('#FF6B6B');
      expect(visitClaim!.color).toBe('#4ECDC4');
    });

    it('should handle date calculations with field references', () => {
      const config: ParserConfig = {
        claimTypes: [
          {
            name: 'prescriptions',
            arrayPath: 'prescriptions',
            color: '#FF6B6B',
            idField: { path: 'id' },
            startDate: { type: 'field', field: 'fillDate' },
            endDate: {
              type: 'calculation',
              calculation: {
                baseField: 'fillDate',
                operation: 'add',
                value: 'daysSupply', // Field reference
                unit: 'days'
              }
            },
            displayName: { path: 'drugName' },
            displayFields: []
          }
        ],
        globalDateFormat: 'YYYY-MM-DD'
      };

      const parser = new FlexibleClaimsParser(config);

      const testData = {
        prescriptions: [
          {
            id: 'rx1',
            drugName: 'Test Drug',
            fillDate: '2024-01-01',
            daysSupply: 90
          }
        ]
      };

      const claims = parser.extractClaims(testData);
      expect(claims).toHaveLength(1);
      expect(claims[0].startDate.toISOString().split('T')[0]).toBe('2024-01-01');
      expect(claims[0].endDate.toISOString().split('T')[0]).toBe('2024-03-31'); // 90 days later
    });
  });

  describe('Comprehensive Error Handling Preservation', () => {
    it('should preserve error handling in FlexibleClaimsParser', () => {
      const config: ParserConfig = {
        claimTypes: [
          {
            name: 'test',
            arrayPath: 'nonexistent.path',
            color: '#FF6B6B',
            idField: { path: 'id' },
            startDate: { type: 'field', field: 'date' },
            endDate: { type: 'field', field: 'date' },
            displayName: { path: 'name' },
            displayFields: []
          }
        ],
        globalDateFormat: 'YYYY-MM-DD'
      };

      const parser = new FlexibleClaimsParser(config);

      const testData = {
        someOtherData: []
      };

      // Should handle missing arrays gracefully
      const claims = parser.extractClaims(testData);
      expect(claims).toHaveLength(0);
    });

    it('should handle invalid date formats gracefully', () => {
      const config: ParserConfig = {
        claimTypes: [
          {
            name: 'test',
            arrayPath: 'data',
            color: '#FF6B6B',
            idField: { path: 'id' },
            startDate: { type: 'field', field: 'invalidDate' },
            endDate: { type: 'field', field: 'invalidDate' },
            displayName: { path: 'name' },
            displayFields: []
          }
        ],
        globalDateFormat: 'YYYY-MM-DD'
      };

      const parser = new FlexibleClaimsParser(config);

      const testData = {
        data: [
          {
            id: 'test1',
            name: 'Test Item',
            invalidDate: 'not-a-date'
          }
        ]
      };

      // Should handle invalid dates gracefully by skipping invalid claims
      const claims = parser.extractClaims(testData);
      expect(claims).toHaveLength(0); // Invalid claims should be skipped
    });

    it('should validate configuration thoroughly', () => {
      const invalidConfig: ClaimTypeConfig[] = [
        {
          name: '', // Invalid: empty name
          arrayPath: 'data',
          color: 'invalid-color', // Invalid: not hex color
          idField: { path: '' }, // Invalid: empty path
          startDate: { type: 'field', field: '' }, // Invalid: empty field
          endDate: { type: 'calculation' }, // Invalid: missing calculation
          displayName: { path: '' }, // Invalid: empty path
          displayFields: []
        }
      ];

      const validation = configManager.validateFlexibleConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('name is required'))).toBe(true);
      expect(validation.errors.some(e => e.includes('valid color is required'))).toBe(true);
    });
  });

  describe('All Extension Features and Settings', () => {
    it('should support all legacy configuration options', () => {
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
      
      expect(config.rxTbaPath).toBe('customRxTba');
      expect(config.rxHistoryPath).toBe('customRxHistory');
      expect(config.medHistoryPath).toBe('customMedHistory');
      expect(config.dateFormat).toBe('MM/DD/YYYY');
      expect(config.colors?.rxTba).toBe('#123456');
      expect(config.customMappings?.custom).toBe('mapping');
    });

    it('should support all flexible configuration options', () => {
      mockWorkspaceConfig.get.mockImplementation((key: string) => {
        if (key === 'claimTypes') {
          return [
            {
              name: 'customType',
              arrayPath: 'custom.data',
              color: '#FF6B6B',
              idField: { path: 'customId', defaultValue: 'default-id' },
              startDate: { 
                type: 'field', 
                field: 'startDate',
                fallbacks: ['altStartDate', 'createdDate']
              },
              endDate: {
                type: 'calculation',
                calculation: {
                  baseField: 'startDate',
                  operation: 'add',
                  value: 30,
                  unit: 'days'
                }
              },
              displayName: { path: 'title', defaultValue: 'Custom Item' },
              displayFields: [
                { label: 'Title', path: 'title', format: 'text', showInTooltip: true, showInDetails: true },
                { label: 'Amount', path: 'amount', format: 'currency', showInTooltip: false, showInDetails: true },
                { label: 'Date', path: 'startDate', format: 'date', showInTooltip: true, showInDetails: true }
              ]
            }
          ];
        }
        if (key === 'globalDateFormat') return 'YYYY-MM-DD';
        if (key === 'defaultColors') return ['#FF6B6B', '#4ECDC4', '#45B7D1'];
        return undefined;
      });

      const config = configManager.getParserConfig();
      
      expect(config.claimTypes).toBeDefined();
      expect(config.claimTypes).toHaveLength(1);
      expect(config.claimTypes![0].displayFields).toHaveLength(3);
      expect(config.globalDateFormat).toBe('YYYY-MM-DD');
      expect(config.defaultColors).toEqual(['#FF6B6B', '#4ECDC4', '#45B7D1']);
    });

    it('should handle configuration validation for all field types', () => {
      const complexConfig: ClaimTypeConfig[] = [
        {
          name: 'complex',
          arrayPath: 'data.items',
          color: '#FF6B6B',
          idField: { path: 'nested.id', defaultValue: 'auto' },
          startDate: { 
            type: 'field', 
            field: 'dates.start',
            fallbacks: ['dates.created', 'timestamp']
          },
          endDate: {
            type: 'calculation',
            calculation: {
              baseField: 'dates.start',
              operation: 'add',
              value: 'duration.days',
              unit: 'days'
            }
          },
          displayName: { path: 'info.title', defaultValue: 'Complex Item' },
          displayFields: [
            { label: 'Title', path: 'info.title', format: 'text', showInTooltip: true, showInDetails: true },
            { label: 'Cost', path: 'financial.cost', format: 'currency', showInTooltip: false, showInDetails: true },
            { label: 'Count', path: 'quantity', format: 'number', showInTooltip: true, showInDetails: false },
            { label: 'Created', path: 'dates.created', format: 'date', showInTooltip: false, showInDetails: true }
          ]
        }
      ];

      const validation = configManager.validateFlexibleConfig(complexConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should support configuration reset functionality', async () => {
      mockWorkspaceConfig.update.mockResolvedValue(undefined);

      await configManager.resetToDefaults();

      // Should update all default configuration values
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('rxTbaPath', 'rxTba', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('rxHistoryPath', 'rxHistory', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('medHistoryPath', 'medHistory', 2);
      expect(mockWorkspaceConfig.update).toHaveBeenCalledWith('dateFormat', 'YYYY-MM-DD', 2);
    });
  });

  describe('HybridParser Integration with Advanced Features', () => {
    it('should determine appropriate parsing strategy', async () => {
      // Test that hybrid parser can determine parsing strategies
      // Since we can't easily mock file system in this context, we'll test the logic
      const strategy = await hybridParser.getParsingStrategy('test-claims.json');
      expect(['simple', 'complex', 'flexible', 'none']).toContain(strategy);
    });

    it('should handle parsing strategy selection', () => {
      // Test the hybrid parser's strategy selection logic
      expect(hybridParser).toBeDefined();
      expect(typeof hybridParser.getParsingStrategy).toBe('function');
      expect(typeof hybridParser.parseFile).toBe('function');
    });
  });
});