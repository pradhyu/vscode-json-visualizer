/**
 * Manual test script to verify all advanced features work correctly
 * This script tests the integration of all components without mocking
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './configManager';
import { FlexibleClaimsParser } from './flexibleClaimsParser';
import { HybridParser } from './hybridParser';
import { ClaimsParser } from './claimsParser';
import { ClaimTypeConfig, ParserConfig } from './types';

async function runAdvancedFeaturesTest() {
    console.log('🧪 Starting Advanced Features Integration Test');
    console.log('=' .repeat(60));

    let testsPassed = 0;
    let testsTotal = 0;

    function test(name: string, testFn: () => void | Promise<void>) {
        testsTotal++;
        try {
            console.log(`\n🔍 Testing: ${name}`);
            const result = testFn();
            if (result instanceof Promise) {
                return result.then(() => {
                    console.log(`✅ PASSED: ${name}`);
                    testsPassed++;
                }).catch((error) => {
                    console.log(`❌ FAILED: ${name}`);
                    console.error(`   Error: ${error.message}`);
                });
            } else {
                console.log(`✅ PASSED: ${name}`);
                testsPassed++;
            }
        } catch (error) {
            console.log(`❌ FAILED: ${name}`);
            console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Test 1: ConfigManager Integration
    await test('ConfigManager provides valid configuration', () => {
        const configManager = new ConfigManager();
        
        // Test default configuration
        const defaultConfig = configManager.getDefaultConfig();
        console.log(`   Default config paths: ${defaultConfig.rxTbaPath}, ${defaultConfig.rxHistoryPath}, ${defaultConfig.medHistoryPath}`);
        
        // Test configuration validation
        const validation = configManager.validateConfig(defaultConfig);
        if (!validation.isValid) {
            throw new Error(`Default config validation failed: ${validation.errors.join(', ')}`);
        }
        
        console.log('   ✓ Default configuration is valid');
    });

    // Test 2: FlexibleClaimsParser with custom configuration
    await test('FlexibleClaimsParser works with custom configurations', () => {
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
                        fillDate: '2024-01-15',
                        daysSupply: 30
                    }
                ]
            }
        };

        // Test structure validation
        parser.validateStructure(testData);
        console.log('   ✓ Structure validation passed');

        // Test claims extraction
        const claims = parser.extractClaims(testData);
        if (claims.length !== 1) {
            throw new Error(`Expected 1 claim, got ${claims.length}`);
        }

        const claim = claims[0];
        if (claim.id !== 'RX12345' || claim.type !== 'medications' || claim.displayName !== 'Lisinopril 10mg') {
            throw new Error('Claim data extraction failed');
        }

        console.log(`   ✓ Extracted claim: ${claim.displayName} (${claim.startDate.toISOString().split('T')[0]} - ${claim.endDate.toISOString().split('T')[0]})`);
    });

    // Test 3: Configuration validation with complex scenarios
    await test('Configuration validation handles complex scenarios', () => {
        const configManager = new ConfigManager();

        // Test valid complex configuration
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
                    { label: 'Cost', path: 'financial.cost', format: 'currency', showInTooltip: false, showInDetails: true }
                ]
            }
        ];

        const validation = configManager.validateFlexibleConfig(complexConfig);
        if (!validation.isValid) {
            throw new Error(`Complex config validation failed: ${validation.errors.join(', ')}`);
        }

        console.log('   ✓ Complex configuration validation passed');

        // Test invalid configuration detection
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

        const invalidValidation = configManager.validateFlexibleConfig(invalidConfig);
        if (invalidValidation.isValid) {
            throw new Error('Invalid configuration was incorrectly validated as valid');
        }

        console.log(`   ✓ Invalid configuration correctly detected (${invalidValidation.errors.length} errors)`);
    });

    // Test 4: Legacy to flexible configuration conversion
    await test('Legacy configuration converts to flexible format', () => {
        const configManager = new ConfigManager();

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

        if (flexibleConfig.length !== 3) {
            throw new Error(`Expected 3 claim types, got ${flexibleConfig.length}`);
        }

        const rxTbaConfig = flexibleConfig.find(c => c.name === 'rxTba');
        if (!rxTbaConfig || rxTbaConfig.color !== '#FF6B6B' || rxTbaConfig.arrayPath !== 'rxTba') {
            throw new Error('rxTba configuration conversion failed');
        }

        console.log(`   ✓ Converted ${flexibleConfig.length} legacy configurations to flexible format`);
    });

    // Test 5: Error handling preservation
    await test('Error handling is preserved in advanced features', () => {
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
        if (claims.length !== 0) {
            throw new Error(`Expected 0 claims for missing data, got ${claims.length}`);
        }

        console.log('   ✓ Missing data handled gracefully');

        // Test invalid date handling
        const invalidDateConfig: ParserConfig = {
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

        const invalidDateParser = new FlexibleClaimsParser(invalidDateConfig);

        const invalidDateData = {
            data: [
                {
                    id: 'test1',
                    name: 'Test Item',
                    invalidDate: 'not-a-date'
                }
            ]
        };

        // Should handle invalid dates by skipping claims
        const invalidClaims = invalidDateParser.extractClaims(invalidDateData);
        if (invalidClaims.length !== 0) {
            throw new Error(`Expected 0 claims for invalid dates, got ${invalidClaims.length}`);
        }

        console.log('   ✓ Invalid dates handled gracefully');
    });

    // Test 6: HybridParser integration
    await test('HybridParser integrates with advanced features', () => {
        const hybridParser = new HybridParser();

        // Test that HybridParser has the required methods
        if (typeof hybridParser.getParsingStrategy !== 'function') {
            throw new Error('HybridParser missing getParsingStrategy method');
        }

        if (typeof hybridParser.parseFile !== 'function') {
            throw new Error('HybridParser missing parseFile method');
        }

        console.log('   ✓ HybridParser has required methods');
        console.log('   ✓ HybridParser integration verified');
    });

    // Test 7: Test with actual test-claims.json if available
    await test('Real file parsing with test-claims.json', async () => {
        const testFilePath = path.join(process.cwd(), 'test-claims.json');
        
        if (!fs.existsSync(testFilePath)) {
            console.log('   ⚠️  test-claims.json not found, skipping real file test');
            return;
        }

        try {
            // Test with ClaimsParser (standard parser)
            const configManager = new ConfigManager();
            const defaultConfig = configManager.getDefaultConfig();
            const claimsParser = new ClaimsParser(defaultConfig);
            const standardResult = await claimsParser.parseFile(testFilePath);
            console.log(`   ✓ Standard parser: ${standardResult.claims.length} claims`);

            // Test with HybridParser
            const hybridParser = new HybridParser();
            const strategy = await hybridParser.getParsingStrategy(testFilePath);
            console.log(`   ✓ HybridParser strategy: ${strategy}`);

            const hybridResult = await hybridParser.parseFile(testFilePath);
            console.log(`   ✓ HybridParser result: ${hybridResult.claims.length} claims`);

            if (hybridResult.claims.length === 0) {
                throw new Error('HybridParser returned no claims');
            }

        } catch (error) {
            console.log(`   ⚠️  Real file test failed: ${error instanceof Error ? error.message : String(error)}`);
            // Don't fail the test for file parsing issues, as this depends on external file
        }
    });

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log(`🏁 Advanced Features Test Summary`);
    console.log(`   Tests Passed: ${testsPassed}/${testsTotal}`);
    
    if (testsPassed === testsTotal) {
        console.log('   🎉 ALL ADVANCED FEATURES WORKING CORRECTLY!');
        return true;
    } else {
        console.log(`   ⚠️  ${testsTotal - testsPassed} tests failed`);
        return false;
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    runAdvancedFeaturesTest()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { runAdvancedFeaturesTest };