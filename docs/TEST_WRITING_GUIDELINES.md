# Test Writing Guidelines

## Overview

This document provides specific guidelines for writing new tests in the Medical Claims Timeline extension. These guidelines are based on lessons learned from fixing 37 failing tests and establishing robust testing patterns.

## Before You Start

### Required Reading

1. [Test Patterns and Utilities Documentation](./TEST_PATTERNS_AND_UTILITIES.md)
2. [Parser Behavior Reference](./PARSER_BEHAVIOR_REFERENCE.md)

### Essential Imports

Always start your test files with these imports:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Date utilities - ALWAYS use these for date handling
import { 
    createParserDate, 
    expectDateToEqual, 
    calculateEndDate 
} from './test-utils/dateUtils';

// Mock utilities - Use instead of manual mocking
import { 
    createTestEnvironment,
    setupVSCodeMocks,
    setupFsMocks 
} from './test-utils/mockUtils';

// Test data - Use instead of hardcoded data
import { 
    STANDARD_TEST_DATA,
    generateTestData,
    generateExpectedTimelineData 
} from './test-utils/testDataUtils';
```

## Test Structure Guidelines

### Standard Test File Structure

```typescript
import { /* imports */ } from './test-utils';

// Mock external dependencies
vi.mock('fs', () => setupFsMocks());
vi.mock('vscode', () => setupVSCodeMocks());

describe('YourComponent', () => {
    let component: YourComponent;
    let testEnv: any;

    beforeEach(() => {
        testEnv = createTestEnvironment();
        component = new YourComponent(mockConfig);
        vi.clearAllMocks();
    });

    afterEach(() => {
        testEnv.reset();
    });

    describe('feature group', () => {
        it('should do something specific', async () => {
            // Arrange
            const inputData = generateTestData({ rxTbaCount: 2 });
            const expectedOutput = generateExpectedTimelineData(inputData);
            
            // Act
            const result = await component.process(inputData);
            
            // Assert
            expect(result).toEqual(expectedOutput);
        });
    });
});
```

### Test Naming Conventions

#### Describe Blocks
- Use the component/class name: `describe('ClaimsParser', () => {})`
- Use feature groups: `describe('date parsing', () => {})`
- Use method names: `describe('parseFile', () => {})`

#### Test Cases
- Use "should" statements: `it('should parse valid claims data', () => {})`
- Be specific: `it('should throw FileReadError for non-existent files', () => {})`
- Include context: `it('should sort claims by date descending when multiple claims exist', () => {})`

## Date Testing Guidelines

### ✅ DO: Use Date Utilities

```typescript
// Creating expected dates
const expectedDate = createParserDate('2024-01-15');
expect(claim.startDate).toEqual(expectedDate);

// Comparing dates
expectDateToEqual(claim.startDate, '2024-01-15');

// Calculating end dates
const expectedEndDate = calculateEndDate('2024-01-15', 30);
expect(claim.endDate).toEqual(expectedEndDate);
```

### ❌ DON'T: Create Raw Dates

```typescript
// These will fail in different timezones
const wrongDate = new Date('2024-01-15T00:00:00.000Z');
const alsoWrong = new Date('2024-01-15');
expect(claim.startDate).toEqual(wrongDate); // FAILS
```

### Date Range Testing

```typescript
it('should calculate correct date range for timeline', () => {
    const inputData = generateTestData({ rxTbaCount: 3 });
    const result = await parser.parseFile(JSON.stringify(inputData));
    
    // Verify date range spans all claims
    const allDates = result.claims.flatMap(c => [c.startDate, c.endDate]);
    const expectedStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const expectedEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    expect(result.dateRange.start).toEqual(expectedStart);
    expect(result.dateRange.end).toEqual(expectedEnd);
});
```

## Mock Configuration Guidelines

### ✅ DO: Use Standardized Mocks

```typescript
// Complete mock setup
const testEnv = createTestEnvironment({
    mockData: customData,
    fsReturnValue: JSON.stringify(testData)
});

// Scenario-specific setup
const testEnv = setupIntegrationTestEnvironment({
    expectCommandRegistration: true,
    mockFileContent: JSON.stringify(STANDARD_TEST_DATA)
});
```

### ❌ DON'T: Create Incomplete Mocks

```typescript
// This will cause test failures
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn()
        // Missing other required methods
    }
}));
```

### File System Mock Configuration

```typescript
describe('file operations', () => {
    it('should read file successfully', async () => {
        const testData = generateTestData({ rxTbaCount: 1 });
        testEnv.expectFileRead('test.json', JSON.stringify(testData));
        
        const result = await parser.parseFile('test.json');
        expect(result).toBeDefined();
    });

    it('should handle file not found', async () => {
        testEnv.expectFileError('ENOENT');
        
        await expect(parser.parseFile('missing.json'))
            .rejects.toThrow('ENOENT');
    });
});
```

## Test Data Guidelines

### ✅ DO: Use Test Data Generators

```typescript
// Standard data for basic tests
const data = STANDARD_TEST_DATA;

