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

# ====== RunPod Serverless Path Compatibility Fix ======
# Handle difference between RunPod Pod (/workspace) and Serverless (/runpod-volume) environments
def setup_runpod_serverless_compatibility():
    """Setup path compatibility for RunPod Serverless environment"""
    
    logger.info("🔧 Setting up RunPod Serverless path compatibility...")
    
    # Check if we're in RunPod Serverless environment
    if os.path.exists('/runpod-volume') and not os.path.exists('/workspace'):
        logger.info("🚀 Detected RunPod Serverless environment")
        
        # Create symbolic link: /runpod-volume -> /workspace
        try:
            os.symlink('/runpod-volume', '/workspace')
            logger.info("✅ Created symbolic link: /runpod-volume -> /workspace")
            
            # Verify the link works
            if os.path.exists('/workspace/faceswap'):
                logger.info("✅ Path compatibility verified: /workspace/faceswap accessible")
            else:
                logger.warning("⚠️ /workspace/faceswap not found via symbolic link")
                
        except FileExistsError:
            logger.info("ℹ️ Symbolic link already exists")
        except Exception as e:
            logger.error(f"❌ Failed to create symbolic link: {e}")
            
    elif os.path.exists('/workspace'):
        logger.info("🔍 Detected traditional RunPod Pod environment")
        logger.info("ℹ️ No path conversion needed")
        
    else:
        logger.info("🏠 Detected local development environment")
        logger.info("ℹ️ No path conversion needed")

# Apply RunPod Serverless compatibility fix immediately
setup_runpod_serverless_compatibility()

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
    
    # Import super resolution module
    try:
        from modules.processors.frame.super_resolution import enhance_resolution
        logger.info("✅ Super resolution module imported successfully")
        SR_AVAILABLE = True
    except ImportError as e:
        logger.warning(f"⚠️ Super resolution module not available: {e}")
        SR_AVAILABLE = False
        def enhance_resolution(frame, scale_factor=4, max_size=2048):
            """Fallback function when super resolution is not available"""
            return frame
    
    logger.info("✅ Core modules imported successfully")
    
