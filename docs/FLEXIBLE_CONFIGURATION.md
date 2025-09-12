# Flexible Configuration Guide

The Medical Claims Timeline Viewer supports a powerful flexible configuration system that allows you to define custom data formats, field mappings, and display options. This guide explains how to configure the extension for your specific data structure.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Structure](#configuration-structure)
3. [Claim Type Configuration](#claim-type-configuration)
4. [Date Configuration](#date-configuration)
5. [Display Configuration](#display-configuration)
6. [Examples](#examples)
7. [Migration from Legacy Configuration](#migration-from-legacy-configuration)
8. [Troubleshooting](#troubleshooting)

## Overview

The flexible configuration system allows you to:

- **Define custom claim types** with any name and data structure
- **Configure flexible data paths** using JSON path notation
- **Set up date calculations** (e.g., start date + days supply = end date)
- **Customize display fields** with formatting and visibility options
- **Use multiple data formats** in the same workspace

### Key Benefits

- **No code changes required** - configure everything through VSCode settings
- **Support for any JSON structure** - not limited to predefined formats
- **Backward compatibility** - legacy configurations continue to work
- **Flexible date handling** - support for calculations and fallbacks
- **Rich display options** - control what users see in tooltips and details

## Configuration Structure

The flexible configuration is defined in your VSCode settings under `claimsTimeline.claimTypes`. Here's the basic structure:

```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "prescriptions",
      "arrayPath": "patient.medications",
      "color": "#FF6B6B",
      "idField": { "path": "prescriptionId" },
      "startDate": { "type": "field", "field": "startDate" },
      "endDate": { "type": "calculation", "calculation": {...} },
      "displayName": { "path": "drugName" },
      "displayFields": [...]
    }
  ]
}
```

## Claim Type Configuration

Each claim type represents a different category of data in your JSON file.

### Required Fields

#### `name` (string)
The identifier for this claim type. Used in the timeline legend and for grouping.

```json
"name": "prescriptions"
```

#### `arrayPath` (string)
JSON path to the array containing claims of this type. Supports nested paths.

```json
"arrayPath": "patient.medications"           // Simple path
"arrayPath": "data.claims.prescriptions"     // Nested path
"arrayPath": "response.results[0].items"     // Array indexing
```

#### `color` (string)
Hex color code for this claim type in the timeline.

```json
"color": "#FF6B6B"  // Red
"color": "#4ECDC4"  // Teal
"color": "#45B7D1"  // Blue
```

#### `idField` (object)
Configuration for extracting the unique identifier.

```json
"idField": {
  "path": "prescriptionId",           // JSON path to ID field
  "defaultValue": "auto-generated"    // Default if missing (optional)
}
```

#### `startDate` and `endDate` (objects)
Date configuration objects. See [Date Configuration](#date-configuration) for details.

#### `displayName` (object)
Configuration for the claim's display name.

```json
"displayName": {
  "path": "drugName",                 // JSON path to name field
  "defaultValue": "Prescription"      // Default if missing (optional)
}
```

### Optional Fields

#### `displayFields` (array)
Array of fields to show in tooltips and detail panels. See [Display Configuration](#display-configuration).

## Date Configuration

Date configuration supports three types: `field`, `calculation`, and `fixed`.

### Field Type

Extract date directly from a field with optional fallbacks.

```json
{
  "type": "field",
  "field": "startDate",                    // Primary date field
  "fallbacks": ["prescribedDate", "fillDate"], // Try these if primary fails
  "format": "YYYY-MM-DD"                   // Date format (optional)
}
```

### Calculation Type

Calculate date based on another field and a mathematical operation.

```json
{
  "type": "calculation",
  "calculation": {
    "baseField": "startDate",              // Base date field
    "operation": "add",                    // "add" or "subtract"
    "value": "daysSupply",                 // Field path or number
    "unit": "days"                         // "days", "weeks", "months", "years"
  }
}
```

#### Calculation Examples

**Add days supply to start date:**
```json
{
  "type": "calculation",
  "calculation": {
    "baseField": "startDate",
    "operation": "add",
    "value": "daysSupply",
    "unit": "days"
  }
}
```

**Add fixed duration:**
```json
{
  "type": "calculation",
  "calculation": {
    "baseField": "appointmentDate",
    "operation": "add",
    "value": 60,
    "unit": "minutes"
  }
}
```

**Subtract processing time:**
```json
{
  "type": "calculation",
  "calculation": {
    "baseField": "resultDate",
    "operation": "subtract",
    "value": "processingDays",
    "unit": "days"
  }
}
```

### Fixed Type

Use a fixed date value (useful for testing or default dates).

```json
{
  "type": "fixed",
  "value": "2024-01-01",
  "format": "YYYY-MM-DD"
}
```

## Display Configuration

Control what information is shown to users in tooltips and detail panels.

### Display Field Structure

```json
{
  "label": "Drug Name",                    // Label shown to user
  "path": "drugName",                      // JSON path to value
  "format": "text",                        // Display format
  "showInTooltip": true,                   // Show in hover tooltip
  "showInDetails": true                    // Show in detail panel
}
```

### Format Types

#### `text` (default)
Display as plain text.

```json
{"label": "Drug Name", "path": "drugName", "format": "text"}
```

#### `date`
Format as a localized date.

```json
{"label": "Start Date", "path": "startDate", "format": "date"}
```

#### `currency`
Format as currency (USD).

```json
{"label": "Cost", "path": "cost", "format": "currency"}
// Displays: $15.00
```

#### `number`
Format as a localized number.

```json
{"label": "Days Supply", "path": "daysSupply", "format": "number"}
// Displays: 30
```

### Nested Field Paths

Support for complex JSON structures:

```json
{"label": "Prescriber", "path": "prescriber.name"}
{"label": "Pharmacy Address", "path": "pharmacy.address.street"}
{"label": "First Diagnosis", "path": "diagnoses[0].code"}
```

## Examples

### Example 1: Custom Prescription Format

**Data Structure:**
```json
{
  "patient": {
    "medications": [
      {
        "rxId": "RX001",
        "drug": "Lisinopril 10mg",
        "startDate": "2024-01-15",
        "duration": 30,
        "doctor": "Dr. Smith",
        "cost": 15.00
      }
    ]
  }
}
```

**Configuration:**
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "medications",
      "arrayPath": "patient.medications",
      "color": "#FF6B6B",
      "idField": {
        "path": "rxId",
        "defaultValue": "auto-generated"
      },
      "startDate": {
        "type": "field",
        "field": "startDate"
      },
      "endDate": {
        "type": "calculation",
        "calculation": {
          "baseField": "startDate",
          "operation": "add",
          "value": "duration",
          "unit": "days"
        }
      },
      "displayName": {
        "path": "drug",
        "defaultValue": "Medication"
      },
      "displayFields": [
        {
          "label": "Drug",
          "path": "drug",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Duration",
          "path": "duration",
          "format": "number",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Doctor",
          "path": "doctor",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Cost",
          "path": "cost",
          "format": "currency",
          "showInTooltip": false,
          "showInDetails": true
        }
      ]
    }
  ]
}
```

### Example 2: Multiple Claim Types

**Data Structure:**
```json
{
  "healthData": {
    "prescriptions": [...],
    "appointments": [...],
    "labTests": [...]
  }
}
```

**Configuration:**
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "prescriptions",
      "arrayPath": "healthData.prescriptions",
      "color": "#FF6B6B",
      // ... prescription configuration
    },
    {
      "name": "appointments",
      "arrayPath": "healthData.appointments", 
      "color": "#4ECDC4",
      // ... appointment configuration
    },
    {
      "name": "labTests",
      "arrayPath": "healthData.labTests",
      "color": "#45B7D1",
      // ... lab test configuration
    }
  ]
}
```

### Example 3: Complex Date Calculations

**Appointment with duration in minutes:**
```json
{
  "startDate": {
    "type": "field",
    "field": "appointmentDateTime"
  },
  "endDate": {
    "type": "calculation",
    "calculation": {
      "baseField": "appointmentDateTime",
      "operation": "add",
      "value": "durationMinutes",
      "unit": "minutes"
    }
  }
}
```

**Lab test with collection and result dates:**
```json
{
  "startDate": {
    "type": "field",
    "field": "collectionDate"
  },
  "endDate": {
    "type": "field",
    "field": "resultDate",
    "fallbacks": ["collectionDate"]  // Use collection date if no result date
  }
}
```

## Migration from Legacy Configuration

If you're currently using the legacy configuration format, you can migrate to the flexible system:

### Automatic Migration

The extension automatically detects legacy configurations and continues to work with them. No immediate action is required.

### Manual Migration

To take advantage of flexible features, you can convert your legacy configuration:

**Legacy Configuration:**
```json
{
  "claimsTimeline.rxTbaPath": "rxTba",
  "claimsTimeline.colors": {
    "rxTba": "#FF6B6B"
  }
}
```

**Flexible Configuration:**
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "rxTba",
      "arrayPath": "rxTba",
      "color": "#FF6B6B",
      "idField": {"path": "id"},
      "startDate": {"type": "field", "field": "dos"},
      "endDate": {
        "type": "calculation",
        "calculation": {
          "baseField": "dos",
          "operation": "add", 
          "value": "dayssupply",
          "unit": "days"
        }
      },
      "displayName": {"path": "medication"},
      "displayFields": [
        {"label": "Medication", "path": "medication", "format": "text", "showInTooltip": true},
        {"label": "Days Supply", "path": "dayssupply", "format": "number", "showInTooltip": true}
      ]
    }
  ]
}
```

### Migration Helper

Use the Command Palette command "Medical Claims: Convert Legacy Configuration" to automatically convert your existing settings.

## Troubleshooting

### Common Issues

#### "No valid claim arrays found"
- **Cause**: The `arrayPath` doesn't match your JSON structure
- **Solution**: Verify the path exists in your JSON file
- **Example**: If your data is at `data.claims.rx`, use `"arrayPath": "data.claims.rx"`

#### "Date parsing error"
- **Cause**: Date format doesn't match your data
- **Solution**: Set the correct `format` in date configuration or use `globalDateFormat`
- **Example**: For "01/15/2024", use `"format": "MM/DD/YYYY"`

#### "Field not found" errors
- **Cause**: Field paths don't match your JSON structure
- **Solution**: Check field paths and use fallbacks for optional fields
- **Example**: Use `"fallbacks": ["alternateField"]` for optional fields

#### Claims not appearing
- **Cause**: Required fields are missing or invalid
- **Solution**: Check that ID, start date, and end date can be extracted
- **Debug**: Look at the console for detailed error messages

### Validation

The extension validates your configuration and provides helpful error messages:

1. **Open VSCode Settings**
2. **Search for "Medical Claims Timeline"**
3. **Check for validation errors** in the configuration fields
4. **Use the sample configurations** as templates

### Testing Configuration

1. **Create a test JSON file** with your data structure
2. **Configure one claim type** first
3. **Test with the timeline viewer**
4. **Add more claim types** incrementally
5. **Use the sample files** to verify functionality

### Getting Help

- **Check the console** (F12 → Console) for detailed error messages
- **Use sample configurations** as starting points
- **Validate JSON structure** with online JSON validators
- **Test with small data files** first
- **Report issues** with anonymized sample data

---

## Advanced Features

### Custom Formatters

Future versions will support custom JavaScript formatters for complex display logic.

### Conditional Display

Future versions will support conditional field display based on data values.

### Data Validation

Future versions will include built-in data validation and quality checks.

---

This flexible configuration system makes the Medical Claims Timeline Viewer adaptable to virtually any healthcare data format while maintaining ease of use and powerful visualization capabilities.