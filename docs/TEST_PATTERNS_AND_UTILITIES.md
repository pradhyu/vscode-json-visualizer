# Test Patterns and Utilities Documentation

## Overview

This document provides comprehensive guidelines for writing tests in the Medical Claims Timeline extension. It covers the standardized test utilities, common patterns, and best practices to avoid the pitfalls that led to the 37 failing tests that were systematically fixed.

## Table of Contents

1. [Date Handling Patterns](#date-handling-patterns)
2. [Mock Configuration Utilities](#mock-configuration-utilities)
3. [Test Data Generation](#test-data-generation)
4. [Common Test Patterns](#common-test-patterns)
5. [Error Testing Guidelines](#error-testing-guidelines)
6. [Performance Testing Patterns](#performance-testing-patterns)
7. [Integration Testing Setup](#integration-testing-setup)
8. [Best Practices and Pitfalls to Avoid](#best-practices-and-pitfalls-to-avoid)

## Date Handling Patterns

### The Core Issue

The most common cause of test failures was timezone-related date handling. The parsers normalize dates to local midnight using `new Date(year, month, date)`, but tests often expected UTC dates.

### Date Utility Functions

#### `createParserDate(dateString: string): Date`

Creates dates that match parser behavior - normalized to local midnight.

```typescript
import { createParserDate } from './test-utils/dateUtils';

// ✅ Correct - matches parser behavior
const expectedDate = createParserDate('2024-01-15');
expect(claim.startDate).toEqual(expectedDate);

// ❌ Wrong - creates UTC date, will fail in different timezones
const wrongDate = new Date('2024-01-15T00:00:00.000Z');
expect(claim.startDate).toEqual(wrongDate); // Fails in non-UTC timezones
```

#### `expectDateToEqual(actual: Date, expected: string): void`

Compares dates with timezone tolerance.

```typescript
import { expectDateToEqual } from './test-utils/dateUtils';

// ✅ Correct - timezone-safe comparison
expectDateToEqual(claim.startDate, '2024-01-15');

// ❌ Wrong - direct comparison fails across timezones
expect(claim.startDate).toEqual(new Date('2024-01-15'));
```

#### `calculateEndDate(startDateString: string, daysSupply: number): Date`

Calculates end dates matching parser logic.

```typescript
import { calculateEndDate } from './test-utils/dateUtils';

// ✅ Correct - matches parser calculation
const expectedEndDate = calculateEndDate('2024-01-15', 30);
expect(claim.endDate).toEqual(expectedEndDate);
```

### Date Testing Best Practices

1. **Always use `createParserDate()` for expected dates**
2. **Use `expectDateToEqual()` for date comparisons**
3. **Test date ranges with `createDateRange()`**
4. **Validate timeline dates with `validateTimelineDates()`**

## Mock Configuration Utilities

### File System Mocks

#### `setupFsMocks()`

Provides complete fs mock with both sync and async operations.

```typescript
import { setupFsMocks } from './test-utils/mockUtils';

const fsMocks = setupFsMocks();

// Configure return values
fsMocks.readFileSync.mockReturnValue('{"test": "data"}');
fsMocks.promises.readFile.mockResolvedValue('{"test": "data"}');

// Configure errors
const error = new Error('ENOENT: no such file or directory');
(error as any).code = 'ENOENT';
fsMocks.readFileSync.mockImplementation(() => { throw error; });
```

### VSCode API Mocks

#### `setupVSCodeMocks()`

Provides complete VSCode API mock with all required methods.

```typescript
import { setupVSCodeMocks } from './test-utils/mockUtils';

const vscodeMocks = setupVSCodeMocks();

// Mock is pre-configured with all common methods
expect(vscodeMocks.window.createWebviewPanel).toBeDefined();
expect(vscodeMocks.commands.registerCommand).toBeDefined();
expect(vscodeMocks.workspace.getConfiguration).toBeDefined();
```

### Complete Test Environment

#### `createTestEnvironment(options)`

Sets up complete mock environment for testing.

```typescript
import { createTestEnvironment } from './test-utils/mockUtils';

// Basic setup
const env = createTestEnvironment();

// With custom data
const env = createTestEnvironment({
    mockData: customTimelineData,
    fsReturnValue: JSON.stringify(testData)
});

// With error simulation
const env = createTestEnvironment({
    shouldThrowError: true,
    errorType: 'ENOENT'
});
```

## Test Data Generation

### Standard Test Data

#### `STANDARD_TEST_DATA`

Pre-configured test data that matches all parser expectations.

```typescript
import { STANDARD_TEST_DATA } from './test-utils/testDataUtils';

// Use standard data for consistent testing
const result = await parser.parseFile(JSON.stringify(STANDARD_TEST_DATA));
```

#### `generateTestData(options)`

Generates custom test data with specific characteristics.

```typescript
import { generateTestData } from './test-utils/testDataUtils';

// Generate large dataset for performance testing
const largeData = generateTestData({
    rxTbaCount: 1000,
    rxHistoryCount: 1000,
    medHistoryCount: 500
});

// Generate data with missing fields for error testing
const incompleteData = generateTestData({
    includeMissingFields: true
});

// Generate data with invalid values
const invalidData = generateTestData({
    includeInvalidData: true
});
```

### Expected Timeline Data

#### `generateExpectedTimelineData(inputData)`

Generates expected timeline data structure from input data.

```typescript
import { generateExpectedTimelineData } from './test-utils/testDataUtils';

const inputData = generateTestData({ rxTbaCount: 2 });
const expectedOutput = generateExpectedTimelineData(inputData);

const result = await parser.parseFile(JSON.stringify(inputData));
expect(result).toEqual(expectedOutput);
```

## Common Test Patterns

### Basic Parser Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimsParser } from './claimsParser';
import { createTestEnvironment, generateTestData, generateExpectedTimelineData } from './test-utils';

describe('ClaimsParser', () => {
    let parser: ClaimsParser;
    let testEnv: any;

    beforeEach(() => {
        testEnv = createTestEnvironment();
        parser = new ClaimsParser(mockConfig);
        vi.clearAllMocks();
    });

    it('should parse valid claims data', async () => {
        const inputData = generateTestData({ rxTbaCount: 2 });
        const expectedOutput = generateExpectedTimelineData(inputData);
        
        testEnv.expectFileRead('test.json', JSON.stringify(inputData));
        
        const result = await parser.parseFile('test.json');
        expect(result).toEqual(expectedOutput);
    });
});
```

### Error Testing Pattern

```typescript
import { setupErrorTestEnvironment } from './test-utils/mockUtils';

describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
        const testEnv = setupErrorTestEnvironment('file-not-found');
        
        await expect(parser.parseFile('nonexistent.json'))
            .rejects.toThrow('ENOENT: no such file or directory');
    });

    it('should handle invalid JSON', async () => {
        const testEnv = setupErrorTestEnvironment('invalid-json');
        
        await expect(parser.parseFile('invalid.json'))
            .rejects.toThrow('Unexpected token');
    });
});
```

### Integration Test Pattern

```typescript
import { setupIntegrationTestEnvironment } from './test-utils/mockUtils';

describe('Extension Integration', () => {
    let context: any;
    let testEnv: any;

    beforeEach(() => {
        testEnv = setupIntegrationTestEnvironment({
            expectCommandRegistration: true,
            mockFileContent: JSON.stringify(STANDARD_TEST_DATA)
        });
        context = testEnv.context;
    });

    it('should register commands and track subscriptions', async () => {
        await activate(context);
        
        expect(testEnv.vscode.commands.registerCommand).toHaveBeenCalledTimes(2);
        expect(context.subscriptions).toHaveLength(2);
    });
});
```

## Error Testing Guidelines

### Error Types and Expected Behavior

The parsers throw specific error types that tests must expect:

#### File Read Errors
```typescript
// File not found
const enoentError = new Error('ENOENT: no such file or directory');
(enoentError as any).code = 'ENOENT';

// Permission denied
const eaccesError = new Error('EACCES: permission denied');
(eaccesError as any).code = 'EACCES';
```

#### JSON Parse Errors
```typescript
// Invalid JSON syntax
await expect(parser.parseFile('invalid.json'))
    .rejects.toThrow('Unexpected token');
```

#### Validation Errors
```typescript
// Structure validation failure
await expect(parser.parseFile('non-medical.json'))
    .rejects.toThrow('Structure validation failed');
```

### Error Testing Utilities

#### `setupErrorTestEnvironment(errorType)`

Pre-configured environments for different error scenarios.

```typescript
import { setupErrorTestEnvironment } from './test-utils/mockUtils';

// Test file not found
const env = setupErrorTestEnvironment('file-not-found');

// Test invalid JSON
const env = setupErrorTestEnvironment('invalid-json');

// Test permission denied
const env = setupErrorTestEnvironment('permission-denied');
```

## Performance Testing Patterns

### Large Dataset Testing

```typescript
import { createPerformanceTestData } from './test-utils/testDataUtils';

describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
        const largeData = createPerformanceTestData('large'); // 1000+ claims
        const startTime = Date.now();
        
        const result = await parser.parseFile(JSON.stringify(largeData));
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(5000); // 5 second threshold
        expect(result.claims.length).toBeGreaterThan(1000);
    });
});
```

### Memory Usage Testing

```typescript
it('should not leak memory with large datasets', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 100; i++) {
        const data = createPerformanceTestData('medium');
        await parser.parseFile(JSON.stringify(data));
    }
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
});
```

## Integration Testing Setup

### Extension Activation Testing

```typescript
import { setupIntegrationTestEnvironment } from './test-utils/mockUtils';

