#!/usr/bin/env python3
"""
Check Additional Models for Multi-Person Video Processing
This script checks for additional models required for advanced face processing features
"""

import os
import logging
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_additional_models(volume_path='/runpod-volume/faceswap'):
    """Check for additional models required for multi-person video processing"""
    
    logger.info(f"🔍 Checking additional models in: {volume_path}")
    
    # Additional models for advanced features
    additional_models = {
        # Core GFPGAN models
        'GFPGANv1.3.pth': {
            'description': 'GFPGAN v1.3 (more natural results)',
            'url': 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth',
            'size_mb': 332,
            'required_for': 'Enhanced face restoration'
        },
        'GFPGANv1.4.pth': {
            'description': 'GFPGAN v1.4 (latest version)',
            'url': 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth',
            'size_mb': 332,
            'required_for': 'Latest face enhancement'
        },
        
        # FaceXLib models for advanced face processing
        'detection_Resnet50_Final.pth': {
            'description': 'RetinaFace detection model (ResNet50)',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth',
            'size_mb': 109,
            'required_for': 'High-accuracy face detection in videos'
        },
        'detection_mobilenet0.25_Final.pth': {
            'description': 'MobileNet face detection (lightweight)',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_mobilenet0.25_Final.pth',
            'size_mb': 1.7,
            'required_for': 'Fast face detection for real-time processing'
        },
        'parsing_parsenet.pth': {
            'description': 'ParseNet face parsing model',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth',
            'size_mb': 85,
            'required_for': 'Detailed face parsing for multi-person videos'
        },
        'alignment_WFLW_4HG.pth': {
            'description': 'WFLW face alignment model',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.2.0/alignment_WFLW_4HG.pth',
            'size_mb': 59,
            'required_for': 'Precise face landmark detection'
        },
        'headpose_hopenet_alpha1.pth': {
            'description': 'HopeNet head pose estimation',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.2.0/headpose_hopenet_alpha1.pth',
            'size_mb': 23,
            'required_for': 'Head pose estimation for better face alignment'
        },
        'matting_modnet_photographic_portrait_matting.ckpt': {
            'description': 'MODNet portrait matting model',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.2.0/matting_modnet_photographic_portrait_matting.ckpt',
            'size_mb': 24,
            'required_for': 'Background separation for portrait processing'
        },
        'recognition_arcface_ir_se50.pth': {
            'description': 'ArcFace recognition model',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.2.0/recognition_arcface_ir_se50.pth',
            'size_mb': 92,
            'required_for': 'Face identity verification and matching'
        },
        'assessment_hyperIQA.pth': {
            'description': 'HyperIQA quality assessment',
            'url': 'https://github.com/xinntao/facexlib/releases/download/v0.2.0/assessment_hyperIQA.pth',
            'size_mb': 112,
            'required_for': 'Image quality assessment and optimization'
        }
    }
    
    found_models = []
    missing_models = []
    total_size_mb = 0
    missing_size_mb = 0
    
    for model_name, model_info in additional_models.items():
        model_path = os.path.join(volume_path, model_name)
        gfpgan_path = os.path.join(volume_path, 'gfpgan', 'weights', model_name)
        
        if os.path.exists(model_path):
            size_mb = os.path.getsize(model_path) / (1024 * 1024)
            logger.info(f"✅ Found {model_info['description']}: {model_name} ({size_mb:.1f}MB)")
            logger.info(f"   📋 Used for: {model_info['required_for']}")
            found_models.append(model_name)
            total_size_mb += size_mb
        elif os.path.exists(gfpgan_path):
            size_mb = os.path.getsize(gfpgan_path) / (1024 * 1024)
            logger.info(f"✅ Found {model_info['description']}: {model_name} (in gfpgan/weights, {size_mb:.1f}MB)")
            logger.info(f"   📋 Used for: {model_info['required_for']}")
            found_models.append(model_name)
            total_size_mb += size_mb
        else:
            logger.warning(f"⚠️ Missing {model_info['description']}: {model_name}")
            logger.info(f"   📋 Required for: {model_info['required_for']}")
            logger.info(f"   📥 Download URL: {model_info['url']}")
            logger.info(f"   📊 Size: ~{model_info['size_mb']}MB")
            missing_models.append(model_name)
            missing_size_mb += model_info['size_mb']
    
    # Summary
    logger.info(f"\n📊 Additional Models Summary:")
    logger.info(f"✅ Found: {len(found_models)}/{len(additional_models)} models ({total_size_mb:.1f}MB)")
    logger.info(f"⚠️ Missing: {len(missing_models)} models (~{missing_size_mb:.1f}MB)")
    
    if missing_models:
        logger.info(f"\n📋 Missing Models Details:")
        for model_name in missing_models:
            model_info = additional_models[model_name]
            logger.info(f"   • {model_name}: {model_info['description']}")
            logger.info(f"     Required for: {model_info['required_for']}")
    
    # Feature availability analysis
    logger.info(f"\n🎯 Feature Availability Analysis:")
    
    # Core features (always available with basic models)
    logger.info(f"✅ Basic face swapping: Available")
    logger.info(f"✅ Single person processing: Available")
    
    # Advanced features (require additional models)
    advanced_features = {
        'High-accuracy face detection': ['detection_Resnet50_Final.pth'],
        'Fast real-time processing': ['detection_mobilenet0.25_Final.pth'],
        'Multi-person video processing': ['detection_Resnet50_Final.pth', 'parsing_parsenet.pth'],
        'Precise face alignment': ['alignment_WFLW_4HG.pth'],
        'Head pose estimation': ['headpose_hopenet_alpha1.pth'],
        'Background separation': ['matting_modnet_photographic_portrait_matting.ckpt'],
        'Face identity verification': ['recognition_arcface_ir_se50.pth'],
        'Quality assessment': ['assessment_hyperIQA.pth'],
        'Enhanced face restoration': ['GFPGANv1.3.pth', 'GFPGANv1.4.pth']
    }
    
    for feature, required_models in advanced_features.items():
        available = all(model in found_models for model in required_models)
        status = "✅ Available" if available else "⚠️ Limited (missing models)"
        logger.info(f"{status}: {feature}")
        if not available:
            missing_for_feature = [m for m in required_models if m not in found_models]
            logger.info(f"   Missing: {', '.join(missing_for_feature)}")
    
    return {
        'found_models': found_models,
        'missing_models': missing_models,
        'total_found': len(found_models),
        'total_missing': len(missing_models),
        'found_size_mb': total_size_mb,
        'missing_size_mb': missing_size_mb,
        'additional_models': additional_models
    }

