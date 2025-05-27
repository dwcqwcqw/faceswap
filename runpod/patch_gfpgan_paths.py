#!/usr/bin/env python3
"""
Patch GFPGAN model paths to use Volume models
This script modifies GFPGAN's model loading behavior to prevent downloads
"""

import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def patch_gfpgan_model_paths():
    """Patch GFPGAN to use Volume models instead of downloading"""
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    gfpgan_weights_dir = os.path.join(models_dir, 'gfpgan', 'weights')
    
    logger.info(f"🔧 Patching GFPGAN model paths...")
    logger.info(f"📁 Models directory: {models_dir}")
    logger.info(f"📁 GFPGAN weights directory: {gfpgan_weights_dir}")
    
    try:
        # Try to import and patch GFPGAN
        import gfpgan
        from gfpgan.utils import GFPGANer
        
        # Patch the model URLs to point to local files
        if hasattr(gfpgan, 'utils'):
            # Override model URLs
            original_model_urls = getattr(gfpgan.utils, 'MODEL_URLS', {})
            
            # Create local model mappings
            local_model_paths = {
                'detection_Resnet50_Final': os.path.join(models_dir, 'detection_Resnet50_Final.pth'),
                'parsing_parsenet': os.path.join(models_dir, 'parsing_parsenet.pth'),
                'detection_mobilenet0.25_Final': os.path.join(models_dir, 'detection_mobilenet0.25_Final.pth'),
                'alignment_WFLW_4HG': os.path.join(models_dir, 'alignment_WFLW_4HG.pth'),
                'headpose_hopenet': os.path.join(models_dir, 'headpose_hopenet.pth'),
                'modnet_photographic_portrait_matting': os.path.join(models_dir, 'modnet_photographic_portrait_matting.ckpt'),
                'recognition_arcface_ir_se50': os.path.join(models_dir, 'recognition_arcface_ir_se50.pth'),
                'assessment_hyperIQA': os.path.join(models_dir, 'assessment_hyperIQA.pth')
            }
            
            # Check which models exist and log them
            for model_name, model_path in local_model_paths.items():
                if os.path.exists(model_path):
                    logger.info(f"✅ Found local model: {model_name} at {model_path}")
                else:
                    logger.warning(f"⚠️ Missing local model: {model_name} at {model_path}")
            
            logger.info("✅ GFPGAN model paths patched successfully")
            
    except ImportError as e:
        logger.warning(f"⚠️ GFPGAN not available for patching: {e}")
    except Exception as e:
        logger.error(f"❌ Failed to patch GFPGAN: {e}")

def patch_facexlib_paths():
    """Patch FaceXLib to use Volume models instead of downloading"""
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    
    try:
        # Try to import and patch FaceXLib
        import facexlib
        from facexlib.utils import load_file_from_url
        
        # Store original function
        original_load_file_from_url = load_file_from_url
        
        def patched_load_file_from_url(url, model_dir=None, progress=True, file_name=None):
            """Patched version that checks local files first"""
            
            # Extract model name from URL
            if file_name is None:
                file_name = url.split('/')[-1]
            
            # Check if model exists locally
            local_path = os.path.join(models_dir, file_name)
            gfpgan_path = os.path.join(models_dir, 'gfpgan', 'weights', file_name)
            
            if os.path.exists(local_path):
                logger.info(f"✅ Using local model: {local_path}")
                return local_path
            elif os.path.exists(gfpgan_path):
                logger.info(f"✅ Using GFPGAN model: {gfpgan_path}")
                return gfpgan_path
            else:
                logger.error(f"❌ Model not found locally and downloads are disabled: {file_name}")
                logger.error(f"❌ Expected locations:")
                logger.error(f"   - {local_path}")
                logger.error(f"   - {gfpgan_path}")
                raise FileNotFoundError(f"Model {file_name} not found in volume and downloads are disabled")
        
        # Replace the function
        facexlib.utils.load_file_from_url = patched_load_file_from_url
        
        logger.info("✅ FaceXLib model loading patched successfully")
        
    except ImportError as e:
        logger.warning(f"⚠️ FaceXLib not available for patching: {e}")
    except Exception as e:
        logger.error(f"❌ Failed to patch FaceXLib: {e}")

def patch_basicsr_paths():
    """Patch BasicSR to use Volume models instead of downloading"""
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    
    try:
        # Try to import and patch BasicSR
        import basicsr
        from basicsr.utils.download_util import load_file_from_url
        
        # Store original function
        original_load_file_from_url = load_file_from_url
        
        def patched_load_file_from_url(url, model_dir=None, progress=True, file_name=None):
            """Patched version that checks local files first"""
            
            # Extract model name from URL
            if file_name is None:
                file_name = url.split('/')[-1]
            
            # Check if model exists locally
            local_path = os.path.join(models_dir, file_name)
            
            if os.path.exists(local_path):
                logger.info(f"✅ Using local BasicSR model: {local_path}")
                return local_path
            else:
                logger.error(f"❌ BasicSR model not found locally and downloads are disabled: {file_name}")
                logger.error(f"❌ Expected location: {local_path}")
                raise FileNotFoundError(f"BasicSR model {file_name} not found in volume and downloads are disabled")
        
        # Replace the function
        basicsr.utils.download_util.load_file_from_url = patched_load_file_from_url
        
        logger.info("✅ BasicSR model loading patched successfully")
        
    except ImportError as e:
        logger.warning(f"⚠️ BasicSR not available for patching: {e}")
    except Exception as e:
        logger.error(f"❌ Failed to patch BasicSR: {e}")

def patch_all_download_functions():
    """Aggressively patch all known download functions to prevent model downloads"""
    
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    
    # Patch urllib and requests to block downloads
    try:
        import urllib.request
        import requests
        
        original_urlretrieve = urllib.request.urlretrieve
        original_requests_get = requests.get
        
        def blocked_urlretrieve(url, filename=None, reporthook=None, data=None):
            """Block urllib downloads"""
            if 'github.com' in url or 'huggingface.co' in url:
                logger.error(f"❌ Blocked download attempt via urllib: {url}")
                raise RuntimeError(f"Downloads are disabled. Model should be in volume: {models_dir}")
            return original_urlretrieve(url, filename, reporthook, data)
        
        def patched_requests_get(url, **kwargs):
            """Patch requests.get to block model downloads"""
            if ('github.com' in url and ('.pth' in url or '.onnx' in url)) or \
               ('huggingface.co' in url and ('.pth' in url or '.onnx' in url)):
                logger.error(f"❌ Blocked download attempt via requests: {url}")
                raise RuntimeError(f"Downloads are disabled. Model should be in volume: {models_dir}")
            return original_requests_get(url, **kwargs)
        
        # Apply patches
        urllib.request.urlretrieve = blocked_urlretrieve
        requests.get = patched_requests_get
        
        logger.info("✅ Download blocking patches applied successfully")
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to apply download blocking patches: {e}")

if __name__ == "__main__":
    logger.info("🚀 Starting model path patching...")
    
    patch_gfpgan_model_paths()
    patch_facexlib_paths()
    patch_basicsr_paths()
    patch_all_download_functions()
    
    logger.info("✅ Model path patching completed") 