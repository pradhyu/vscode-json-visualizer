# Parser Behavior Reference

## Overview

This document describes the expected behavior of the Medical Claims Timeline parsers. Understanding this behavior is crucial for writing accurate tests and avoiding the common pitfalls that led to test failures.

## Date Handling Behavior

### Date Normalization

The parsers normalize all dates to **local midnight** using JavaScript's `new Date(year, month, date)` constructor:

```typescript
// Parser behavior for date "2024-01-15"
const parts = dateString.split('-');
const year = parseInt(parts[0], 10);
const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
const day = parseInt(parts[2], 10);
const normalizedDate = new Date(year, month, day); // Local midnight
```

### Key Implications

1. **Timezone Independence**: Dates are created in the local timezone, not UTC
2. **Consistent Midnight**: All dates are normalized to 00:00:00 local time
3. **No Time Components**: Original time components are stripped

### Test Expectations

```typescript
// ✅ Correct - matches parser behavior
const expected = new Date(2024, 0, 15); // January 15, 2024 local midnight
expect(claim.startDate).toEqual(expected);

// ❌ Wrong - UTC date will fail in non-UTC timezones
const wrong = new Date('2024-01-15T00:00:00.000Z');
expect(claim.startDate).toEqual(wrong);
```

## Sorting Behavior

### Timeline Data Sorting

Claims in timeline data are sorted by **start date in descending order** (most recent first):

```typescript
// Parser sorting logic
claims.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
```

### Secondary Sorting

When claims have the same start date, they maintain their original order from the data source.

### Test Expectations

```typescript
// For claims with dates: 2024-01-15, 2024-03-01, 2024-02-10
// Expected order: 2024-03-01, 2024-02-10, 2024-01-15 (most recent first)

const expectedOrder = [
    expect.objectContaining({ startDate: createParserDate('2024-03-01') }),
    expect.objectContaining({ startDate: createParserDate('2024-02-10') }),
    expect.objectContaining({ startDate: createParserDate('2024-01-15') })
];

expect(result.claims).toEqual(expectedOrder);
```

## Data Processing Behavior

### RxTba Claims Processing

```typescript
// Required fields: id, dos, medication
// Optional fields: dayssupply, dosage, quantity, prescriber, pharmacy, copay

// Days supply handling
const daysSupply = claim.dayssupply && claim.dayssupply > 0 
    ? Math.min(claim.dayssupply, 365) // Capped at 365 days
    : 30; // Default fallback

// End date calculation
const endDate = new Date(startDate);
endDate.setDate(endDate.getDate() + daysSupply);
```

### RxHistory Claims Processing

```typescript
// Required fields: id, dos, medication
// Optional fields: dayssupply, dosage, fillDate, refillsRemaining

// Similar processing to rxTba but with different color coding
// Color: '#4ECDC4' (teal)
```

### MedHistory Claims Processing

```typescript
// Structure: medHistory.claims[].lines[]
// Required fields per line: lineId, srvcStart, description
// Optional fields: srvcEnd, serviceType, procedureCode, chargedAmount

// End date handling
const endDate = line.srvcEnd && !isNaN(new Date(line.srvcEnd).getTime())
    ? createParserDate(line.srvcEnd)
    : startDate; // Same as start date if no end date

// Color: '#45B7D1' (blue)
```

## Validation Behavior

### Structure Validation

The parser validates that the JSON contains at least one of the expected medical data structures:

```typescript
// Valid structures (at least one must be present)
const hasRxTba = data.rxTba && Array.isArray(data.rxTba) && data.rxTba.length > 0;
const hasRxHistory = data.rxHistory && Array.isArray(data.rxHistory) && data.rxHistory.length > 0;
const hasMedHistory = data.medHistory && data.medHistory.claims && 
                     Array.isArray(data.medHistory.claims) && data.medHistory.claims.length > 0;

const isValid = hasRxTba || hasRxHistory || hasMedHistory;
```

### Field Validation

#### Required Fields by Claim Type

**RxTba Claims:**
- `id` (string)
- `dos` (valid date string)
- `medication` (string)

**RxHistory Claims:**
- `id` (string)
- `dos` (valid date string)
- `medication` (string)

**MedHistory Lines:**
- `lineId` (string)
- `srvcStart` (valid date string)
- `description` (string)

### Date Validation

```typescript
// Date validation logic
function isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

// Claims with invalid dates are filtered out
const validClaims = claims.filter(claim => isValidDate(claim.dos));
```

