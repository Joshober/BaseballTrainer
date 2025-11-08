#!/usr/bin/env python3
"""
Script to install and verify YOLOv8 models for baseball swing analysis
This script downloads the YOLOv8n model if it doesn't exist and verifies the installation.
"""
import os
import sys
from pathlib import Path

def check_ultralytics():
    """Check if ultralytics is installed"""
    try:
        import ultralytics
        print(f"✅ ultralytics is installed (version: {ultralytics.__version__})")
        return True
    except ImportError:
        print("❌ ultralytics is not installed")
        return False

def install_ultralytics():
    """Install ultralytics package"""
    import subprocess
    import sys
    
    print("\n📦 Installing ultralytics...")
    try:
        # Try to use the same Python that's running this script
        python_cmd = sys.executable
        result = subprocess.run(
            [python_cmd, '-m', 'pip', 'install', 'ultralytics'],
            capture_output=True,
            text=True,
            check=True
        )
        print("✅ ultralytics installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install ultralytics: {e}")
        print(f"   Error output: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ Error installing ultralytics: {e}")
        return False

def install_model(model_name='yolov8n.pt', model_dir=None):
    """
    Download YOLOv8 model if it doesn't exist
    
    Args:
        model_name: Name of the model file (default: yolov8n.pt)
        model_dir: Directory where model should be stored (default: pose-detection-service)
    """
    # Determine model directory
    if model_dir is None:
        # Get the project root (parent of scripts directory)
        script_dir = Path(__file__).parent
        project_root = script_dir.parent
        model_dir = project_root / 'pose-detection-service'
    else:
        model_dir = Path(model_dir)
    
    model_path = model_dir / model_name
    
    print(f"\n📦 Installing YOLOv8 model: {model_name}")
    print(f"   Target directory: {model_dir}")
    print(f"   Model path: {model_path}")
    
    # Check if model already exists
    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024 * 1024)
        print(f"✅ Model already exists ({size_mb:.2f} MB)")
        return True
    
    # Check if ultralytics is installed
    if not check_ultralytics():
        print("\n❌ Cannot download model: ultralytics is not installed")
        print("   Please install it first: pip install ultralytics")
        return False
    
    try:
        from ultralytics import YOLO
        
        print(f"\n⬇️  Downloading {model_name}...")
        print("   This may take a few minutes on first run...")
        
        # Change to model directory for download
        original_cwd = os.getcwd()
        try:
            os.chdir(model_dir)
            # YOLO will automatically download the model if it doesn't exist
            model = YOLO(model_name)
            print(f"✅ Model downloaded successfully!")
            
            # Verify the model file exists
            if model_path.exists():
                size_mb = model_path.stat().st_size / (1024 * 1024)
                print(f"   Model size: {size_mb:.2f} MB")
                return True
            else:
                print("⚠️  Model object created but file not found at expected path")
                return False
        finally:
            os.chdir(original_cwd)
            
    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        return False

def verify_model(model_name='yolov8n.pt', model_dir=None):
    """
    Verify that the model can be loaded and used
    
    Args:
        model_name: Name of the model file
        model_dir: Directory where model is stored
    """
    if model_dir is None:
        script_dir = Path(__file__).parent
        project_root = script_dir.parent
        model_dir = project_root / 'pose-detection-service'
    else:
        model_dir = Path(model_dir)
    
    model_path = model_dir / model_name
    
    print(f"\n🔍 Verifying model: {model_name}")
    
    if not model_path.exists():
        print(f"❌ Model file not found: {model_path}")
        return False
    
    if not check_ultralytics():
        return False
    
    try:
        from ultralytics import YOLO
        import numpy as np
        
        print("   Loading model...")
        model = YOLO(str(model_path))
        
        # Test with a dummy image
        print("   Testing model with dummy image...")
        dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
        results = model(dummy_image, verbose=False)
        
        print("✅ Model loaded and tested successfully!")
        print(f"   Model classes: {len(model.names)} classes")
        print(f"   Model input size: {model.imgsz}")
        return True
        
    except Exception as e:
        print(f"❌ Error verifying model: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main installation function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Install YOLOv8 models for baseball swing analysis')
    parser.add_argument('--auto', '--yes', '-y', action='store_true', 
                       help='Automatically install dependencies without prompting')
    args = parser.parse_args()
    
    print("=" * 60)
    print("YOLOv8 Model Installation Script")
    print("=" * 60)
    
    # Check ultralytics
    if not check_ultralytics():
        print("\n💡 ultralytics is required for YOLOv8 models")
        
        if args.auto:
            # Auto-install if --auto flag is set
            if not install_ultralytics():
                print("\n❌ Failed to install ultralytics automatically")
                print("   Please install it manually:")
                print("   pip install ultralytics")
                print("\n   Or for the pose detection service:")
                print("   cd pose-detection-service && pip install -r requirements.txt")
                sys.exit(1)
        else:
            # Interactive mode
            response = input("   Would you like to install it now? (y/n): ").strip().lower()
            
            if response == 'y' or response == 'yes':
                if not install_ultralytics():
                    print("\n❌ Failed to install ultralytics automatically")
                    print("   Please install it manually:")
                    print("   pip install ultralytics")
                    print("\n   Or for the pose detection service:")
                    print("   cd pose-detection-service && pip install -r requirements.txt")
                    sys.exit(1)
            else:
                print("\n💡 To install ultralytics manually:")
                print("   pip install ultralytics")
                print("\n   Or for the pose detection service:")
                print("   cd pose-detection-service && pip install -r requirements.txt")
                sys.exit(1)
    
    # Install model
    success = install_model('yolov8n.pt')
    
    if success:
        # Verify model
        verify_success = verify_model('yolov8n.pt')
        
        if verify_success:
            print("\n" + "=" * 60)
            print("✅ Model installation completed successfully!")
            print("=" * 60)
            print("\nThe YOLOv8n model is ready for use in:")
            print("  • Person detection")
            print("  • Bat detection")
            print("  • Ball detection")
            sys.exit(0)
        else:
            print("\n⚠️  Model downloaded but verification failed")
            sys.exit(1)
    else:
        print("\n❌ Model installation failed")
        sys.exit(1)

if __name__ == '__main__':
    main()

