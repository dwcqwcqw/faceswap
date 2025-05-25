#!/usr/bin/env python3
"""
RunPod Serverless Handler - No GUI Version
Handles face swap requests without GUI dependencies
"""

import runpod
import os
import sys
import json
import base64
import tempfile
import requests
from io import BytesIO
from PIL import Image
import cv2
import numpy as np
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the app directory to Python path
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/runpod')

# Set headless mode before importing any modules
os.environ['DISPLAY'] = ''
os.environ['HEADLESS'] = '1'

# Initialize models before importing face swap modules
try:
    from init_models import init_models
    models_dir = init_models()
    logger.info(f"🎯 Models initialization completed: {models_dir}")
except Exception as e:
    logger.warning(f"⚠️ Model initialization error: {e}")
    logger.info("🔄 Will attempt model setup during request processing")

# Ensure models are available in workspace before proceeding
try:
    from download_missing_models import ensure_models_available
    logger.info("🔄 Checking and downloading missing models...")
    ensure_models_available()
    logger.info("✅ Model availability check completed")
except Exception as e:
    logger.warning(f"⚠️ Model download check failed: {e}")
    logger.info("🔄 Proceeding anyway, will check models during processing")

# Import face swap functionality without GUI modules
try:
    # Import core modules (avoid UI modules)
    from modules.face_analyser import get_one_face, get_many_faces
    from modules.processors.frame.face_swapper import swap_face
    from modules.processors.frame.face_swapper import process_frame
    import modules.globals
    
    logger.info("✅ Core modules imported successfully")
    
except ImportError as e:
    logger.error(f"❌ Failed to import core modules: {e}")
    # Create fallback functions
    def get_one_face(frame):
        return None
    def swap_face(source_face, target_face, frame):
        return frame

def download_models():
    """Download required models if not present"""
    try:
        models_dir = modules.globals.get_models_dir()
        logger.info(f"🔍 Using models directory: {models_dir}")
        
        # Ensure models directory exists
        os.makedirs(models_dir, exist_ok=True)
        
        # Check essential models
        essential_models = {
            'inswapper_128_fp16.onnx': 'Face swapper model',
            'GFPGANv1.4.pth': 'Face enhancer model'
        }
        
        all_found = True
        for model_name, description in essential_models.items():
            model_path = os.path.join(models_dir, model_name)
            if os.path.exists(model_path):
                logger.info(f"✅ Found {description}: {model_name}")
            else:
                logger.warning(f"⚠️ Missing {description}: {model_name}")
                all_found = False
        
        # If essential models are found, proceed without downloading additional ones
        if all_found:
            logger.info("✅ Essential models found, ready for face swapping")
            # Update environment variable to ensure consistent model directory access
            os.environ['MODELS_DIR'] = models_dir
            return True
        
        # Try to download models using the download script if available
        try:
            from download_models import check_and_download_models
            actual_models_dir = check_and_download_models()
            logger.info(f"✅ Models ready in: {actual_models_dir}")
            
            # Update environment variable and modules.globals to use the actual models directory
            os.environ['MODELS_DIR'] = actual_models_dir
            
            # Force refresh of models directory in modules.globals
            import importlib
            importlib.reload(modules.globals)
            
            return True
        except ImportError:
            logger.warning("⚠️ Model download script not found")
        except Exception as e:
            logger.error(f"❌ Model download script failed: {e}")
        
        # Try to check if models exist in workspace/faceswap directly
        workspace_models = ['/workspace/faceswap/inswapper_128_fp16.onnx', '/workspace/faceswap/GFPGANv1.4.pth']
        workspace_found = []
        
        for model_path in workspace_models:
            if os.path.exists(model_path):
                model_name = os.path.basename(model_path)
                workspace_found.append(model_name)
                logger.info(f"✅ Found workspace model: {model_path}")
                
                # Create symlink or copy to models directory
                target_path = os.path.join(models_dir, model_name)
                if not os.path.exists(target_path):
                    try:
                        os.symlink(model_path, target_path)
                        logger.info(f"🔗 Linked {model_name} from workspace")
                    except:
                        import shutil
                        shutil.copy2(model_path, target_path)
                        logger.info(f"📋 Copied {model_name} from workspace")
        
        if workspace_found:
            logger.info(f"✅ Found {len(workspace_found)} models in workspace: {workspace_found}")
            # Update environment variable
            os.environ['MODELS_DIR'] = models_dir
            return True
        
        # If we reach here, some models are missing but we can try to proceed
        logger.warning("⚠️ Some models may be missing, but attempting to proceed")
        logger.info("💡 Face swapping may work if essential models are mounted in workspace")
        # Still update environment variable
        os.environ['MODELS_DIR'] = models_dir
        return True
        
    except Exception as e:
        logger.error(f"❌ Model setup failed: {e}")
        # Don't fail completely, allow handler to try anyway
        return True

