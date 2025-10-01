# Medical Claims Timeline CLI

A powerful command-line tool that transforms medical claims JSON data into beautiful, interactive timeline visualizations. Generate standalone HTML files that can be viewed in any web browser.

![Medical Claims Timeline CLI Demo](https://via.placeholder.com/800x400/45B7D1/FFFFFF?text=Medical+Claims+Timeline+CLI)

## Features

- 🚀 **Fast & Lightweight** - Generate timelines in seconds
- 📊 **Interactive Visualizations** - Zoom, pan, and explore your data
- 🎨 **Beautiful Design** - Professional-looking timelines with customizable themes
- 📱 **Responsive** - Works on desktop, tablet, and mobile devices
- 🌙 **Dark Mode Support** - Automatic theme detection with manual override
- 📁 **Standalone Output** - Self-contained HTML files with no dependencies
- ⚙️ **Configurable** - Flexible configuration options for different data formats
- 🔍 **Data Validation** - Built-in validation with helpful error messages
- 💻 **Cross-Platform** - Works on Windows, macOS, and Linux

## Installation

### Global Installation (Recommended)

```bash
npm install -g medical-claims-timeline-cli
```

After installation, you can use the `claims-timeline` or `mct` command from anywhere:

```bash
claims-timeline --help
mct --help
```

### Local Installation

```bash
npm install medical-claims-timeline-cli
npx claims-timeline --help
```

### From Source

```bash
git clone https://github.com/medical-claims-timeline/cli.git
cd cli
npm install
npm run build
npm link
```

## Quick Start

### Basic Usage

Generate a timeline from a JSON file:

```bash
claims-timeline generate data.json
```

This creates `timeline.html` in the current directory.

### Interactive Mode

For guided setup with prompts:

```bash
claims-timeline interactive
```

### Advanced Usage

```bash
# Custom output file and open in browser
claims-timeline generate data.json -o my-timeline.html --open

# Custom theme and title
claims-timeline generate data.json --theme dark --title "Patient Timeline"

# Custom dimensions
claims-timeline generate data.json --width 1600 --height 800

# Use configuration file
claims-timeline generate data.json -c config.json
```

## Commands

### `generate` (alias: `gen`)

Generate timeline visualization from JSON file.

```bash
claims-timeline generate <input> [options]
```

**Arguments:**
- `<input>` - Path to input JSON file

**Options:**
- `-o, --output <path>` - Output HTML file path (default: timeline.html)
- `-c, --config <path>` - Configuration file path
- `--open` - Open generated HTML file in browser
- `--theme <theme>` - Color theme: light|dark|auto (default: auto)
- `--title <title>` - Timeline title
- `--no-interactive` - Disable interactive features
- `--format <format>` - Date format (default: YYYY-MM-DD)
- `--width <width>` - Timeline width in pixels (default: 1200)
- `--height <height>` - Timeline height in pixels (default: 600)

**Examples:**

```bash
# Basic generation
claims-timeline generate claims.json

# With custom output and browser opening
claims-timeline generate claims.json -o timeline.html --open

# Dark theme with custom title
claims-timeline generate claims.json --theme dark --title "Medical History"

# Large timeline with custom dimensions
claims-timeline generate claims.json --width 1600 --height 900

# US date format
claims-timeline generate claims.json --format "MM/DD/YYYY"
```

### `interactive` (alias: `i`)

Interactive mode with guided prompts.

```bash
claims-timeline interactive
```

This mode will ask you for:
- Input JSON file path
- Output HTML file path
- Timeline title (optional)
- Color theme preference
- Date format
- Whether to open in browser

### `validate` (alias: `val`)

Validate JSON file structure and show analysis.

```bash
claims-timeline validate <input> [options]
```

**Options:**
- `-v, --verbose` - Show detailed analysis

**Examples:**

```bash
# Basic validation
claims-timeline validate claims.json

# Detailed analysis
claims-timeline validate claims.json --verbose
```

### `info`

Show system information and usage examples.

```bash
claims-timeline info
```

## Supported Data Formats

The CLI supports standard medical claims JSON formats:

### Prescription Claims (rxTba)

```json
{
  "rxTba": [
    {
      "id": "rx101",
      "dos": "2024-01-15",
      "dayssupply": 30,
      "medication": "Lisinopril 10mg",
      "dosage": "10mg once daily",
      "prescriber": "Dr. Smith",
      "pharmacy": "CVS Pharmacy",
      "ndc": "12345-678-90",
      "quantity": "30 tablets",
      "copay": "$10.00"
    }
  ]
}
```

### Prescription History (rxHistory)

```json
{
  "rxHistory": [
    {
      "id": "rxh101",
      "dos": "2024-01-10",
      "dayssupply": 7,
      "medication": "Amoxicillin 500mg",
      "dosage": "500mg three times daily",
      "prescriber": "Dr. Johnson"
    }
  ]
}
```

### Medical Claims (medHistory)

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
            "description": "Routine checkup",
            "procedureCode": "99213",
            "chargedAmount": "$150.00",
            "allowedAmount": "$120.00",
            "paidAmount": "$96.00"
          }
        ]
      }
    ]
  }
}
```

### Combined Data

You can include multiple claim types in a single file:

```json
{
  "rxTba": [...],
  "rxHistory": [...],
  "medHistory": {...}
}
```

## Configuration

### Configuration File

Create a JSON configuration file to customize parsing behavior:

```json
{
  "rxTbaPath": "rxTba",
  "rxHistoryPath": "rxHistory", 
  "medHistoryPath": "medHistory",
  "dateFormat": "YYYY-MM-DD",
  "colors": {
    "rxTba": "#FF6B6B",
    "rxHistory": "#4ECDC4",
    "medHistory": "#45B7D1"
  }
}
```

Use with the `-c` option:

```bash
claims-timeline generate data.json -c config.json
```

### Configuration Options

| Option | Description | Default | Valid Values |
|--------|-------------|---------|--------------|
| `rxTbaPath` | JSON path to rxTba array | `"rxTba"` | Any string |
| `rxHistoryPath` | JSON path to rxHistory array | `"rxHistory"` | Any string |
| `medHistoryPath` | JSON path to medHistory object | `"medHistory"` | Any string |
| `dateFormat` | Date parsing format | `"YYYY-MM-DD"` | See Date Formats |
| `colors.rxTba` | Color for rxTba claims | `"#FF6B6B"` | Hex color |
| `colors.rxHistory` | Color for rxHistory claims | `"#4ECDC4"` | Hex color |
| `colors.medHistory` | Color for medHistory claims | `"#45B7D1"` | Hex color |

### Date Formats

Supported date formats:

- `YYYY-MM-DD` - ISO format (2024-01-15)
- `MM/DD/YYYY` - US format (01/15/2024)
- `DD-MM-YYYY` - European format (15-01-2024)
- `YYYY/MM/DD` - Alternative ISO (2024/01/15)
- `DD/MM/YYYY` - UK format (15/01/2024)
- `MM-DD-YYYY` - US alternative (01-15-2024)

### Themes

Available themes:

- `auto` - Automatically detect system preference (default)
- `light` - Light theme with white background
- `dark` - Dark theme with dark background

## Output Features

The generated HTML file includes:

### Interactive Timeline
- **Zoom & Pan** - Mouse wheel to zoom, click and drag to pan
- **Hover Tooltips** - Detailed information on hover
- **Click Details** - Side panel with complete claim information
- **Responsive Design** - Works on all screen sizes

### Visual Elements
- **Color-coded Claims** - Different colors for each claim type
- **Timeline Axis** - Clear date labels and gridlines
- **Legend** - Claim type identification
- **Statistics** - Total claims, types, and date range

### Controls
- **Zoom Controls** - Zoom in, zoom out, and reset buttons
- **Theme Toggle** - Switch between light, dark, and auto themes
- **Details Panel** - Expandable side panel for claim details

### Accessibility
- **Keyboard Navigation** - Full keyboard support
- **Screen Reader Support** - Proper ARIA labels and descriptions
- **High Contrast** - Clear visual distinctions
- **Responsive Text** - Scalable fonts and layouts

## Examples

### Basic Timeline Generation

```bash
# Generate timeline from claims data
claims-timeline generate medical-claims.json

