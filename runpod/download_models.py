#!/usr/bin/env python3
"""
Model Download Script for RunPod Serverless
Downloads required models if not found in volume or local storage
"""

import os
import sys
import requests
import zipfile
from pathlib import Path

def get_models_dir():
    """Get models directory, preferring RunPod volume"""
    
    # Priority 1: Volume mount - workspace/faceswap (as user mentioned)
    if os.path.exists('/workspace/faceswap'):
        models_dir = '/workspace/faceswap/models'
        os.makedirs(models_dir, exist_ok=True)
        print(f"🔍 Using volume mount models directory: {models_dir}")
        return models_dir
    
    # Priority 2: RunPod Network Volume (if mounted)
    if os.path.exists('/runpod-volume/models'):
        print(f"🔍 Using RunPod network volume: /runpod-volume/models")
        return '/runpod-volume/models'
    
    # Priority 3: Workspace models (if exists)
    if os.path.exists('/workspace/models'):
        print(f"🔍 Using workspace models: /workspace/models")
        return '/workspace/models'
    
    # Priority 4: Local app models
    models_dir = '/app/models'
    os.makedirs(models_dir, exist_ok=True)
    print(f"🔍 Using local app models: {models_dir}")
    return models_dir

def download_file(url, filepath, description=""):
    """Download file with progress indication"""
    try:
        print(f"📥 Downloading {description}...")
        print(f"    From: {url}")
        print(f"    To: {filepath}")
        
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        print(f"\r    Progress: {progress:.1f}%", end='', flush=True)
        
        print(f"\n✅ Downloaded {description}")
        return True
        
    except Exception as e:
        print(f"❌ Error downloading {description}: {str(e)}")
        return False

def extract_zip(zip_path, extract_to):
    """Extract zip file"""
    try:
        print(f"📂 Extracting {os.path.basename(zip_path)}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        os.remove(zip_path)  # Clean up zip file
        print(f"✅ Extracted {os.path.basename(zip_path)}")
        return True
    except Exception as e:
        print(f"❌ Error extracting {os.path.basename(zip_path)}: {str(e)}")
        return False

def check_existing_models(models_dir):
    """Check for existing models in various locations"""
    existing_models = {}
    
    # Check workspace/faceswap root directory (user mentioned models are there)
    if os.path.exists('/workspace/faceswap'):
        for filename in ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth']:
            workspace_path = os.path.join('/workspace/faceswap', filename)
            if os.path.exists(workspace_path):
                # Copy or symlink to models directory
                models_path = os.path.join(models_dir, filename)
                if not os.path.exists(models_path):
                    try:
                        # Try to create symlink first, fallback to copy
                        os.symlink(workspace_path, models_path)
                        print(f"🔗 Linked {filename} from workspace")
                    except:
                        import shutil
                        shutil.copy2(workspace_path, models_path)
                        print(f"📋 Copied {filename} from workspace")
                existing_models[filename] = True
    
    # Check models directory itself
    for filename in ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth', '79999_iter.pth']:
        model_path = os.path.join(models_dir, filename)
        if os.path.exists(model_path):
            existing_models[filename] = True
    
    # Check buffalo_l directory
    buffalo_dir = os.path.join(models_dir, 'buffalo_l')
    if os.path.exists(buffalo_dir) and os.listdir(buffalo_dir):
        existing_models['buffalo_l.zip'] = True
    
    return existing_models

def check_and_download_models():
    """Check for required models and download if missing"""
    
    models_dir = get_models_dir()
    print(f"✅ Models initialized in: {models_dir}")
    
    # Check for existing models
    existing_models = check_existing_models(models_dir)
    
    # Required models with their download URLs
    models = {
        'inswapper_128_fp16.onnx': {
            'url': 'https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx',
            'description': 'Face Swapper Model (inswapper)'
        },
        'GFPGANv1.4.pth': {
            'url': 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth',
            'description': 'Face Enhancer Model (GFPGAN)'
        },
        'RealESRGAN_x4plus.pth': {
            'url': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
            'description': 'Super Resolution Model (Real-ESRGAN 4x)'
        },
        'RealESRGAN_x2plus.pth': {
            'url': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.1/RealESRGAN_x2plus.pth', 
            'description': 'Super Resolution Model (Real-ESRGAN 2x)'
        },
        '79999_iter.pth': {
            'url': 'https://huggingface.co/ManyOtherFunctions/face-parse-bisent/resolve/main/79999_iter.pth',
            'description': 'Face Parsing Model'
        },
        'buffalo_l.zip': {
            'url': 'https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip',
            'description': 'Face Analysis Model (Buffalo_L)',
            'extract': True
        }
    }
    
    all_models_exist = True
    
    # Check which models are missing
    for model_name, model_info in models.items():
        if existing_models.get(model_name):
            print(f"✅ {model_info['description']} already exists")
            continue
        
        print(f"❌ {model_info['description']} not found")
        all_models_exist = False
        
        # Download missing model
        model_path = os.path.join(models_dir, model_name)
        if download_file(model_info['url'], model_path, model_info['description']):
            # Extract if it's a zip file
            if model_info.get('extract') and model_name.endswith('.zip'):
                extract_zip(model_path, models_dir)
    
    if all_models_exist:
        print("🎉 All required models are available!")
    else:
        print("📦 Model download completed!")
    
    # Set permissions
    try:
        os.system(f"chmod -R 755 {models_dir}")
        print(f"✅ Set permissions for {models_dir}")
    except:
        pass
    
    return models_dir

if __name__ == "__main__":
    print("🚀 Starting model check and download...")
    models_dir = check_and_download_models()
    print(f"✅ Models ready in: {models_dir}")
    
    # Update environment variable for handler
    os.environ['MODELS_DIR'] = models_dir 