// Custom data for specific scenarios
const largeData = generateTestData({
    rxTbaCount: 100,
    rxHistoryCount: 50,
    medHistoryCount: 25
});

// Error scenario data
const invalidData = generateTestData({
    includeInvalidData: true
});
```

### ❌ DON'T: Hardcode Test Data

```typescript
// This may not match parser expectations
const hardcodedData = {
    rxTba: [
        { id: 'rx1', dos: '2024-01-01' } // Missing required fields
    ]
};
```

### Expected Output Generation

```typescript
it('should generate correct timeline data', async () => {
    const inputData = generateTestData({ rxTbaCount: 2, medHistoryCount: 1 });
    const expectedOutput = generateExpectedTimelineData(inputData);
    
    testEnv.expectFileRead('test.json', JSON.stringify(inputData));
    
    const result = await parser.parseFile('test.json');
    expect(result).toEqual(expectedOutput);
});
```

## Error Testing Guidelines

### Error Type Testing

```typescript
describe('error handling', () => {
    it('should throw FileReadError for file system errors', async () => {
        const error = new Error('ENOENT: no such file or directory');
        (error as any).code = 'ENOENT';
        testEnv.fs.readFileSync.mockImplementation(() => { throw error; });
        
        await expect(parser.parseFile('missing.json'))
            .rejects.toThrow('ENOENT');
    });

    it('should throw SyntaxError for invalid JSON', async () => {
        testEnv.expectFileRead('invalid.json', '{ invalid json }');
        
        await expect(parser.parseFile('invalid.json'))
            .rejects.toThrow('Unexpected token');
    });
});
```

### Error Message Testing

```typescript
// ✅ DO: Test error patterns, not exact messages
await expect(parser.parseFile('bad.json')).rejects.toThrow(/JSON/);
await expect(parser.parseFile('bad.json')).rejects.toBeInstanceOf(SyntaxError);

// ❌ DON'T: Test exact error messages (they may change)
await expect(parser.parseFile('bad.json')).rejects.toThrow('Unexpected token in JSON at position 2');
```

## Performance Testing Guidelines

### Realistic Thresholds

```typescript
describe('performance', () => {
    it('should process large datasets within reasonable time', async () => {
        const largeData = createPerformanceTestData('large');
        const startTime = Date.now();
        
        const result = await parser.parseFile(JSON.stringify(largeData));
        const duration = Date.now() - startTime;
        
        // Reasonable threshold - not too strict
        expect(duration).toBeLessThan(5000); // 5 seconds
        expect(result.claims.length).toBeGreaterThan(1000);
    });
});
```

### Memory Testing

```typescript
it('should not leak memory with repeated operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform multiple operations
    for (let i = 0; i < 50; i++) {
        const data = generateTestData({ rxTbaCount: 10 });
        await parser.parseFile(JSON.stringify(data));
    }
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Reasonable memory increase threshold
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
});
```

## Integration Testing Guidelines

### Extension Activation Testing

```typescript
describe('extension activation', () => {
    let context: any;
    let testEnv: any;

    beforeEach(() => {
        testEnv = setupIntegrationTestEnvironment({
            expectCommandRegistration: true
        });
        context = testEnv.context;
    });

    it('should register all required commands', async () => {
        await activate(context);
        
        expect(testEnv.vscode.commands.registerCommand).toHaveBeenCalledWith(
            'medicalClaimsTimeline.openTimeline',
            expect.any(Function)
        );
        
        expect(testEnv.vscode.commands.registerCommand).toHaveBeenCalledWith(
            'medicalClaimsTimeline.refreshTimeline',
            expect.any(Function)
        );
        
        // Verify subscription tracking
        expect(context.subscriptions).toHaveLength(2);
    });
});
```

### Webview Testing

```typescript
it('should create webview with correct configuration', async () => {
    const renderer = new TimelineRenderer(context);
    await renderer.showTimeline('test.json');
    
    expect(testEnv.vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'medicalClaimsTimeline',
        'Medical Claims Timeline',
        testEnv.vscode.ViewColumn.One,
        expect.objectContaining({
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: expect.any(Array)
        })
    );
});
```

## Sorting and Ordering Guidelines

### Timeline Sorting Tests

```typescript
it('should sort claims by start date descending', async () => {
    const inputData = {
        rxTba: [
            { id: 'rx1', dos: '2024-01-15', medication: 'Med 1', dayssupply: 30 },
            { id: 'rx2', dos: '2024-03-01', medication: 'Med 2', dayssupply: 30 },
            { id: 'rx3', dos: '2024-02-10', medication: 'Med 3', dayssupply: 30 }
        ]
    };
    
    const result = await parser.parseFile(JSON.stringify(inputData));
    
    // Expected order: 2024-03-01, 2024-02-10, 2024-01-15 (most recent first)
    expectDateToEqual(result.claims[0].startDate, '2024-03-01');
    expectDateToEqual(result.claims[1].startDate, '2024-02-10');
    expectDateToEqual(result.claims[2].startDate, '2024-01-15');
});
```

## Validation Testing Guidelines

### Structure Validation

```typescript
describe('structure validation', () => {
    it('should accept valid medical data structure', () => {
        const validData = generateTestData({ rxTbaCount: 1 });
        expect(parser.validateStructure(validData)).toBe(true);
    });

    it('should reject non-medical data structure', () => {
        const invalidData = {
            users: [{ id: 1, name: 'John' }],
            products: [{ id: 1, name: 'Widget' }]
        };
        expect(parser.validateStructure(invalidData)).toBe(false);
    });

    it('should reject empty data', () => {
        expect(parser.validateStructure({})).toBe(false);
    });
});
```

### Field Validation

```typescript
describe('field validation', () => {
    it('should filter out claims with missing required fields', async () => {
        const dataWithMissingFields = {
            rxTba: [
                { id: 'rx1', dos: '2024-01-15', medication: 'Valid Med', dayssupply: 30 },
                { id: 'rx2', medication: 'Invalid - no date' }, // Missing dos
                { dos: '2024-01-16', dayssupply: 30 } // Missing id and medication
            ]
        };
        
        const result = await parser.parseFile(JSON.stringify(dataWithMissingFields));
        
        // Only the valid claim should be included
        expect(result.claims).toHaveLength(1);
        expect(result.claims[0].id).toBe('rx1');
    });
});
```

## Common Pitfalls to Avoid

### 1. Timezone-Dependent Tests

```typescript
// ❌ DON'T: This fails in different timezones
expect(claim.startDate).toEqual(new Date('2024-01-15T00:00:00.000Z'));

