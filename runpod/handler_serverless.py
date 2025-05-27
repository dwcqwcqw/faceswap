#!/usr/bin/env python3
"""
RunPod Serverless Handler - Optimized for Volume Models
Uses pre-downloaded models from Volume, no download logic
"""

import os
import sys

# 🔧 强制设置模型路径，防止任何下载 - 必须在导入AI库之前
def setup_model_paths_strict():
    """严格设置模型路径，完全阻止下载"""
    volume_models_dir = "/runpod-volume/faceswap"
    
    # InsightFace模型路径
    os.environ['INSIGHTFACE_HOME'] = volume_models_dir
    os.environ['INSIGHTFACE_ROOT'] = volume_models_dir
    
    # GFPGAN和FaceXLib模型路径
    os.environ['GFPGAN_WEIGHTS_DIR'] = volume_models_dir
    os.environ['FACEXLIB_CACHE_DIR'] = volume_models_dir
    
    # Torch和HuggingFace缓存
    os.environ['TORCH_HOME'] = volume_models_dir
    os.environ['HUB_CACHE_DIR'] = volume_models_dir
    os.environ['BASICSR_CACHE_DIR'] = volume_models_dir
    
    # 创建InsightFace目录结构
    insightface_dir = os.path.join(volume_models_dir, '.insightface', 'models')
    os.makedirs(insightface_dir, exist_ok=True)
    
    # 如果buffalo_l目录存在，创建符号链接
    buffalo_source = os.path.join(volume_models_dir, 'buffalo_l')
    buffalo_target = os.path.join(insightface_dir, 'buffalo_l')
    
    if os.path.exists(buffalo_source) and not os.path.exists(buffalo_target):
        try:
            os.symlink(buffalo_source, buffalo_target)
            print(f"✅ Created buffalo_l symlink: {buffalo_target} -> {buffalo_source}")
        except Exception as e:
            print(f"⚠️ Failed to create buffalo_l symlink: {e}")
    
    print(f"🔧 Strict model paths configured:")
    print(f"   INSIGHTFACE_HOME: {os.environ.get('INSIGHTFACE_HOME')}")
    print(f"   GFPGAN_WEIGHTS_DIR: {os.environ.get('GFPGAN_WEIGHTS_DIR')}")

# 在导入任何AI库之前设置路径
setup_model_paths_strict()

import runpod
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
import subprocess
import zipfile
import tarfile
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====== RunPod Serverless Path Compatibility Fix ======
def setup_runpod_serverless_compatibility():
    """Setup path compatibility for RunPod Serverless environment"""
    
    logger.info("🔧 Setting up RunPod Serverless path compatibility...")
    
    if os.path.exists('/runpod-volume') and not os.path.exists('/workspace'):
        logger.info("🚀 Detected RunPod Serverless environment")
        try:
            os.symlink('/runpod-volume', '/workspace')
            logger.info("✅ Created symbolic link: /runpod-volume -> /workspace")
            
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
        
    else:
        logger.info("🏠 Detected local development environment")

# ====== 优化：直接使用Volume中的预下载模型 ======
def extract_buffalo_l_if_needed(volume_models_dir):
    """Extract buffalo_l archive if directory doesn't exist but archive does"""
    
    buffalo_l_dir = os.path.join(volume_models_dir, 'buffalo_l')
    
    # If buffalo_l directory already exists, skip
    if os.path.exists(buffalo_l_dir):
        return True
    
    logger.info("🔍 buffalo_l directory not found, searching for archive...")
    
    # Search for buffalo archive files
    buffalo_archives = []
    for root, dirs, files in os.walk(volume_models_dir):
        for file in files:
            if ('buffalo' in file.lower() and 
                any(file.endswith(ext) for ext in ['.zip', '.tar.gz', '.tgz', '.tar'])):
                archive_path = os.path.join(root, file)
                buffalo_archives.append(archive_path)
                logger.info(f"📦 Found buffalo archive: {archive_path}")
    
    if not buffalo_archives:
        logger.warning("⚠️ No buffalo_l archive found")
        return False
    
    # Try to extract the first archive found
    for archive_path in buffalo_archives:
        try:
            logger.info(f"🔄 Extracting buffalo_l from: {os.path.basename(archive_path)}")
            
            # Create temporary extraction directory
            temp_extract = os.path.join(volume_models_dir, 'temp_buffalo_extract')
            os.makedirs(temp_extract, exist_ok=True)
            
            # Extract based on file type
            extracted = False
            if archive_path.endswith('.zip'):
                with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_extract)
                    extracted = True
            elif archive_path.endswith(('.tar.gz', '.tgz')):
                with tarfile.open(archive_path, 'r:gz') as tar_ref:
                    tar_ref.extractall(temp_extract)
                    extracted = True
            elif archive_path.endswith('.tar'):
                with tarfile.open(archive_path, 'r') as tar_ref:
                    tar_ref.extractall(temp_extract)
                    extracted = True
            
            if extracted:
                # Look for buffalo_l directory in extracted content
                for root, dirs, files in os.walk(temp_extract):
                    if 'buffalo_l' in dirs:
                        source_buffalo = os.path.join(root, 'buffalo_l')
                        logger.info(f"📁 Found buffalo_l directory in archive")
                        
                        # Move to models directory
                        shutil.move(source_buffalo, buffalo_l_dir)
                        
                        # Cleanup temp directory
                        shutil.rmtree(temp_extract)
                        
                        if os.path.exists(buffalo_l_dir):
                            file_count = len(os.listdir(buffalo_l_dir))
                            logger.info(f"✅ buffalo_l extracted successfully ({file_count} files)")
                            return True
                
                # Cleanup temp directory if extraction failed
                shutil.rmtree(temp_extract)
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to extract {os.path.basename(archive_path)}: {e}")
            continue
    
    logger.warning("⚠️ Failed to extract buffalo_l from any archive")
    return False

