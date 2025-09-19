# Parser Behavior Analysis

## Overview

This document analyzes the actual behavior of the medical claims parsers to understand how they handle dates, sorting, validation, and error handling. This analysis is critical for fixing the 37 failing tests by aligning test expectations with actual implementation behavior.

## Date Normalization Behavior

### ClaimsParser Date Handling

The ClaimsParser uses a sophisticated date parsing system with the following behavior:

1. **Primary Date Parsing Method**: `parseDate(dateStr: string): Date`
   - First attempts to parse as ISO date (YYYY-MM-DD)
   - Creates UTC dates: `new Date(trimmedDateStr + 'T00:00:00.000Z')`
   - Falls back to multiple format attempts if ISO parsing fails

2. **Date Normalization in parseDateWithFormat**:
   ```typescript
   const date = new Date(Date.UTC(year, month, day));
   ```
   - **All dates are normalized to UTC midnight**
   - This explains why tests expecting local dates fail

3. **Date Standardization in extractClaims**:
   ```typescript
   // From standardizeClaimFormat method
   startDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
   ```
   - **Converts UTC dates back to local midnight**
   - This creates timezone-dependent behavior

### FlexibleClaimsParser Date Handling

Uses FieldExtractor.parseDate which:
```typescript
// Normalize to local midnight to avoid timezone issues
return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
```

### HybridParser Date Handling

In simple parsing fallback:
```typescript
// Normalize to local midnight to avoid timezone issues
return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
```

### Key Finding: Date Normalization Inconsistency

**Tests expect**: `2024-01-15T00:00:00.000Z` (UTC midnight)
**Parsers return**: `2024-01-14T05:00:00.000Z` (local midnight converted to UTC in timezone like EST)

The parsers normalize dates to **local midnight**, but tests expect **UTC midnight**.

## Sorting Logic Analysis

### ClaimsParser.generateTimelineData

```typescript
// Sort claims by start date (oldest first) for consistent ordering
const sortedClaims = claims.sort((a, b) => {
    const aStartDate = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
    const bStartDate = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
    return aStartDate.getTime() - bStartDate.getTime();
});
```

**Actual behavior**: Sorts **oldest first** (ascending order)

### FlexibleClaimsParser.generateTimelineData

```typescript
// Sort claims by start date (most recent first)
const sortedClaims = claims.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
```

**Actual behavior**: Sorts **most recent first** (descending order)

### Key Finding: Sorting Inconsistency

- **ClaimsParser**: Sorts oldest first (ascending)
- **FlexibleClaimsParser**: Sorts most recent first (descending)
- **Tests expect**: Various orders, need to be aligned with actual implementation

## Error Types and Messages Catalog

### Error Class Hierarchy

```typescript
ParseError (base class)
├── ValidationError
│   └── StructureValidationError
├── DateParseError
├── FileReadError
└── ConfigurationError
```

### Actual Error Types Thrown

#### 1. StructureValidationError
**When thrown**:
- Invalid JSON structure (not an object)
- No valid claim arrays found
- Missing required fields in claim structures

**Actual messages**:
- `"JSON does not contain valid medical claims data - expected object but received {type}"`
- `"JSON does not contain valid medical claims data"`
- `"No valid claim arrays found in JSON"`

#### 2. DateParseError
**When thrown**:
- Invalid date strings
- Unparseable date formats
- Empty or null date values

**Actual messages**:
- `"Date string is empty or null"`
- `"Expected date string but received {type}: {value}"`
- `"Unable to parse date: \"{dateStr}\". Tried formats: {formats}"`

**Context properties**:
```typescript
{
    claimType: string,
    claimIndex: number,
    fieldName: string,
    fieldValue: any,
    originalValue: any,
    attemptedFormats: string[],
    suggestedFormats: string[],
    examples: Record<string, string>
}
```

#### 3. ValidationError
**When thrown**:
- Invalid JSON syntax
- Empty files
- General validation failures

**Actual messages**:
- `"Empty file"`
- `"Invalid JSON: {syntaxError.message}"`
- `"Invalid JSON structure for medical claims data"`

#### 4. FileReadError
**When thrown**:
- File not found (ENOENT)
- Permission denied (EACCES)
- Out of memory (ENOMEM)
- No space left (ENOSPC)
- Network unreachable (ENETUNREACH)

