# Test Utilities

This directory contains standardized test utilities for the Medical Claims Timeline extension. These utilities were developed to address the common pitfalls that led to 37 failing tests and ensure consistent, reliable testing across all test suites.

## Overview

The test utilities are organized into three main categories:

1. **Date Handling** (`dateUtils.ts`) - Utilities that match the parser's date normalization behavior
2. **Mock Configuration** (`mockUtils.ts`) - Complete mock setups for external dependencies
3. **Test Data Generation** (`testDataUtils.ts`) - Standardized test data that matches parser expectations

## Quick Start

```typescript
import { 
    createParserDate, 
    expectDateToEqual,
    createTestEnvironment, 
    generateTestData,
    generateExpectedTimelineData
} from './test-utils';

// Basic test setup
const testEnv = createTestEnvironment();
const inputData = generateTestData({ rxTbaCount: 2 });
const expectedOutput = generateExpectedTimelineData(inputData);
```

## Date Handling Utilities (`dateUtils.ts`)

### Core Problem Solved
The parser normalizes dates to local midnight, but tests often expected UTC dates, causing failures across different timezones.

### Key Functions

#### `createParserDate(dateString: string): Date`
Creates dates that match parser behavior - normalized to local midnight.

```typescript
// ✅ Correct - matches parser behavior
const expectedDate = createParserDate('2024-01-15');
expect(claim.startDate).toEqual(expectedDate);

// ❌ Wrong - UTC date fails in non-UTC timezones
const wrongDate = new Date('2024-01-15T00:00:00.000Z');
```

#### `expectDateToEqual(actual: Date, expected: string): void`
Timezone-safe date comparison utility.

```typescript
// Safe comparison across all timezones
expectDateToEqual(claim.startDate, '2024-01-15');
```

#### `calculateEndDate(startDateString: string, daysSupply: number): Date`
Calculates end dates using the same logic as the parser.

```typescript
const endDate = calculateEndDate('2024-01-15', 30);
expect(claim.endDate).toEqual(endDate);
```

#### `sortClaimsByDate(claims: any[]): any[]`
Sorts claims by start date descending (most recent first) - matches parser behavior.

```typescript
const expectedOrder = sortClaimsByDate(inputClaims);
expect(result.claims).toEqual(expectedOrder);
```

### Additional Utilities

- `createDateRange()` - Create date ranges for testing
- `parseDaysSupply()` - Parse days supply with fallback logic
- `validateTimelineDates()` - Validate timeline date integrity
- `generateTestClaimData()` - Generate test claims with consistent dates
- `createComprehensiveTestData()` - Create complete test datasets

## Mock Configuration Utilities

### Core Mock Setup Functions

#### `setupFsMocks()`
Creates a complete file system mock with both sync and async operations.
```typescript
const fsMock = setupFsMocks();
// Includes: existsSync, readFileSync, writeFileSync, promises.readFile, etc.
```

#### `setupVSCodeMocks()`
Creates a comprehensive VSCode API mock with all required methods and properties.
```typescript
const vscodeMock = setupVSCodeMocks();
// Includes: window, workspace, commands, ViewColumn, Uri, etc.
```

#### `setupParserMocks(mockData?)`
Creates parser mocks with consistent return data.
```typescript
const parserMock = setupParserMocks();
// Includes: parseFile, validateStructure, extractClaims, generateTimelineData
```

### Specialized Mock Environments

#### `createTestEnvironment(options)`
Creates a complete test environment with all mocks configured.
```typescript
const env = createTestEnvironment({
    mockData: customData,
    fsReturnValue: jsonString,
    shouldThrowError: false
});
```

#### `createIntegrationMockEnvironment()`
Specifically designed for integration tests, handles subscription tracking and file type simulation.
```typescript
const env = createIntegrationMockEnvironment();
env.expectSubscriptionCount(2); // Verify correct number of subscriptions
env.mockFileType('non-medical'); // Simulate different file types
```

#### `setupIntegrationTestEnvironment(options)`
Configures mocks for integration test scenarios.
```typescript
const env = setupIntegrationTestEnvironment({
    expectCommandRegistration: true,
    expectWebviewCreation: true,
    mockFileContent: '{"test": "data"}'
});
```

