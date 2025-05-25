#!/usr/bin/env python3
"""
Test script to verify RunPod Serverless path compatibility fixes
"""

import os
import sys

# Add the app directory to Python path (simulate RunPod environment)
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/runpod')

def test_path_compatibility():
    """Test RunPod Serverless path compatibility"""
    
    print("🧪 Testing RunPod Serverless Path Compatibility")
    print("=" * 50)
    
    # Test 1: Check symbolic link creation (if we were in RunPod Serverless)
    print("\n1️⃣ Testing path detection logic:")
    
    if os.path.exists('/runpod-volume'):
        print("✅ /runpod-volume detected (RunPod Serverless environment)")
        if os.path.exists('/workspace'):
            if os.path.islink('/workspace'):
                print("✅ /workspace is a symbolic link")
                print(f"   Links to: {os.readlink('/workspace')}")
            else:
                print("ℹ️ /workspace exists but is not a symbolic link")
        else:
            print("❌ /workspace does not exist")
    elif os.path.exists('/workspace'):
        print("✅ /workspace detected (traditional RunPod Pod environment)")
    else:
        print("🏠 Local development environment detected")
    
    # Test 2: Test models directory detection
    print("\n2️⃣ Testing models directory detection:")
    
    try:
        # Import the modules to test path detection
        from modules.globals import get_models_dir
        models_dir = get_models_dir()
        print(f"✅ Models directory detected: {models_dir}")
        
        if os.path.exists(models_dir):
            print(f"✅ Models directory exists: {models_dir}")
        else:
            print(f"⚠️ Models directory doesn't exist but will be created: {models_dir}")
            
    except ImportError as e:
        print(f"❌ Failed to import modules.globals: {e}")
    
    # Test 3: Test super resolution module path detection
    print("\n3️⃣ Testing super resolution path detection:")
    
    try:
        from modules.processors.frame.super_resolution import find_model_file
        
        test_models = ['RealESRGAN_x4plus.pth', 'RealESRGAN_x2plus.pth']
        
        for model_name in test_models:
            model_path = find_model_file(model_name)
            if model_path:
                print(f"✅ Found {model_name}: {model_path}")
            else:
                print(f"❌ Not found {model_name}")
                
    except ImportError as e:
        print(f"❌ Failed to import super resolution module: {e}")
    
    # Test 4: Test all possible paths
    print("\n4️⃣ Testing all possible model paths:")
    
    test_paths = [
        # RunPod Serverless paths
        '/runpod-volume/faceswap',
        '/runpod-volume/faceswap/models',
        '/runpod-volume/models',
        
        # Traditional RunPod Pod paths
        '/workspace/faceswap',
        '/workspace/faceswap/models',
        '/workspace/models',
        
        # Docker paths
        '/app/models',
        
        # Local development
        './models'
    ]
    
    for path in test_paths:
        exists = "✅" if os.path.exists(path) else "❌"
        print(f"   {exists} {path}")
    
    print("\n✅ Path compatibility test completed!")

def test_environment_variables():
    """Test environment variable setup"""
    
    print("\n🔧 Testing Environment Variables:")
    print("=" * 50)
    
    env_vars = ['MODELS_DIR', 'WORKSPACE_DIR', 'HEADLESS', 'DISPLAY']
    
    for var in env_vars:
        value = os.environ.get(var, 'Not set')
        print(f"   {var}: {value}")

if __name__ == "__main__":
    test_path_compatibility()
    test_environment_variables() 