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

def patch_insightface_paths():
    """Patch InsightFace to use Volume models"""
    try:
        models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
        buffalo_dir = os.path.join(models_dir, 'buffalo_l')
        
        # Set InsightFace environment variables
        insightface_home = os.path.join(models_dir, '.insightface')
        os.environ['INSIGHTFACE_HOME'] = insightface_home
        
        # Create .insightface directory structure
        insightface_models_dir = os.path.join(insightface_home, 'models')
        insightface_buffalo_dir = os.path.join(insightface_models_dir, 'buffalo_l')
        
        os.makedirs(insightface_models_dir, exist_ok=True)
        
        # Create symlink if buffalo_l exists and symlink doesn't exist
        if os.path.exists(buffalo_dir) and not os.path.exists(insightface_buffalo_dir):
            try:
                os.symlink(buffalo_dir, insightface_buffalo_dir)
                logger.info(f"🔗 Created InsightFace symlink: {insightface_buffalo_dir}")
            except OSError as e:
                if e.errno == 17:  # File exists
                    logger.info(f"🔗 InsightFace symlink already exists")
                else:
                    logger.warning(f"⚠️ Failed to create InsightFace symlink: {e}")
        
        # Also create symlink in /root/.insightface for compatibility
        root_insightface = '/root/.insightface/models'
        root_buffalo = os.path.join(root_insightface, 'buffalo_l')
        
        os.makedirs(root_insightface, exist_ok=True)
        
        if os.path.exists(buffalo_dir) and not os.path.exists(root_buffalo):
            try:
                os.symlink(buffalo_dir, root_buffalo)
                logger.info(f"🔗 Created root InsightFace symlink: {root_buffalo}")
            except OSError as e:
                if e.errno == 17:  # File exists
                    logger.info(f"🔗 Root InsightFace symlink already exists")
                else:
                    logger.warning(f"⚠️ Failed to create root InsightFace symlink: {e}")
        
        logger.info("✅ InsightFace paths configured successfully")
        
    except Exception as e:
        logger.error(f"❌ Error configuring InsightFace paths: {e}")

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
        
        # Model mapping - map model names to actual file paths in volume
        model_mapping = {
            'detection_Resnet50_Final': os.path.join(models_dir, 'detection_Resnet50_Final.pth'),
            'parsing_parsenet': os.path.join(models_dir, 'parsing_parsenet.pth'),
            'detection_mobilenet0.25_Final': os.path.join(models_dir, 'detection_mobilenet0.25_Final.pth'),
            'alignment_WFLW_4HG': os.path.join(models_dir, 'alignment_WFLW_4HG.pth'),
            'headpose_hopenet': os.path.join(models_dir, 'headpose_hopenet.pth'),
            'modnet_photographic_portrait_matting': os.path.join(models_dir, 'modnet_photographic_portrait_matting.ckpt'),
            'recognition_arcface_ir_se50': os.path.join(models_dir, 'recognition_arcface_ir_se50.pth'),
            'assessment_hyperIQA': os.path.join(models_dir, 'assessment_hyperIQA.pth'),
        }
        
        # Check and log model availability
        for model_name, model_path in model_mapping.items():
            if os.path.exists(model_path):
                logger.info(f"✅ Found local model: {model_name} at {model_path}")
            else:
                logger.warning(f"⚠️ Missing model: {model_name} at {model_path}")
        
        # Patch GFPGAN model loading
        original_init = GFPGANer.__init__
        
        def patched_init(self, model_path, upscale=2, arch='clean', channel_multiplier=2, bg_upsampler=None, device=None):
            # Force use local models directory
            if not os.path.isabs(model_path):
                # If relative path, make it absolute using our models directory
                model_path = os.path.join(models_dir, model_path)
            
            # Set weights directory to our volume
            os.environ['GFPGAN_WEIGHTS_DIR'] = gfpgan_weights_dir
            
            return original_init(self, model_path, upscale, arch, channel_multiplier, bg_upsampler, device)
        
        GFPGANer.__init__ = patched_init
        logger.info("✅ GFPGAN model paths patched successfully")
        
    except ImportError as e:
        logger.warning(f"⚠️ Could not import GFPGAN for patching: {e}")
    except Exception as e:
        logger.error(f"❌ Error patching GFPGAN: {e}")

