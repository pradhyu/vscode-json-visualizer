# Design Document

## Overview

The Medical Claims Timeline extension has a sophisticated architecture but fails at the data flow between parsing and visualization. The design focuses on identifying and fixing the specific points of failure while preserving the advanced features. The key insight from the working simple version is that the core D3.js visualization works correctly, so the issue lies in the data processing pipeline.

## Architecture

### Current Architecture Analysis
The extension follows a layered architecture:
- **Extension Layer**: Command registration and orchestration
- **Configuration Layer**: ConfigManager for user settings
- **Parsing Layer**: ClaimsParser and FlexibleClaimsParser for data processing
- **Rendering Layer**: TimelineRenderer for webview management and visualization
- **Error Handling Layer**: Comprehensive error management with user-friendly messages

### Root Cause Analysis
Based on the working simple version, the failure points are likely:
1. **Parser Validation**: The validateStructure method may be too strict or failing incorrectly
2. **Data Flow**: The parsed data may not match the expected format for TimelineRenderer
3. **Webview Communication**: Message passing between extension and webview may be broken
4. **Async Timing**: Race conditions in data loading and webview initialization

## Components and Interfaces

### Fixed Extension Entry Point
```typescript
// Simplified command handler that preserves advanced features
async function viewTimeline(uri?: vscode.Uri) {
    // 1. Basic validation (file exists, is JSON)
    // 2. Try simple parsing first as fallback
    // 3. Use advanced parsing if simple parsing succeeds
    // 4. Create timeline with proper error handling
}
```

### Enhanced Parser Integration
```typescript
// Hybrid parsing approach
class HybridParser {
    // Try simple parsing first to validate basic structure
    // Fall back to complex parsing for advanced features
    // Ensure output format matches TimelineRenderer expectations
}
```

### Fixed TimelineRenderer Communication
```typescript
// Ensure proper message passing and data format
class TimelineRenderer {
    // Immediate data sending without waiting for ready message
    // Proper error handling for webview failures
    // Consistent data format matching simple version
}
```

### Debugging and Diagnostics
```typescript
// Enhanced logging and error reporting
class DiagnosticManager {
    // Step-by-step execution logging
    // Data format validation at each stage
    // Webview communication monitoring
}
```

## Data Models

### Standardized Timeline Data Format
Based on the working simple version, ensure all parsers output this format:
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
    type: string;
    startDate: string; // ISO format for JSON serialization
    endDate: string;   // ISO format for JSON serialization
    displayName: string;
    details: Record<string, any>;
}
```

### Parser Output Validation
```typescript
// Ensure all parsers produce compatible output
function validateTimelineData(data: any): data is TimelineData {
    // Validate structure matches working simple version
    // Convert dates to proper format
    // Ensure all required fields are present
}
```

## Error Handling

### Graceful Degradation Strategy
1. **Primary**: Use advanced parsing with full features
2. **Fallback**: Use simple parsing if advanced parsing fails
3. **Emergency**: Show raw data view if all parsing fails
4. **Recovery**: Provide clear instructions for data format fixes

### Enhanced Error Reporting
```typescript
// Detailed error context for debugging
interface ExtendedError {
    stage: 'validation' | 'parsing' | 'rendering' | 'communication';
    originalError: Error;
    context: {
        fileSize: number;
        dataKeys: string[];
        parserUsed: string;
        webviewState: string;
    };
    suggestions: string[];
}
```

## Testing Strategy

### Validation Approach
1. **Unit Tests**: Test each parser independently with test-claims.json
2. **Integration Tests**: Test full pipeline with known good data
3. **Regression Tests**: Ensure simple version functionality is preserved
4. **Error Path Tests**: Verify error handling doesn't break the extension

### Test Data Scenarios
- **Working Case**: test-claims.json (known to work with simple version)
- **Edge Cases**: Empty arrays, missing fields, invalid dates
- **Error Cases**: Malformed JSON, wrong structure, network failures

### Debugging Tools
```typescript
// Built-in diagnostic commands
commands: [
    'claimsTimeline.diagnose',      // Run full diagnostic
    'claimsTimeline.testParsing',   // Test parsing only
    'claimsTimeline.testWebview',   // Test webview only
    'claimsTimeline.showDebugInfo'  // Show detailed debug info
]
```

## Implementation Strategy

### Phase 1: Diagnostic Integration
- Add comprehensive logging to existing extension
- Identify exact failure point with test-claims.json
- Compare data flow with working simple version

### Phase 2: Parser Harmonization
- Ensure ClaimsParser and FlexibleClaimsParser output matches simple version format
- Fix validateStructure method to accept test-claims.json
- Add fallback to simple parsing logic

### Phase 3: Renderer Synchronization
- Fix TimelineRenderer to handle data format from Phase 2
- Ensure webview communication matches simple version
- Add immediate data sending without waiting for ready message

### Phase 4: Error Handling Enhancement
- Preserve existing error handling while fixing core functionality
- Add diagnostic commands for troubleshooting
- Ensure graceful degradation to simple parsing

### Phase 5: Feature Preservation
- Verify all advanced features still work after fixes
- Test configuration management and flexible parsing
- Ensure backward compatibility with existing user settings