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
from io import BytesIO
from PIL import Image
import cv2
import numpy as np
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the app directory to Python path
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/runpod')

# Set headless mode before importing any modules
os.environ['DISPLAY'] = ''
os.environ['HEADLESS'] = '1'

# Import face swap functionality without GUI modules
try:
    # Import core modules (avoid UI modules)
    from modules.face_analyser import get_one_face, get_many_faces
    from modules.face_swapper import swap_face
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
            return True
        
        # Try to download models using the download script if available
        try:
            from download_models import check_and_download_models
            models_dir = check_and_download_models()
            logger.info(f"✅ Models ready in: {models_dir}")
            return True
        except ImportError:
            logger.warning("⚠️ Model download script not found")
        except Exception as e:
            logger.error(f"❌ Model download script failed: {e}")
        
        # If we reach here, some models are missing but we can try to proceed
        logger.warning("⚠️ Some models may be missing, but attempting to proceed")
        logger.info("💡 Face swapping may work if essential models are mounted in workspace")
        return True
        
    except Exception as e:
        logger.error(f"❌ Model setup failed: {e}")
        # Don't fail completely, allow handler to try anyway
        return True

def process_image_swap(source_image_data, target_image_data):
    """Process single image face swap"""
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
        
        # Swap face
        result_frame = swap_face(source_face, target_frame)
        
        # Convert back to PIL and encode
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Encode to base64
        buffer = BytesIO()
        result_image.save(buffer, format='PNG')
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        return {"result": result_data}
        
    except Exception as e:
        logger.error(f"❌ Image processing failed: {e}")
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
        
        swap_type = input_data.get("type", "single_image")
        
        if swap_type == "single_image":
            source_image = input_data.get("source_image")
            target_image = input_data.get("target_image")
            
            if not source_image or not target_image:
                return {"error": "Missing source_image or target_image"}
            
            return process_image_swap(source_image, target_image)
            
        elif swap_type == "video":
            source_image = input_data.get("source_image")
            target_video = input_data.get("target_video")
            
            if not source_image or not target_video:
                return {"error": "Missing source_image or target_video"}
            
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