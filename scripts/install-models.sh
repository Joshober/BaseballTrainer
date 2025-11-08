#!/bin/bash
# Script to install YOLOv8 models for baseball swing analysis
# This script checks for Python, installs dependencies, and downloads the model

set -e

echo "============================================================"
echo "YOLOv8 Model Installation Script"
echo "============================================================"
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POSE_SERVICE_DIR="$PROJECT_ROOT/pose-detection-service"

# Check Python version
echo "🔍 Checking Python installation..."
if command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
    echo "✅ Found Python 3.10"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    echo "✅ Found Python: $PYTHON_VERSION"
else
    echo "❌ Python 3 not found. Please install Python 3.10 or later."
    exit 1
fi

# Check if ultralytics is installed
echo ""
echo "🔍 Checking ultralytics installation..."
if $PYTHON_CMD -c "import ultralytics" 2>/dev/null; then
    VERSION=$($PYTHON_CMD -c "import ultralytics; print(ultralytics.__version__)" 2>/dev/null)
    echo "✅ ultralytics is installed (version: $VERSION)"
else
    echo "❌ ultralytics is not installed"
    echo ""
    echo "📦 Installing ultralytics..."
    
    # Try to install from requirements.txt first
    if [ -f "$POSE_SERVICE_DIR/requirements.txt" ]; then
        echo "   Installing from pose-detection-service/requirements.txt..."
        cd "$POSE_SERVICE_DIR"
        $PYTHON_CMD -m pip install -r requirements.txt
    else
        echo "   Installing ultralytics directly..."
        $PYTHON_CMD -m pip install ultralytics
    fi
    
    if $PYTHON_CMD -c "import ultralytics" 2>/dev/null; then
        echo "✅ ultralytics installed successfully"
    else
        echo "❌ Failed to install ultralytics"
        echo "   Please install manually: pip install ultralytics"
        exit 1
    fi
fi

# Run the Python installation script
echo ""
echo "📦 Installing YOLOv8 model..."
cd "$PROJECT_ROOT"
$PYTHON_CMD scripts/install-models.py --auto

echo ""
echo "============================================================"
echo "✅ Model installation complete!"
echo "============================================================"
