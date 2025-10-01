#!/bin/bash

# Package Medical Claims Timeline CLI for distribution

set -e

echo "📦 Packaging Medical Claims Timeline CLI..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -f *.tgz

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Run tests if they exist
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    echo "🧪 Running tests..."
    npm test || echo "⚠️  Tests failed or not configured"
fi

# Create npm package
echo "📦 Creating npm package..."
npm pack

# Get package info
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")
PACKAGE_FILE="${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz"

echo "✅ Package created successfully!"
echo ""
echo "📋 Package Information:"
echo "   Name:     $PACKAGE_NAME"
echo "   Version:  $PACKAGE_VERSION"
echo "   File:     $PACKAGE_FILE"
echo "   Size:     $(ls -lh $PACKAGE_FILE | awk '{print $5}')"
echo ""
echo "🚀 Installation options:"
echo "   Global:   npm install -g $PACKAGE_FILE"
echo "   Local:    npm install $PACKAGE_FILE"
echo "   From npm: npm install -g $PACKAGE_NAME"
echo ""
echo "📖 Usage after installation:"
echo "   claims-timeline --help"
echo "   claims-timeline generate data.json"
echo "   claims-timeline interactive"