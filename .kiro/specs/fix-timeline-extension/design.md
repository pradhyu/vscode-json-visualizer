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

## Interactive Timeline Visualization

### Enhanced Timeline Rendering with Zoom and Pan
The timeline will support multiple claim types with full interactive controls:

```typescript
interface ClaimTypeConfig {
    type: string;
    color: string;
    visible: boolean;
    displayName: string;
    count: number;
    icon?: string;
}

interface TimelineViewState {
    zoomLevel: number;
    panOffset: number;
    visibleClaimTypes: Set<string>;
    dateRange: {
        visible: { start: Date; end: Date };
        total: { start: Date; end: Date };
    };
}

interface EnhancedTimelineData extends TimelineData {
    claimTypeConfigs: ClaimTypeConfig[];
    viewState: TimelineViewState;
}
```

### Interactive Legend Component
```typescript
class InteractiveLegend {
    private claimTypes: ClaimTypeConfig[];
    private onToggle: (type: string) => void;
    
    // Render legend with toggle controls and statistics
    render(): void;
    
    // Handle click events for show/hide individual claim types
    handleToggle(claimType: string): void;
    
    // Update legend state when timeline changes
    updateCounts(claims: ClaimItem[]): void;
    
    // Show hover information with claim statistics
    showTooltip(claimType: string): void;
}
```

### Zoom and Pan Controls
```typescript
class TimelineControls {
    private currentZoom: number = 1;
    private currentPan: number = 0;
    private minZoom: number = 0.1;
    private maxZoom: number = 10;
    
    // Zoom controls
    zoomIn(): void;
    zoomOut(): void;
    resetZoom(): void;
    
    // Pan controls
    panLeft(): void;
    panRight(): void;
    panToDate(date: Date): void;
    
    // Boundary detection
    private validatePanBounds(): void;
    private calculateVisibleDateRange(): { start: Date; end: Date };
}
```

### Tabular Data View Component
```typescript
interface TableColumn {
    key: string;
    label: string;
    sortable: boolean;
    filterable: boolean;
    formatter?: (value: any, claim: ClaimItem) => string;
    width?: string;
}

interface TableState {
    sortColumn: string;
    sortDirection: 'asc' | 'desc';
    searchQuery: string;
    visibleColumns: Set<string>;
    pageSize: number;
    currentPage: number;
}

class DataTableView {
    private claims: ClaimItem[];
    private filteredClaims: ClaimItem[];
    private tableState: TableState;
    private columns: TableColumn[];
    
    // Initialize table with claim data
    initialize(claims: ClaimItem[]): void;
    
    // Render table with current state
    render(): void;
    
    // Handle search input
    handleSearch(query: string): void;
    
    // Handle column sorting
    handleSort(column: string): void;
    
    // Handle row selection
    handleRowClick(claimId: string): void;
    
    // Export filtered data
    exportData(format: 'csv' | 'json'): void;
    
    // Update visibility based on claim type filters
    updateVisibility(visibleTypes: Set<string>): void;
    
    // Pagination controls
    private renderPagination(): void;
    private goToPage(page: number): void;
}
```

### View Toggle Component
```typescript
class ViewToggle {
    private currentView: 'timeline' | 'table' = 'timeline';
    private onViewChange: (view: string) => void;
    
    // Render view toggle buttons
    render(): void;
    
    // Switch between timeline and table views
    switchView(view: 'timeline' | 'table'): void;
    
    // Preserve state when switching views
    private preserveState(): void;
}
```

### D3.js Timeline Enhancements
```typescript
class D3TimelineRenderer {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private xScale: d3.ScaleTime<number, number>;
    private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    
    // Initialize zoom and pan behavior
    initializeZoomPan(): void;
    
    // Handle zoom events
    onZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void;
    
    // Update timeline based on visible claim types
    updateVisibleClaims(visibleTypes: Set<string>): void;
    
    // Animate claim type visibility changes
    animateClaimToggle(claimType: string, visible: boolean): void;
    
    // Update scales based on zoom/pan state
    updateScales(transform: d3.ZoomTransform): void;
}
```

