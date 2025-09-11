# Medical Claims Timeline Viewer

A VSCode extension that transforms medical claims data from JSON files into interactive timeline visualizations. Perfect for healthcare data analysts, researchers, and developers working with medical claims data.

![Medical Claims Timeline Demo](https://via.placeholder.com/800x400/45B7D1/FFFFFF?text=Medical+Claims+Timeline+Demo)

## Features

- 📊 **Interactive Timeline Visualization** - View medical claims on a chronological timeline with zoom and pan capabilities
- 🏥 **Multiple Claim Types Support** - Handles prescription claims (rxTba, rxHistory) and medical claims (medHistory)
- 🎨 **Color-Coded Claims** - Different colors for each claim type with customizable color schemes
- 🔍 **Detailed Tooltips** - Hover over claims to see detailed information
- ⚙️ **Configurable Data Mapping** - Customize JSON attribute paths for different data formats
- 📅 **Flexible Date Formats** - Support for various date formats with automatic parsing
- 🚀 **High Performance** - Efficiently handles large datasets with 1000+ claims
- 🛠️ **Error Recovery** - Comprehensive error handling with helpful suggestions

## Quick Start

### Installation

1. Install the extension from the VSCode Marketplace
2. Open a JSON file containing medical claims data
3. Right-click and select "View Timeline" or use `Ctrl+Shift+T` (Cmd+Shift+T on Mac)

### Supported Data Formats

The extension supports JSON files with the following structure:

#### Prescription Claims (rxTba and rxHistory)
```json
{
  "rxTba": [
    {
      "id": "rx101",
      "dos": "2024-01-15",
      "dayssupply": 30,
      "medication": "Lisinopril 10mg",
      "dosage": "10mg once daily",
      "prescriber": "Dr. Smith"
    }
  ],
  "rxHistory": [
    {
      "id": "rxh101", 
      "dos": "2024-01-10",
      "dayssupply": 7,
      "medication": "Amoxicillin 500mg"
    }
  ]
}
```

#### Medical Claims (medHistory)
```json
{
  "medHistory": {
    "claims": [
      {
        "claimId": "med101",
        "provider": "General Hospital",
        "lines": [
          {
            "lineId": "line1",
            "srvcStart": "2024-01-08",
            "srvcEnd": "2024-01-08", 
            "serviceType": "Office Visit",
            "description": "Routine checkup"
          }
        ]
      }
    ]
  }
}
```

## Usage

### Opening Timeline View

There are several ways to open the timeline view:

1. **Context Menu**: Right-click on a JSON file in the Explorer or Editor and select "View Timeline"
2. **Command Palette**: Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac) and search for "Medical Claims: View Timeline"
3. **Keyboard Shortcut**: Press `Ctrl+Shift+T` (Cmd+Shift+T on Mac) while a JSON file is open

### Interacting with the Timeline

- **Zoom**: Use mouse wheel or zoom controls to zoom in/out
- **Pan**: Click and drag to pan horizontally across the timeline
- **Hover**: Hover over claims to see detailed tooltips
- **Click**: Click on claims to see expanded details in a side panel
- **Legend**: Use the legend to identify different claim types

### Timeline Features