def patch_facexlib_paths():
    """Patch FaceXLib to use Volume models"""
    try:
        import facexlib
        from facexlib.utils import load_file_from_url
        
        models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
        
        # Store original function
        original_load_file_from_url = load_file_from_url
        
        def patched_load_file_from_url(url, model_dir=None, progress=True, file_name=None):
            """Patched version that uses local files instead of downloading"""
            
            # Extract filename from URL if not provided
            if file_name is None:
                file_name = url.split('/')[-1]
            
            # Check if file exists in our models directory
            local_path = os.path.join(models_dir, file_name)
            if os.path.exists(local_path):
                logger.info(f"✅ Using local model: {file_name} from {local_path}")
                return local_path
            
            # Check in gfpgan/weights subdirectory
            gfpgan_path = os.path.join(models_dir, 'gfpgan', 'weights', file_name)
            if os.path.exists(gfpgan_path):
                logger.info(f"✅ Using local model: {file_name} from {gfpgan_path}")
                return gfpgan_path
            
            # If not found locally, allow download as fallback
            logger.warning(f"⚠️ Model {file_name} not found in volume, allowing download from {url}")
            return original_load_file_from_url(url, model_dir, progress, file_name)
        
        # Replace the function
        facexlib.utils.load_file_from_url = patched_load_file_from_url
        
        logger.info("✅ FaceXLib model loading patched successfully")
        
    except ImportError as e:
        logger.warning(f"⚠️ Could not import FaceXLib for patching: {e}")
    except Exception as e:
        logger.error(f"❌ Error patching FaceXLib: {e}")

def patch_basicsr_paths():
    """Patch BasicSR to use Volume models"""
    try:
        import basicsr
        from basicsr.utils.download_util import load_file_from_url
        
        models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
        
        # Store original function
        original_load_file_from_url = load_file_from_url
        
        def patched_load_file_from_url(url, model_dir=None, progress=True, file_name=None):
            """Patched version that uses local files instead of downloading"""
            
            # Extract filename from URL if not provided
            if file_name is None:
                file_name = url.split('/')[-1]
            
            # Check if file exists in our models directory
            local_path = os.path.join(models_dir, file_name)
            if os.path.exists(local_path):
                logger.info(f"✅ Using local model: {file_name} from {local_path}")
                return local_path
            
            # Check in gfpgan/weights subdirectory
            gfpgan_path = os.path.join(models_dir, 'gfpgan', 'weights', file_name)
            if os.path.exists(gfpgan_path):
                logger.info(f"✅ Using local model: {file_name} from {gfpgan_path}")
                return gfpgan_path
            
            # If not found locally, allow download as fallback
            logger.warning(f"⚠️ Model {file_name} not found in volume, allowing download from {url}")
            return original_load_file_from_url(url, model_dir, progress, file_name)
        
        # Replace the function
        basicsr.utils.download_util.load_file_from_url = patched_load_file_from_url
        
        logger.info("✅ BasicSR model loading patched successfully")
        
    except ImportError as e:
        logger.warning(f"⚠️ Could not import BasicSR for patching: {e}")
    except Exception as e:
        logger.error(f"❌ Error patching BasicSR: {e}")

def patch_download_functions():
    """Patch download functions to allow fallback downloads if models not found"""
    try:
        import urllib.request
        import requests
        
        models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
        
        # Store original functions
        original_urlretrieve = urllib.request.urlretrieve
        original_requests_get = requests.get
        
        def smart_urlretrieve(url, filename=None, reporthook=None, data=None):
            """Allow downloads but log them"""
            logger.info(f"📥 Allowing urllib download: {url}")
            return original_urlretrieve(url, filename, reporthook, data)
        
        def smart_requests_get(url, **kwargs):
            """Allow requests but log model downloads"""
            if any(domain in url for domain in ['github.com', 'huggingface.co', 'drive.google.com']) and any(ext in url for ext in ['.pth', '.onnx', '.zip']):
                logger.info(f"📥 Allowing model download via requests: {url}")
            
            return original_requests_get(url, **kwargs)
        
        # Replace functions
        urllib.request.urlretrieve = smart_urlretrieve
        requests.get = smart_requests_get
        
        logger.info("✅ Download functions configured for smart fallback")
        
    except Exception as e:
        logger.error(f"❌ Error configuring download functions: {e}")

def ensure_buffalo_l_extracted():
    """Ensure buffalo_l.zip is extracted to buffalo_l directory"""
    try:
        models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
        buffalo_zip = os.path.join(models_dir, 'buffalo_l.zip')
        buffalo_dir = os.path.join(models_dir, 'buffalo_l')
        
        if os.path.exists(buffalo_zip) and not os.path.exists(buffalo_dir):
            logger.info(f"📦 Extracting buffalo_l.zip to {buffalo_dir}")
            import zipfile
            with zipfile.ZipFile(buffalo_zip, 'r') as zip_ref:
                zip_ref.extractall(models_dir)
            logger.info("✅ buffalo_l.zip extracted successfully")
        elif os.path.exists(buffalo_dir):
            logger.info("✅ buffalo_l directory already exists")
        else:
            logger.warning("⚠️ buffalo_l.zip not found in volume")
            
    except Exception as e:
        logger.error(f"❌ Error extracting buffalo_l.zip: {e}")

if __name__ == "__main__":
    patch_insightface_paths()
    patch_gfpgan_model_paths()
    patch_facexlib_paths()
    patch_basicsr_paths()
    patch_download_functions()
    ensure_buffalo_l_extracted() 