def download_missing_additional_models(volume_path='/runpod-volume/faceswap', models_to_download=None):
    """Download missing additional models"""
    
    result = check_additional_models(volume_path)
    
    if not result['missing_models']:
        logger.info("✅ All additional models are already available!")
        return True
    
    if models_to_download is None:
        models_to_download = result['missing_models']
    
    logger.info(f"📥 Downloading {len(models_to_download)} additional models...")
    
    downloaded_count = 0
    failed_count = 0
    
    for model_name in models_to_download:
        if model_name not in result['additional_models']:
            logger.warning(f"⚠️ Unknown model: {model_name}")
            continue
            
        model_info = result['additional_models'][model_name]
        model_path = os.path.join(volume_path, model_name)
        
        try:
            logger.info(f"📥 Downloading {model_info['description']}...")
            logger.info(f"   URL: {model_info['url']}")
            logger.info(f"   Size: ~{model_info['size_mb']}MB")
            
            response = requests.get(model_info['url'], stream=True)
            response.raise_for_status()
            
            with open(model_path, 'wb') as f:
                downloaded = 0
                total_size = int(response.headers.get('content-length', 0))
                
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if total_size > 0 and downloaded % (1024 * 1024) == 0:
                            progress = (downloaded / total_size) * 100
                            logger.info(f"   Progress: {progress:.1f}%")
            
            # Verify download
            if os.path.exists(model_path):
                size_mb = os.path.getsize(model_path) / (1024 * 1024)
                logger.info(f"✅ Downloaded {model_name} ({size_mb:.1f}MB)")
                downloaded_count += 1
            else:
                logger.error(f"❌ Download verification failed for {model_name}")
                failed_count += 1
                
        except Exception as e:
            logger.error(f"❌ Failed to download {model_name}: {e}")
            failed_count += 1
    
    logger.info(f"\n📊 Download Summary:")
    logger.info(f"✅ Successfully downloaded: {downloaded_count} models")
    if failed_count > 0:
        logger.warning(f"❌ Failed downloads: {failed_count} models")
    
    return failed_count == 0

if __name__ == "__main__":
    import sys
    
    # Get volume path from command line or use default
    volume_path = sys.argv[1] if len(sys.argv) > 1 else '/runpod-volume/faceswap'
    
    logger.info("🚀 Additional Models Check Script")
    logger.info(f"📁 Volume path: {volume_path}")
    
    # Check existing models
    result = check_additional_models(volume_path)
    
    # Ask if user wants to download missing models
    if len(sys.argv) > 2 and sys.argv[2] == '--download':
        if result['missing_models']:
            download_missing_additional_models(volume_path)
        else:
            logger.info("✅ No additional models need to be downloaded!")
    elif result['missing_models']:
        logger.info(f"\n💡 To download missing models, run:")
        logger.info(f"   python {sys.argv[0]} {volume_path} --download")
    
    logger.info("✅ Additional models check completed!") 