#!/usr/bin/env python3
"""
Test script to verify model detection logic
Run this to test if the enhanced model detection can find the models
"""

import os
import sys

# Add the app directory to Python path for testing
sys.path.insert(0, '.')
sys.path.insert(0, './modules')

def test_model_detection():
    """Test the model detection logic"""
    print("🧪 Testing model detection logic...")
    
    try:
        # Import the modules we need
        import modules.globals
        
        print(f"📁 Current working directory: {os.getcwd()}")
        print(f"📁 Default models directory: {modules.globals.get_models_dir()}")
        
        # Test direct file search in common locations
        search_paths = [
            '/workspace/faceswap/inswapper_128_fp16.onnx',
            '/workspace/models/inswapper_128_fp16.onnx',
            '/app/models/inswapper_128_fp16.onnx',
            '/runpod-volume/models/inswapper_128_fp16.onnx',
            './inswapper_128_fp16.onnx',
            'inswapper_128_fp16.onnx'
        ]
        
        print("\n🔍 Direct path testing:")
        found_paths = []
        
        for path in search_paths:
            exists = os.path.exists(path)
            is_file = os.path.isfile(path) if exists else False
            readable = os.access(path, os.R_OK) if exists else False
            size = os.path.getsize(path) if exists and is_file else 0
            
            status = "✅" if exists and is_file and readable else "❌"
            print(f"  {status} {path}")
            print(f"     exists: {exists}, is_file: {is_file}, readable: {readable}, size: {size}")
            
            if exists and is_file and readable:
                found_paths.append(path)
        
        if found_paths:
            print(f"\n🎉 Found {len(found_paths)} accessible model files:")
            for path in found_paths:
                print(f"  ✅ {path}")
        else:
            print("\n❌ No accessible model files found")
        
        # Test workspace directory listing
        print("\n📂 Workspace directory contents:")
        workspace_dirs = ['/workspace', '/workspace/faceswap', '/workspace/models']
        
        for dir_path in workspace_dirs:
            if os.path.exists(dir_path):
                try:
                    files = os.listdir(dir_path)
                    print(f"  {dir_path}: {files}")
                except Exception as e:
                    print(f"  {dir_path}: Error listing - {e}")
            else:
                print(f"  {dir_path}: Directory does not exist")
        
        # Now test the actual face_swapper import
        print("\n🔧 Testing face_swapper import...")
        try:
            from modules.processors.frame.face_swapper import get_face_swapper
            
            print("✅ Successfully imported get_face_swapper")
            print("🔄 Attempting to load face swapper model...")
            
            # This will trigger our enhanced model detection logic
            face_swapper = get_face_swapper()
            
            if face_swapper:
                print("🎉 Face swapper model loaded successfully!")
                return True
            else:
                print("❌ Face swapper model loading returned None")
                return False
                
        except Exception as e:
            print(f"❌ Face swapper import/loading failed: {e}")
            return False
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting model detection test...\n")
    success = test_model_detection()
    
    if success:
        print("\n✅ Model detection test passed!")
        exit(0)
    else:
        print("\n❌ Model detection test failed!")
        exit(1) 