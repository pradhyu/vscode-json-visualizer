# Sample Medical Claims Data Files

This directory contains sample JSON files for testing and demonstrating the Medical Claims Timeline Viewer extension.

## File Descriptions

### `rxTba-sample.json`
Contains sample prescription claims data in the `rxTba` array format. Includes:
- 4 prescription claims with realistic medication names and dosages
- Date of service (`dos`) and days supply (`dayssupply`) for timeline calculation
- Additional metadata like prescriber, pharmacy, NDC codes, and copay amounts

### `rxHistory-sample.json`
Contains historical prescription claims data in the `rxHistory` array format. Includes:
- 4 historical prescription fills showing medication history over time
- Similar structure to rxTba but with additional fields like fill date and refills remaining
- Demonstrates medication changes and refill patterns

### `medHistory-sample.json`
Contains medical claims data in the `medHistory.claims[]` structure. Includes:
- 4 medical claims with various service types (ER visit, office visits, imaging, cardiac monitoring)
- Each claim contains multiple service lines with `srvcStart` and `srvcEnd` dates
- Realistic procedure codes, descriptions, and financial information

### `comprehensive-claims-sample.json`
A complete sample file combining all three claim types (`rxTba`, `rxHistory`, and `medHistory`). This file:
- Demonstrates how all claim types can coexist in a single JSON file
- Shows overlapping timeframes between prescription and medical claims
- Includes patient information header for context
- Provides a realistic dataset for testing the complete timeline visualization

## Usage

These sample files can be used to:
1. Test the extension's JSON parsing capabilities
2. Demonstrate timeline visualization features
3. Validate date range calculations and claim type differentiation
4. Test interactive features like tooltips and detail panels

## Data Notes

- All patient information uses placeholder values (e.g., `[Patient Name]`)
- Dates span from October 2023 to March 2024 to show historical progression
- Financial amounts and medical codes are realistic but fictional
- Medication names and dosages reflect common prescriptions