describe('Extension Activation', () => {
    it('should activate extension and register commands', async () => {
        const testEnv = setupIntegrationTestEnvironment({
            expectCommandRegistration: true
        });
        
        await activate(testEnv.context);
        
        // Verify commands are registered
        expect(testEnv.vscode.commands.registerCommand).toHaveBeenCalledWith(
            'medicalClaimsTimeline.openTimeline',
            expect.any(Function)
        );
        
        // Verify subscriptions are tracked
        expect(testEnv.context.subscriptions).toHaveLength(2);
    });
});
```

### Webview Testing

```typescript
it('should create and configure webview panel', async () => {
    const testEnv = setupIntegrationTestEnvironment({
        expectWebviewCreation: true,
        mockFileContent: JSON.stringify(STANDARD_TEST_DATA)
    });
    
    const renderer = new TimelineRenderer(testEnv.context);
    await renderer.showTimeline('test.json');
    
    expect(testEnv.vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'medicalClaimsTimeline',
        'Medical Claims Timeline',
        testEnv.vscode.ViewColumn.One,
        expect.objectContaining({
            enableScripts: true,
            retainContextWhenHidden: true
        })
    );
});
```

## Best Practices and Pitfalls to Avoid

### Date Handling Pitfalls

❌ **Don't create UTC dates for comparison**
```typescript
// This will fail in non-UTC timezones
const expected = new Date('2024-01-15T00:00:00.000Z');
expect(claim.startDate).toEqual(expected);
```

✅ **Use parser-compatible date creation**
```typescript
// This works across all timezones
const expected = createParserDate('2024-01-15');
expect(claim.startDate).toEqual(expected);
```

### Mock Configuration Pitfalls

❌ **Don't use incomplete mocks**
```typescript
// Missing required methods - will cause test failures
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn()
        // Missing other required methods
    }
}));
```

✅ **Use complete mock utilities**
```typescript
// Complete mock with all required methods
import { setupVSCodeMocks } from './test-utils/mockUtils';
vi.mock('vscode', () => setupVSCodeMocks());
```

### Test Data Pitfalls

❌ **Don't hardcode test data**
```typescript
// Hardcoded data may not match parser expectations
const testData = {
    rxTba: [{ id: 'rx1', dos: '2024-01-01' }] // Missing required fields
};
```

✅ **Use standardized test data generators**
```typescript
// Complete, valid test data
import { generateTestData } from './test-utils/testDataUtils';
const testData = generateTestData({ rxTbaCount: 1 });
```

### Sorting Expectations

❌ **Don't assume sorting order**
```typescript
// Parser sorts by date descending (most recent first)
expect(result.claims[0].startDate).toBe(oldestDate); // Wrong!
```

✅ **Use sorting utilities**
```typescript
// Correct sorting expectation
import { sortClaimsByDate } from './test-utils/dateUtils';
const expectedOrder = sortClaimsByDate(inputClaims);
expect(result.claims).toEqual(expectedOrder);
```

### Error Testing Pitfalls

❌ **Don't expect generic error messages**
```typescript
// Error messages may vary
await expect(parser.parseFile('bad.json')).rejects.toThrow('Error');
```

✅ **Test specific error types and patterns**
```typescript
// Test specific error characteristics
await expect(parser.parseFile('bad.json')).rejects.toThrow(/JSON/);
// Or test error type
await expect(parser.parseFile('bad.json')).rejects.toBeInstanceOf(SyntaxError);
```

### Performance Testing Pitfalls

❌ **Don't use unrealistic thresholds**
```typescript
// Too strict - may fail on slower systems
expect(duration).toBeLessThan(100); // 100ms is too strict
```

✅ **Use reasonable performance expectations**
```typescript
// Reasonable threshold for large datasets
expect(duration).toBeLessThan(5000); // 5 seconds for 1000+ claims
```

## Quick Reference

### Essential Imports

```typescript
// Date utilities
import { 
    createParserDate, 
    expectDateToEqual, 
    calculateEndDate,
    sortClaimsByDate 
} from './test-utils/dateUtils';

