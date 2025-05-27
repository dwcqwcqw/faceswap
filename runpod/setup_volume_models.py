#!/usr/bin/env python3
"""
Setup Volume Models Script
Ensures all required models are properly organized in the volume
"""

import os
import sys
import logging
import zipfile
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_volume_models():
    """Setup and organize models in the volume directory"""
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    gfpgan_weights_dir = os.path.join(models_dir, 'gfpgan', 'weights')
    
    logger.info(f"🔧 Setting up volume models...")
    logger.info(f"📁 Models directory: {models_dir}")
    logger.info(f"📁 GFPGAN weights directory: {gfpgan_weights_dir}")
    
    # Create directories if they don't exist
    os.makedirs(gfpgan_weights_dir, exist_ok=True)
    
    # Required models list
    required_models = [
        'inswapper_128_fp16.onnx',
        'GFPGANv1.4.pth',
        'GFPGANv1.3.pth',
        'RealESRGAN_x4plus.pth',
        'RealESRGAN_x2plus.pth',
        '79999_iter.pth',
        'detection_Resnet50_Final.pth',
        'parsing_parsenet.pth',
        'detection_mobilenet0.25_Final.pth',
        'alignment_WFLW_4HG.pth',
        'headpose_hopenet.pth',
        'modnet_photographic_portrait_matting.ckpt',
        'recognition_arcface_ir_se50.pth',
        'assessment_hyperIQA.pth'
    ]
    
    # Check and report model status
    missing_models = []
    found_models = []
    
    for model in required_models:
        model_path = os.path.join(models_dir, model)
        if os.path.exists(model_path):
            size_mb = os.path.getsize(model_path) / (1024 * 1024)
            found_models.append(model)
            logger.info(f"✅ Found: {model} ({size_mb:.1f}MB)")
        else:
            missing_models.append(model)
            logger.warning(f"❌ Missing: {model}")
    
    # Handle buffalo_l.zip extraction
    buffalo_zip = os.path.join(models_dir, 'buffalo_l.zip')
    buffalo_dir = os.path.join(models_dir, 'buffalo_l')
    
    if os.path.exists(buffalo_zip):
        if not os.path.exists(buffalo_dir):
            logger.info(f"📦 Extracting buffalo_l.zip...")
            try:
                with zipfile.ZipFile(buffalo_zip, 'r') as zip_ref:
                    zip_ref.extractall(models_dir)
                logger.info("✅ buffalo_l.zip extracted successfully")
            except Exception as e:
                logger.error(f"❌ Failed to extract buffalo_l.zip: {e}")
        else:
            logger.info("✅ buffalo_l directory already exists")
    else:
        logger.warning("⚠️ buffalo_l.zip not found")
    
    # Create symlinks in gfpgan/weights directory for models that need them
    gfpgan_models = [
        'detection_Resnet50_Final.pth',
        'parsing_parsenet.pth',
        'detection_mobilenet0.25_Final.pth',
        'alignment_WFLW_4HG.pth',
        'headpose_hopenet.pth',
        'modnet_photographic_portrait_matting.ckpt',
        'recognition_arcface_ir_se50.pth',
        'assessment_hyperIQA.pth'
    ]
    
    for model in gfpgan_models:
        source_path = os.path.join(models_dir, model)
        target_path = os.path.join(gfpgan_weights_dir, model)
        
        if os.path.exists(source_path) and not os.path.exists(target_path):
            try:
                os.symlink(source_path, target_path)
                logger.info(f"🔗 Created symlink: {model}")
            except OSError as e:
                if e.errno == 17:  # File exists
                    logger.info(f"🔗 Symlink already exists: {model}")
                else:
                    logger.warning(f"⚠️ Failed to create symlink for {model}: {e}")
    
    # Summary
    logger.info(f"\n📊 Model Setup Summary:")
    logger.info(f"   ✅ Found models: {len(found_models)}/{len(required_models)}")
    logger.info(f"   ❌ Missing models: {len(missing_models)}")
    
    if missing_models:
        logger.warning(f"⚠️ Missing models: {', '.join(missing_models)}")
        logger.warning("⚠️ Some functionality may be limited")
    else:
        logger.info("🎉 All required models are available!")
    
    return len(missing_models) == 0

def check_insightface_models():
    """Check InsightFace models"""
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    insightface_dir = os.path.join(models_dir, '.insightface')
    buffalo_dir = os.path.join(models_dir, 'buffalo_l')
    
    logger.info(f"🔍 Checking InsightFace models...")
    
    if os.path.exists(buffalo_dir):
        files = os.listdir(buffalo_dir)
        logger.info(f"✅ buffalo_l directory contains {len(files)} files: {files}")
        
        # Create .insightface directory structure if needed
        insightface_models_dir = os.path.join(insightface_dir, 'models')
        insightface_buffalo_dir = os.path.join(insightface_models_dir, 'buffalo_l')
        
        os.makedirs(insightface_models_dir, exist_ok=True)
        
        if not os.path.exists(insightface_buffalo_dir):
            try:
                # Create symlink to buffalo_l directory
                os.symlink(buffalo_dir, insightface_buffalo_dir)
                logger.info(f"🔗 Created InsightFace symlink: {insightface_buffalo_dir}")
            except OSError as e:
                logger.warning(f"⚠️ Failed to create InsightFace symlink: {e}")
        else:
            logger.info("✅ InsightFace buffalo_l symlink already exists")
    else:
        logger.warning("⚠️ buffalo_l directory not found")

def main():
    """Main setup function"""
    logger.info("🚀 Starting Volume Models Setup...")
    
    models_ready = setup_volume_models()
    check_insightface_models()
    
    if models_ready:
        logger.info("✅ Volume models setup completed successfully!")
        return 0
    else:
        logger.error("❌ Volume models setup completed with missing models!")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 