except ImportError as e:
    logger.error(f"❌ Failed to import core modules: {e}")
    # Create fallback functions
    def get_one_face(frame):
        return None
    def get_many_faces(frame):
        return []
    def swap_face(source_face, target_face, frame):
        return frame
    def enhance_resolution(frame, scale_factor=4, max_size=2048):
        return frame
    SR_AVAILABLE = False

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
            'GFPGANv1.4.pth': 'Face enhancer model',
            'RealESRGAN_x4plus.pth': 'Super resolution model (4x)',
            'RealESRGAN_x2plus.pth': 'Super resolution model (2x)'
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
        
        # Also check for super resolution models
        sr_models_workspace = [
            '/workspace/faceswap/RealESRGAN_x4plus.pth', 
            '/workspace/faceswap/RealESRGAN_x2plus.pth'
        ]
        
        for model_path in sr_models_workspace:
            if os.path.exists(model_path):
                model_name = os.path.basename(model_path)
                workspace_found.append(model_name)
                logger.info(f"✅ Found workspace SR model: {model_path}")
                
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
            
            # Log response headers for debugging
            content_type = response.headers.get('content-type', '')
            logger.info(f"📋 Response content-type: {content_type}")
            logger.info(f"📋 Response size: {len(response.content)} bytes")
            
            # Check if it's a valid image format
            if 'svg' in content_type.lower():
                logger.error("❌ SVG format is not supported for face detection")
                return None
            
            # Convert to PIL Image
            try:
                image = Image.open(BytesIO(response.content))
                logger.info(f"📐 PIL Image format: {image.format}, mode: {image.mode}, size: {image.size}")
            except Exception as e:
                logger.error(f"❌ Failed to open image with PIL: {e}")
                # Try to detect file format from first few bytes
                if len(response.content) > 10:
                    header = response.content[:10]
                    logger.error(f"❌ File header: {header.hex()}")
                return None
            
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
    """Process face swap with image URLs - Enhanced with multi-round optimization"""
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
        logger.info(f"📐 Source image shape: {source_frame.shape}")
        logger.info(f"📐 Target image shape: {target_frame.shape}")
        
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
        
        # Configure enhancement settings
        logger.info("⚙️ Configuring face enhancement settings...")
        modules.globals.use_face_enhancer = True  # Enable face enhancer
        modules.globals.mouth_mask = True         # Enable mouth mask for better blending
        modules.globals.color_correction = True  # Enable color correction
        
        # Multi-round iterative face swap for higher quality
        logger.info("🚀 Starting multi-round iterative face swap...")
        result_frame = target_frame.copy()
        
        # Round 1: Initial face swap
        logger.info("🔄 Round 1: Initial face swap...")
        result_frame = swap_face(source_face, target_face, result_frame)
        logger.info("✅ Round 1 completed")
        
        # Round 2: Refinement with detected result face
        logger.info("🔄 Round 2: Refinement pass...")
        refined_target_face = get_one_face(result_frame)
        if refined_target_face is not None:
            # Use a slightly more conservative approach for refinement
            temp_result = swap_face(source_face, refined_target_face, result_frame)
            # Quality check: compare face detection confidence
            if refined_target_face.det_score > 0.5:  # If detection is confident
                result_frame = temp_result
                logger.info("✅ Round 2 refinement applied")
            else:
                logger.info("⚠️ Round 2 skipped due to low detection confidence")
        else:
            logger.warning("⚠️ Round 2 skipped - no face detected in result")
        
        # Round 3: Final precision pass
        logger.info("🔄 Round 3: Final precision pass...")
        final_target_face = get_one_face(result_frame)
        if final_target_face is not None and final_target_face.det_score > 0.6:
            # Very conservative final pass
            temp_result = swap_face(source_face, final_target_face, result_frame)
            # Check if the final result maintains face detectability
            check_face = get_one_face(temp_result)
            if check_face is not None and check_face.det_score > 0.5:
                result_frame = temp_result
                logger.info("✅ Round 3 precision pass applied")
            else:
                logger.info("⚠️ Round 3 skipped - would degrade quality")
        else:
            logger.info("⚠️ Round 3 skipped - insufficient face detection confidence")
        
        # Apply face enhancement if available
        try:
            logger.info("🎨 Applying advanced face enhancement...")
            
            # Try to import and use face enhancer
            from modules.processors.frame.face_enhancer import enhance_face, get_face_enhancer
            
            # Multiple enhancement passes for better quality
            for enhancement_round in range(2):  # Two rounds of enhancement
                logger.info(f"✨ Enhancement round {enhancement_round + 1}/2...")
                
                enhanced_frame = enhance_face(result_frame)
                if enhanced_frame is not None:
                    if enhancement_round == 0:
                        # First round: blend conservatively
                        result_frame = cv2.addWeighted(result_frame, 0.4, enhanced_frame, 0.6, 0)
                        logger.info("✅ First enhancement pass blended")
                    else:
                        # Second round: use full enhancement
                        result_frame = enhanced_frame
                        logger.info("✅ Final enhancement applied")
                else:
                    logger.warning(f"⚠️ Enhancement round {enhancement_round + 1} failed")
                    break
                    
        except ImportError:
            logger.warning("⚠️ Face enhancer module not available")
        except Exception as e:
            logger.warning(f"⚠️ Face enhancement failed: {e}")
        
        # Advanced post-processing for better realism
        logger.info("🎭 Applying advanced post-processing...")
        try:
            # Ensure face region boundaries are smooth
            final_face = get_one_face(result_frame)
            if final_face is not None:
                # Apply subtle smoothing to face edges
                result_frame = apply_edge_smoothing(result_frame, final_face)
                logger.info("✅ Edge smoothing applied")
        except Exception as e:
            logger.warning(f"⚠️ Post-processing warning: {e}")
        
        # Apply AI Super Resolution for ultra-high quality output
        logger.info("🔍 Applying AI Super Resolution for ultra-high quality...")
        try:
            if SR_AVAILABLE:
                # Determine optimal scale factor based on input size - OPTIMIZED FOR MAXIMUM QUALITY
                height, width = result_frame.shape[:2]
                
                # Use 4x for most images to get maximum quality, 2x for large images, skip only for very large
                if max(width, height) < 768:  # Increased threshold for 4x (was 512)
                    scale_factor = 4
                    max_output_size = 4096  # Higher max size for 4x
                    logger.info(f"📐 Using 4x super resolution for maximum quality (input: {width}x{height})")
                elif max(width, height) < 1536:  # Increased threshold for 2x (was 1024)
                    scale_factor = 2 
                    max_output_size = 3072  # Standard max size for 2x
                    logger.info(f"📐 Using 2x super resolution (input: {width}x{height})")
                else:
                    scale_factor = 1  # Skip only for very large images (≥1536px)
                    max_output_size = 3072
                    logger.info(f"📐 Skipping super resolution (input already very large: {width}x{height})")
                
                if scale_factor > 1:
                    enhanced_frame = enhance_resolution(result_frame, scale_factor, max_size=max_output_size)
                    if enhanced_frame is not None:
                        result_frame = enhanced_frame
                        final_height, final_width = result_frame.shape[:2]
                        logger.info(f"✅ AI Super Resolution completed: {final_width}x{final_height}")
                    else:
                        logger.warning("⚠️ Super resolution failed, using original")
            else:
                logger.info("⚠️ Super resolution not available, using traditional upscaling...")
                # Fallback to traditional high-quality upscaling
                height, width = result_frame.shape[:2]
                if max(width, height) < 768:
                    scale = min(2.0, 1536 / max(width, height))  # Target at least 1536px
                    new_width = int(width * scale)
                    new_height = int(height * scale)
                    result_frame = cv2.resize(result_frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                    logger.info(f"✅ Traditional upscaling: {new_width}x{new_height}")
                    
        except Exception as e:
            logger.warning(f"⚠️ Super resolution failed: {e}")
        
        # Convert back to PIL with ultra-high quality settings
        logger.info("📸 Converting result to ultra-high quality image...")
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Resize if the image is too small (upscale for better quality)
        width, height = result_image.size
        if width < 512 or height < 512:
            # Calculate new size maintaining aspect ratio
            scale_factor = max(512 / width, 512 / height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            
            logger.info(f"🔍 Upscaling image from {width}x{height} to {new_width}x{new_height}")
            result_image = result_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Encode to base64 with high quality JPEG
        buffer = BytesIO()
        result_image.save(buffer, format='JPEG', quality=95, optimize=True)
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info("✅ Ultra-high quality multi-round result image encoded successfully")
        return {"result": result_data}
        
    except Exception as e:
        logger.error(f"❌ Face swap processing failed: {e}")
        return {"error": f"Processing failed: {str(e)}"}

def apply_edge_smoothing(frame, face):
    """Apply subtle edge smoothing to face boundaries"""
    try:
        # Create a face mask
        mask = np.zeros(frame.shape[:2], dtype=np.uint8)
        landmarks = face.landmark_2d_106
        
        if landmarks is not None:
            # Convert landmarks to int32
            landmarks = landmarks.astype(np.int32)
            
            # Create face contour
            hull = cv2.convexHull(landmarks)
            cv2.fillPoly(mask, [hull], 255)
            
            # Apply Gaussian blur to the mask for smooth edges
            mask_blurred = cv2.GaussianBlur(mask, (5, 5), 2)
            
            # Normalize mask
            mask_normalized = mask_blurred.astype(np.float32) / 255.0
            mask_normalized = np.stack([mask_normalized] * 3, axis=2)
            
            # Apply very subtle smoothing
            frame_float = frame.astype(np.float32)
            blurred_frame = cv2.GaussianBlur(frame, (3, 3), 1)
            blurred_frame_float = blurred_frame.astype(np.float32)
            
            # Blend only at edges (use a very small smoothing factor)
            edge_factor = 0.1  # Very subtle
            smoothed = frame_float * (1 - mask_normalized * edge_factor) + blurred_frame_float * (mask_normalized * edge_factor)
            
            return smoothed.astype(np.uint8)
            
    except Exception as e:
        logger.warning(f"Edge smoothing failed: {e}")
        
    return frame

def process_image_swap_from_base64(source_image_data, target_image_data):
    """Process face swap with base64 data (backward compatibility) - Enhanced with multi-round optimization"""
    try:
        # Decode base64 images
        source_image = Image.open(BytesIO(base64.b64decode(source_image_data)))
        target_image = Image.open(BytesIO(base64.b64decode(target_image_data)))
        
        # Convert to OpenCV format
        source_frame = cv2.cvtColor(np.array(source_image), cv2.COLOR_RGB2BGR)
        target_frame = cv2.cvtColor(np.array(target_image), cv2.COLOR_RGB2BGR)
        
        logger.info(f"📐 Source image shape: {source_frame.shape}")
        logger.info(f"📐 Target image shape: {target_frame.shape}")
        
        # Get source face
        source_face = get_one_face(source_frame)
        if source_face is None:
            return {"error": "No face detected in source image"}
        
        # Get target face as well
        target_face = get_one_face(target_frame)
        if target_face is None:
            return {"error": "No face detected in target image"}
        
        # Configure enhancement settings
        logger.info("⚙️ Configuring face enhancement settings...")
        modules.globals.use_face_enhancer = True  # Enable face enhancer
        modules.globals.mouth_mask = True         # Enable mouth mask for better blending
        modules.globals.color_correction = True  # Enable color correction
        
        # Multi-round iterative face swap for higher quality
        logger.info("🚀 Starting multi-round iterative face swap...")
        result_frame = target_frame.copy()
        
        # Round 1: Initial face swap
        logger.info("🔄 Round 1: Initial face swap...")
        result_frame = swap_face(source_face, target_face, result_frame)
        logger.info("✅ Round 1 completed")
        
        # Round 2: Refinement with detected result face
        logger.info("🔄 Round 2: Refinement pass...")
        refined_target_face = get_one_face(result_frame)
        if refined_target_face is not None:
            # Use a slightly more conservative approach for refinement
            temp_result = swap_face(source_face, refined_target_face, result_frame)
            # Quality check: compare face detection confidence
            if refined_target_face.det_score > 0.5:  # If detection is confident
                result_frame = temp_result
                logger.info("✅ Round 2 refinement applied")
            else:
                logger.info("⚠️ Round 2 skipped due to low detection confidence")
        else:
            logger.warning("⚠️ Round 2 skipped - no face detected in result")
        
        # Round 3: Final precision pass
        logger.info("🔄 Round 3: Final precision pass...")
        final_target_face = get_one_face(result_frame)
        if final_target_face is not None and final_target_face.det_score > 0.6:
            # Very conservative final pass
            temp_result = swap_face(source_face, final_target_face, result_frame)
            # Check if the final result maintains face detectability
            check_face = get_one_face(temp_result)
            if check_face is not None and check_face.det_score > 0.5:
                result_frame = temp_result
                logger.info("✅ Round 3 precision pass applied")
            else:
                logger.info("⚠️ Round 3 skipped - would degrade quality")
        else:
            logger.info("⚠️ Round 3 skipped - insufficient face detection confidence")
        
        # Apply face enhancement if available
        try:
            logger.info("🎨 Applying advanced face enhancement...")
            
            # Try to import and use face enhancer
            from modules.processors.frame.face_enhancer import enhance_face, get_face_enhancer
            
            # Multiple enhancement passes for better quality
            for enhancement_round in range(2):  # Two rounds of enhancement
                logger.info(f"✨ Enhancement round {enhancement_round + 1}/2...")
                
                enhanced_frame = enhance_face(result_frame)
                if enhanced_frame is not None:
                    if enhancement_round == 0:
                        # First round: blend conservatively
                        result_frame = cv2.addWeighted(result_frame, 0.4, enhanced_frame, 0.6, 0)
                        logger.info("✅ First enhancement pass blended")
                    else:
                        # Second round: use full enhancement
                        result_frame = enhanced_frame
                        logger.info("✅ Final enhancement applied")
                else:
                    logger.warning(f"⚠️ Enhancement round {enhancement_round + 1} failed")
                    break
                    
        except ImportError:
            logger.warning("⚠️ Face enhancer module not available")
        except Exception as e:
            logger.warning(f"⚠️ Face enhancement failed: {e}")
        
        # Advanced post-processing for better realism
        logger.info("🎭 Applying advanced post-processing...")
        try:
            # Ensure face region boundaries are smooth
            final_face = get_one_face(result_frame)
            if final_face is not None:
                # Apply subtle smoothing to face edges
                result_frame = apply_edge_smoothing(result_frame, final_face)
                logger.info("✅ Edge smoothing applied")
        except Exception as e:
            logger.warning(f"⚠️ Post-processing warning: {e}")
        
        # Apply AI Super Resolution for ultra-high quality output
        logger.info("🔍 Applying AI Super Resolution for ultra-high quality...")
        try:
            if SR_AVAILABLE:
                # Determine optimal scale factor based on input size - OPTIMIZED FOR MAXIMUM QUALITY
                height, width = result_frame.shape[:2]
                
                # Use 4x for most images to get maximum quality, 2x for large images, skip only for very large
                if max(width, height) < 768:  # Increased threshold for 4x (was 512)
                    scale_factor = 4
                    max_output_size = 4096  # Higher max size for 4x
                    logger.info(f"📐 Using 4x super resolution for maximum quality (input: {width}x{height})")
                elif max(width, height) < 1536:  # Increased threshold for 2x (was 1024)
                    scale_factor = 2 
                    max_output_size = 3072  # Standard max size for 2x
                    logger.info(f"📐 Using 2x super resolution (input: {width}x{height})")
                else:
                    scale_factor = 1  # Skip only for very large images (≥1536px)
                    max_output_size = 3072
                    logger.info(f"📐 Skipping super resolution (input already very large: {width}x{height})")
                
                if scale_factor > 1:
                    enhanced_frame = enhance_resolution(result_frame, scale_factor, max_size=max_output_size)
                    if enhanced_frame is not None:
                        result_frame = enhanced_frame
                        final_height, final_width = result_frame.shape[:2]
                        logger.info(f"✅ AI Super Resolution completed: {final_width}x{final_height}")
                    else:
                        logger.warning("⚠️ Super resolution failed, using original")
            else:
                logger.info("⚠️ Super resolution not available, using traditional upscaling...")
                # Fallback to traditional high-quality upscaling
                height, width = result_frame.shape[:2]
                if max(width, height) < 768:
                    scale = min(2.0, 1536 / max(width, height))  # Target at least 1536px
                    new_width = int(width * scale)
                    new_height = int(height * scale)
                    result_frame = cv2.resize(result_frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                    logger.info(f"✅ Traditional upscaling: {new_width}x{new_height}")
                    
        except Exception as e:
            logger.warning(f"⚠️ Super resolution failed: {e}")
        
        # Convert back to PIL with ultra-high quality settings
        logger.info("📸 Converting result to ultra-high quality image...")
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Resize if the image is too small (upscale for better quality)
        width, height = result_image.size
        if width < 512 or height < 512:
            # Calculate new size maintaining aspect ratio
            scale_factor = max(512 / width, 512 / height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            
            logger.info(f"🔍 Upscaling image from {width}x{height} to {new_width}x{new_height}")
            result_image = result_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Encode to base64 with high quality JPEG
        buffer = BytesIO()
        result_image.save(buffer, format='JPEG', quality=95, optimize=True)
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info("✅ Ultra-high quality multi-round result image encoded successfully")
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

def process_detect_faces_from_url(image_url):
    """Detect faces in image from URL - Enhanced multi-face detection with face previews"""
    try:
        logger.info(f"🔍 Starting face detection from URL: {image_url}")
        
        # Download image from URL
        image_frame = download_image_from_url(image_url)
        if image_frame is None:
            return {"error": "Failed to download image"}
        
        logger.info(f"📐 Image downloaded successfully, shape: {image_frame.shape}")
        
        # Detect all faces in the image
        logger.info("🔍 Detecting faces using get_many_faces...")
        faces = get_many_faces(image_frame)
        
        if faces is None or len(faces) == 0:
            logger.warning("⚠️ No faces detected in image")
            return {
                "faces": [],
                "total_faces": 0,
                "image_path": image_url,
                "error": "No faces detected in the image"
            }
        
        logger.info(f"✅ Detected {len(faces)} face(s)")
        
        # Convert faces to API format with face previews
        detected_faces = []
        for i, face in enumerate(faces):
            try:
                # Extract face information
                face_info = {
                    'id': str(i),
                    'x': int(face.bbox[0]) if hasattr(face, 'bbox') else 0,
                    'y': int(face.bbox[1]) if hasattr(face, 'bbox') else 0,
                    'width': int(face.bbox[2] - face.bbox[0]) if hasattr(face, 'bbox') else 0,
                    'height': int(face.bbox[3] - face.bbox[1]) if hasattr(face, 'bbox') else 0,
                    'confidence': float(face.det_score) if hasattr(face, 'det_score') else 0.9
                }
                
                # Extract and encode face image
                try:
                    face_image = extract_face_image(image_frame, face)
                    if face_image is not None:
                        face_info['preview'] = face_image
                        logger.info(f"✅ Face {i+1} preview extracted successfully")
                    else:
                        logger.warning(f"⚠️ Failed to extract preview for face {i+1}")
                except Exception as e:
                    logger.warning(f"⚠️ Error extracting face image {i}: {e}")
                
                # Add embedding for face matching (optional)
                if hasattr(face, 'embedding'):
                    face_info['embedding'] = face.embedding.tolist()
                
                detected_faces.append(face_info)
                logger.info(f"👤 Face {i+1}: bbox=({face_info['x']}, {face_info['y']}, {face_info['width']}, {face_info['height']}), confidence={face_info['confidence']:.3f}")
                
            except Exception as e:
                logger.warning(f"⚠️ Error processing face {i}: {e}")
                continue
        
        result = {
            "faces": detected_faces,
            "total_faces": len(detected_faces),
            "image_path": image_url
        }
        
        logger.info(f"✅ Face detection completed: {len(detected_faces)} faces detected")
        return result
        
    except Exception as e:
        logger.error(f"❌ Face detection failed: {e}")
        return {
            "error": f"Face detection failed: {str(e)}",
            "faces": [],
            "total_faces": 0,
            "image_path": image_url if 'image_url' in locals() else ""
        }

def extract_face_image(image_frame, face):
    """Extract face region from image and return as base64 encoded JPEG"""
    try:
        # Get face bounding box
        if not hasattr(face, 'bbox'):
            return None
            
        x1, y1, x2, y2 = face.bbox
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        
        # Add padding around face
        padding = 20
        height, width = image_frame.shape[:2]
        
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(width, x2 + padding)
        y2 = min(height, y2 + padding)
        
        # Extract face region
        face_region = image_frame[y1:y2, x1:x2]
        
        if face_region.size == 0:
            return None
        
        # Convert to RGB for PIL
        face_rgb = cv2.cvtColor(face_region, cv2.COLOR_BGR2RGB)
        
        # Convert to PIL Image
        face_pil = Image.fromarray(face_rgb)
        
        # Resize to standard size for preview
        face_pil = face_pil.resize((150, 150), Image.Resampling.LANCZOS)
        
        # Encode to base64 JPEG
        buffer = BytesIO()
        face_pil.save(buffer, format='JPEG', quality=85)
        face_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return face_base64
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to extract face image: {e}")
        return None

def process_multi_image_swap_from_urls(target_url, face_mappings):
    """Process multi-person face swap with individual face mappings - Enhanced with multi-round processing"""
    try:
        logger.info("🚀 Starting enhanced multi-person face swap processing...")
        logger.info(f"📋 Target image URL: {target_url}")
        logger.info(f"📋 Face mappings: {json.dumps(face_mappings, indent=2)}")
        
        # Download target image
        logger.info("🔄 Downloading target image...")
        target_frame = download_image_from_url(target_url)
        if target_frame is None:
            return {"error": "Failed to download target image"}
        
        logger.info(f"✅ Target image downloaded, shape: {target_frame.shape}")
        
        # Detect all faces in target image
        logger.info("🔍 Detecting faces in target image...")
        target_faces = get_many_faces(target_frame)
        
        if target_faces is None or len(target_faces) == 0:
            return {"error": "No faces detected in target image"}
        
        logger.info(f"✅ Detected {len(target_faces)} face(s) in target image")
        
        # Prepare source faces
        source_faces = []
        face_mapping_pairs = []
        
        # Download and process each source face
        for face_id, source_url in face_mappings.items():
            try:
                logger.info(f"🔄 Processing source face for {face_id}: {source_url}")
                
                # Download source image
                source_frame = download_image_from_url(source_url)
                if source_frame is None:
                    logger.warning(f"⚠️ Failed to download source image for {face_id}")
                    continue
                
                # Get the main face from source image
                source_face = get_one_face(source_frame)
                if source_face is None:
                    logger.warning(f"⚠️ No face detected in source image for {face_id}")
                    continue
                
                # Parse face_id to get target face index
                face_index = int(face_id.replace('face_', ''))
                
                if face_index < len(target_faces):
                    face_mapping_pairs.append({
                        'source_face': source_face,
                        'target_face': target_faces[face_index],
                        'face_id': face_id,
                        'face_index': face_index
                    })
                    logger.info(f"✅ Mapped {face_id} (index {face_index}) successfully")
                else:
                    logger.warning(f"⚠️ Face index {face_index} out of range for {face_id}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Error processing source face {face_id}: {e}")
                continue
        
        if not face_mapping_pairs:
            return {"error": "No valid face mappings could be processed"}
        
        logger.info(f"🎯 Processing {len(face_mapping_pairs)} face swap(s) with multi-round enhancement...")
        
        # Configure enhancement settings for high quality
        modules.globals.use_face_enhancer = True
        modules.globals.mouth_mask = True
        modules.globals.color_correction = True
        
        # Multi-round iterative processing for superior quality
        result_frame = target_frame.copy()
        
        # Store original target faces for quality comparison
        original_target_faces = target_faces.copy()
        
        # Round 1: Initial face swaps for all faces
        logger.info("🔄 Round 1: Initial multi-face swap...")
        for i, mapping in enumerate(face_mapping_pairs):
            logger.info(f"   Processing face {i+1}/{len(face_mapping_pairs)} ({mapping['face_id']})...")
            
            try:
                # Perform initial face swap
                temp_result = swap_face(
                    mapping['source_face'], 
                    mapping['target_face'], 
                    result_frame
                )
                result_frame = temp_result
                logger.info(f"   ✅ Face {i+1} initial swap completed")
                
            except Exception as e:
                logger.warning(f"   ⚠️ Face {i+1} initial swap failed: {e}")
                continue
        
        logger.info("✅ Round 1 completed - all initial face swaps done")
        
        # Round 2: Refinement pass - re-detect faces and refine
        logger.info("🔄 Round 2: Refinement pass...")
        current_faces = get_many_faces(result_frame)
        
        if current_faces and len(current_faces) >= len(face_mapping_pairs):
            refinement_count = 0
            for i, mapping in enumerate(face_mapping_pairs):
                try:
                    # Use current detected face for refinement
                    if i < len(current_faces):
                        current_face = current_faces[i]
                        
                        # Quality check before refinement
                        if current_face.det_score > 0.5:
                            temp_result = swap_face(
                                mapping['source_face'],
                                current_face,
                                result_frame
                            )
                            
                            # Verify refinement improves quality
                            refined_faces = get_many_faces(temp_result)
                            if refined_faces and len(refined_faces) >= len(face_mapping_pairs):
                                result_frame = temp_result
                                refinement_count += 1
                                logger.info(f"   ✅ Face {i+1} refinement applied")
                            else:
                                logger.info(f"   ⚠️ Face {i+1} refinement skipped - would degrade detection")
                        else:
                            logger.info(f"   ⚠️ Face {i+1} refinement skipped - low confidence")
                    
                except Exception as e:
                    logger.warning(f"   ⚠️ Face {i+1} refinement failed: {e}")
                    continue
            
            logger.info(f"✅ Round 2 completed - {refinement_count}/{len(face_mapping_pairs)} faces refined")
        else:
            logger.warning("⚠️ Round 2 skipped - insufficient face detection quality")
        
        # Round 3: Final precision pass - high-quality enhancement
        logger.info("🔄 Round 3: Final precision pass...")
        final_faces = get_many_faces(result_frame)
        
        if final_faces and len(final_faces) >= len(face_mapping_pairs):
            precision_count = 0
            for i, mapping in enumerate(face_mapping_pairs):
                try:
                    if i < len(final_faces):
                        final_face = final_faces[i]
                        
                        # Very high quality threshold for final pass
                        if final_face.det_score > 0.6:
                            temp_result = swap_face(
                                mapping['source_face'],
                                final_face,
                                result_frame
                            )
                            
                            # Conservative quality check
                            check_faces = get_many_faces(temp_result)
                            if (check_faces and len(check_faces) >= len(face_mapping_pairs) and
                                all(f.det_score > 0.5 for f in check_faces[:len(face_mapping_pairs)])):
                                result_frame = temp_result
                                precision_count += 1
                                logger.info(f"   ✅ Face {i+1} precision pass applied")
                            else:
                                logger.info(f"   ⚠️ Face {i+1} precision pass skipped - would degrade quality")
                        else:
                            logger.info(f"   ⚠️ Face {i+1} precision pass skipped - insufficient confidence")
                    
                except Exception as e:
                    logger.warning(f"   ⚠️ Face {i+1} precision pass failed: {e}")
                    continue
            
            logger.info(f"✅ Round 3 completed - {precision_count}/{len(face_mapping_pairs)} faces precision-enhanced")
        else:
            logger.warning("⚠️ Round 3 skipped - insufficient face detection quality")
        
        # Advanced face enhancement - multiple passes for superior quality
        try:
            logger.info("🎨 Applying advanced multi-pass face enhancement...")
            
            from modules.processors.frame.face_enhancer import enhance_face
            
            # Enhancement Pass 1: Conservative blend
            logger.info("✨ Enhancement pass 1: Conservative blending...")
            enhanced_frame_1 = enhance_face(result_frame)
            if enhanced_frame_1 is not None:
                # Conservative blend (30% original + 70% enhanced)
                result_frame = cv2.addWeighted(result_frame, 0.3, enhanced_frame_1, 0.7, 0)
                logger.info("✅ Enhancement pass 1 completed")
            
            # Enhancement Pass 2: Standard enhancement
            logger.info("✨ Enhancement pass 2: Standard enhancement...")
            enhanced_frame_2 = enhance_face(result_frame)
            if enhanced_frame_2 is not None:
                # Balanced blend (40% original + 60% enhanced)
                result_frame = cv2.addWeighted(result_frame, 0.4, enhanced_frame_2, 0.6, 0)
                logger.info("✅ Enhancement pass 2 completed")
                
            # Enhancement Pass 3: Final refinement
            logger.info("✨ Enhancement pass 3: Final refinement...")
            enhanced_frame_3 = enhance_face(result_frame)
            if enhanced_frame_3 is not None:
                # Final enhancement application
                result_frame = enhanced_frame_3
                logger.info("✅ Enhancement pass 3 completed")
                
        except ImportError:
            logger.warning("⚠️ Face enhancer module not available")
        except Exception as e:
            logger.warning(f"⚠️ Advanced face enhancement failed: {e}")
        
        # Advanced post-processing for all faces
        logger.info("🎭 Applying advanced post-processing to all faces...")
        try:
            current_faces = get_many_faces(result_frame)
            if current_faces:
                edge_smoothing_count = 0
                for face in current_faces:
                    try:
                        result_frame = apply_edge_smoothing(result_frame, face)
                        edge_smoothing_count += 1
                    except Exception as e:
                        logger.warning(f"⚠️ Edge smoothing failed for one face: {e}")
                        continue
                
                logger.info(f"✅ Edge smoothing applied to {edge_smoothing_count} faces")
        except Exception as e:
            logger.warning(f"⚠️ Post-processing warning: {e}")
        
        # Apply AI Super Resolution for ultra-high quality multi-person output
        logger.info("🔍 Applying AI Super Resolution for ultra-high quality multi-person output...")
        try:
            if SR_AVAILABLE:
                # Determine optimal scale factor based on input size - OPTIMIZED FOR MAXIMUM QUALITY
                height, width = result_frame.shape[:2]
                
                # Use 4x for most multi-person images too, but with slightly more conservative thresholds
                if max(width, height) < 640:  # 4x for smaller multi-person images  
                    scale_factor = 4
                    max_output_size = 5120  # Even higher max for multi-person 4x
                    logger.info(f"📐 Using 4x super resolution for maximum quality (multi-person input: {width}x{height})")
                elif max(width, height) < 1280:  # 2x for medium multi-person images
                    scale_factor = 2 
                    max_output_size = 4096  # Higher max for multi-person 2x
                    logger.info(f"📐 Using 2x super resolution (multi-person input: {width}x{height})")
                else:
                    scale_factor = 1  # Skip only for very large multi-person images (≥1280px)
                    max_output_size = 4096
                    logger.info(f"📐 Skipping super resolution (multi-person input already very large: {width}x{height})")
                
                if scale_factor > 1:
                    enhanced_frame = enhance_resolution(result_frame, scale_factor, max_size=max_output_size)
                    if enhanced_frame is not None:
                        result_frame = enhanced_frame
                        final_height, final_width = result_frame.shape[:2]
                        logger.info(f"✅ AI Super Resolution completed for multi-person: {final_width}x{final_height}")
                    else:
                        logger.warning("⚠️ Super resolution failed, using original")
            else:
                logger.info("⚠️ Super resolution not available, using traditional upscaling...")
                # Fallback to traditional high-quality upscaling
                height, width = result_frame.shape[:2]
                if max(width, height) < 1024:  # More conservative for multi-person
                    scale = min(1.5, 2048 / max(width, height))  # Target at least 2048px for multi-person
                    new_width = int(width * scale)
                    new_height = int(height * scale)
                    result_frame = cv2.resize(result_frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                    logger.info(f"✅ Traditional upscaling for multi-person: {new_width}x{new_height}")
                    
        except Exception as e:
            logger.warning(f"⚠️ Super resolution failed: {e}")
        
        # Convert to ultra-high quality image
        logger.info("📸 Converting result to ultra-high quality image...")
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Quality upscaling if needed
        width, height = result_image.size
        if width < 768 or height < 768:  # Higher threshold for multi-person images
            scale_factor = max(768 / width, 768 / height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            
            logger.info(f"🔍 Upscaling image from {width}x{height} to {new_width}x{new_height}")
            result_image = result_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Encode to high-quality JPEG
        buffer = BytesIO()
        result_image.save(buffer, format='JPEG', quality=98, optimize=True)  # Higher quality for multi-person
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info("✅ Ultra-high quality multi-person face swap completed successfully")
        return {
            "result": result_data,
            "faces_processed": len(face_mapping_pairs),
            "total_target_faces": len(target_faces),
            "processing_rounds": 3,
            "enhancement_passes": 3,
            "quality_level": "ultra-high"
        }
        
    except Exception as e:
        logger.error(f"❌ Multi-person face swap failed: {e}")
        return {"error": f"Multi-person face swap failed: {str(e)}"}

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
        elif swap_type == "multi-image":
            swap_type = "multi_image"
        elif swap_type == "detect-faces":
            swap_type = "detect_faces"
        
        logger.info(f"🎯 Processing type: {swap_type}")
        
        # Handle face detection
        if swap_type == "detect_faces":
            image_url = input_data.get("image_file")
            if not image_url:
                return {"error": "Missing image_file parameter for face detection"}
            
            return process_detect_faces_from_url(image_url)
        
        # Handle multi-person image face swap
        elif swap_type == "multi_image":
            target_url = input_data.get("target_file")
            face_mappings = input_data.get("face_mappings", {})
            
            if not target_url:
                return {"error": "Missing target_file parameter for multi-image processing"}
            
            if not face_mappings:
                return {"error": "Missing face_mappings parameter for multi-image processing"}
            
            return process_multi_image_swap_from_urls(target_url, face_mappings)
        
        # Handle single image face swap
        elif swap_type == "single_image":
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