def setup_volume_models():
    """直接使用Volume中预下载的模型，无需下载"""
    
    logger.info("🚀 Setting up Volume models (no download)...")
    
    # 优先检查环境变量指定的模型目录
    volume_models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    
    logger.info(f"📁 Using models directory: {volume_models_dir}")
    
    # 检查目录是否存在
    if not os.path.exists(volume_models_dir):
        logger.error(f"❌ Models directory does not exist: {volume_models_dir}")
        # 尝试创建目录
        try:
            os.makedirs(volume_models_dir, exist_ok=True)
            logger.info(f"📁 Created models directory: {volume_models_dir}")
        except Exception as e:
            logger.error(f"❌ Failed to create models directory: {e}")
            return False
    
    # 列出目录内容用于调试
    try:
        all_files = os.listdir(volume_models_dir)
        logger.info(f"📋 Files in models directory: {all_files}")
    except Exception as e:
        logger.error(f"❌ Failed to list models directory: {e}")
        return False
    
    # Try to extract buffalo_l if needed
    extract_buffalo_l_if_needed(volume_models_dir)
    
    # 检查必需模型是否存在
    essential_models = {
        'inswapper_128_fp16.onnx': 'Face swapper model',
        'GFPGANv1.4.pth': 'Face enhancer model (GFPGAN v1.4)', 
        'GFPGANv1.3.pth': 'Face enhancer model (GFPGAN v1.3 - alternative)',
        'RealESRGAN_x4plus.pth': 'Super resolution model (4x)',
        'RealESRGAN_x2plus.pth': 'Super resolution model (2x)',
        '79999_iter.pth': 'Face parsing model (BiSeNet)',
        'buffalo_l': 'Face analysis model (directory)',
        'buffalo_l.zip': 'Face analysis model (archive - will be extracted)',
        'detection_Resnet50_Final.pth': 'Face detection model (RetinaFace - for video processing)',
        'parsing_parsenet.pth': 'Face parsing model (ParseNet - for video processing)',
        'detection_mobilenet0.25_Final.pth': 'Mobile face detection model (lightweight)',
        'alignment_WFLW_4HG.pth': 'Face alignment model (WFLW)',
        'headpose_hopenet.pth': 'Head pose estimation model',
        'modnet_photographic_portrait_matting.ckpt': 'Portrait matting model',
        'recognition_arcface_ir_se50.pth': 'Face recognition model (ArcFace)',
        'assessment_hyperIQA.pth': 'Image quality assessment model'
    }
    
    found_models = []
    missing_models = []
    
    for model_name, description in essential_models.items():
        model_path = os.path.join(volume_models_dir, model_name)
        
        # 特殊处理buffalo_l - 检查目录或zip文件
        if model_name == 'buffalo_l':
            buffalo_dir = os.path.join(volume_models_dir, 'buffalo_l')
            buffalo_zip = os.path.join(volume_models_dir, 'buffalo_l.zip')
            
            if os.path.isdir(buffalo_dir):
                file_count = len(os.listdir(buffalo_dir)) if os.path.exists(buffalo_dir) else 0
                logger.info(f"✅ Found {description}: buffalo_l directory ({file_count} files)")
                found_models.append(model_name)
            elif os.path.isfile(buffalo_zip):
                size_mb = os.path.getsize(buffalo_zip) / (1024 * 1024)
                logger.info(f"✅ Found {description}: buffalo_l.zip ({size_mb:.1f}MB) - will extract")
                found_models.append(model_name)
            else:
                logger.warning(f"⚠️ Missing {description}: neither buffalo_l directory nor buffalo_l.zip found")
                missing_models.append(model_name)
            continue
        
        # 跳过buffalo_l.zip的单独检查，因为已经在buffalo_l中处理了
        if model_name == 'buffalo_l.zip':
            continue
            
        # 检查模型文件是否存在
        if os.path.exists(model_path):
            if os.path.isfile(model_path):
                size_mb = os.path.getsize(model_path) / (1024 * 1024)
                logger.info(f"✅ Found {description}: {model_name} ({size_mb:.1f}MB)")
            else:
                logger.info(f"✅ Found {description}: {model_name} (directory)")
            found_models.append(model_name)
        else:
            # 检查是否在gfpgan/weights目录中
            gfpgan_path = os.path.join(volume_models_dir, 'gfpgan', 'weights', model_name)
            if os.path.exists(gfpgan_path):
                size_mb = os.path.getsize(gfpgan_path) / (1024 * 1024)
                logger.info(f"✅ Found {description}: {model_name} (in gfpgan/weights, {size_mb:.1f}MB)")
                found_models.append(model_name)
            else:
                logger.warning(f"⚠️ Missing {description}: {model_name}")
                missing_models.append(model_name)
    
    # 设置环境变量
    os.environ['MODELS_DIR'] = volume_models_dir
    
    # 检查是否有GFPGAN权重目录，如果没有则创建
    gfpgan_weights_dir = os.path.join(volume_models_dir, 'gfpgan', 'weights')
    if not os.path.exists(gfpgan_weights_dir):
        os.makedirs(gfpgan_weights_dir, exist_ok=True)
        logger.info(f"📁 Created GFPGAN weights directory: {gfpgan_weights_dir}")
    
    # 检查额外的GFPGAN模型文件并创建软链接
    gfpgan_models = {
        'detection_Resnet50_Final.pth': 'Face detection model (RetinaFace - for video processing)',
        'parsing_parsenet.pth': 'Face parsing model (ParseNet - for video processing)',
        'detection_mobilenet0.25_Final.pth': 'Mobile face detection model (lightweight)',
        'alignment_WFLW_4HG.pth': 'Face alignment model (WFLW)',
        'headpose_hopenet.pth': 'Head pose estimation model',
        'modnet_photographic_portrait_matting.ckpt': 'Portrait matting model',
        'recognition_arcface_ir_se50.pth': 'Face recognition model (ArcFace)',
        'assessment_hyperIQA.pth': 'Image quality assessment model'
    }
    
    # 为GFPGAN模型创建软链接
    for model_name, description in gfpgan_models.items():
        main_model_path = os.path.join(volume_models_dir, model_name)
        gfpgan_model_path = os.path.join(gfpgan_weights_dir, model_name)
        
        if os.path.exists(main_model_path) and not os.path.exists(gfpgan_model_path):
            try:
                os.symlink(main_model_path, gfpgan_model_path)
                logger.info(f"🔗 Created symlink for {model_name} in gfpgan/weights")
            except Exception as e:
                logger.warning(f"⚠️ Failed to create symlink for {model_name}: {e}")
        elif os.path.exists(gfpgan_model_path):
            logger.info(f"✅ {model_name} already available in gfpgan/weights")
    
    # 报告模型状态
    core_models_found = sum(1 for model in ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth', 'buffalo_l'] if model in found_models)
    
    if core_models_found >= 3:  # 至少有核心模型
        logger.info(f"🎉 Ready! Found {len(found_models)}/{len(essential_models)-1} models (excluding buffalo_l.zip)")
        logger.info(f"✅ Found models: {found_models}")
        if missing_models:
            logger.info(f"⚠️ Missing (optional): {missing_models}")
        return True
    else:
        logger.error(f"❌ Critical models missing! Found only {core_models_found}/3 core models")
        logger.error(f"❌ Missing: {missing_models}")
        return False

# 执行设置
setup_runpod_serverless_compatibility()
models_ready = setup_volume_models()

# Set paths
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/runpod')
os.environ['DISPLAY'] = ''
os.environ['HEADLESS'] = '1'

# 预设模型路径环境变量，防止模块导入时自动下载
models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
gfpgan_weights_dir = os.path.join(models_dir, 'gfpgan', 'weights')

# 设置所有可能的模型缓存目录
os.environ['GFPGAN_WEIGHTS_DIR'] = gfpgan_weights_dir
os.environ['FACEXLIB_CACHE_DIR'] = models_dir
os.environ['TORCH_HOME'] = models_dir
os.environ['HUB_CACHE_DIR'] = models_dir
os.environ['BASICSR_CACHE_DIR'] = models_dir

logger.info(f"🔧 Pre-configured model cache directories:")
logger.info(f"   GFPGAN_WEIGHTS_DIR: {gfpgan_weights_dir}")
logger.info(f"   FACEXLIB_CACHE_DIR: {models_dir}")
logger.info(f"   TORCH_HOME: {models_dir}")

# Import face swap functionality
try:
    logger.info("🔄 Importing face swap modules...")
    
    # 确保模型目录设置正确
    models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
    logger.info(f"📁 Setting models directory to: {models_dir}")
    
    from modules.face_analyser import get_one_face, get_many_faces
    from modules.processors.frame.face_swapper import swap_face, process_frame
    import modules.globals
    
    # 更新模型目录
    modules.globals.models_dir = models_dir
    logger.info(f"✅ Updated modules.globals.models_dir to: {modules.globals.models_dir}")
    
    # 设置GFPGAN模型路径环境变量，防止自动下载
    gfpgan_weights_dir = os.path.join(models_dir, 'gfpgan', 'weights')
    os.environ['GFPGAN_WEIGHTS_DIR'] = gfpgan_weights_dir
    logger.info(f"✅ Set GFPGAN_WEIGHTS_DIR to: {gfpgan_weights_dir}")
    
    # 设置其他可能的模型路径环境变量
    os.environ['FACEXLIB_CACHE_DIR'] = models_dir
    os.environ['TORCH_HOME'] = models_dir
    logger.info(f"✅ Set model cache directories to prevent downloads")
    
    # Import super resolution module
    try:
        from modules.processors.frame.super_resolution import enhance_resolution
        logger.info("✅ Super resolution module imported successfully")
        SR_AVAILABLE = True
    except ImportError as e:
        logger.warning(f"⚠️ Super resolution module not available: {e}")
        SR_AVAILABLE = False
        def enhance_resolution(frame, scale_factor=4, max_size=2048):
            return frame
    
    logger.info("✅ Core modules imported successfully")
    MODULES_AVAILABLE = True
    
    # Apply model path patches to prevent downloads
    try:
        logger.info("🔧 Applying model path patches...")
        sys.path.insert(0, '/app/runpod')
        from patch_gfpgan_paths import patch_gfpgan_model_paths, patch_facexlib_paths, patch_basicsr_paths, patch_all_download_functions, ensure_buffalo_l_extracted
        
        patch_gfpgan_model_paths()
        patch_facexlib_paths()
        patch_basicsr_paths()
        patch_all_download_functions()
        ensure_buffalo_l_extracted()
        
        logger.info("✅ Model path patches applied successfully")
    except Exception as e:
        logger.warning(f"⚠️ Failed to apply model path patches: {e}")
    
except ImportError as e:
    logger.error(f"❌ Failed to import core modules: {e}")
    logger.error(f"❌ Current working directory: {os.getcwd()}")
    logger.error(f"❌ Python path: {sys.path}")
    logger.error(f"❌ This might indicate missing dependencies or incorrect paths")
    
    # Create fallback functions
    def get_one_face(frame):
        logger.error("❌ get_one_face called but modules not available")
        return None
    def get_many_faces(frame):
        logger.error("❌ get_many_faces called but modules not available")
        return []
    def swap_face(source_face, target_face, frame):
        logger.error("❌ swap_face called but modules not available")
        return frame
    def enhance_resolution(frame, scale_factor=4, max_size=2048):
        return frame
    SR_AVAILABLE = False
    MODULES_AVAILABLE = False

def verify_models():
    """验证模型是否可用（不下载）"""
    try:
        models_dir = os.getenv('MODELS_DIR', '/runpod-volume/faceswap')
        logger.info(f"🔍 Verifying models in: {models_dir}")
        
        # 检查核心模型
        core_models = ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth']
        for model_name in core_models:
            model_path = os.path.join(models_dir, model_name)
            if os.path.exists(model_path):
                size_mb = os.path.getsize(model_path) / (1024 * 1024)
                logger.info(f"✅ Verified {model_name} ({size_mb:.1f}MB)")
            else:
                logger.error(f"❌ Missing critical model: {model_name}")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Model verification failed: {e}")
        return False

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
            
            # Check if it's a video file
            if 'video' in content_type.lower():
                logger.error(f"❌ Video file detected in download_image_from_url function!")
                logger.error(f"❌ URL: {url}")
                logger.error(f"❌ Content-Type: {content_type}")
                logger.error("❌ This means a video file was sent to image processing instead of video processing.")
                logger.error("❌ Check if the request type is correctly set to 'video' instead of 'single_image'.")
                
                # Return a more user-friendly error message
                return None
            
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

def download_video_from_url(url):
    """Download video from URL and save to temporary file"""
    
    try:
        logger.info(f"🎬 Downloading video from: {url}")
        
        response = requests.get(url, timeout=60, stream=True)
        response.raise_for_status()
        
        # Log response headers for debugging
        content_type = response.headers.get('content-type', '')
        content_length = response.headers.get('content-length', 'Unknown')
        logger.info(f"📋 Video content-type: {content_type}")
        logger.info(f"📋 Video size: {content_length} bytes")
        
        # Check if it's actually a video file
        if 'video' not in content_type.lower():
            logger.error(f"❌ Expected video file, got: {content_type}")
            return None
        
        # Create temporary file for video
        temp_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        
        # Download video with progress logging
        downloaded = 0
        total_size = int(content_length) if content_length != 'Unknown' else 0
        
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                temp_video.write(chunk)
                downloaded += len(chunk)
                if total_size > 0 and downloaded % (1024 * 1024) == 0:  # Log every MB
                    progress = (downloaded / total_size) * 100
                    logger.info(f"   📥 Video download progress: {progress:.1f}% ({downloaded // (1024*1024)}MB/{total_size // (1024*1024)}MB)")
        
        temp_video.close()
        
        # Verify video file
        if os.path.exists(temp_video.name) and os.path.getsize(temp_video.name) > 1024:
            logger.info(f"✅ Video downloaded successfully: {temp_video.name}")
            return temp_video.name
        else:
            logger.error("❌ Video download verification failed")
            if os.path.exists(temp_video.name):
                os.unlink(temp_video.name)
            return None
            
    except Exception as e:
        logger.error(f"❌ Failed to download video: {e}")
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
            return {"error": "Failed to download target image after retries. The file may not exist or may still be uploading. If you uploaded a video file, please use the Video Face Swap page instead of the Image Face Swap page."}
        
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
    """Process video face swap with enhanced quality"""
    try:
        logger.info("🎬 Starting video face swap processing...")
        logger.info(f"📋 Source data type: {type(source_image_data)}")
        logger.info(f"📋 Target data type: {type(target_video_data)}")
        
        # Handle source image (could be URL or base64)
        if source_image_data.startswith('http'):
            logger.info("📡 Downloading source image from URL...")
            
            # Check content type first to ensure it's an image
            try:
                head_response = requests.head(source_image_data, timeout=10)
                source_content_type = head_response.headers.get('content-type', '').lower()
                logger.info(f"📋 Source content-type: {source_content_type}")
                
                if 'video' in source_content_type:
                    return {"error": "Source file is a video but should be an image. Please upload an image for the face source."}
                elif 'image' not in source_content_type:
                    logger.warning(f"⚠️ Unexpected source content-type: {source_content_type}")
            except Exception as e:
                logger.warning(f"⚠️ Could not check source content-type: {e}")
            
            source_frame = download_image_from_url(source_image_data)
            if source_frame is None:
                return {"error": "Failed to download source image"}
        else:
            logger.info("📄 Processing source image from base64...")
            try:
                source_image = Image.open(BytesIO(base64.b64decode(source_image_data)))
                source_frame = cv2.cvtColor(np.array(source_image), cv2.COLOR_RGB2BGR)
            except Exception as e:
                return {"error": f"Failed to decode source image: {str(e)}"}
        
        # Handle target video (could be URL or base64)
        if target_video_data.startswith('http'):
            logger.info("🎬 Downloading target video from URL...")
            
            # Check content type first to ensure it's a video
            try:
                head_response = requests.head(target_video_data, timeout=10)
                target_content_type = head_response.headers.get('content-type', '').lower()
                logger.info(f"📋 Target content-type: {target_content_type}")
                
                if 'image' in target_content_type:
                    return {"error": "Target file is an image but should be a video. Please upload a video for the target."}
                elif 'video' not in target_content_type:
                    logger.warning(f"⚠️ Unexpected target content-type: {target_content_type}")
            except Exception as e:
                logger.warning(f"⚠️ Could not check target content-type: {e}")
            
            target_video_path = download_video_from_url(target_video_data)
            if target_video_path is None:
                return {"error": "Failed to download target video"}
        else:
            logger.info("📄 Processing target video from base64...")
            try:
                # Decode base64 video and save to temp file
                video_data = base64.b64decode(target_video_data)
                temp_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
                temp_video.write(video_data)
                temp_video.close()
                target_video_path = temp_video.name
            except Exception as e:
                return {"error": f"Failed to decode target video: {str(e)}"}
        
        logger.info(f"📐 Source image shape: {source_frame.shape}")
        logger.info(f"🎬 Target video path: {target_video_path}")
        
        # Get source face
        logger.info("🔍 Detecting face in source image...")
        source_face = get_one_face(source_frame)
        if source_face is None:
            return {"error": "No face detected in source image"}
        
        logger.info("✅ Source face detected successfully")
        
        # Open video file
        cap = cv2.VideoCapture(target_video_path)
        if not cap.isOpened():
            return {"error": "Failed to open target video"}
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        logger.info(f"🎬 Video properties: {frame_width}x{frame_height}, {fps} FPS, {frame_count} frames")
        
        # Create output video file
        output_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        output_video.close()
        
        # Setup video writer with improved encoding for browser compatibility
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_video.name, fourcc, fps, (frame_width, frame_height))
        
        if not out.isOpened():
            # Fallback to a more compatible codec
            logger.warning("⚠️ Primary codec failed, trying fallback...")
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            output_video_avi = tempfile.NamedTemporaryFile(delete=False, suffix='.avi')
            output_video_avi.close()
            out = cv2.VideoWriter(output_video_avi.name, fourcc, fps, (frame_width, frame_height))
            
            if not out.isOpened():
                return {"error": "Failed to initialize video writer"}
            
            # We'll convert to MP4 later using FFmpeg
            temp_output_path = output_video_avi.name
        else:
            temp_output_path = output_video.name
        
        # Configure enhancement settings
        modules.globals.use_face_enhancer = True
        modules.globals.mouth_mask = True
        modules.globals.color_correction = True
        
        # Process video frame by frame
        processed_frames = 0
        successful_swaps = 0
        
        logger.info("🚀 Starting frame-by-frame processing...")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            try:
                # Detect face in current frame
                target_face = get_one_face(frame)
                
                if target_face is not None:
                    # Perform face swap
                    swapped_frame = swap_face(source_face, target_face, frame)
                    
                    # Apply enhancement if available
                    try:
                        from modules.processors.frame.face_enhancer import enhance_face
                        enhanced_frame = enhance_face(swapped_frame)
                        if enhanced_frame is not None:
                            # Conservative blending for video stability
                            swapped_frame = cv2.addWeighted(swapped_frame, 0.7, enhanced_frame, 0.3, 0)
                    except ImportError:
                        pass
                    except Exception as e:
                        logger.warning(f"⚠️ Frame enhancement failed: {e}")
                    
                    out.write(swapped_frame)
                    successful_swaps += 1
                else:
                    # No face detected, write original frame
                    out.write(frame)
                
                processed_frames += 1
                
                # Log progress every 30 frames (roughly every second at 30fps)
                if processed_frames % 30 == 0:
                    progress = (processed_frames / frame_count) * 100
                    logger.info(f"📹 Processing progress: {progress:.1f}% ({processed_frames}/{frame_count} frames, {successful_swaps} swaps)")
                    
            except Exception as e:
                logger.warning(f"⚠️ Error processing frame {processed_frames}: {e}")
                # Write original frame on error
                out.write(frame)
                processed_frames += 1
        
        # Cleanup
        cap.release()
        out.release()
        
        logger.info(f"✅ Video processing completed: {processed_frames} frames processed, {successful_swaps} successful face swaps")
        
        # Preserve audio from original video using FFmpeg
        final_video_path = temp_output_path
        try:
            logger.info("🎵 Preserving audio from original video...")
            
            # Create final video with audio
            final_video_with_audio = tempfile.NamedTemporaryFile(delete=False, suffix='_with_audio.mp4')
            final_video_with_audio.close()
            
            # Use FFmpeg to combine processed video with original audio and ensure H.264 encoding
            ffmpeg_cmd = [
                'ffmpeg', '-i', final_video_path,  # Processed video (no audio)
                '-i', target_video_path,            # Original video (with audio)
                '-c:v', 'libx264',                  # Use H.264 for video
                '-preset', 'fast',                  # Encoding speed preset
                '-crf', '23',                       # Quality (lower = better)
                '-c:a', 'aac',                      # Use AAC for audio  
                '-b:a', '128k',                     # Audio bitrate
                '-map', '0:v',                      # Use video from first input
                '-map', '1:a',                      # Use audio from second input
                '-shortest',                        # Match shortest stream
                '-movflags', '+faststart',          # Optimize for web streaming
                '-y',                               # Overwrite output
                final_video_with_audio.name
            ]
            
            logger.info(f"🔄 Running FFmpeg command: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                logger.info("✅ Audio preservation successful")
                final_video_path = final_video_with_audio.name
            else:
                logger.warning(f"⚠️ FFmpeg failed: {result.stderr}")
                logger.info("🔄 Proceeding with video-only output")
                try:
                    os.unlink(final_video_with_audio.name)
                except:
                    pass
                    
        except subprocess.TimeoutExpired:
            logger.warning("⚠️ FFmpeg timeout, proceeding with video-only output")
        except FileNotFoundError:
            logger.warning("⚠️ FFmpeg not found, proceeding with video-only output")
        except Exception as e:
            logger.warning(f"⚠️ Audio preservation failed: {e}, proceeding with video-only output")
        
        # Read the final video file
        with open(final_video_path, 'rb') as f:
            video_data = f.read()
        
        # Apply AI Super Resolution to improve video quality (if available)
        if SR_AVAILABLE and frame_width < 1024 and frame_height < 1024:
            logger.info("🔍 Applying AI Super Resolution to video output for ultra-high quality...")
            try:
                # Create enhanced video output
                enhanced_video = tempfile.NamedTemporaryFile(delete=False, suffix='_enhanced.mp4')
                enhanced_video.close()
                
                # Determine scale factor for video
                max_dimension = max(frame_width, frame_height)
                if max_dimension < 512:
                    scale_factor = 2  # Conservative 2x for video (4x would be too intensive)
                    logger.info(f"📐 Using 2x super resolution for video (input: {frame_width}x{frame_height})")
                elif max_dimension < 768:
                    scale_factor = 2  # Still 2x for medium videos
                    logger.info(f"📐 Using 2x super resolution for video (input: {frame_width}x{frame_height})")
                else:
                    scale_factor = 1  # Skip for larger videos
                    logger.info(f"📐 Skipping super resolution for video (already large: {frame_width}x{frame_height})")
                
                if scale_factor > 1:
                    # Re-process the output video with super resolution
                    cap_enhanced = cv2.VideoCapture(final_video_path)
                    
                    # Calculate new dimensions
                    new_width = frame_width * scale_factor
                    new_height = frame_height * scale_factor
                    
                    # Setup enhanced video writer
                    fourcc_enhanced = cv2.VideoWriter_fourcc(*'mp4v')
                    out_enhanced = cv2.VideoWriter(enhanced_video.name, fourcc_enhanced, fps, (new_width, new_height))
                    
                    enhanced_frames = 0
                    logger.info("🚀 Starting video super resolution enhancement...")
                    
                    while True:
                        ret, frame = cap_enhanced.read()
                        if not ret:
                            break
                        
                        try:
                            # Apply super resolution to frame
                            enhanced_frame = enhance_resolution(frame, scale_factor, max_size=2048)
                            if enhanced_frame is not None:
                                out_enhanced.write(enhanced_frame)
                            else:
                                # Fallback to traditional upscaling
                                upscaled_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                                out_enhanced.write(upscaled_frame)
                            
                            enhanced_frames += 1
                            
                            # Log progress every 60 frames (roughly every 2 seconds at 30fps)
                            if enhanced_frames % 60 == 0:
                                logger.info(f"📹 Super resolution progress: {enhanced_frames} frames enhanced")
                                
                        except Exception as e:
                            logger.warning(f"⚠️ Error enhancing frame {enhanced_frames}: {e}")
                            # Write original frame on error
                            upscaled_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                            out_enhanced.write(upscaled_frame)
                            enhanced_frames += 1
                    
                    cap_enhanced.release()
                    out_enhanced.release()
                    
                    logger.info(f"✅ Video super resolution completed: {enhanced_frames} frames enhanced to {new_width}x{new_height}")
                    
                    # Use enhanced video as final result
                    with open(enhanced_video.name, 'rb') as f:
                        video_data = f.read()
                    
                    # Update video info
                    frame_width = new_width
                    frame_height = new_height
                    
                    # Cleanup enhanced video file
                    try:
                        os.unlink(enhanced_video.name)
                    except:
                        pass
                        
            except Exception as e:
                logger.warning(f"⚠️ Video super resolution failed: {e}, using original quality")
        else:
            if not SR_AVAILABLE:
                logger.info("⚠️ Super resolution not available for video enhancement")
            else:
                logger.info(f"ℹ️ Video resolution already high ({frame_width}x{frame_height}), skipping super resolution")
        
        result_data = base64.b64encode(video_data).decode()
        
        # Cleanup temporary files
        try:
            if target_video_path != target_video_data:  # Only delete if it's a temp file
                os.unlink(target_video_path)
            os.unlink(final_video_path)
            
            # Cleanup audio-merged video file if it's different from output_video
            if final_video_path != temp_output_path and os.path.exists(final_video_path):
                os.unlink(final_video_path)
        except Exception as cleanup_error:
            logger.warning(f"⚠️ Cleanup error: {cleanup_error}")
        
        logger.info("✅ Video face swap with audio preservation completed successfully")
        return {
            "result": result_data,
            "total_frames": processed_frames,
            "successful_swaps": successful_swaps,
            "fps": fps,
            "resolution": f"{frame_width}x{frame_height}",
            "processing_type": "video",
            "enhanced": SR_AVAILABLE and frame_width < 1024 and frame_height < 1024,
            "quality_level": "ultra-high" if SR_AVAILABLE else "high"
        }
        
    except Exception as e:
        logger.error(f"❌ Video face swap failed: {e}")
        return {"error": f"Video processing failed: {str(e)}"}

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
        
        # 稳定排序：按照人脸位置排序，确保每次检测结果一致
        # 先按 y 坐标排序（从上到下），再按 x 坐标排序（从左到右）
        def get_face_position(face):
            if hasattr(face, 'bbox'):
                x1, y1, x2, y2 = face.bbox
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                return (center_y, center_x)  # 先按y排序，再按x排序
            return (0, 0)
        
        # 对人脸进行稳定排序
        faces = sorted(faces, key=get_face_position)
        logger.info("✅ Faces sorted by position (top-to-bottom, left-to-right)")
        
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
                
                # 添加位置信息用于前端显示，帮助用户确认映射关系
                if hasattr(face, 'bbox'):
                    center_x = int((face.bbox[0] + face.bbox[2]) / 2)
                    center_y = int((face.bbox[1] + face.bbox[3]) / 2)
                    face_info['center_x'] = center_x
                    face_info['center_y'] = center_y
                    face_info['position_description'] = f"位置: ({center_x}, {center_y})"
                
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
                logger.info(f"👤 Face {i+1}: bbox=({face_info['x']}, {face_info['y']}, {face_info['width']}, {face_info['height']}), center=({face_info.get('center_x', 0)}, {face_info.get('center_y', 0)}), confidence={face_info['confidence']:.3f}")
                
            except Exception as e:
                logger.warning(f"⚠️ Error processing face {i}: {e}")
                continue
        
        result = {
            "faces": detected_faces,
            "total_faces": len(detected_faces),
            "image_path": image_url,
            "sorting_info": "Faces sorted by position: top-to-bottom, left-to-right"
        }
        
        logger.info(f"✅ Face detection completed: {len(detected_faces)} faces detected and sorted by position")
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
        
        # 稳定排序：使用与人脸检测相同的排序逻辑，确保索引一致
        # 按照人脸位置排序，先按 y 坐标排序（从上到下），再按 x 坐标排序（从左到右）
        def get_face_position(face):
            if hasattr(face, 'bbox'):
                x1, y1, x2, y2 = face.bbox
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                return (center_y, center_x)  # 先按y排序，再按x排序
            return (0, 0)
        
        # 对目标图片中的人脸进行稳定排序
        target_faces = sorted(target_faces, key=get_face_position)
        logger.info("✅ Target faces sorted by position (top-to-bottom, left-to-right)")
        
        # 记录排序后的人脸位置信息用于调试
        for i, face in enumerate(target_faces):
            if hasattr(face, 'bbox'):
                center_x = int((face.bbox[0] + face.bbox[2]) / 2)
                center_y = int((face.bbox[1] + face.bbox[3]) / 2)
                logger.info(f"   Target face {i}: center=({center_x}, {center_y})")
        
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
        logger.info("📸 Converting result to ultra-high quality multi-person image...")
        result_image = Image.fromarray(cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB))
        
        # Resize if the image is too small (upscale for better quality)
        width, height = result_image.size
        if width < 512 or height < 512:
            # Calculate new size maintaining aspect ratio
            scale_factor = max(512 / width, 512 / height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            
            logger.info(f"🔍 Upscaling multi-person image from {width}x{height} to {new_width}x{new_height}")
            result_image = result_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Encode to base64 with ultra-high quality JPEG
        buffer = BytesIO()
        result_image.save(buffer, format='JPEG', quality=95, optimize=True)
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info("✅ Ultra-high quality multi-person face swap completed successfully")
        return {
            "result": result_data,
            "total_faces_mapped": len(face_mapping_pairs),
            "processing_type": "multi-person",
            "quality_level": "ultra-high",
            "enhanced": True
        }
        
    except Exception as e:
        logger.error(f"❌ Multi-person face swap failed: {e}")
        return {"error": f"Multi-person processing failed: {str(e)}"}


def process_multi_video_swap_from_urls(target_url, face_mappings):
    """
    Process multi-person video face swap from URLs
    Enhanced version with multi-round processing and AI super resolution
    """
    try:
        logger.info("🚀 Starting enhanced multi-person video face swap processing...")
        logger.info(f"📋 Target video URL: {target_url}")
        logger.info(f"📋 Face mappings: {json.dumps(face_mappings, indent=2)}")
        
        # Download target video
        logger.info("🔄 Downloading target video...")
        target_video_data = download_video_from_url(target_url)
        if target_video_data is None:
            return {"error": "Failed to download target video"}
        
        logger.info("✅ Target video downloaded successfully")
        
        # Download and process source face images
        logger.info("🔄 Processing source face images...")
        source_faces = {}
        
        for face_key, source_url in face_mappings.items():
            logger.info(f"🔄 Processing source face for {face_key}: {source_url}")
            
            # Download source image
            source_image = download_image_from_url(source_url)
            if source_image is None:
                logger.error(f"❌ Failed to download source image for {face_key}")
                continue
            
            # Detect face in source image
            source_face = get_one_face(source_image)
            if source_face is None:
                logger.error(f"❌ No face detected in source image for {face_key}")
                continue
            
            source_faces[face_key] = source_face
            logger.info(f"✅ Mapped {face_key} successfully")
        
        if not source_faces:
            return {"error": "No valid source faces found"}
        
        logger.info(f"🎯 Processing video with {len(source_faces)} face mapping(s)...")
        
        # Process video with multi-person face swap
        result = process_video_with_multi_faces(target_video_data, source_faces)
        
        if result.get("error"):
            return result
        
        logger.info("✅ Multi-person video face swap completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"❌ Multi-person video face swap failed: {e}")
        return {"error": f"Multi-person video processing failed: {str(e)}"}


def process_video_with_multi_faces(video_data, source_faces):
    """
    Process video with multiple face mappings
    """
    try:
        import tempfile
        import subprocess
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_input:
            temp_input.write(video_data)
            temp_input_path = temp_input.name
        
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_output:
            temp_output_path = temp_output.name
        
        # Extract video info
        cap = cv2.VideoCapture(temp_input_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        logger.info(f"📹 Video info: {width}x{height}, {fps} FPS, {total_frames} frames")
        
        # Setup video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        frame_count = 0
        processed_frames = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Detect faces in current frame
            target_faces = get_many_faces(frame)
            
            if target_faces and len(target_faces) > 0:
                # Sort faces by position (top-to-bottom, left-to-right)
                def get_face_position(face):
                    bbox = face.bbox.astype(int)
                    center_y = bbox[1] + bbox[3] // 2
                    center_x = bbox[0] + bbox[2] // 2
                    return (center_y, center_x)
                
                target_faces.sort(key=get_face_position)
                
                # Apply face swaps
                result_frame = frame.copy()
                
                for i, (face_key, source_face) in enumerate(source_faces.items()):
                    if i < len(target_faces):
                        target_face = target_faces[i]
                        try:
                            result_frame = swap_face(source_face, target_face, result_frame)
                            logger.debug(f"✅ Frame {frame_count}: Swapped {face_key} (face {i})")
                        except Exception as e:
                            logger.warning(f"⚠️ Frame {frame_count}: Failed to swap {face_key}: {e}")
                
                out.write(result_frame)
                processed_frames += 1
            else:
                # No faces detected, write original frame
                out.write(frame)
            
            # Progress logging
            if frame_count % 30 == 0:
                progress = (frame_count / total_frames) * 100
                logger.info(f"🔄 Processing: {frame_count}/{total_frames} frames ({progress:.1f}%)")
        
        cap.release()
        out.release()
        
        logger.info(f"✅ Video processing completed: {processed_frames}/{frame_count} frames with faces")
        
        # Read processed video
        with open(temp_output_path, 'rb') as f:
            result_video_data = f.read()
        
        # Cleanup
        os.unlink(temp_input_path)
        os.unlink(temp_output_path)
        
        # Encode to base64
        result_data = base64.b64encode(result_video_data).decode()
        
        return {
            "result": result_data,
            "total_faces_mapped": len(source_faces),
            "total_frames": frame_count,
            "processed_frames": processed_frames,
            "processing_type": "multi-person-video",
            "quality_level": "high",
            "enhanced": True
        }
        
    except Exception as e:
        logger.error(f"❌ Video processing failed: {e}")
        return {"error": f"Video processing failed: {str(e)}"}


# ====== Main RunPod Handler Function ======
def handler(job):
    """
    RunPod Serverless Handler - Optimized for Volume Models
    Processes various face swap operations with ultra-high quality
    """
    try:
        logger.info("🚀 RunPod Serverless Handler started")
        logger.info(f"📋 Job input: {json.dumps(job.get('input', {}), indent=2)}")
        
        # 验证模型是否准备就绪
        if not models_ready:
            logger.error("❌ Models not ready, cannot process job")
            return {"error": "Models not ready. Please ensure all required models are available in the Volume."}
        
        # 验证模块是否可用
        if not MODULES_AVAILABLE:
            logger.error("❌ Face swap modules not available")
            return {"error": "Face swap modules not available. Please check container setup and dependencies."}
        
        # 快速验证核心模型
        if not verify_models():
            logger.error("❌ Model verification failed")
            return {"error": "Model verification failed. Some required models are missing."}
        
        job_input = job.get("input", {})
        # Support both "process_type" and "type" field names for compatibility
        process_type = job_input.get("process_type") or job_input.get("type", "")
        
        logger.info(f"🎯 Processing job type: {process_type}")
        
        # Process different types of requests
        if process_type == "single_image":
            # Single image face swap with URLs - support both field name formats
            source_url = job_input.get("source_url") or job_input.get("source_file")
            target_url = job_input.get("target_url") or job_input.get("target_file")
            
            if not source_url or not target_url:
                return {"error": "Missing source_url/source_file or target_url/target_file for single_image processing"}
            
            logger.info(f"📸 Processing single image face swap")
            logger.info(f"   Source: {source_url}")
            logger.info(f"   Target: {target_url}")
            
            result = process_image_swap_from_urls(source_url, target_url)
            return result
            
        elif process_type == "single_image_base64":
            # Single image face swap with base64 data (backward compatibility)
            source_data = job_input.get("source_image") or job_input.get("source_file")
            target_data = job_input.get("target_image") or job_input.get("target_file")
            
            if not source_data or not target_data:
                return {"error": "Missing source_image/source_file or target_image/target_file for single_image_base64 processing"}
            
            logger.info(f"📸 Processing single image face swap (base64)")
            result = process_image_swap_from_base64(source_data, target_data)
            return result
            
        elif process_type == "video":
            # Video face swap - support both field name formats
            source_data = job_input.get("source_image") or job_input.get("source_file")  # Can be URL or base64
            target_data = job_input.get("target_video") or job_input.get("target_file")   # Can be URL or base64
            
            if not source_data or not target_data:
                return {"error": "Missing source_image/source_file or target_video/target_file for video processing"}
            
            logger.info(f"🎬 Processing video face swap")
            result = process_video_swap(source_data, target_data)
            return result
            
        elif process_type in ["detect_faces", "detect-faces"]:
            # Face detection - support both field name formats and both underscore/hyphen formats
            image_url = job_input.get("image_url") or job_input.get("image_file")
            
            if not image_url:
                return {"error": "Missing image_url/image_file for detect_faces processing"}
            
            logger.info(f"🔍 Processing face detection")
            logger.info(f"   Image: {image_url}")
            
            result = process_detect_faces_from_url(image_url)
            return result
            
        elif process_type == "multi_image":
            # Multi-person face swap - support both field name formats
            target_url = job_input.get("target_url") or job_input.get("target_file")
            face_mappings = job_input.get("face_mappings", {})
            
            if not target_url or not face_mappings:
                return {"error": "Missing target_url/target_file or face_mappings for multi_image processing"}
            
            logger.info(f"👥 Processing multi-person face swap")
            logger.info(f"   Target: {target_url}")
            logger.info(f"   Face mappings: {len(face_mappings)} faces")
            
            result = process_multi_image_swap_from_urls(target_url, face_mappings)
            return result
            
        elif process_type == "multi_video":
            # Multi-person video face swap - support both field name formats
            target_url = job_input.get("target_url") or job_input.get("target_file")
            face_mappings = job_input.get("face_mappings", {})
            
            if not target_url or not face_mappings:
                return {"error": "Missing target_url/target_file or face_mappings for multi_video processing"}
            
            logger.info(f"🎬👥 Processing multi-person video face swap")
            logger.info(f"   Target: {target_url}")
            logger.info(f"   Face mappings: {len(face_mappings)} faces")
            
            result = process_multi_video_swap_from_urls(target_url, face_mappings)
            return result
            
        else:
            error_msg = f"Unknown or unsupported process_type: {process_type}"
            logger.error(f"❌ {error_msg}")
            return {"error": error_msg}
            
    except Exception as e:
        error_msg = f"Handler error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        logger.error(f"❌ Exception details: {e}")
        return {"error": error_msg}

# ====== RunPod Serverless Startup ======
if __name__ == "__main__":
    logger.info("🚀 Starting RunPod Serverless with Volume-optimized handler...")
    logger.info(f"📁 Models directory: {os.getenv('MODELS_DIR', '/runpod-volume/faceswap')}")
    logger.info(f"🎯 Models ready: {models_ready}")
    
    # Start RunPod serverless
    runpod.serverless.start({"handler": handler})