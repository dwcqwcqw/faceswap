#!/usr/bin/env python3
"""
RunPod Serverless Handler - Optimized Version
- 完全阻止模型下载
- 简化处理流程
- 适中输出质量
- 更快的启动时间
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
    
    # 创建GFPGAN weights目录并创建符号链接
    gfpgan_weights_dir = os.path.join(volume_models_dir, 'gfpgan', 'weights')
    os.makedirs(gfpgan_weights_dir, exist_ok=True)
    
    # 为GFPGAN模型创建符号链接
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
    
    for model_name in gfpgan_models:
        source_path = os.path.join(volume_models_dir, model_name)
        target_path = os.path.join(gfpgan_weights_dir, model_name)
        
        if os.path.exists(source_path) and not os.path.exists(target_path):
            try:
                os.symlink(source_path, target_path)
                print(f"✅ Created GFPGAN symlink: {model_name}")
            except Exception as e:
                print(f"⚠️ Failed to create GFPGAN symlink for {model_name}: {e}")
    
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 导入faceswap模块
sys.path.append('/app')
import modules.globals
import modules.core

def verify_models():
    """验证Volume中的模型"""
    logger.info("🔍 Verifying models in: /runpod-volume/faceswap")
    
    essential_models = [
        'inswapper_128_fp16.onnx',
        'GFPGANv1.4.pth'
    ]
    
    for model_name in essential_models:
        model_path = os.path.join('/runpod-volume/faceswap', model_name)
        if os.path.exists(model_path):
            size_mb = os.path.getsize(model_path) / (1024 * 1024)
            logger.info(f"✅ Verified {model_name} ({size_mb:.1f}MB)")
        else:
            logger.error(f"❌ Missing {model_name}")
            return False
    
    return True

def download_image_from_url(url, max_retries=3):
    """从URL下载图片"""
    for attempt in range(max_retries):
        try:
            logger.info(f"📥 Downloading image from: {url} (attempt {attempt + 1})")
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            logger.info(f"📋 Response content-type: {response.headers.get('content-type', 'unknown')}")
            logger.info(f"📋 Response size: {len(response.content)} bytes")
            
            # 尝试用PIL打开图片
            try:
                image = Image.open(BytesIO(response.content))
                logger.info(f"📐 PIL Image format: {image.format}, mode: {image.mode}, size: {image.size}")
                
                # 转换为RGB模式
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # 转换为numpy数组
                image_array = np.array(image)
                
                # 转换为BGR格式（OpenCV格式）
                if len(image_array.shape) == 3:
                    image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
                else:
                    image_bgr = image_array
                
                logger.info(f"✅ Image downloaded successfully, shape: {image_bgr.shape}")
                return image_bgr
                
            except Exception as e:
                logger.error(f"❌ Failed to process image: {e}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"⚠️ Download attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 指数退避
            continue
    
    logger.error(f"❌ Failed to download image after {max_retries} attempts")
    return None

def process_image_swap_simple(source_url, target_url, use_face_enhancer=True):
    """简化的图片换脸处理"""
    try:
        # 下载图片
        logger.info("🔄 Starting image downloads...")
        source_frame = download_image_from_url(source_url)
        target_frame = download_image_from_url(target_url)
        
        if source_frame is None or target_frame is None:
            return {"error": "Failed to download images"}
        
        logger.info("✅ Both images downloaded successfully")
        logger.info(f"📐 Source image shape: {source_frame.shape}")
        logger.info(f"📐 Target image shape: {target_frame.shape}")
        
        # 检测人脸
        logger.info("🔍 Detecting face in source image...")
        source_face = modules.core.get_one_face(source_frame)
        if source_face is None:
            return {"error": "No face detected in source image"}
        logger.info("✅ Source face detected successfully")
        
        logger.info("🔍 Detecting face in target image...")
        target_face = modules.core.get_one_face(target_frame)
        if target_face is None:
            return {"error": "No face detected in target image"}
        logger.info("✅ Target face detected successfully")
        
        # 简化的单次换脸
        logger.info("🚀 Starting face swap...")
        result_frame = modules.core.swap_face(source_face, target_face, target_frame)
        logger.info("✅ Face swap completed")
        
        # 应用面部增强（如果启用）
        if use_face_enhancer:
            try:
                logger.info("🎨 Applying face enhancement...")
                enhanced_frame = modules.core.enhance_face(target_face, result_frame)
                
                if enhanced_frame is not None:
                    # 适度混合，避免过度增强
                    face_enhancer_blend = 0.6
                    result_frame = cv2.addWeighted(
                        result_frame, 1 - face_enhancer_blend,
                        enhanced_frame, face_enhancer_blend, 0
                    )
                    logger.info("✅ Face enhancement applied")
                else:
                    logger.warning("⚠️ Face enhancement failed, using original result")
                    
            except Exception as e:
                logger.warning(f"⚠️ Face enhancement failed: {e}")
        
        # 转换为适中质量图片
        logger.info("📸 Converting result to optimized quality image...")
        
        # 确保结果是正确的数据类型
        if result_frame.dtype != np.uint8:
            result_frame = np.clip(result_frame, 0, 255).astype(np.uint8)
        
        # 转换颜色空间
        if len(result_frame.shape) == 3 and result_frame.shape[2] == 3:
            result_frame_rgb = cv2.cvtColor(result_frame, cv2.COLOR_BGR2RGB)
        else:
            result_frame_rgb = result_frame
        
        # 创建PIL图像
        result_image = Image.fromarray(result_frame_rgb)
        
        # 限制输出尺寸，避免过大
        max_dimension = 1024  # 最大边长限制
        width, height = result_image.size
        if max(width, height) > max_dimension:
            if width > height:
                new_width = max_dimension
                new_height = int(height * max_dimension / width)
            else:
                new_height = max_dimension
                new_width = int(width * max_dimension / height)
            
            result_image = result_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"📐 Resized output: {width}x{height} -> {new_width}x{new_height}")
        
        # 保存为适中质量图片
        buffer = BytesIO()
        result_image.save(buffer, format='JPEG', quality=85, optimize=True)
        result_data = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info("✅ Optimized quality result image encoded successfully")
        return {"result": result_data}
        
    except Exception as e:
        logger.error(f"❌ Face swap processing failed: {e}")
        return {"error": f"Processing failed: {str(e)}"}

def process_detect_faces_simple(image_url):
    """简化的人脸检测"""
    try:
        logger.info(f"🔍 Starting face detection from URL: {image_url}")
        
        # 下载图片
        image_frame = download_image_from_url(image_url)
        if image_frame is None:
            return {"error": "Failed to download image"}
        
        logger.info(f"📐 Image downloaded successfully, shape: {image_frame.shape}")
        
        # 检测人脸
        logger.info("🔍 Detecting faces using get_many_faces...")
        faces = modules.core.get_many_faces(image_frame)
        
        if not faces:
            return {"error": "No faces detected in the image"}
        
        logger.info(f"✅ Detected {len(faces)} face(s)")
        
        # 按位置排序人脸
        def get_face_position(face):
            bbox = face.bbox.astype(int)
            return (bbox[1], bbox[0])  # (y, x) for top-to-bottom, left-to-right
        
        faces.sort(key=get_face_position)
        logger.info("✅ Faces sorted by position (top-to-bottom, left-to-right)")
        
        # 提取人脸信息
        faces_data = []
        for i, face in enumerate(faces):
            try:
                # 提取人脸区域
                bbox = face.bbox.astype(int)
                x1, y1, x2, y2 = bbox
                
                # 确保边界在图像范围内
                h, w = image_frame.shape[:2]
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                
                # 提取人脸图像
                face_image = image_frame[y1:y2, x1:x2]
                
                if face_image.size > 0:
                    # 转换为RGB并编码
                    face_rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                    face_pil = Image.fromarray(face_rgb)
                    
                    # 编码为base64
                    buffer = BytesIO()
                    face_pil.save(buffer, format='JPEG', quality=90)
                    face_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    logger.info(f"✅ Face {i+1} preview extracted successfully")
                    
                    # 计算人脸中心点
                    center_x = (x1 + x2) // 2
                    center_y = (y1 + y2) // 2
                    
                    face_info = {
                        "face_id": i,
                        "bbox": [x1, y1, x2 - x1, y2 - y1],  # [x, y, width, height]
                        "center": [center_x, center_y],
                        "confidence": float(face.det_score),
                        "preview": face_base64
                    }
                    
                    faces_data.append(face_info)
                    logger.info(f"👤 Face {i+1}: bbox=({x1}, {y1}, {x2-x1}, {y2-y1}), center=({center_x}, {center_y}), confidence={face.det_score:.3f}")
                
            except Exception as e:
                logger.warning(f"⚠️ Failed to extract face {i+1}: {e}")
                continue
        
        if not faces_data:
            return {"error": "Failed to extract face data"}
        
        logger.info(f"✅ Face detection completed: {len(faces_data)} faces detected and sorted by position")
        
        return {
            "faces": faces_data,
            "total_faces": len(faces_data)
        }
        
    except Exception as e:
        logger.error(f"❌ Face detection failed: {e}")
        return {"error": f"Face detection failed: {str(e)}"}

def handler(job):
    """优化的RunPod Serverless Handler"""
    try:
        logger.info("🚀 RunPod Serverless Handler started")
        logger.info(f"📋 Job input: {json.dumps(job['input'], indent=2)}")
        
        # 验证模型
        if not verify_models():
            return {"error": "Model verification failed"}
        
        # 设置模型目录
        modules.globals.models_dir = '/runpod-volume/faceswap'
        
        # 获取输入参数
        job_input = job['input']
        
        # 支持两种参数格式
        process_type = job_input.get('process_type') or job_input.get('type')
        
        # 支持detect-faces和detect_faces两种格式
        if process_type == 'detect-faces':
            process_type = 'detect_faces'
        
        logger.info(f"🎯 Processing job type: {process_type}")
        
        if process_type == 'single_image':
            # 单图换脸
            source_url = job_input.get('source_file') or job_input.get('source_url')
            target_url = job_input.get('target_file') or job_input.get('target_url')
            
            if not source_url or not target_url:
                return {"error": "Missing source_file/source_url or target_file/target_url"}
            
            logger.info("📸 Processing single image face swap")
            logger.info(f"   Source: {source_url}")
            logger.info(f"   Target: {target_url}")
            
            # 获取选项
            options = job_input.get('options', {})
            use_face_enhancer = options.get('use_face_enhancer', True)
            
            return process_image_swap_simple(source_url, target_url, use_face_enhancer)
            
        elif process_type == 'detect_faces':
            # 人脸检测
            image_url = job_input.get('image_file') or job_input.get('image_url')
            
            if not image_url:
                return {"error": "Missing image_file/image_url"}
            
            logger.info("🔍 Processing face detection")
            logger.info(f"   Image: {image_url}")
            
            return process_detect_faces_simple(image_url)
            
        else:
            return {"error": f"Unsupported process_type: {process_type}"}
            
    except Exception as e:
        logger.error(f"❌ Handler failed: {e}")
        return {"error": f"Handler failed: {str(e)}"}

if __name__ == "__main__":
    logger.info("🚀 Starting RunPod Serverless with optimized handler...")
    logger.info("📁 Models directory: /runpod-volume/faceswap")
    logger.info("🎯 Models ready: True")
    runpod.serverless.start({"handler": handler}) 