#### Color Coding
- **rxTba Claims**: Red (#FF6B6B) - Prescription claims to be adjudicated
- **rxHistory Claims**: Teal (#4ECDC4) - Historical prescription claims  
- **medHistory Claims**: Blue (#45B7D1) - Medical service claims

#### Date Handling
- **Prescription Claims**: Uses `dos` (date of service) as start date and `dos + dayssupply` as end date
- **Medical Claims**: Uses `srvcStart` and `srvcEnd` for date range
- **Chronological Sorting**: Most recent claims appear first

## Configuration

### Extension Settings

Configure the extension through VSCode settings (`File > Preferences > Settings` and search for "Medical Claims Timeline"):

#### Data Mapping Settings
```json
{
  "medicalClaimsTimeline.rxTbaPath": "rxTba",
  "medicalClaimsTimeline.rxHistoryPath": "rxHistory", 
  "medicalClaimsTimeline.medHistoryPath": "medHistory",
  "medicalClaimsTimeline.dateFormat": "YYYY-MM-DD"
}
```

#### Color Customization
```json
{
  "medicalClaimsTimeline.colors": {
    "rxTba": "#FF6B6B",
    "rxHistory": "#4ECDC4", 
    "medHistory": "#45B7D1"
  }
}
```

#### Custom Attribute Mappings
```json
{
  "medicalClaimsTimeline.customMappings": {
    "customField": "data.nested.field"
  }
}
```

### Supported Date Formats

The extension supports various date formats:

- `YYYY-MM-DD` (ISO format, default)
- `MM/DD/YYYY` (US format)
- `DD-MM-YYYY` (European format)
- `YYYY/MM/DD` (Alternative ISO)
- `DD/MM/YYYY` (UK format)
- `MM-DD-YYYY` (US alternative)

### Custom Data Structures

If your JSON uses different attribute names, configure custom paths:

```json
{
  "medicalClaimsTimeline.rxTbaPath": "prescriptions.pending",
  "medicalClaimsTimeline.rxHistoryPath": "prescriptions.history",
  "medicalClaimsTimeline.medHistoryPath": "medical.claims"
}
```

## Sample Data

The extension includes sample files to help you get started:

- `samples/rxTba-sample.json` - Prescription claims to be adjudicated
- `samples/rxHistory-sample.json` - Historical prescription claims
- `samples/medHistory-sample.json` - Medical service claims
- `samples/comprehensive-claims-sample.json` - All claim types combined

Access sample files through the command palette: "Medical Claims: Open Sample Files"

## Performance

The extension is optimized for large datasets:

- **Large Files**: Efficiently handles files with 1000+ claims
- **Memory Usage**: Optimized memory management for large datasets
- **Rendering**: Fast timeline rendering with D3.js
- **Streaming**: Progressive loading for very large files

### Performance Tips

- For files with 10,000+ claims, consider filtering data before visualization
- Use date range filtering to focus on specific time periods
- Large files may take a few seconds to process initially

## Troubleshooting

### Common Issues

#### "Invalid JSON Structure" Error
- **Cause**: JSON file doesn't contain expected medical claims structure
- **Solution**: Verify your file contains `rxTba`, `rxHistory`, or `medHistory` arrays
- **Help**: Check sample files for correct structure

#### "Date Format Error" 
- **Cause**: Date values don't match the configured format
- **Solution**: Update date format in settings or fix date values in JSON
- **Help**: Use ISO format (YYYY-MM-DD) for best compatibility

#### "No Claims Found"
- **Cause**: JSON structure is valid but contains no claim data
- **Solution**: Verify arrays contain claim objects with required fields
- **Help**: Check that `dos`, `dayssupply`, `srvcStart`, `srvcEnd` fields exist

#### Performance Issues
- **Cause**: Very large datasets or complex nested structures
- **Solution**: Consider data filtering or pagination
- **Help**: Contact support for files with 50,000+ claims

### Error Recovery

The extension provides helpful error messages and recovery options:

1. **Structure Validation Errors**: Links to sample files and configuration help
2. **Date Parsing Errors**: Format examples and settings shortcuts
3. **File Access Errors**: Retry options and permission guidance

### Getting Help

- **Documentation**: Check this README and inline help
- **Sample Files**: Use provided samples to verify functionality
- **Settings**: Review extension settings for configuration options
- **Issues**: Report bugs on GitHub with sample data (anonymized)

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/your-repo/medical-claims-timeline-viewer.git
cd medical-claims-timeline-viewer

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Package extension
vsce package
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- src/claimsParser.test.ts
npm test -- src/integration.test.ts

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm test -- src/performance.test.ts
```

### Project Structure

```
src/
├── extension.ts           # Main extension entry point
├── claimsParser.ts        # JSON parsing and data transformation
├── timelineRenderer.ts    # Webview management and timeline rendering
├── configManager.ts       # Settings and configuration management
├── errorHandling.ts       # Error handling utilities
├── types.ts              # TypeScript type definitions
└── test/                 # Test files
    ├── integration.test.ts
    ├── performance.test.ts
    └── *.test.ts

samples/                  # Sample JSON files
├── rxTba-sample.json
├── rxHistory-sample.json
├── medHistory-sample.json
└── comprehensive-claims-sample.json
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- **New Data Formats**: Support for additional medical data standards
- **Visualization Features**: Enhanced timeline interactions and views
- **Performance**: Optimizations for very large datasets
- **Documentation**: Improvements to user guides and examples
- **Testing**: Additional test cases and edge case coverage

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### Version 0.0.1 (Initial Release)
- Interactive timeline visualization for medical claims
- Support for rxTba, rxHistory, and medHistory claim types
- Configurable data mapping and color schemes
- Comprehensive error handling and recovery
- Performance optimization for large datasets
- Sample data files and documentation

## Support

- **Documentation**: This README and inline help
- **Issues**: [GitHub Issues](https://github.com/your-repo/medical-claims-timeline-viewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/medical-claims-timeline-viewer/discussions)
- **Email**: support@your-domain.com

---

**Note**: This extension is designed for development and analysis purposes. Ensure compliance with healthcare data regulations (HIPAA, etc.) when working with real patient data. Always anonymize or use synthetic data for testing and demonstrations.