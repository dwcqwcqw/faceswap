#!/usr/bin/env python3
"""
Quick Super Resolution Models Download Script
Downloads Real-ESRGAN models directly to workspace/faceswap directory
"""

import os
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_file(url, destination, description=""):
    """Download file with progress"""
    try:
        logger.info(f"📥 Downloading {description}...")
        logger.info(f"   From: {url}")
        logger.info(f"   To: {destination}")
        
        # Create directory if needed
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        
        response = requests.get(url, stream=True, timeout=120)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(destination, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        if downloaded % (2 * 1024 * 1024) == 0:  # Log every 2MB
                            logger.info(f"   Progress: {progress:.1f}% ({downloaded // (1024*1024)}MB/{total_size // (1024*1024)}MB)")
        
        # Verify download
        if os.path.exists(destination) and os.path.getsize(destination) > 1024 * 1024:
            file_size = os.path.getsize(destination)
            logger.info(f"✅ Successfully downloaded {description} ({file_size} bytes)")
            return True
        else:
            logger.error(f"❌ Download verification failed for {description}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to download {description}: {e}")
        return False

def main():
    """Download super resolution models"""
    logger.info("🚀 Starting Super Resolution Models Download...")
    
    # Target directory - where RunPod expects to find models
    target_dirs = [
        '/workspace/faceswap',  # Primary workspace location
        './models',             # Local development fallback
    ]
    
    # Determine target directory
    target_dir = None
    for dir_path in target_dirs:
        if os.path.exists(os.path.dirname(dir_path)) or dir_path.startswith('./'):
            target_dir = dir_path
            break
    
    if not target_dir:
        target_dir = './models'
    
    logger.info(f"📁 Target directory: {target_dir}")
    
    # Create target directory
    os.makedirs(target_dir, exist_ok=True)
    
    # Super resolution models to download
    models = {
        'RealESRGAN_x4plus.pth': {
            'url': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
            'description': 'Real-ESRGAN 4x Super Resolution Model'
        },
        'RealESRGAN_x2plus.pth': {
            'url': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth',
            'description': 'Real-ESRGAN 2x Super Resolution Model'
        }
    }
    
    downloaded_count = 0
    total_count = len(models)
    
    for model_name, model_info in models.items():
        model_path = os.path.join(target_dir, model_name)
        
        # Check if model already exists
        if os.path.exists(model_path) and os.path.getsize(model_path) > 1024 * 1024:
            file_size = os.path.getsize(model_path)
            logger.info(f"✅ {model_info['description']} already exists ({file_size} bytes)")
            downloaded_count += 1
            continue
        
        # Download model
        if download_file(model_info['url'], model_path, model_info['description']):
            downloaded_count += 1
        else:
            logger.error(f"❌ Failed to download {model_name}")
    
    # Summary
    logger.info(f"\n📊 Download Summary: {downloaded_count}/{total_count} models ready")
    
    if downloaded_count == total_count:
        logger.info("🎉 All super resolution models are ready!")
        logger.info("💡 Ultra-high quality face swapping is now available")
    else:
        logger.warning("⚠️ Some models failed to download")
        logger.info("🔄 Face swapping will still work with fallback methods")
    
    # List final files
    logger.info(f"\n📁 Files in {target_dir}:")
    try:
        for file in os.listdir(target_dir):
            file_path = os.path.join(target_dir, file)
            if os.path.isfile(file_path):
                size = os.path.getsize(file_path)
                size_mb = size / (1024 * 1024)
                logger.info(f"   {file}: {size_mb:.1f}MB")
    except Exception as e:
        logger.warning(f"⚠️ Could not list directory: {e}")

if __name__ == "__main__":
    main() 