// Mock utilities
import { 
    createTestEnvironment,
    setupVSCodeMocks,
    setupFsMocks,
    setupIntegrationTestEnvironment 
} from './test-utils/mockUtils';

// Test data utilities
import { 
    STANDARD_TEST_DATA,
    generateTestData,
    generateExpectedTimelineData,
    createPerformanceTestData 
} from './test-utils/testDataUtils';
```

### Common Test Setup

```typescript
describe('YourTestSuite', () => {
    let testEnv: any;
    
    beforeEach(() => {
        testEnv = createTestEnvironment();
        vi.clearAllMocks();
    });
    
    afterEach(() => {
        testEnv.reset();
    });
});
```

### Debugging Failed Tests

1. **Check date expectations** - Use `createParserDate()` for expected dates
2. **Verify mock completeness** - Ensure all required methods are mocked
3. **Validate test data structure** - Use `validateTestDataStructure()`
4. **Check error types** - Verify expected error types match implementation
5. **Review sorting expectations** - Claims are sorted by date descending

## Conclusion

Following these patterns and using the provided utilities will help you write robust, reliable tests that work consistently across different environments. The utilities were developed by analyzing and fixing 37 failing tests, so they address real-world testing challenges in this codebase.

Remember: **Always use the standardized utilities rather than creating your own date handling, mocks, or test data**. This ensures consistency and prevents the common pitfalls that led to the original test failures.