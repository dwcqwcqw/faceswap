#!/usr/bin/env python3
"""
RunPod Serverless Debug Handler
Simplified version for troubleshooting container and model issues
"""

import runpod
import os
import sys
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_environment():
    """Debug environment setup"""
    logger.info("🔍 === ENVIRONMENT DEBUG ===")
    logger.info(f"📁 Current working directory: {os.getcwd()}")
    logger.info(f"🐍 Python version: {sys.version}")
    logger.info(f"📋 Python path: {sys.path}")
    
    # Check key directories
    directories_to_check = [
        '/app',
        '/workspace', 
        '/runpod-volume',
        '/runpod-volume/faceswap'
    ]
    
    for directory in directories_to_check:
        if os.path.exists(directory):
            try:
                files = os.listdir(directory)
                logger.info(f"✅ {directory}: {len(files)} items - {files[:10]}")
            except Exception as e:
                logger.error(f"❌ {directory}: Error listing - {e}")
        else:
            logger.warning(f"⚠️ {directory}: Does not exist")
    
    # Check environment variables
    env_vars = ['MODELS_DIR', 'PYTHONPATH', 'PATH']
    for var in env_vars:
        value = os.getenv(var, 'Not set')
        logger.info(f"🔧 {var}: {value}")

def debug_models():
    """Debug model availability"""
    logger.info("🔍 === MODELS DEBUG ===")
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    logger.info(f"📁 Models directory: {models_dir}")
    
    if not os.path.exists(models_dir):
        logger.error(f"❌ Models directory does not exist: {models_dir}")
        return False
    
    try:
        all_files = os.listdir(models_dir)
        logger.info(f"📋 Files in models directory ({len(all_files)}): {all_files}")
        
        # Check for key models
        key_models = [
            'inswapper_128_fp16.onnx',
            'GFPGANv1.4.pth', 
            'buffalo_l',
            'buffalo_l.zip',
            'detection_Resnet50_Final.pth',
            'parsing_parsenet.pth'
        ]
        
        for model in key_models:
            model_path = os.path.join(models_dir, model)
            if os.path.exists(model_path):
                if os.path.isfile(model_path):
                    size_mb = os.path.getsize(model_path) / (1024 * 1024)
                    logger.info(f"✅ {model}: {size_mb:.1f}MB")
                else:
                    logger.info(f"✅ {model}: directory")
            else:
                logger.warning(f"⚠️ {model}: missing")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error checking models: {e}")
        return False

def debug_imports():
    """Debug module imports"""
    logger.info("🔍 === IMPORTS DEBUG ===")
    
    # Test basic imports
    try:
        import cv2
        logger.info(f"✅ OpenCV version: {cv2.__version__}")
    except ImportError as e:
        logger.error(f"❌ OpenCV import failed: {e}")
    
    try:
        import numpy as np
        logger.info(f"✅ NumPy version: {np.__version__}")
    except ImportError as e:
        logger.error(f"❌ NumPy import failed: {e}")
    
    try:
        from PIL import Image
        logger.info("✅ PIL imported successfully")
    except ImportError as e:
        logger.error(f"❌ PIL import failed: {e}")
    
    # Test face swap modules
    try:
        sys.path.insert(0, '/app')
        from modules.face_analyser import get_one_face, get_many_faces
        logger.info("✅ Face analyser modules imported")
    except ImportError as e:
        logger.error(f"❌ Face analyser import failed: {e}")
    
    try:
        from modules.processors.frame.face_swapper import swap_face
        logger.info("✅ Face swapper module imported")
    except ImportError as e:
        logger.error(f"❌ Face swapper import failed: {e}")

def handler(job):
    """Debug handler function"""
    try:
        logger.info("🚀 === DEBUG HANDLER STARTED ===")
        
        # Run all debug checks
        debug_environment()
        models_available = debug_models()
        debug_imports()
        
        # Process job input
        job_input = job.get("input", {})
        process_type = job_input.get("process_type") or job_input.get("type", "")
        
        logger.info(f"📋 Job input: {json.dumps(job_input, indent=2)}")
        logger.info(f"🎯 Process type: {process_type}")
        
        # Return debug information
        return {
            "status": "debug_completed",
            "models_available": models_available,
            "process_type": process_type,
            "environment": {
                "cwd": os.getcwd(),
                "models_dir": os.getenv('MODELS_DIR', 'Not set'),
                "python_version": sys.version
            },
            "message": "Debug handler completed successfully. Check logs for detailed information."
        }
        
    except Exception as e:
        logger.error(f"❌ Debug handler error: {e}")
        return {
            "error": f"Debug handler failed: {str(e)}",
            "status": "debug_failed"
        }

if __name__ == "__main__":
    logger.info("🚀 Starting RunPod Debug Handler...")
    
    # Run initial debug
    debug_environment()
    debug_models()
    debug_imports()
    
    # Start RunPod serverless
    runpod.serverless.start({"handler": handler}) 