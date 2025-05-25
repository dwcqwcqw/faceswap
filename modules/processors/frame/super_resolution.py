"""
Super Resolution Processor using Real-ESRGAN
Enhances image resolution for ultra-high-definition output
"""

from typing import Any, List, Optional
import cv2
import numpy as np
import threading
import os
import tempfile
import logging

import modules.globals
import modules.processors.frame.core
from modules.core import update_status
from modules.typing import Frame
from modules.utilities import (
    conditional_download,
    is_image,
    is_video,
)

# Configure logging
logger = logging.getLogger(__name__)

SUPER_RESOLUTION_MODEL = None
THREAD_SEMAPHORE = threading.Semaphore()
THREAD_LOCK = threading.Lock()
NAME = "DLC.SUPER-RESOLUTION"

def get_models_directory():
    """Get models directory with fallback options"""
    try:
        # Try to get from modules.globals first
        models_dir = modules.globals.get_models_dir()
        if models_dir and os.path.exists(models_dir):
            return models_dir
    except:
        pass
    
    # Fallback options for RunPod environment
    fallback_paths = [
        '/workspace/faceswap/models',
        '/workspace/faceswap',
        '/app/models',
        '/workspace/models'
    ]
    
    for path in fallback_paths:
        if os.path.exists(path):
            logger.info(f"🔍 Using fallback models directory: {path}")
            return path
    
    # Create default directory
    default_dir = '/app/models'
    os.makedirs(default_dir, exist_ok=True)
    logger.info(f"🔍 Created default models directory: {default_dir}")
    return default_dir


def find_model_file(model_name: str) -> Optional[str]:
    """Find model file in multiple possible locations"""
    search_paths = [
        # Primary models directory
        get_models_directory(),
        # Workspace paths
        '/workspace/faceswap/models',
        '/workspace/faceswap',
        '/workspace/models',
        # App paths
        '/app/models',
        # Current directory paths
        './models',
        '.'
    ]
    
    for search_path in search_paths:
        if not os.path.exists(search_path):
            continue
            
        model_path = os.path.join(search_path, model_name)
        if os.path.exists(model_path) and os.path.isfile(model_path):
            file_size = os.path.getsize(model_path)
            if file_size > 1024 * 1024:  # At least 1MB
                logger.info(f"✅ Found {model_name} at: {model_path} ({file_size} bytes)")
                return model_path
            else:
                logger.warning(f"⚠️ Found {model_name} but file too small: {model_path} ({file_size} bytes)")
    
    logger.warning(f"⚠️ Model {model_name} not found in any search location")
    return None