// ✅ DO: Use timezone-agnostic utilities
expectDateToEqual(claim.startDate, '2024-01-15');
```

### 2. Incomplete Mock Setup

```typescript
// ❌ DON'T: Partial mocks cause failures
vi.mock('vscode', () => ({
    window: { showErrorMessage: vi.fn() }
}));

// ✅ DO: Use complete mock utilities
vi.mock('vscode', () => setupVSCodeMocks());
```

### 3. Hardcoded Test Data

```typescript
// ❌ DON'T: May not match parser expectations
const testData = { rxTba: [{ id: 'rx1' }] };

// ✅ DO: Use data generators
const testData = generateTestData({ rxTbaCount: 1 });
```

### 4. Wrong Sorting Expectations

```typescript
// ❌ DON'T: Assume input order is preserved
expect(result.claims[0].id).toBe('rx1'); // First in input

// ✅ DO: Expect date-based sorting
expectDateToEqual(result.claims[0].startDate, '2024-03-01'); // Most recent
```

### 5. Strict Performance Thresholds

```typescript
// ❌ DON'T: Too strict, may fail on slower systems
expect(duration).toBeLessThan(100); // 100ms

// ✅ DO: Use reasonable thresholds
expect(duration).toBeLessThan(5000); // 5 seconds for large datasets
```

## Test Review Checklist

Before submitting tests, verify:

- [ ] Uses `createParserDate()` for all expected dates
- [ ] Uses `expectDateToEqual()` for date comparisons
- [ ] Uses standardized mock utilities (`createTestEnvironment`, etc.)
- [ ] Uses test data generators instead of hardcoded data
- [ ] Tests error types, not exact error messages
- [ ] Uses reasonable performance thresholds
- [ ] Follows the standard test file structure
- [ ] Includes proper cleanup in `afterEach`
- [ ] Tests the actual parser behavior, not assumptions
- [ ] Covers both success and error scenarios

## Getting Help

If you encounter test failures:

1. **Check the date handling** - Most failures are timezone-related
2. **Verify mock completeness** - Ensure all required methods are mocked
3. **Review parser behavior** - Consult the Parser Behavior Reference
4. **Use debugging utilities** - `validateTestDataStructure()`, `validateTimelineDates()`
5. **Ask for review** - Have someone familiar with the testing patterns review your tests

## Examples Repository

For complete examples of well-written tests, refer to:

- `src/claimsParser.test.ts` - Basic parser testing patterns
- `src/error-handling.test.ts` - Error scenario testing
- `src/integration.test.ts` - Integration testing patterns
- `src/performance.test.ts` - Performance testing examples

These files demonstrate the correct application of all the guidelines in this document.