def download_image_from_url(url):
    """Download image from URL and return as OpenCV format"""
    
    # Retry configuration
    max_retries = 3
    base_delay = 2  # seconds
    
    for attempt in range(max_retries + 1):
        try:
            logger.info(f"📥 Downloading image from: {url} (attempt {attempt + 1})")
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Convert to PIL Image
            image = Image.open(BytesIO(response.content))
            
            # Convert to OpenCV format (BGR)
            image_array = np.array(image)
            if len(image_array.shape) == 3 and image_array.shape[2] == 3:
                # RGB to BGR for OpenCV
                opencv_image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            elif len(image_array.shape) == 3 and image_array.shape[2] == 4:
                # RGBA to BGR for OpenCV
                opencv_image = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGR)
            else:
                # Grayscale to BGR
                opencv_image = cv2.cvtColor(image_array, cv2.COLOR_GRAY2BGR)
            
            logger.info(f"✅ Image downloaded successfully, shape: {opencv_image.shape}")
            return opencv_image
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404 and attempt < max_retries:
                # 404 might be temporary due to upload timing, retry with exponential backoff
                delay = base_delay * (2 ** attempt)
                logger.warning(f"⚠️ 404 error on attempt {attempt + 1}, retrying in {delay}s...")
                time.sleep(delay)
                continue
            else:
                logger.error(f"❌ HTTP error after {attempt + 1} attempts: {e}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to download image from {url} on attempt {attempt + 1}: {e}")
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"⚠️ Retrying in {delay}s...")
                time.sleep(delay)
                continue
            else:
                return None
    
    return None

def process_image_swap_from_urls(source_url, target_url):
    """Process face swap with image URLs"""
    try:
        # Download images from URLs
        logger.info("🔄 Starting image downloads...")
        source_frame = download_image_from_url(source_url)
        target_frame = download_image_from_url(target_url)
        
        if source_frame is None:
            return {"error": "Failed to download source image after retries. The file may not exist or may still be uploading."}
        
        if target_frame is None:
            return {"error": "Failed to download target image after retries. The file may not exist or may still be uploading."}
        
        logger.info("✅ Both images downloaded successfully")
        
        # Get source face
        logger.info("🔍 Detecting face in source image...")
        source_face = get_one_face(source_frame)
        if source_face is None:
            return {"error": "No face detected in source image"}
        
        logger.info("✅ Source face detected successfully")
        
        # Get target face as well
        logger.info("🔍 Detecting face in target image...")
        target_face = get_one_face(target_frame)
        if target_face is None:
            return {"error": "No face detected in target image"}
        
        logger.info("✅ Target face detected successfully")
        
        # Swap face
        logger.info("🔄 Starting face swap...")
        result_frame = swap_face(source_face, target_face, target_frame)
        logger.info("✅ Face swap completed")
        
        # Convert back to PIL and encode to base64
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Encode to base64
        buffer = BytesIO()
        result_image.save(buffer, format='PNG')
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info("✅ Result image encoded successfully")
        return {"result": result_data}
        
    except Exception as e:
        logger.error(f"❌ Face swap processing failed: {e}")
        return {"error": f"Processing failed: {str(e)}"}

