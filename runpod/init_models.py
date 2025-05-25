#!/usr/bin/env python3
"""
Model Initialization Script for RunPod
Ensures models are available before handler starts
"""

import os
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def init_models():
    """Initialize models for RunPod Serverless"""
    logger.info("🚀 Starting model initialization...")
    
    # Add current directory to Python path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # Try to run model download script
    try:
        from download_models import check_and_download_models
        models_dir = check_and_download_models()
        logger.info(f"✅ Models initialized in: {models_dir}")
        
        # Set environment variable for consistent access
        os.environ['MODELS_DIR'] = models_dir
        
        # Verify essential models
        essential_models = ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth']
        missing_models = []
        
        for model_name in essential_models:
            model_path = os.path.join(models_dir, model_name)
            if os.path.exists(model_path):
                logger.info(f"✅ Verified model: {model_name}")
            else:
                missing_models.append(model_name)
                logger.warning(f"⚠️ Missing model: {model_name}")
        
        if missing_models:
            logger.warning(f"⚠️ Missing {len(missing_models)} models: {missing_models}")
            logger.info("💡 Handler will attempt to find models in alternative locations")
        else:
            logger.info("🎉 All essential models are ready!")
        
        return models_dir
        
    except Exception as e:
        logger.error(f"❌ Model initialization failed: {e}")
        logger.info("🔄 Handler will try to use existing models or download at runtime")
        return None

if __name__ == "__main__":
    init_models() 