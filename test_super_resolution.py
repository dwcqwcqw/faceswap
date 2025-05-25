#!/usr/bin/env python3
"""
Test Script for Super Resolution Functionality
Tests the face swap handler with super resolution capabilities
"""

import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_super_resolution_import():
    """Test if super resolution module can be imported"""
    try:
        from modules.processors.frame.super_resolution import enhance_resolution, get_super_resolution_model
        logger.info("✅ Super resolution module imported successfully")
        return True
    except ImportError as e:
        logger.error(f"❌ Super resolution import failed: {e}")
        return False

def test_dependencies():
    """Test if all required dependencies are available"""
    missing_deps = []
    
    try:
        import cv2
        logger.info("✅ OpenCV available")
    except ImportError:
        missing_deps.append("opencv-python")
    
    try:
        import numpy as np
        logger.info("✅ NumPy available")
    except ImportError:
        missing_deps.append("numpy")
    
    try:
        from PIL import Image
        logger.info("✅ Pillow available")
    except ImportError:
        missing_deps.append("Pillow")
    
    try:
        import basicsr
        from realesrgan import RealESRGANer
        logger.info("✅ Real-ESRGAN available")
    except ImportError as e:
        logger.warning(f"⚠️ Real-ESRGAN not available: {e}")
        missing_deps.append("realesrgan")
    
    if missing_deps:
        logger.warning(f"⚠️ Missing dependencies: {missing_deps}")
        logger.info("💡 Run: python runpod/install_dependencies.py")
        return False
    else:
        logger.info("✅ All dependencies available")
        return True

def test_handler_health():
    """Test the handler health check"""
    try:
        import sys
        import os
        
        # Add paths
        sys.path.insert(0, '/app')
        sys.path.insert(0, '/app/runpod')
        
        # Import handler
        from runpod.handler_serverless import handler
        
        # Test health check
        test_event = {
            "input": {
                "type": "health_check"
            }
        }
        
        result = handler(test_event)
        logger.info(f"📋 Handler health check result: {json.dumps(result, indent=2)}")
        
        if result.get("status") == "healthy":
            logger.info("✅ Handler health check passed")
            return True
        else:
            logger.warning("⚠️ Handler health check failed")
            return False
            
    except Exception as e:
        logger.error(f"❌ Handler test failed: {e}")
        return False

def test_model_availability():
    """Test if super resolution models are available"""
    try:
        import modules.globals
        models_dir = modules.globals.get_models_dir()
        
        logger.info(f"🔍 Checking models in: {models_dir}")
        
        import os
        sr_models = {
            'RealESRGAN_x4plus.pth': 'Super Resolution 4x Model',
            'RealESRGAN_x2plus.pth': 'Super Resolution 2x Model'
        }
        
        available_models = []
        for model_name, description in sr_models.items():
            model_path = os.path.join(models_dir, model_name)
            if os.path.exists(model_path):
                file_size = os.path.getsize(model_path)
                logger.info(f"✅ Found {description}: {model_name} ({file_size} bytes)")
                available_models.append(model_name)
            else:
                logger.warning(f"❌ Missing {description}: {model_name}")
        
        if available_models:
            logger.info(f"✅ {len(available_models)}/2 super resolution models available")
            return True
        else:
            logger.warning("⚠️ No super resolution models found")
            logger.info("💡 Models will be auto-downloaded on first use")
            return False
            
    except Exception as e:
        logger.error(f"❌ Model availability check failed: {e}")
        return False

def main():
    """Run all tests"""
    logger.info("🚀 Starting Super Resolution Tests...")
    
    tests = [
        ("Dependencies", test_dependencies),
        ("Super Resolution Import", test_super_resolution_import),
        ("Model Availability", test_model_availability),
        ("Handler Health", test_handler_health)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        logger.info(f"\n🔍 Running test: {test_name}")
        try:
            if test_func():
                passed += 1
                logger.info(f"✅ {test_name} - PASSED")
            else:
                logger.warning(f"⚠️ {test_name} - FAILED")
        except Exception as e:
            logger.error(f"❌ {test_name} - ERROR: {e}")
    
    logger.info(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! Super resolution is ready.")
    elif passed >= total - 1:
        logger.info("✅ Most tests passed. System should work with some limitations.")
    else:
        logger.warning("⚠️ Multiple tests failed. Please check configuration.")
    
    # Provide guidance
    logger.info("\n💡 Next Steps:")
    if passed == total:
        logger.info("   • Super resolution is fully functional")
        logger.info("   • Original images will be enhanced to ultra-high quality")
        logger.info("   • Small images (<512px) will be upscaled 4x")
        logger.info("   • Medium images (<1024px) will be upscaled 2x")
        logger.info("   • Large images will maintain quality without upscaling")
    else:
        logger.info("   • Install missing dependencies: python runpod/install_dependencies.py")
        logger.info("   • Face swapping will still work with traditional upscaling")
        logger.info("   • Models will be downloaded automatically on first use")

if __name__ == "__main__":
    main() 