### Error Scenario Mocks

#### `setupErrorTestEnvironment(errorType)`
Configures mocks for specific error scenarios.
```typescript
const env = setupErrorTestEnvironment('file-not-found');
// Available types: 'file-not-found', 'invalid-json', 'permission-denied', 'network-error'
```

#### `setupParserErrorMocks(errorType)`
Creates parser mocks that simulate specific error conditions.
```typescript
const parserMock = setupParserErrorMocks('structure-validation');
// Available types: 'structure-validation', 'date-parse', 'file-read', 'json-parse'
```

### Test Data Generation

#### `createMockJsonData(type)`
Generates mock JSON data for different test scenarios.
```typescript
const validData = createMockJsonData('valid');
const nonMedicalData = createMockJsonData('non-medical');
const incompleteData = createMockJsonData('incomplete');
// Available types: 'valid', 'invalid', 'empty', 'malformed', 'non-medical', 'incomplete'
```

## Usage Examples

### Basic Test Setup
```typescript
import { setupTestScenario } from '../test-utils';

describe('My Test Suite', () => {
    it('should handle basic scenario', () => {
        const env = setupTestScenario('basic');
        // Test implementation
    });
});
```

### Integration Test Setup
```typescript
import { createIntegrationMockEnvironment } from '../test-utils';

describe('Integration Tests', () => {
    let env: ReturnType<typeof createIntegrationMockEnvironment>;
    
    beforeEach(() => {
        env = createIntegrationMockEnvironment();
    });
    
    afterEach(() => {
        env.reset();
    });
    
    it('should register commands correctly', () => {
        activate(env.context);
        env.expectSubscriptionCount(2);
    });
});
```

### Error Handling Tests
```typescript
import { setupErrorTestEnvironment } from '../test-utils';

describe('Error Handling', () => {
    it('should handle file not found', async () => {
        const env = setupErrorTestEnvironment('file-not-found');
        
        await expect(parser.parseFile('/nonexistent.json'))
            .rejects.toThrow('ENOENT');
    });
});
```

## Best Practices

1. **Use Standardized Utilities**: Always use the provided mock utilities instead of creating custom mocks
2. **Reset Between Tests**: Call `env.reset()` in `afterEach` to ensure clean state
3. **Match Parser Behavior**: Use date utilities that match the actual parser's date normalization
4. **Consistent Test Data**: Use `createMockJsonData()` for consistent test data structures
5. **Proper Error Testing**: Use error-specific mock environments for testing error scenarios

## Common Issues and Solutions

### Subscription Count Mismatches
Use `createIntegrationMockEnvironment()` which properly tracks subscriptions:
```typescript
const env = createIntegrationMockEnvironment();
activate(env.context);
env.expectSubscriptionCount(2); // Will pass with correct tracking
```

### VSCode API Method Missing
The comprehensive VSCode mock includes all required methods. If you encounter missing methods, they may need to be added to `setupVSCodeMocks()`.

### File System Mock Issues
Use `setupFsMocks()` which includes both sync and async operations with proper error handling.

### Date/Timezone Issues
Use the date utilities from `dateUtils.ts` that match the parser's behavior:
```typescript
import { createParserDate, expectDateToEqual } from '../test-utils';

const expectedDate = createParserDate('2024-01-15');
expectDateToEqual(actualDate, '2024-01-15');
```

## Mock Utility Reference

| Function | Purpose | Use Case |
|----------|---------|----------|
| `setupFsMocks()` | File system operations | Basic file I/O testing |
| `setupVSCodeMocks()` | VSCode API | Extension functionality testing |
| `setupParserMocks()` | Parser operations | Data parsing testing |
| `createTestEnvironment()` | Complete test setup | General testing |
| `createIntegrationMockEnvironment()` | Integration testing | End-to-end workflows |
| `setupErrorTestEnvironment()` | Error scenarios | Error handling testing |
| `createMockJsonData()` | Test data generation | Data-driven testing |

This standardized approach ensures consistent testing across all test suites and reduces mock configuration issues.