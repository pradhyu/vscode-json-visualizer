# Medical Claims Timeline Viewer - User Guide

This comprehensive guide will help you get the most out of the Medical Claims Timeline Viewer extension.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding Your Data](#understanding-your-data)
3. [Using the Timeline](#using-the-timeline)
4. [Configuration](#configuration)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Getting Started

### Installation and First Use

1. **Install the Extension**
   - Open VSCode
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Medical Claims Timeline Viewer"
   - Click Install

2. **Open Your First Timeline**
   - Open a JSON file with medical claims data
   - Right-click in the editor and select "View Timeline"
   - Or use the keyboard shortcut: Ctrl+Shift+T (Cmd+Shift+T on Mac)

3. **Try the Sample Data**
   - If you don't have medical claims data, use the provided samples
   - Open Command Palette (Ctrl+Shift+P)
   - Type "Medical Claims: Open Sample Files"

### Quick Tour

When you first open a timeline, you'll see:

- **Timeline Chart**: The main visualization showing claims over time
- **Legend**: Color-coded legend showing different claim types
- **Zoom Controls**: Buttons to zoom in/out and reset view
- **Date Range**: Current visible date range
- **Claim Count**: Total number of claims displayed

## Understanding Your Data

### Supported Data Formats

The extension works with JSON files containing medical claims data in specific formats:

#### 1. Prescription Claims (rxTba)

These are prescription claims "to be adjudicated" - typically pending or recent prescriptions.

```json
{
  "rxTba": [
    {
      "id": "rx101",                    // Unique identifier
      "dos": "2024-01-15",             // Date of service (required)
      "dayssupply": 30,                // Days supply (required)
      "medication": "Lisinopril 10mg", // Medication name
      "dosage": "10mg once daily",     // Dosage instructions
      "quantity": 30,                  // Quantity dispensed
      "prescriber": "Dr. Smith",       // Prescribing physician
      "pharmacy": "CVS #1234",         // Dispensing pharmacy
      "ndc": "12345-678-90",          // National Drug Code
      "copay": 15.00                   // Patient copay amount
    }
  ]
}
```

**Timeline Behavior**: 
- Start Date: `dos` (date of service)
- End Date: `dos + dayssupply`
- Color: Red (#FF6B6B) by default

#### 2. Prescription History (rxHistory)

Historical prescription claims that have been processed.

```json
{
  "rxHistory": [
    {
      "id": "rxh101",
      "dos": "2023-12-15",
      "dayssupply": 30,
      "medication": "Metformin 500mg",
      "refillsRemaining": 2,
      "fillDate": "2023-12-15"
    }
  ]
}
```

**Timeline Behavior**:
- Start Date: `dos` (or `fillDate` if `dos` is invalid)
- End Date: `dos + dayssupply`
- Color: Teal (#4ECDC4) by default

#### 3. Medical Claims (medHistory)

Medical service claims with potentially multiple service lines per claim.

```json
{
  "medHistory": {
    "claims": [
      {
        "claimId": "med101",
        "provider": "General Hospital",
        "claimDate": "2024-01-08",
        "totalAmount": 250.00,
        "lines": [
          {
            "lineId": "line1",
            "srvcStart": "2024-01-08",    // Service start date (required)
            "srvcEnd": "2024-01-08",      // Service end date (required)
            "serviceType": "Office Visit",
            "procedureCode": "99213",
            "description": "Routine checkup",
            "chargedAmount": 150.00,
            "allowedAmount": 120.00,
            "paidAmount": 105.00
          }
        ]
      }
    ]
  }
}
```

**Timeline Behavior**:
- Start Date: `srvcStart`
- End Date: `srvcEnd`
- Color: Blue (#45B7D1) by default
- Each line item becomes a separate timeline entry

### Data Requirements

#### Required Fields

**For rxTba and rxHistory:**
- `dos` (date of service) - must be a valid date
- `dayssupply` - number of days (can be 0)

**For medHistory:**
- `srvcStart` - service start date
- `srvcEnd` - service end date

#### Optional but Recommended Fields

- `id` - unique identifier (auto-generated if missing)
- `medication` - for prescription claims
- `description` - for medical claims
- Display names are auto-generated from available fields

## Using the Timeline

### Navigation

#### Zooming
- **Mouse Wheel**: Scroll up to zoom in, down to zoom out
- **Zoom Buttons**: Use + and - buttons in the toolbar
- **Double-Click**: Double-click on timeline to zoom in on that area
- **Reset**: Click the reset button to return to full view

#### Panning
- **Click and Drag**: Click and drag horizontally to pan left/right
- **Keyboard**: Use arrow keys for fine panning (when timeline is focused)

#### Time Range Selection
- **Click and Drag**: Hold Shift and drag to select a time range
- **Zoom to Selection**: Double-click the selection to zoom to that range

### Interacting with Claims

#### Tooltips
Hover over any claim to see a detailed tooltip containing:
- Claim type and ID
- Date range
- Medication/service name
- Additional details (dosage, provider, amounts, etc.)

#### Detailed View
Click on any claim to open a detailed side panel showing:
- All available claim data
- Formatted dates and amounts
- Related claim information
- Quick actions (if applicable)

#### Multi-Selection
- **Ctrl+Click**: Select multiple claims
- **Shift+Click**: Select a range of claims
- **Selection Info**: View summary statistics for selected claims

### Timeline Features

#### Lane Management
When claims overlap in time, they're automatically arranged in separate "lanes" to prevent visual conflicts:
- Claims with overlapping dates appear in different horizontal lanes
- Lane assignment is optimized to minimize visual clutter
- Hover over lanes to highlight related claims

#### Chronological Sorting
- Claims are sorted with most recent first (top to bottom)
- Within the same time period, claims are ordered by type: rxTba, rxHistory, medHistory
- Sorting can be customized in settings

#### Color Coding and Legend
- Each claim type has a distinct color
- Legend shows claim types and their colors
- Click legend items to show/hide claim types
- Colors are customizable in settings

## Configuration

### Accessing Settings

1. Open VSCode Settings (File > Preferences > Settings)
2. Search for "Medical Claims Timeline"
3. Or use Command Palette: "Preferences: Open Settings (JSON)"

### Data Mapping Settings

#### Custom Attribute Paths

If your JSON uses different attribute names:

```json
{
  "claimsTimeline.rxTbaPath": "prescriptions.pending",
  "claimsTimeline.rxHistoryPath": "prescriptions.filled", 
  "claimsTimeline.medHistoryPath": "claims.medical"
}
```

#### Nested Path Support

For deeply nested data structures:

```json
{
  "claimsTimeline.rxTbaPath": "data.patient.prescriptions.rxTba",
  "claimsTimeline.medHistoryPath": "data.patient.medical.history"
}
```

### Date Format Configuration

#### Supported Formats

```json
{
  "claimsTimeline.dateFormat": "YYYY-MM-DD"  // ISO format (default)
}
```

Other supported formats:
- `"MM/DD/YYYY"` - US format (01/15/2024)
- `"DD-MM-YYYY"` - European format (15-01-2024)
- `"YYYY/MM/DD"` - Alternative ISO (2024/01/15)
- `"DD/MM/YYYY"` - UK format (15/01/2024)
- `"MM-DD-YYYY"` - US alternative (01-15-2024)

#### Date Format Examples

The extension will show format examples in error messages:

```
YYYY-MM-DD: 2024-03-15
MM/DD/YYYY: 03/15/2024
DD-MM-YYYY: 15-03-2024
```

### Visual Customization

#### Color Schemes

```json
{
  "claimsTimeline.colors": {
    "rxTba": "#FF6B6B",      // Red for pending prescriptions
    "rxHistory": "#4ECDC4",   // Teal for prescription history
    "medHistory": "#45B7D1"   // Blue for medical claims
  }
}
```

#### Custom Color Palettes

You can use any valid hex colors:

```json
{
  "claimsTimeline.colors": {
    "rxTba": "#E74C3C",      // Darker red
    "rxHistory": "#2ECC71",   // Green
    "medHistory": "#9B59B6"   // Purple
  }
}
```

### Advanced Configuration

#### Custom Field Mappings

For non-standard JSON structures:

```json
{
  "claimsTimeline.customMappings": {
    "alternateIdField": "customId",
    "alternateDateField": "serviceDate",
    "alternateNameField": "drugName"
  }
}
```

## Advanced Features

### Filtering and Search

#### Date Range Filtering
- Use the date picker controls to filter claims by date range
- Supports relative dates ("Last 30 days", "This year")
- Custom date range selection

#### Claim Type Filtering
- Click legend items to show/hide specific claim types
- Use checkboxes in the filter panel
- Keyboard shortcuts: R (rxTba), H (rxHistory), M (medHistory)

#### Text Search
- Search box filters claims by medication name, description, or ID
- Supports partial matching and regex patterns
- Case-insensitive by default

### Data Export

#### Export Options
- **CSV Export**: Export filtered claims to CSV format
- **JSON Export**: Export processed timeline data
- **Image Export**: Save timeline as PNG/SVG
- **PDF Report**: Generate printable timeline report

#### Export Configuration
```json
{
  "claimsTimeline.export": {
    "includeDetails": true,
    "dateFormat": "MM/DD/YYYY",
    "imageResolution": "high"
  }
}
```

### Performance Optimization

#### Large Dataset Handling
- **Pagination**: Automatically enabled for 1000+ claims
- **Virtual Scrolling**: Efficient rendering for large timelines
- **Progressive Loading**: Load data in chunks for very large files
- **Memory Management**: Automatic cleanup of unused data

#### Performance Settings
```json
{
  "claimsTimeline.performance": {
    "maxClaimsPerPage": 1000,
    "enableVirtualScrolling": true,
    "preloadNextPage": true
  }
}
```

## Troubleshooting

### Common Error Messages

#### "Invalid JSON Structure"

**Problem**: Your JSON file doesn't contain the expected medical claims structure.

**Solutions**:
1. Verify your file contains at least one of: `rxTba`, `rxHistory`, or `medHistory`
2. Check that arrays contain objects with required fields
3. Use sample files as reference
4. Configure custom paths if using different attribute names

**Example Fix**:
```json
// ❌ Invalid - missing required arrays
{
  "patientData": {
    "name": "John Doe"
  }
}

// ✅ Valid - contains rxTba array
{
  "rxTba": [
    {
      "id": "rx1",
      "dos": "2024-01-15", 
      "dayssupply": 30,
      "medication": "Test Med"
    }
  ]
}
```

#### "Date Format Error"

**Problem**: Date values in your JSON don't match the configured format.

**Solutions**:
1. Update date format in settings to match your data
2. Fix date values in your JSON file
3. Use ISO format (YYYY-MM-DD) for best compatibility

**Example Fix**:
```json
// ❌ Invalid date format
{
  "rxTba": [
    {
      "dos": "Jan 15, 2024",  // Non-standard format
      "dayssupply": 30
    }
  ]
}

// ✅ Valid date format
{
  "rxTba": [
    {
      "dos": "2024-01-15",    // ISO format
      "dayssupply": 30
    }
  ]
}
```

#### "No Claims Found"

**Problem**: JSON structure is valid but contains no claim data.

**Solutions**:
1. Verify arrays are not empty
2. Check that objects contain required fields
3. Verify date fields are valid
4. Check for typos in field names

### Performance Issues

#### Slow Loading

**Symptoms**: Timeline takes a long time to load or becomes unresponsive.

**Solutions**:
1. **Reduce Data Size**: Filter data before loading
2. **Enable Pagination**: Set `maxClaimsPerPage` to 500-1000
3. **Optimize JSON**: Remove unnecessary fields
4. **Check Memory**: Close other applications if low on RAM

#### Timeline Rendering Issues

**Symptoms**: Timeline appears blank or claims don't display correctly.

**Solutions**:
1. **Check Browser Console**: Open Developer Tools (F12) for error messages
2. **Refresh Webview**: Close and reopen timeline
3. **Reset Zoom**: Click reset button to return to default view
4. **Clear Cache**: Restart VSCode to clear cached data

### Data Quality Issues

#### Missing Claims

**Problem**: Some claims from your JSON don't appear in the timeline.

**Debugging Steps**:
1. Check the claim count in the status bar
2. Verify required fields are present
3. Check date formats and validity
4. Look for parsing errors in the output panel

#### Incorrect Dates

**Problem**: Claims appear at wrong dates or with wrong durations.

**Solutions**:
1. Verify date format configuration
2. Check `dayssupply` values for prescription claims
3. Verify `srvcStart`/`srvcEnd` for medical claims
4. Look for timezone issues in date parsing

## Best Practices

### Data Preparation

#### JSON Structure
- Use consistent field names across all claims
- Include unique IDs for all claims
- Validate JSON syntax before loading
- Remove or anonymize sensitive data

#### Date Handling
- Use ISO format (YYYY-MM-DD) when possible
- Ensure all dates are valid and in the same format
- Include time zones if relevant
- Validate date ranges (end date >= start date)

#### Performance Optimization
- Limit files to 10,000 claims for best performance
- Remove unnecessary fields to reduce file size
- Use pagination for very large datasets
- Consider splitting large files by date range

### Workflow Integration

#### Development Workflow
1. **Data Validation**: Validate JSON structure before visualization
2. **Iterative Analysis**: Use filtering to focus on specific time periods
3. **Export Results**: Save filtered views for reporting
4. **Documentation**: Include timeline screenshots in documentation

#### Analysis Workflow
1. **Overview**: Start with full timeline view to understand data range
2. **Focus**: Zoom in on specific time periods of interest
3. **Details**: Use tooltips and detail panels for claim investigation
4. **Comparison**: Use multi-selection to compare related claims

### Security and Privacy

#### Data Protection
- Always anonymize patient data before visualization
- Use synthetic or test data for demonstrations
- Ensure compliance with healthcare regulations (HIPAA, etc.)
- Don't share screenshots containing real patient information

#### File Handling
- Store sensitive files in secure locations
- Use version control for configuration files only
- Regularly clean up temporary files
- Encrypt files containing real patient data

### Customization Tips

#### Color Schemes
- Use high contrast colors for accessibility
- Consider colorblind-friendly palettes
- Match organizational branding when appropriate
- Test colors on different displays

#### Configuration Management
- Document custom configurations for team sharing
- Use workspace settings for project-specific configurations
- Version control settings files for consistency
- Test configurations with sample data first

---

## Getting Help

If you need additional assistance:

1. **Check Documentation**: Review this guide and the README
2. **Try Sample Data**: Use provided samples to verify functionality
3. **Check Settings**: Review extension configuration
4. **Report Issues**: Create GitHub issues with anonymized sample data
5. **Community**: Join discussions on GitHub for tips and best practices

Remember to always protect patient privacy and comply with relevant healthcare data regulations when working with real medical claims data.