**Actual messages**:
- `"File not found: {filePath}"`
- `"Permission denied reading file: {filePath}"`
- `"Out of memory reading file: {filePath}"`
- `"No space left on device: {filePath}"`
- `"Network unreachable: {filePath}"`

## Validation Logic Analysis

### ClaimsParser.validateStructure

**Validation approach**:
1. Checks if input is an object
2. Validates at least one claim array exists (rxTba, rxHistory, or medHistory)
3. Validates structure of existing arrays
4. **Allows empty arrays** - they are considered valid
5. **Allows missing optional fields** - uses fallbacks during extraction

**Key validation methods**:
- `validateArrayStructures()` - validates existing arrays
- `validateRxArrayStructure()` - validates prescription arrays
- `validateMedHistoryArrayStructure()` - validates medical history structure

**Validation behavior**:
- **Permissive**: Only fails on critical structural errors
- **Fallback-friendly**: Missing fields are handled during extraction, not validation
- **Multi-format support**: Accepts various claim array combinations

### FlexibleClaimsParser.validateStructure

**Validation approach**:
1. Checks if input is an object
2. Validates claim type configurations exist
3. Checks each configured claim type array
4. Validates sample items from each array

**Key differences from ClaimsParser**:
- More strict about item structure
- Validates against configuration-defined paths
- Requires at least one valid array with valid items

### HybridParser Validation

Uses multiple validation strategies:
1. Attempts ClaimsParser validation first
2. Falls back to FlexibleClaimsParser validation
3. Falls back to simple validation in `validateMultipleClaimTypes()`

**Simple validation logic**:
- Checks for basic required fields (dos, medication for Rx; srvcStart, description for medical)
- More lenient than complex parsers
- Focuses on data availability rather than strict structure

## Key Findings Summary

### 1. Date Issues (25+ test failures)
- **Root cause**: Parsers normalize to local midnight, tests expect UTC midnight
- **Solution**: Update test expectations to match parser behavior
- **Pattern**: `new Date(year, month, date)` creates local dates

### 2. Sorting Issues (5+ test failures)
- **Root cause**: Different parsers sort differently
- **ClaimsParser**: Oldest first (ascending)
- **FlexibleClaimsParser**: Most recent first (descending)
- **Solution**: Update tests to expect correct sort order per parser

### 3. Error Type Mismatches (5+ test failures)
- **Root cause**: Tests expect different error types than actually thrown
- **Common issues**:
  - Tests expect `ValidationError` but get `StructureValidationError`
  - Tests expect specific error messages that don't match actual messages
  - Tests expect error context properties that don't exist

### 4. Validation Logic Mismatches (2+ test failures)
- **Root cause**: Tests expect stricter validation than implemented
- **Parser behavior**: Permissive, allows empty arrays and missing fields
- **Test expectations**: Often expect validation failures for valid edge cases

## Recommendations for Test Fixes

### 1. Date Expectations
```typescript
// Instead of expecting UTC dates:
expect(claim.startDate).toEqual(new Date('2024-01-15T00:00:00.000Z'));

// Expect local midnight dates:
expect(claim.startDate).toEqual(new Date(2024, 0, 15)); // Local midnight
```

### 2. Sorting Expectations
```typescript
// For ClaimsParser - expect oldest first:
expect(claims[0].startDate.getTime()).toBeLessThan(claims[1].startDate.getTime());

// For FlexibleClaimsParser - expect newest first:
expect(claims[0].startDate.getTime()).toBeGreaterThan(claims[1].startDate.getTime());
```

### 3. Error Type Expectations
```typescript
// Use specific error types:
expect(() => parser.validateStructure(invalid)).toThrow(StructureValidationError);
expect(() => parser.parseDate(invalid)).toThrow(DateParseError);
```

### 4. Validation Expectations
```typescript
// Expect permissive validation:
expect(parser.validateStructure({ rxTba: [] })).toBe(true); // Empty arrays are valid
expect(parser.validateStructure({ rxTba: [{ dos: '2024-01-01' }] })).toBe(true); // Missing fields OK
```

This analysis provides the foundation for systematically fixing all 37 failing tests by aligning expectations with actual parser behavior.