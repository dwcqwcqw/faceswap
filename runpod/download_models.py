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

def extract_zip(zip_path, extract_to, remove_after=True):
    """Extract zip file"""
    try:
        print(f"📂 Extracting {os.path.basename(zip_path)}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        
        # Only remove downloaded zip files, not existing workspace files
        if remove_after and '/workspace/' not in zip_path and '/runpod-volume/' not in zip_path:
            os.remove(zip_path)  # Clean up zip file
            print(f"✅ Extracted and removed {os.path.basename(zip_path)}")
        else:
            print(f"✅ Extracted {os.path.basename(zip_path)} (keeping original)")
        return True
    except Exception as e:
        print(f"❌ Error extracting {os.path.basename(zip_path)}: {str(e)}")
        return False

def check_existing_models(models_dir):
    """Check for existing models in various locations"""
    existing_models = {}
    
    # Check runpod-volume paths and workspace directory (user mentioned models are there)
    workspace_paths = [
        '/runpod-volume/workspace/faceswap',
        '/runpod-volume/faceswap',
        '/workspace/faceswap'
    ]
    
    for workspace_root in workspace_paths:
        if os.path.exists(workspace_root):
            print(f"🔍 Checking workspace: {workspace_root}")
            
            # Check for buffalo_l.zip in workspace root
            buffalo_zip_path = os.path.join(workspace_root, 'buffalo_l.zip')
            if os.path.exists(buffalo_zip_path):
                print(f"✅ Found buffalo_l.zip in workspace: {buffalo_zip_path}")
                # Extract it to models directory if not already extracted
                buffalo_dir = os.path.join(models_dir, 'buffalo_l')
                if not os.path.exists(buffalo_dir) or not os.listdir(buffalo_dir):
                    print(f"📂 Extracting buffalo_l.zip from workspace...")
                    os.makedirs(buffalo_dir, exist_ok=True)
                    if extract_zip(buffalo_zip_path, models_dir, remove_after=False):
                        existing_models['buffalo_l.zip'] = True
                else:
                    existing_models['buffalo_l.zip'] = True
            
            # Check for extracted buffalo_l directory
            buffalo_workspace_dir = os.path.join(workspace_root, 'buffalo_l')
            if os.path.exists(buffalo_workspace_dir) and os.listdir(buffalo_workspace_dir):
                print(f"✅ Found extracted buffalo_l directory in workspace: {buffalo_workspace_dir}")
                buffalo_models_dir = os.path.join(models_dir, 'buffalo_l')
                if not os.path.exists(buffalo_models_dir):
                    try:
                        os.symlink(buffalo_workspace_dir, buffalo_models_dir)
                        print(f"🔗 Linked buffalo_l directory from workspace")
                    except:
                        import shutil
                        shutil.copytree(buffalo_workspace_dir, buffalo_models_dir)
                        print(f"📋 Copied buffalo_l directory from workspace")
                existing_models['buffalo_l.zip'] = True
            
            # Check for other model files
            for filename in ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth', '79999_iter.pth', 'RealESRGAN_x4plus.pth', 'RealESRGAN_x2plus.pth']:
                workspace_path = os.path.join(workspace_root, filename)
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
    for filename in ['inswapper_128_fp16.onnx', 'GFPGANv1.4.pth', '79999_iter.pth', 'RealESRGAN_x4plus.pth', 'RealESRGAN_x2plus.pth']:
        model_path = os.path.join(models_dir, filename)
        if os.path.exists(model_path):
            existing_models[filename] = True
    
    # Check buffalo_l directory in models
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
            'url': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth', 
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