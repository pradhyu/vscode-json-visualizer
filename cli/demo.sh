#!/bin/bash

# Medical Claims Timeline CLI Demo Script

set -e

echo "🏥 Medical Claims Timeline CLI Demo"
echo "=================================="
echo ""

# Check if CLI is built
if [ ! -f "dist/index.js" ]; then
    echo "📦 Building CLI..."
    npm run build
    echo ""
fi

echo "📋 1. Validating sample data..."
node dist/index.js validate examples/sample-data.json --verbose
echo ""

echo "📊 2. Generating timeline visualization..."
node dist/index.js generate examples/sample-data.json -o demo-timeline.html --title "Demo Medical Timeline"
echo ""

echo "🎨 3. Generating dark theme timeline..."
node dist/index.js generate examples/sample-data.json -o demo-dark-timeline.html --theme dark --title "Demo Timeline (Dark)"
echo ""

echo "📏 4. Generating large timeline..."
node dist/index.js generate examples/sample-data.json -o demo-large-timeline.html --width 1600 --height 900 --title "Large Timeline Demo"
echo ""

echo "✅ Demo complete!"
echo ""
echo "Generated files:"
echo "  - demo-timeline.html (default theme)"
echo "  - demo-dark-timeline.html (dark theme)"
echo "  - demo-large-timeline.html (large size)"
echo ""
echo "Open any of these files in your web browser to view the interactive timeline."