#!/usr/bin/env python3
"""
Test script to verify model availability and paths
"""

import os
import sys

# Add paths
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/runpod')

def test_model_paths():
    """Test model paths and availability"""
    print("🧪 Testing model paths and availability...")
    
    # Test different model locations
    test_paths = [
        '/workspace/faceswap/inswapper_128_fp16.onnx',
        '/workspace/faceswap/models/inswapper_128_fp16.onnx',
        '/workspace/models/inswapper_128_fp16.onnx',
        '/app/models/inswapper_128_fp16.onnx',
        '/runpod-volume/models/inswapper_128_fp16.onnx'
    ]
    
    found_models = []
    for path in test_paths:
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"✅ Found model: {path} ({size:,} bytes)")
            found_models.append((path, size))
        else:
            print(f"❌ Not found: {path}")
    
    if found_models:
        print(f"\n🎉 Found {len(found_models)} model files!")
        for path, size in found_models:
            print(f"  📁 {path} ({size:,} bytes)")
    else:
        print("\n⚠️ No model files found in any location!")
        print("💡 Please ensure inswapper_128_fp16.onnx is available")
    
    # Test modules.globals
    try:
        import modules.globals
        models_dir = modules.globals.get_models_dir()
        print(f"\n🔍 modules.globals.get_models_dir(): {models_dir}")
        
        model_path = os.path.join(models_dir, 'inswapper_128_fp16.onnx')
        if os.path.exists(model_path):
            print(f"✅ Model available via modules.globals: {model_path}")
        else:
            print(f"❌ Model NOT available via modules.globals: {model_path}")
            
    except Exception as e:
        print(f"❌ Error testing modules.globals: {e}")
    
    # Test environment variable
    env_models_dir = os.environ.get('MODELS_DIR')
    if env_models_dir:
        print(f"\n🌍 MODELS_DIR environment variable: {env_models_dir}")
        model_path = os.path.join(env_models_dir, 'inswapper_128_fp16.onnx')
        if os.path.exists(model_path):
            print(f"✅ Model available via env var: {model_path}")
        else:
            print(f"❌ Model NOT available via env var: {model_path}")
    else:
        print("\n⚠️ MODELS_DIR environment variable not set")

if __name__ == "__main__":
    test_model_paths() 