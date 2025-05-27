#!/usr/bin/env python3
"""
Download missing GFPGAN models to volume directory
This script downloads the models that are still missing from the volume
"""

import os
import sys
import logging
import requests
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_file(url, destination):
    """Download a file from URL to destination"""
    try:
        logger.info(f"📥 Downloading {url}")
        logger.info(f"📁 Destination: {destination}")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        
        response = requests.get(url, stream=True)
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
                        if downloaded % (1024 * 1024) == 0:  # Log every MB
                            logger.info(f"📊 Progress: {progress:.1f}% ({downloaded / (1024*1024):.1f}MB / {total_size / (1024*1024):.1f}MB)")
        
        logger.info(f"✅ Downloaded successfully: {destination}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to download {url}: {e}")
        return False

def main():
    """Download missing models"""
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    logger.info(f"📁 Models directory: {models_dir}")
    
    # Models that need to be downloaded
    models_to_download = {
        'detection_Resnet50_Final.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth',
        'parsing_parsenet.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth'
    }
    
    # Check which models are missing
    missing_models = []
    for model_name, url in models_to_download.items():
        model_path = os.path.join(models_dir, model_name)
        if not os.path.exists(model_path):
            missing_models.append((model_name, url, model_path))
            logger.info(f"❌ Missing: {model_name}")
        else:
            size_mb = os.path.getsize(model_path) / (1024 * 1024)
            logger.info(f"✅ Found: {model_name} ({size_mb:.1f}MB)")
    
    if not missing_models:
        logger.info("🎉 All models are already present!")
        return True
    
    logger.info(f"📥 Need to download {len(missing_models)} models...")
    
    # Download missing models
    success_count = 0
    for model_name, url, destination in missing_models:
        logger.info(f"🔄 Downloading {model_name}...")
        if download_file(url, destination):
            success_count += 1
        else:
            logger.error(f"❌ Failed to download {model_name}")
    
    logger.info(f"📊 Download summary: {success_count}/{len(missing_models)} models downloaded successfully")
    
    if success_count == len(missing_models):
        logger.info("🎉 All missing models downloaded successfully!")
        return True
    else:
        logger.error(f"❌ Failed to download {len(missing_models) - success_count} models")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 