# Output: timeline.html (opens in browser)
```

### Custom Output and Styling

```bash
# Generate with custom filename and dark theme
claims-timeline generate claims.json \
  -o patient-timeline.html \
  --theme dark \
  --title "Patient Medical History" \
  --open
```

### Large Dataset with Custom Dimensions

```bash
# Generate large timeline for detailed analysis
claims-timeline generate large-dataset.json \
  --width 1800 \
  --height 1000 \
  --title "Comprehensive Claims Analysis"
```

### Using Configuration File

Create `config.json`:
```json
{
  "dateFormat": "MM/DD/YYYY",
  "colors": {
    "rxTba": "#E74C3C",
    "rxHistory": "#3498DB", 
    "medHistory": "#2ECC71"
  }
}
```

Generate timeline:
```bash
claims-timeline generate claims.json -c config.json --open
```

### Validation and Analysis

```bash
# Validate file structure
claims-timeline validate claims.json

# Detailed analysis with statistics
claims-timeline validate claims.json --verbose
```

## Error Handling

The CLI provides helpful error messages for common issues:

### File Errors
- **File not found** - Check file path and permissions
- **Invalid JSON** - Validate JSON syntax
- **Large files** - Warning for files over 100MB

### Data Errors
- **No claims found** - Verify data structure
- **Invalid dates** - Check date format and values
- **Missing required fields** - Ensure required fields are present

### Configuration Errors
- **Invalid config file** - Check JSON syntax in config
- **Invalid date format** - Use supported date formats
- **Invalid colors** - Use valid hex colors (e.g., #FF6B6B)

### Output Errors
- **Permission denied** - Check write permissions
- **Invalid output path** - Verify directory exists
- **Disk space** - Ensure sufficient disk space

## Performance

### Optimization Tips

- **File Size** - Files under 10MB process fastest
- **Data Structure** - Flat structures parse faster than deeply nested
- **Date Formats** - ISO format (YYYY-MM-DD) parses fastest
- **Memory** - Large datasets may require more RAM

### Performance Benchmarks

| File Size | Claims | Processing Time | Memory Usage |
|-----------|--------|----------------|--------------|
| 1MB | ~1,000 | <1 second | ~50MB |
| 10MB | ~10,000 | 2-3 seconds | ~100MB |
| 50MB | ~50,000 | 10-15 seconds | ~300MB |
| 100MB | ~100,000 | 30-45 seconds | ~500MB |

## Troubleshooting

### Common Issues

**Q: Timeline appears empty**
A: Check that your JSON contains valid claim arrays with required fields (id, dos, etc.)

**Q: Dates appear incorrect**
A: Verify date format matches your data. Use `--format` option or configuration file.

**Q: Colors not showing**
A: Ensure color values are valid hex codes (e.g., #FF6B6B, not red).

**Q: File too large error**
A: Split large files or increase Node.js memory limit: `node --max-old-space-size=4096`

**Q: Permission denied**
A: Check file permissions and ensure output directory is writable.

### Debug Mode

For detailed debugging information:

```bash
# Enable verbose logging
DEBUG=* claims-timeline generate data.json