## Error Handling Behavior

### Error Types

The parsers throw specific error types:

1. **FileReadError**: File system errors (ENOENT, EACCES, etc.)
2. **SyntaxError**: JSON parsing errors
3. **ValidationError**: Structure validation failures
4. **DateParseError**: Date parsing failures

### Error Messages

```typescript
// File not found
throw new Error('ENOENT: no such file or directory, open \'filename.json\'');

// Invalid JSON
throw new SyntaxError('Unexpected token in JSON at position X');

// Structure validation
throw new Error('Structure validation failed: No valid medical data found');

// Date parsing
throw new Error('Date parsing failed for value: invalid-date');
```

## Color Coding Behavior

### Default Colors

```typescript
const DEFAULT_COLORS = {
    rxTba: '#FF6B6B',      // Red/pink
    rxHistory: '#4ECDC4',   // Teal
    medHistory: '#45B7D1'   // Blue
};
```

### Color Assignment

Colors are assigned based on claim type, not individual claims. All claims of the same type share the same color.

## Timeline Data Structure

### Expected Output Format

```typescript
interface TimelineData {
    claims: ClaimItem[];
    dateRange: {
        start: Date;
        end: Date;
    };
    metadata: {
        totalClaims: number;
        claimTypes: string[];
    };
}

interface ClaimItem {
    id: string;
    type: 'rxTba' | 'rxHistory' | 'medHistory';
    startDate: Date;
    endDate: Date;
    displayName: string;
    color: string;
    details: Record<string, any>;
}
```

### Date Range Calculation

```typescript
// Date range spans from earliest start date to latest end date
const allDates = claims.flatMap(claim => [claim.startDate, claim.endDate]);
const dateRange = {
    start: new Date(Math.min(...allDates.map(d => d.getTime()))),
    end: new Date(Math.max(...allDates.map(d => d.getTime())))
};
```

## Fallback Behavior (HybridParser)

### Parser Selection Logic

```typescript
// HybridParser determines which parser to use
function determineParsing(data: any): 'standard' | 'flexible' {
    // Try standard parsing first
    if (hasStandardStructure(data)) {
        return 'standard';
    }
    
    // Fall back to flexible parsing
    return 'flexible';
}
```

### Fallback Processing

When standard parsing fails, the HybridParser:

1. Attempts flexible parsing with relaxed validation
2. Uses default values for missing fields
3. Applies more lenient date parsing
4. Provides generic display names for incomplete data

## Performance Characteristics

### Expected Performance

- **Small datasets** (< 100 claims): < 100ms
- **Medium datasets** (100-1000 claims): < 1000ms
- **Large datasets** (1000+ claims): < 5000ms

### Memory Usage

- Claims are processed in memory
- No streaming for large files
- Memory usage scales linearly with dataset size

## Testing Implications

### What to Test

1. **Date normalization** - Verify dates are local midnight
2. **Sorting order** - Claims sorted by date descending
3. **Field validation** - Required fields are validated
4. **Error handling** - Specific error types are thrown
5. **Color assignment** - Correct colors by claim type
6. **Date range calculation** - Spans all claim dates

### What Not to Test

1. **Internal implementation details** - Focus on behavior, not implementation
2. **Exact error messages** - Messages may change, test error types
3. **Performance on specific hardware** - Use reasonable thresholds
4. **Timezone-specific behavior** - Use timezone-agnostic utilities

## Common Misconceptions

### ❌ Dates are in UTC
**Reality**: Dates are normalized to local midnight

### ❌ Claims are sorted by ID or input order
**Reality**: Claims are sorted by start date descending

### ❌ All fields are required
**Reality**: Only specific fields are required per claim type

### ❌ Error messages are standardized
**Reality**: Error messages may vary, test error types instead

### ❌ Performance is consistent across all systems
**Reality**: Use reasonable thresholds that account for system differences

## Quick Reference for Test Writers

```typescript
// Date creation
const date = createParserDate('2024-01-15'); // Local midnight

// Date comparison
expectDateToEqual(actualDate, '2024-01-15'); // Timezone-safe

// Sorting expectation
const sorted = sortClaimsByDate(claims); // Most recent first

// Error testing
await expect(parser.parseFile('bad.json')).rejects.toThrow(/JSON/);

// Structure validation
const isValid = hasRxTba || hasRxHistory || hasMedHistory;
```

This reference should be consulted when writing new tests to ensure they align with the actual parser behavior rather than assumptions about how the parser should work.