def download_super_resolution_model(model_name: str, destination_path: str) -> bool:
    """Download super resolution model if missing"""
    model_urls = {
        'RealESRGAN_x4plus.pth': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
        'RealESRGAN_x2plus.pth': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth'
    }
    
    if model_name not in model_urls:
        logger.error(f"❌ Unknown model: {model_name}")
        return False
    
    try:
        import requests
        
        url = model_urls[model_name]
        logger.info(f"📥 Downloading {model_name} from: {url}")
        
        # Create directory if needed
        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        # Download with progress
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(destination_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        if downloaded % (1024 * 1024) == 0:  # Log every MB
                            logger.info(f"   Progress: {progress:.1f}% ({downloaded // (1024*1024)}MB/{total_size // (1024*1024)}MB)")
        
        # Verify download
        if os.path.exists(destination_path) and os.path.getsize(destination_path) > 1024 * 1024:
            logger.info(f"✅ Successfully downloaded {model_name}")
            return True
        else:
            logger.error(f"❌ Download verification failed for {model_name}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to download {model_name}: {e}")
        return False


def pre_check() -> bool:
    """Pre-check for super resolution model availability"""
    download_directory_path = get_models_directory()
    conditional_download(
        download_directory_path,
        [
            "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
        ],
    )
    return True


def post_check() -> bool:
    """Post-check for super resolution functionality"""
    return True


def get_super_resolution_model(scale_factor: int = 4):
    """Get Real-ESRGAN model for super resolution"""
    global SUPER_RESOLUTION_MODEL
    
    with THREAD_LOCK:
        if SUPER_RESOLUTION_MODEL is None:
            try:
                # Try to import Real-ESRGAN
                try:
                    import basicsr
                    from realesrgan import RealESRGANer
                    from realesrgan.archs.srvgg_arch import SRVGGNetCompact
                    logger.info("✅ Real-ESRGAN modules imported successfully")
                except ImportError as e:
                    logger.warning(f"⚠️ Real-ESRGAN not available: {e}")
                    logger.info("📦 Installing Real-ESRGAN...")
                    
                    # Try to install Real-ESRGAN
                    import subprocess
                    import sys
                    
                    try:
                        subprocess.check_call([sys.executable, "-m", "pip", "install", "realesrgan", "basicsr"])
                        import basicsr
                        from realesrgan import RealESRGANer
                        from realesrgan.archs.srvgg_arch import SRVGGNetCompact
                        logger.info("✅ Real-ESRGAN installed and imported successfully")
                    except Exception as install_error:
                        logger.error(f"❌ Failed to install Real-ESRGAN: {install_error}")
                        return None
                
                # Determine model path based on scale factor
                if scale_factor == 4:
                    model_name = 'RealESRGAN_x4plus.pth'
                    netscale = 4
                elif scale_factor == 2:
                    model_name = 'RealESRGAN_x2plus.pth'
                    netscale = 2
                else:
                    logger.warning(f"⚠️ Unsupported scale factor {scale_factor}, using 4x")
                    model_name = 'RealESRGAN_x4plus.pth'
                    netscale = 4
                
                # Search for model in multiple locations
                model_path = find_model_file(model_name)
                
                # Check if model exists
                if not model_path or not os.path.exists(model_path):
                    logger.error(f"❌ Super resolution model not found: {model_name}")
                    logger.info("💡 Attempting to download model...")
                    
                    # Try to download missing model
                    models_dir = get_models_directory()
                    download_path = os.path.join(models_dir, model_name)
                    
                    if download_super_resolution_model(model_name, download_path):
                        model_path = download_path
                        logger.info(f"✅ Model downloaded successfully: {model_path}")
                    else:
                        logger.error(f"❌ Failed to download model: {model_name}")
                        return None
                
                logger.info(f"🔍 Loading super resolution model: {model_name}")
                
                # Initialize RealESRGAN
                SUPER_RESOLUTION_MODEL = RealESRGANer(
                    scale=netscale,
                    model_path=model_path,
                    model=None,  # Auto-detect architecture
                    tile=512,    # Use tiling for memory efficiency
                    tile_pad=10,
                    pre_pad=0,
                    half=True    # Use half precision for speed
                )
                
                logger.info(f"✅ Super resolution model loaded successfully (scale: {netscale}x)")
                
            except Exception as e:
                logger.error(f"❌ Failed to load super resolution model: {e}")
                return None
    
    return SUPER_RESOLUTION_MODEL


def enhance_resolution(frame: Frame, scale_factor: int = 4, max_size: int = 2048) -> Optional[Frame]:
    """
    Enhance frame resolution using Real-ESRGAN
    
    Args:
        frame: Input frame (numpy array)
        scale_factor: Upscaling factor (2 or 4)
        max_size: Maximum output dimension to prevent memory issues
    
    Returns:
        Enhanced frame or None if failed
    """
    
    if frame is None:
        return None
    
    try:
        # Get super resolution model
        sr_model = get_super_resolution_model(scale_factor)
        if sr_model is None:
            logger.warning("⚠️ Super resolution model not available, returning original frame")
            return frame
        
        # Check input frame dimensions
        height, width = frame.shape[:2]
        logger.info(f"📐 Input frame size: {width}x{height}")
        
        # Calculate output size
        output_width = width * scale_factor
        output_height = height * scale_factor
        
        # Check if output would be too large
        if max(output_width, output_height) > max_size:
            # Calculate safe scale factor
            safe_scale = min(max_size / width, max_size / height)
            if safe_scale < 1.5:  # If even 1.5x would be too large, skip enhancement
                logger.info(f"⚠️ Frame too large for super resolution ({width}x{height}), skipping")
                return frame
            
            # Use smaller scale factor
            if safe_scale >= 2.0:
                scale_factor = 2
            else:
                logger.info(f"⚠️ Using conservative upscaling due to size constraints")
                # Use traditional upscaling for very large images
                new_width = int(width * safe_scale)
                new_height = int(height * safe_scale)
                return cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
        
        logger.info(f"🚀 Starting super resolution enhancement ({scale_factor}x)...")
        logger.info(f"📏 Output size will be: {output_width}x{output_height}")
        
        # Convert BGR to RGB for Real-ESRGAN
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Apply super resolution
        with THREAD_SEMAPHORE:
            enhanced_rgb, _ = sr_model.enhance(frame_rgb, outscale=scale_factor)
        
        # Convert back to BGR
        enhanced_frame = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGR)
        
        final_height, final_width = enhanced_frame.shape[:2]
        logger.info(f"✅ Super resolution completed: {final_width}x{final_height}")
        
        return enhanced_frame
        
    except Exception as e:
        logger.error(f"❌ Super resolution failed: {e}")
        logger.info("🔄 Falling back to traditional upscaling...")
        
        # Fallback to high-quality traditional upscaling
        try:
            height, width = frame.shape[:2]
            new_width = min(width * 2, max_size)  # At least 2x upscale
            new_height = min(height * 2, max_size)
            
            # Maintain aspect ratio
            aspect_ratio = width / height
            if new_width / aspect_ratio > max_size:
                new_width = int(max_size * aspect_ratio)
                new_height = max_size
            elif new_height * aspect_ratio > max_size:
                new_height = int(max_size / aspect_ratio)
                new_width = max_size
            
            enhanced_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
            logger.info(f"✅ Fallback upscaling completed: {new_width}x{new_height}")
            return enhanced_frame
            
        except Exception as fallback_error:
            logger.error(f"❌ Fallback upscaling also failed: {fallback_error}")
            return frame


