# Configuration Examples

This document provides practical examples of how to configure the Claims Timeline extension for different data formats.

## Table of Contents

1. [Basic Custom Format](#basic-custom-format)
2. [Healthcare System Integration](#healthcare-system-integration)
3. [Insurance Claims Format](#insurance-claims-format)
4. [Multi-Source Data](#multi-source-data)
5. [Complex Date Calculations](#complex-date-calculations)
6. [Migration Examples](#migration-examples)

## Basic Custom Format

### Scenario
You have prescription data in a simple custom format.

### Data Structure
```json
{
  "patient": {
    "prescriptions": [
      {
        "id": "RX001",
        "medication": "Lisinopril 10mg",
        "prescribed": "2024-01-15",
        "duration": 30,
        "doctor": "Dr. Smith",
        "cost": 15.00
      }
    ]
  }
}
```

### Configuration
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "prescriptions",
      "arrayPath": "patient.prescriptions",
      "color": "#FF6B6B",
      "idField": {
        "path": "id"
      },
      "startDate": {
        "type": "field",
        "field": "prescribed"
      },
      "endDate": {
        "type": "calculation",
        "calculation": {
          "baseField": "prescribed",
          "operation": "add",
          "value": "duration",
          "unit": "days"
        }
      },
      "displayName": {
        "path": "medication"
      },
      "displayFields": [
        {
          "label": "Medication",
          "path": "medication",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Duration (days)",
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

## Healthcare System Integration

### Scenario
Integration with an Electronic Health Record (EHR) system that exports data in a specific format.

### Data Structure
```json
{
  "ehrExport": {
    "patientId": "PAT12345",
    "medications": {
      "active": [
        {
          "rxNumber": "RX001",
          "drug": {
            "name": "Lisinopril",
            "strength": "10mg",
            "form": "tablet"
          },
          "therapy": {
            "startDate": "2024-01-15",
            "endDate": "2024-02-14"
          },
          "prescriber": {
            "name": "Dr. Smith",
            "npi": "1234567890"
          }
        }
      ]
    },
    "procedures": [
      {
        "procedureId": "PROC001",
        "cpt": "99213",
        "description": "Office visit",
        "serviceDate": "2024-01-10",
        "provider": {
          "name": "Dr. Johnson",
          "facility": "Main Clinic"
        }
      }
    ]
  }
}
```

### Configuration
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "medications",
      "arrayPath": "ehrExport.medications.active",
      "color": "#FF6B6B",
      "idField": {
        "path": "rxNumber"
      },
      "startDate": {
        "type": "field",
        "field": "therapy.startDate"
      },
      "endDate": {
        "type": "field",
        "field": "therapy.endDate"
      },
      "displayName": {
        "path": "drug.name"
      },
      "displayFields": [
        {
          "label": "Drug",
          "path": "drug.name",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Strength",
          "path": "drug.strength",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Form",
          "path": "drug.form",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Prescriber",
          "path": "prescriber.name",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        }
      ]
    },
    {
      "name": "procedures",
      "arrayPath": "ehrExport.procedures",
      "color": "#4ECDC4",
      "idField": {
        "path": "procedureId"
      },
      "startDate": {
        "type": "field",
        "field": "serviceDate"
      },
      "endDate": {
        "type": "field",
        "field": "serviceDate"
      },
      "displayName": {
        "path": "description"
      },
      "displayFields": [
        {
          "label": "Procedure",
          "path": "description",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "CPT Code",
          "path": "cpt",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Provider",
          "path": "provider.name",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Facility",
          "path": "provider.facility",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        }
      ]
    }
  ]
}
```

## Insurance Claims Format

### Scenario
Processing insurance claims data with complex financial information.

### Data Structure
```json
{
  "claims": {
    "medical": [
      {
        "claimNumber": "CLM001",
        "serviceLines": [
          {
            "lineNumber": 1,
            "serviceStart": "2024-01-10",
            "serviceEnd": "2024-01-10",
            "procedure": {
              "code": "99213",
              "description": "Office visit"
            },
            "charges": {
              "billed": 150.00,
              "allowed": 120.00,
              "paid": 96.00,
              "patientResponsibility": 24.00
            }
          }
        ],
        "provider": {
          "name": "Dr. Smith",
          "taxId": "12-3456789"
        }
      }
    ],
    "pharmacy": [
      {
        "claimNumber": "RX001",
        "fillDate": "2024-01-15",
        "drug": {
          "ndc": "12345-678-90",
          "name": "Lisinopril 10mg"
        },
        "supply": {
          "daysSupply": 30,
          "quantity": 30
        },
        "costs": {
          "ingredientCost": 10.00,
          "dispensingFee": 3.00,
          "copay": 5.00
        }
      }
    ]
  }
}
```

### Configuration
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "medical",
      "arrayPath": "claims.medical",
      "color": "#45B7D1",
      "idField": {
        "path": "claimNumber"
      },
      "startDate": {
        "type": "field",
        "field": "serviceLines[0].serviceStart"
      },
      "endDate": {
        "type": "field",
        "field": "serviceLines[0].serviceEnd",
        "fallbacks": ["serviceLines[0].serviceStart"]
      },
      "displayName": {
        "path": "serviceLines[0].procedure.description",
        "defaultValue": "Medical Service"
      },
      "displayFields": [
        {
          "label": "Service",
          "path": "serviceLines[0].procedure.description",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "CPT Code",
          "path": "serviceLines[0].procedure.code",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Provider",
          "path": "provider.name",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Billed Amount",
          "path": "serviceLines[0].charges.billed",
          "format": "currency",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Paid Amount",
          "path": "serviceLines[0].charges.paid",
          "format": "currency",
          "showInTooltip": false,
          "showInDetails": true
        }
      ]
    },
    {
      "name": "pharmacy",
      "arrayPath": "claims.pharmacy",
      "color": "#FF6B6B",
      "idField": {
        "path": "claimNumber"
      },
      "startDate": {
        "type": "field",
        "field": "fillDate"
      },
      "endDate": {
        "type": "calculation",
        "calculation": {
          "baseField": "fillDate",
          "operation": "add",
          "value": "supply.daysSupply",
          "unit": "days"
        }
      },
      "displayName": {
        "path": "drug.name"
      },
      "displayFields": [
        {
          "label": "Drug",
          "path": "drug.name",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "NDC",
          "path": "drug.ndc",
          "format": "text",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Days Supply",
          "path": "supply.daysSupply",
          "format": "number",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Quantity",
          "path": "supply.quantity",
          "format": "number",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Copay",
          "path": "costs.copay",
          "format": "currency",
          "showInTooltip": false,
          "showInDetails": true
        }
      ]
    }
  ]
}
```

## Multi-Source Data

### Scenario
Combining data from multiple sources (EHR, pharmacy, lab) into a single timeline.

### Data Structure
```json
{
  "sources": {
    "ehr": {
      "visits": [
        {
          "visitId": "V001",
          "date": "2024-01-10",
          "type": "Office Visit",
          "provider": "Dr. Smith"
        }
      ]
    },
    "pharmacy": {
      "dispensings": [
        {
          "rxId": "RX001",
          "dispensedDate": "2024-01-15",
          "medication": "Lisinopril 10mg",
          "daysSupply": 30
        }
      ]
    },
    "lab": {
      "results": [
        {
          "orderId": "LAB001",
          "collectedDate": "2024-01-08",
          "resultDate": "2024-01-09",
          "testName": "Complete Blood Count",
          "status": "Normal"
        }
      ]
    }
  }
}
```

### Configuration
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "visits",
      "arrayPath": "sources.ehr.visits",
      "color": "#4ECDC4",
      "idField": {
        "path": "visitId"
      },
      "startDate": {
        "type": "field",
        "field": "date"
      },
      "endDate": {
        "type": "field",
        "field": "date"
      },
      "displayName": {
        "path": "type"
      },
      "displayFields": [
        {
          "label": "Visit Type",
          "path": "type",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Provider",
          "path": "provider",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        }
      ]
    },
    {
      "name": "medications",
      "arrayPath": "sources.pharmacy.dispensings",
      "color": "#FF6B6B",
      "idField": {
        "path": "rxId"
      },
      "startDate": {
        "type": "field",
        "field": "dispensedDate"
      },
      "endDate": {
        "type": "calculation",
        "calculation": {
          "baseField": "dispensedDate",
          "operation": "add",
          "value": "daysSupply",
          "unit": "days"
        }
      },
      "displayName": {
        "path": "medication"
      },
      "displayFields": [
        {
          "label": "Medication",
          "path": "medication",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Days Supply",
          "path": "daysSupply",
          "format": "number",
          "showInTooltip": true,
          "showInDetails": true
        }
      ]
    },
    {
      "name": "labResults",
      "arrayPath": "sources.lab.results",
      "color": "#45B7D1",
      "idField": {
        "path": "orderId"
      },
      "startDate": {
        "type": "field",
        "field": "collectedDate"
      },
      "endDate": {
        "type": "field",
        "field": "resultDate",
        "fallbacks": ["collectedDate"]
      },
      "displayName": {
        "path": "testName"
      },
      "displayFields": [
        {
          "label": "Test",
          "path": "testName",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Status",
          "path": "status",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Collection Date",
          "path": "collectedDate",
          "format": "date",
          "showInTooltip": false,
          "showInDetails": true
        },
        {
          "label": "Result Date",
          "path": "resultDate",
          "format": "date",
          "showInTooltip": false,
          "showInDetails": true
        }
      ]
    }
  ]
}
```

## Complex Date Calculations

### Scenario
Handling various date calculation scenarios.

### Examples

#### 1. Appointment with Duration in Minutes
```json
{
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

#### 2. Treatment Course with Weeks
```json
{
  "endDate": {
    "type": "calculation",
    "calculation": {
      "baseField": "treatmentStart",
      "operation": "add",
      "value": "treatmentWeeks",
      "unit": "weeks"
    }
  }
}
```

#### 3. Fixed Duration (30 days)
```json
{
  "endDate": {
    "type": "calculation",
    "calculation": {
      "baseField": "startDate",
      "operation": "add",
      "value": 30,
      "unit": "days"
    }
  }
}
```

#### 4. Subtract Processing Time
```json
{
  "startDate": {
    "type": "calculation",
    "calculation": {
      "baseField": "completedDate",
      "operation": "subtract",
      "value": "processingDays",
      "unit": "days"
    }
  }
}
```

## Migration Examples

### From Legacy to Flexible Configuration

#### Legacy Configuration
```json
{
  "claimsTimeline.rxTbaPath": "prescriptions",
  "claimsTimeline.colors": {
    "rxTba": "#FF6B6B"
  },
  "claimsTimeline.dateFormat": "YYYY-MM-DD"
}
```

#### Equivalent Flexible Configuration
```json
{
  "claimsTimeline.claimTypes": [
    {
      "name": "rxTba",
      "arrayPath": "prescriptions",
      "color": "#FF6B6B",
      "idField": {
        "path": "id",
        "defaultValue": "auto-generated"
      },
      "startDate": {
        "type": "field",
        "field": "dos",
        "fallbacks": ["fillDate", "prescriptionDate"]
      },
      "endDate": {
        "type": "calculation",
        "calculation": {
          "baseField": "dos",
          "operation": "add",
          "value": "dayssupply",
          "unit": "days"
        }
      },
      "displayName": {
        "path": "medication",
        "defaultValue": "Prescription"
      },
      "displayFields": [
        {
          "label": "Medication",
          "path": "medication",
          "format": "text",
          "showInTooltip": true,
          "showInDetails": true
        },
        {
          "label": "Days Supply",
          "path": "dayssupply",
          "format": "number",
          "showInTooltip": true,
          "showInDetails": true
        }
      ]
    }
  ],
  "claimsTimeline.globalDateFormat": "YYYY-MM-DD"
}
```

## Tips and Best Practices

### 1. Start Simple
Begin with one claim type and basic configuration, then add complexity.

### 2. Use Fallbacks
Always provide fallback fields for optional data:
```json
"startDate": {
  "type": "field",
  "field": "primaryDateField",
  "fallbacks": ["secondaryDateField", "tertiaryDateField"]
}
```

### 3. Test with Sample Data
Create small test files to verify your configuration before using with large datasets.

### 4. Validate JSON Structure
Use online JSON validators to ensure your configuration is syntactically correct.

### 5. Use Meaningful Names
Choose descriptive names for claim types that will be clear in the timeline legend.

### 6. Color Coordination
Use distinct colors that are accessible and meaningful to your users.

### 7. Display Field Strategy
- Show essential information in tooltips
- Include detailed information in detail panels
- Use appropriate formatting for different data types

---

These examples should help you configure the Claims Timeline extension for virtually any healthcare data format. Remember that the flexible configuration system is designed to be powerful yet intuitive - start with the basics and build up complexity as needed.