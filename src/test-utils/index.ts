/**
 * Test utilities for consistent date handling, mocking, and test data generation
 * 
 * This module provides standardized utilities that match the parser's behavior
 * and ensure consistent testing across all test suites.
 */

// Date handling utilities
export {
    createParserDate,
    expectDateToEqual,
    createDateRange,
    calculateEndDate,
    parseDaysSupply,
    generateTestClaimData,
    generateMedHistoryTestData,
    validateTimelineDates,
    sortClaimsByDate,
    createComprehensiveTestData
} from './dateUtils';

// Mock configuration utilities
export {
    setupFsMocks,
    setupVSCodeMocks,
    setupParserMocks,
    setupExtensionContextMock,
    createTestEnvironment,
    createMockJsonData,
    assertVSCodeCalls,
    setupGlobalVSCodeMock,
    setupEnhancedExtensionContextMock,
    setupIntegrationTestEnvironment,
    setupErrorTestEnvironment,
    createAdditionalVSCodeMocks,
    createSubscriptionTrackingContext,
    setupParserErrorMocks,
    setupHybridParserMocks,
    setupTestScenarioMocks,
    createIntegrationMockEnvironment,
    createVSCodeModuleMock,
    createFsModuleMock
} from './mockUtils';

// Test data generation utilities
export {
    STANDARD_TEST_DATA,
    generateTestData,
    generateExpectedTimelineData,
    createErrorTestData,
    createPerformanceTestData,
    validateTestDataStructure
} from './testDataUtils';

/**
 * Quick setup function for common test scenarios
 * @param scenario Test scenario type
 * @returns Configured test environment
 */
export function setupTestScenario(scenario: 'basic' | 'error' | 'performance' | 'integration') {
    switch (scenario) {
        case 'basic':
            return createTestEnvironment({
                mockData: {
                    claims: [
                        {
                            id: 'test-1',
                            type: 'rxTba',
                            startDate: createParserDate('2024-01-15'),
                            endDate: createParserDate('2024-02-14'),
                            displayName: 'Test Medication',
                            color: '#FF6B6B',
                            details: { dosage: '10mg daily', daysSupply: 30 }
                        }
                    ],
                    dateRange: {
                        start: createParserDate('2024-01-15'),
                        end: createParserDate('2024-02-14')
                    },
                    metadata: { totalClaims: 1, claimTypes: ['rxTba'] }
                },
                fsReturnValue: createMockJsonData('valid')
            });

        case 'error':
            return createTestEnvironment({
                shouldThrowError: true,
                errorType: 'ENOENT'
            });

        case 'performance':
            return createTestEnvironment({
                mockData: generateExpectedTimelineData(createPerformanceTestData('large')),
                fsReturnValue: JSON.stringify(createPerformanceTestData('large'))
            });

        case 'integration':
            return createTestEnvironment({
                mockData: generateExpectedTimelineData(STANDARD_TEST_DATA),
                fsReturnValue: JSON.stringify(STANDARD_TEST_DATA)
            });

        default:
            return createTestEnvironment();
    }
}

// Re-export commonly used functions from dateUtils for convenience
import { createParserDate } from './dateUtils';
import { createTestEnvironment, createMockJsonData } from './mockUtils';
import { generateExpectedTimelineData, createPerformanceTestData, STANDARD_TEST_DATA } from './testDataUtils';