#!/bin/bash

# Medical Claims Timeline CLI Installation Script

set -e

echo "🏥 Installing Medical Claims Timeline CLI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt 14 ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please upgrade to Node.js 14+."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Install globally
echo "📦 Installing medical-claims-timeline-cli globally..."
npm install -g medical-claims-timeline-cli

echo "✅ Installation complete!"
echo ""
echo "🚀 You can now use the CLI with:"
echo "   claims-timeline --help"
echo "   mct --help"
echo ""
echo "📖 Quick start:"
echo "   claims-timeline generate your-data.json"
echo "   claims-timeline interactive"
echo ""
echo "📚 For more information:"
echo "   claims-timeline info"
echo "   https://github.com/medical-claims-timeline/cli"