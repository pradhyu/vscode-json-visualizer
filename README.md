# Medical Claims Timeline Viewer

A VSCode extension that visualizes medical claims data in an interactive timeline chart.

## Features

- Parse JSON files containing medical claims data
- Display prescription claims (rxTba, rxHistory) and medical claims (medHistory) on a timeline
- Interactive timeline with zoom, pan, and detail views
- Configurable JSON attribute paths
- Color-coded claim types with legends

## Usage

1. Open a JSON file containing medical claims data
2. Right-click and select "View Medical Claims Timeline" or use the command palette
3. Interact with the timeline to explore your data

## Configuration

Configure the extension through VSCode settings:

- `medicalClaimsTimeline.rxTbaPath`: Path to rxTba array (default: "rxTba")
- `medicalClaimsTimeline.rxHistoryPath`: Path to rxHistory array (default: "rxHistory")  
- `medicalClaimsTimeline.medHistoryPath`: Path to medHistory array (default: "medHistory")
- `medicalClaimsTimeline.dateFormat`: Date format for parsing (default: "YYYY-MM-DD")
- `medicalClaimsTimeline.colors`: Color scheme for claim types

## Development

1. Clone this repository
2. Run `npm install`
3. Press F5 to open a new Extension Development Host window
4. Test the extension with sample JSON files

## Sample Data Format

The extension expects JSON files with the following structure:

```json
{
  "rxTba": [
    {
      "dos": "2024-01-15",
      "dayssupply": 30,
      "medication": "Medication Name"
    }
  ],
  "rxHistory": [
    {
      "dos": "2024-02-01", 
      "dayssupply": 90,
      "medication": "Another Medication"
    }
  ],
  "medHistory": {
    "claims": [
      {
        "lines": [
          {
            "srvcStart": "2024-01-10",
            "srvcEnd": "2024-01-10",
            "serviceType": "Office Visit"
          }
        ]
      }
    ]
  }
}
```# vscode-json-visualizer
