#!/usr/bin/env python3
"""
Download missing models directly to workspace
This script can be run independently to ensure models are available
"""

import os
import requests
import logging
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_file(url, destination_path, description="file"):
    """Download a file from URL to destination path"""
    try:
        logger.info(f"📥 Downloading {description} from: {url}")
        logger.info(f"   → Destination: {destination_path}")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        # Download with streaming to handle large files
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded_size = 0
        
        with open(destination_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    
                    # Show progress for large files
                    if total_size > 0:
                        progress = (downloaded_size / total_size) * 100
                        if downloaded_size % (1024 * 1024) == 0:  # Log every MB
                            logger.info(f"   Progress: {progress:.1f}% ({downloaded_size // (1024*1024)}MB/{total_size // (1024*1024)}MB)")
        
        # Verify file was downloaded
        if os.path.exists(destination_path) and os.path.getsize(destination_path) > 0:
            file_size = os.path.getsize(destination_path)
            logger.info(f"✅ Successfully downloaded {description}: {file_size} bytes")
            return True
        else:
            logger.error(f"❌ Download verification failed for {description}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to download {description}: {e}")
        return False

def ensure_models_available():
    """Ensure all required models are available in workspace/faceswap"""
    
    # Target directory (where user confirmed the model should be)
    target_dir = "/workspace/faceswap"
    
    # Required models with download URLs
    models = {
        "inswapper_128_fp16.onnx": {
            "url": "https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx",
            "description": "Face swapper model"
        },
        "GFPGANv1.4.pth": {
            "url": "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth", 
            "description": "Face enhancer model"
        },
        "RealESRGAN_x4plus.pth": {
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            "description": "Super resolution model (4x upscale)"
        },
        "RealESRGAN_x2plus.pth": {
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.1/RealESRGAN_x2plus.pth",
            "description": "Super resolution model (2x upscale)"
        }
    }
    
    logger.info(f"🔍 Checking models in: {target_dir}")
    
    # Check if target directory exists
    if not os.path.exists(target_dir):
        logger.info(f"📁 Creating directory: {target_dir}")
        os.makedirs(target_dir, exist_ok=True)
    
    missing_models = []
    
    # Check each required model
    for model_name, model_info in models.items():
        model_path = os.path.join(target_dir, model_name)
        
        if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
            file_size = os.path.getsize(model_path)
            logger.info(f"✅ Found {model_info['description']}: {model_name} ({file_size} bytes)")
        else:
            logger.warning(f"❌ Missing {model_info['description']}: {model_name}")
            missing_models.append((model_name, model_info))
    
    # Download missing models
    if missing_models:
        logger.info(f"📥 Downloading {len(missing_models)} missing models...")
        
        for model_name, model_info in missing_models:
            model_path = os.path.join(target_dir, model_name)
            success = download_file(
                model_info["url"], 
                model_path, 
                model_info["description"]
            )
            
            if not success:
                logger.error(f"❌ Failed to download {model_name}")
                return False
    else:
        logger.info("✅ All required models are available")
    
    # Final verification
    logger.info(f"🔍 Final verification of models in {target_dir}:")
    try:
        files = os.listdir(target_dir)
        for file in files:
            file_path = os.path.join(target_dir, file)
            if os.path.isfile(file_path):
                size = os.path.getsize(file_path)
                logger.info(f"   {file}: {size} bytes")
    except Exception as e:
        logger.warning(f"⚠️ Could not list directory contents: {e}")
    
    return True

if __name__ == "__main__":
    logger.info("🚀 Starting model download script...")
    success = ensure_models_available()
    
    if success:
        logger.info("🎉 All models are ready!")
        exit(0)
    else:
        logger.error("❌ Model setup failed")
        exit(1) 