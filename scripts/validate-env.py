#!/usr/bin/env python3
"""
Validate .env.local file for syntax errors
Helps identify issues with python-dotenv parsing
"""
import sys
from pathlib import Path
from dotenv import load_dotenv

def validate_env_file(file_path: Path):
    """Validate .env.local file for syntax errors"""
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return False
    
    print(f"📄 Validating: {file_path}")
    
    # Read the file to check for common issues
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"❌ Failed to read file: {e}")
        return False
    
    errors = []
    warnings = []
    
    for i, line in enumerate(lines, start=1):
        line_stripped = line.strip()
        
        # Skip empty lines and comments
        if not line_stripped or line_stripped.startswith('#'):
            continue
        
        # Check for common issues
        if '=' not in line_stripped:
            errors.append(f"Line {i}: Missing '=' separator")
            continue
        
        key, value = line_stripped.split('=', 1)
        key = key.strip()
        value = value.strip()
        
        # Check for unquoted values with special characters
        if value and not (value.startswith('"') and value.endswith('"')) and not (value.startswith("'") and value.endswith("'")):
            if any(char in value for char in ['#', ' ', '=', '$', '{', '}']):
                warnings.append(f"Line {i}: Value contains special characters - consider quoting: {key}")
        
        # Check for private keys (should be quoted)
        if 'PRIVATE_KEY' in key.upper() and value:
            if not (value.startswith('"') and value.endswith('"')) and not (value.startswith("'") and value.endswith("'")):
                warnings.append(f"Line {i}: Private key should be quoted (may contain newlines)")
    
    # Try to load with python-dotenv
    try:
        load_dotenv(file_path, override=False)
        print("✅ File syntax is valid")
    except Exception as e:
        errors.append(f"python-dotenv parsing error: {e}")
    
    # Report issues
    if errors:
        print("\n❌ Errors found:")
        for error in errors:
            print(f"   {error}")
    
    if warnings:
        print("\n⚠️  Warnings:")
        for warning in warnings:
            print(f"   {warning}")
    
    if not errors and not warnings:
        print("✅ No issues found")
        return True
    
    return len(errors) == 0

if __name__ == '__main__':
    # Find .env.local in project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    env_file = project_root / '.env.local'
    
    if not env_file.exists():
        print(f"❌ .env.local not found at: {env_file}")
        print("   Create a .env.local file in the project root")
        sys.exit(1)
    
    success = validate_env_file(env_file)
    sys.exit(0 if success else 1)