def process_image_swap_from_base64(source_image_data, target_image_data):
    """Process face swap with base64 data (backward compatibility)"""
    try:
        # Decode base64 images
        source_image = Image.open(BytesIO(base64.b64decode(source_image_data)))
        target_image = Image.open(BytesIO(base64.b64decode(target_image_data)))
        
        # Convert to OpenCV format
        source_frame = cv2.cvtColor(np.array(source_image), cv2.COLOR_RGB2BGR)
        target_frame = cv2.cvtColor(np.array(target_image), cv2.COLOR_RGB2BGR)
        
        # Get source face
        source_face = get_one_face(source_frame)
        if source_face is None:
            return {"error": "No face detected in source image"}
        
        # Get target face as well
        target_face = get_one_face(target_frame)
        if target_face is None:
            return {"error": "No face detected in target image"}
        
        # Swap face
        result_frame = swap_face(source_face, target_face, target_frame)
        
        # Convert back to PIL and encode
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Encode to base64
        buffer = BytesIO()
        result_image.save(buffer, format='PNG')
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        return {"result": result_data}
        
    except Exception as e:
        logger.error(f"❌ Base64 image processing failed: {e}")
        return {"error": str(e)}

def process_video_swap(source_image_data, target_video_data):
    """Process video face swap"""
    try:
        # This is a placeholder for video processing
        # In a real implementation, you'd process the video frame by frame
        return {"error": "Video processing not implemented yet"}
    except Exception as e:
        logger.error(f"❌ Video processing failed: {e}")
        return {"error": str(e)}

def handler(event):
    """
    RunPod serverless handler function
    """
    try:
        logger.info("🚀 Face Swap Handler started")
        logger.info(f"📋 Received event: {json.dumps(event, indent=2)}")
        
        # Check models (don't fail if download doesn't work)
        download_models()
        
        # Get request data
        input_data = event.get("input", {})
        
        # Handle health check
        if input_data.get("type") == "health_check":
            return {
                "status": "healthy",
                "message": "RunPod Serverless Face Swap Handler is running",
                "modules_imported": True,
                "models_directory": modules.globals.get_models_dir()
            }
        
        # Determine swap type - support both new format and legacy format
        swap_type = input_data.get("type") or input_data.get("process_type", "single_image")
        
        # Normalize type format (convert single-image to single_image)
        if swap_type == "single-image":
            swap_type = "single_image"
        
        logger.info(f"🎯 Processing type: {swap_type}")
        
        if swap_type == "single_image":
            # Check for new format (URLs from Cloudflare Worker)
            if input_data.get("source_file") and input_data.get("target_file"):
                logger.info("📡 Processing URLs from Cloudflare Worker")
                source_url = input_data.get("source_file")
                target_url = input_data.get("target_file")
                
                return process_image_swap_from_urls(source_url, target_url)
            
            # Check for legacy format (base64 data)
            elif input_data.get("source_image") and input_data.get("target_image"):
                logger.info("📄 Processing base64 data (legacy format)")
                source_image = input_data.get("source_image")
                target_image = input_data.get("target_image")
                
                return process_image_swap_from_base64(source_image, target_image)
            
            else:
                logger.error("❌ Missing required image data")
                return {"error": "Missing source_file/target_file or source_image/target_image"}
            
        elif swap_type == "video":
            source_image = input_data.get("source_image") or input_data.get("source_file")
            target_video = input_data.get("target_video") or input_data.get("target_file")
            
            if not source_image or not target_video:
                return {"error": "Missing source_image/source_file or target_video/target_file"}
            
            return process_video_swap(source_image, target_video)
            
        else:
            return {"error": f"Unsupported swap type: {swap_type}"}
            
    except Exception as e:
        logger.error(f"❌ Handler error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    logger.info("🚀 Starting RunPod Serverless Face Swap Handler...")
    
    # Download models on startup
    download_models()
    
    # Start RunPod handler
    runpod.serverless.start({"handler": handler}) 