# Node.js debugging
node --inspect claims-timeline generate data.json
```

### Getting Help

- **Documentation** - This README and inline help
- **Examples** - Use `claims-timeline info` for examples
- **Validation** - Use `claims-timeline validate` to check data
- **Issues** - Report bugs on GitHub

## Development

### Building from Source

```bash
git clone https://github.com/medical-claims-timeline/cli.git
cd cli
npm install
npm run build
```

### Development Mode

```bash
# Watch mode for development
npm run dev

# Run tests
npm test

# Type checking
npm run type-check
```

### Project Structure

```
cli/
├── src/
│   ├── index.ts              # Main CLI entry point
│   ├── parser/
│   │   └── ClaimsParser.ts   # JSON parsing logic
│   ├── generator/
│   │   └── HtmlGenerator.ts  # HTML generation
│   ├── config/
│   │   └── ConfigManager.ts  # Configuration management
│   └── utils/
│       ├── validators.ts     # Input validation
│       └── formatters.ts     # Output formatting
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Areas for Contribution

- **New Features** - Additional visualization options
- **Data Formats** - Support for more medical data standards
- **Performance** - Optimizations for large datasets
- **Documentation** - Improvements and examples
- **Testing** - Additional test cases

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Support

- **Documentation** - This README and inline help
- **Issues** - [GitHub Issues](https://github.com/medical-claims-timeline/cli/issues)
- **Discussions** - [GitHub Discussions](https://github.com/medical-claims-timeline/cli/discussions)

---

**Note**: This tool is designed for development and analysis purposes. Always ensure compliance with healthcare data regulations (HIPAA, etc.) when working with real patient data. Use anonymized or synthetic data for testing and demonstrations.