### Webview Message Protocol
```typescript
interface WebviewMessage {
    command: 'zoom' | 'pan' | 'toggleClaimType' | 'resetView' | 'ready' | 'error';
    payload?: {
        zoomLevel?: number;
        panOffset?: number;
        claimType?: string;
        visible?: boolean;
        dateRange?: { start: string; end: string };
    };
}

// Extension to Webview Messages
interface TimelineUpdateMessage {
    command: 'updateTimeline';
    data: {
        claims: ClaimItem[];
        visibleTypes: string[];
        viewState: TimelineViewState;
    };
}

// Webview to Extension Messages
interface UserInteractionMessage {
    command: 'userInteraction';
    action: 'zoom' | 'pan' | 'toggle' | 'reset';
    details: any;
}
```

### Webview UI Components
The webview will include:

#### Control Panel
- **Zoom Controls**: Zoom in (+), Zoom out (-), Reset (⌂) buttons
- **Pan Controls**: Left (←), Right (→) navigation arrows
- **View Reset**: Button to return to full timeline view

#### Interactive Legend
- **Claim Type Toggles**: Checkbox/toggle for each type (rxTba, rxHistory, medHistory)
- **Color Indicators**: Visual color swatches matching timeline colors
- **Claim Counts**: Display number of claims per type
- **Visibility States**: Visual indicators for hidden/shown states (grayed out, strikethrough)
- **Hover Tooltips**: Additional statistics and information

#### Timeline Canvas
- **Zoomable Timeline**: D3.js timeline with zoom/pan capabilities
- **Animated Transitions**: Smooth show/hide animations for claim types
- **Responsive Scaling**: Automatic axis and scale adjustments
- **Boundary Indicators**: Visual cues when at zoom/pan limits

## Testing Strategy

### Validation Approach
1. **Unit Tests**: Test each parser independently with test-claims.json
2. **Integration Tests**: Test full pipeline with known good data
3. **Regression Tests**: Ensure simple version functionality is preserved
4. **Error Path Tests**: Verify error handling doesn't break the extension
5. **Multi-Type Tests**: Test timeline with all claim types present
6. **Legend Tests**: Test interactive legend functionality

### Test Data Scenarios
- **Working Case**: test-claims.json (known to work with simple version)
- **Multi-Type Case**: JSON with rxTba, rxHistory, and medHistory claims
- **Edge Cases**: Empty arrays, missing fields, invalid dates, single claim type
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

### Phase 1: Core Functionality (Already Complete)
- ✅ Fixed parser data structure inconsistencies
- ✅ Enhanced multiple claim type support
- ✅ Standardized date format handling

### Phase 2: Interactive Legend Implementation
- Enhance TimelineRenderer to include legend HTML structure
- Add CSS styling for legend components with toggle controls
- Implement JavaScript event handlers for claim type toggles
- Add smooth CSS transitions for show/hide animations
- Update webview message protocol for legend interactions

### Phase 3: Zoom and Pan Controls
- Integrate D3.js zoom behavior into existing timeline
- Add zoom control buttons to webview UI
- Implement pan navigation with boundary detection
- Add keyboard shortcuts for zoom/pan operations
- Ensure proper scale updates during zoom operations

### Phase 4: Enhanced Webview Communication
- Extend message protocol for interactive features
- Add state management for zoom/pan/visibility settings
- Implement bidirectional communication for user interactions
- Add error handling for interactive feature failures

### Phase 5: UI Polish and Testing
- Add responsive design for different screen sizes
- Implement accessibility features (keyboard navigation, screen reader support)
- Add comprehensive testing for all interactive features
- Performance optimization for large datasets with many claims

### Implementation Priority
1. **High Priority**: Interactive legend with claim type toggles
2. **High Priority**: Basic zoom in/out functionality
3. **Medium Priority**: Pan navigation and boundary detection
4. **Medium Priority**: Enhanced hover tooltips and statistics
5. **Low Priority**: Keyboard shortcuts and accessibility features