def process_frame(frame: Frame, scale_factor: int = 4) -> Frame:
    """
    Process a single frame with super resolution
    
    Args:
        frame: Input frame
        scale_factor: Upscaling factor (2 or 4)
    
    Returns:
        Enhanced frame
    """
    return enhance_resolution(frame, scale_factor)


def process_frames(source_paths: List[str], temp_frame_paths: List[str], update_progress=None) -> None:
    """
    Process multiple frames with super resolution
    
    Args:
        source_paths: List of source frame paths
        temp_frame_paths: List of temporary frame paths for output
        update_progress: Progress update callback
    """
    for index, (source_path, temp_frame_path) in enumerate(zip(source_paths, temp_frame_paths)):
        # Read frame
        source_frame = cv2.imread(source_path)
        if source_frame is None:
            continue
        
        # Process frame
        result_frame = process_frame(source_frame)
        
        # Save result
        cv2.imwrite(temp_frame_path, result_frame)
        
        # Update progress
        if update_progress:
            update_progress(index + 1)


def process_image(source_path: str, target_path: str, scale_factor: int = 4) -> bool:
    """
    Process a single image with super resolution
    
    Args:
        source_path: Input image path
        target_path: Output image path  
        scale_factor: Upscaling factor (2 or 4)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Read image
        source_frame = cv2.imread(source_path)
        if source_frame is None:
            logger.error(f"❌ Failed to read image: {source_path}")
            return False
        
        # Process with super resolution
        result_frame = process_frame(source_frame, scale_factor)
        
        if result_frame is None:
            logger.error("❌ Super resolution processing failed")
            return False
        
        # Save result
        success = cv2.imwrite(target_path, result_frame)
        if success:
            logger.info(f"✅ Super resolution image saved: {target_path}")
        else:
            logger.error(f"❌ Failed to save enhanced image: {target_path}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Image super resolution failed: {e}")
        return False


def process_video(source_path: str, target_path: str, scale_factor: int = 4) -> bool:
    """
    Process a video with super resolution
    
    Args:
        source_path: Input video path
        target_path: Output video path
        scale_factor: Upscaling factor (2 or 4)
    
    Returns:
        True if successful, False otherwise
    """
    # Note: Video super resolution is computationally intensive
    # This is a simplified implementation
    logger.warning("⚠️ Video super resolution is experimental and may be slow")
    
    try:
        # Open video
        cap = cv2.VideoCapture(source_path)
        if not cap.isOpened():
            logger.error(f"❌ Failed to open video: {source_path}")
            return False
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Read first frame to get dimensions
        ret, first_frame = cap.read()
        if not ret:
            logger.error("❌ Failed to read first frame")
            cap.release()
            return False
        
        # Reset video to beginning
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        
        # Process first frame to get output dimensions
        enhanced_first_frame = process_frame(first_frame, scale_factor)
        output_height, output_width = enhanced_first_frame.shape[:2]
        
        # Setup video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(target_path, fourcc, fps, (output_width, output_height))
        
        # Process frames
        frame_index = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process frame
            enhanced_frame = process_frame(frame, scale_factor)
            out.write(enhanced_frame)
            
            frame_index += 1
            if frame_index % 10 == 0:  # Log progress every 10 frames
                logger.info(f"📹 Processed {frame_index}/{frame_count} frames")
        
        # Cleanup
        cap.release()
        out.release()
        
        logger.info(f"✅ Super resolution video saved: {target_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Video super resolution failed: {e}")
        return False 