#!/bin/bash
# Shell script wrapper for model installation
# This script runs the TypeScript installation script

echo "Installing AI models for Baseball Swing Analysis..."
echo ""

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo "Error: tsx is not installed."
    echo "Please install it with: npm install -g tsx"
    echo "Or run: npm install"
    exit 1
fi

# Run the TypeScript script
tsx scripts/install-models.ts

