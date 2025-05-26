#!/usr/bin/env python3
"""
Script to setup additional GFPGAN models in RunPod Volume
This script helps organize the detection_Resnet50_Final.pth and parsing_parsenet.pth files
"""

import os
import shutil
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_gfpgan_models(volume_path='/runpod-volume/faceswap'):
    """Setup GFPGAN models in the correct directory structure"""
    
    logger.info(f"🔧 Setting up GFPGAN models in: {volume_path}")
    
    # Create GFPGAN weights directory
    gfpgan_weights_dir = os.path.join(volume_path, 'gfpgan', 'weights')
    os.makedirs(gfpgan_weights_dir, exist_ok=True)
    logger.info(f"📁 GFPGAN weights directory: {gfpgan_weights_dir}")
    
    # Models to setup
    models_to_setup = [
        'detection_Resnet50_Final.pth',
        'parsing_parsenet.pth'
    ]
    
    for model_name in models_to_setup:
        # Check if model exists in main directory
        main_path = os.path.join(volume_path, model_name)
        gfpgan_path = os.path.join(gfpgan_weights_dir, model_name)
        
        if os.path.exists(main_path):
            logger.info(f"✅ Found {model_name} in main directory")
            
            # Create symlink or copy to gfpgan/weights
            if not os.path.exists(gfpgan_path):
                try:
                    # Try symlink first (more efficient)
                    os.symlink(main_path, gfpgan_path)
                    logger.info(f"🔗 Created symlink: {gfpgan_path} -> {main_path}")
                except OSError:
                    # If symlink fails, copy the file
                    shutil.copy2(main_path, gfpgan_path)
                    logger.info(f"📋 Copied file: {main_path} -> {gfpgan_path}")
            else:
                logger.info(f"✅ {model_name} already exists in gfpgan/weights")
                
        elif os.path.exists(gfpgan_path):
            logger.info(f"✅ Found {model_name} in gfpgan/weights directory")
            
        else:
            logger.warning(f"⚠️ {model_name} not found in either location")
            logger.info(f"   Expected locations:")
            logger.info(f"   - {main_path}")
            logger.info(f"   - {gfpgan_path}")
    
    # List all files in the volume for debugging
    logger.info("📋 Current volume contents:")
    try:
        for root, dirs, files in os.walk(volume_path):
            level = root.replace(volume_path, '').count(os.sep)
            indent = ' ' * 2 * level
            logger.info(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    size_mb = os.path.getsize(file_path) / (1024 * 1024)
                    logger.info(f"{subindent}{file} ({size_mb:.1f}MB)")
                except:
                    logger.info(f"{subindent}{file}")
    except Exception as e:
        logger.error(f"❌ Failed to list volume contents: {e}")

def download_missing_models(volume_path='/runpod-volume/faceswap'):
    """Download missing GFPGAN models if needed"""
    
    import requests
    
    models_urls = {
        'detection_Resnet50_Final.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth',
        'parsing_parsenet.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth'
    }
    
    for model_name, url in models_urls.items():
        main_path = os.path.join(volume_path, model_name)
        gfpgan_path = os.path.join(volume_path, 'gfpgan', 'weights', model_name)
        
        if not os.path.exists(main_path) and not os.path.exists(gfpgan_path):
            logger.info(f"📥 Downloading {model_name}...")
            try:
                response = requests.get(url, stream=True)
                response.raise_for_status()
                
                # Download to main directory first
                with open(main_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                size_mb = os.path.getsize(main_path) / (1024 * 1024)
                logger.info(f"✅ Downloaded {model_name} ({size_mb:.1f}MB)")
                
            except Exception as e:
                logger.error(f"❌ Failed to download {model_name}: {e}")

if __name__ == "__main__":
    import sys
    
    # Get volume path from command line or use default
    volume_path = sys.argv[1] if len(sys.argv) > 1 else '/runpod-volume/faceswap'
    
    logger.info("🚀 GFPGAN Models Setup Script")
    logger.info(f"📁 Volume path: {volume_path}")
    
    # Setup existing models
    setup_gfpgan_models(volume_path)
    
    # Ask if user wants to download missing models
    if len(sys.argv) > 2 and sys.argv[2] == '--download':
        download_missing_models(volume_path)
    
    logger.info("✅ GFPGAN models setup completed!") 