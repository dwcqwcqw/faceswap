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
    
    # Priority 1: RunPod Network Volume (if mounted)
    if os.path.exists('/runpod-volume/models'):
        return '/runpod-volume/models'
    
    # Priority 2: Workspace models (if exists)
    if os.path.exists('/workspace/models'):
        return '/workspace/models'
    
    # Priority 3: Local app models
    return '/app/models'

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

def check_and_download_models():
    """Check for required models and download if missing"""
    
    models_dir = get_models_dir()
    print(f"🔍 Using models directory: {models_dir}")
    
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
        '79999_iter.pth': {
            'url': 'https://huggingface.co/hacksider/deep-live-cam/resolve/main/79999_iter.pth',
            'description': 'Face Parsing Model'
        },
        'buffalo_l.zip': {
            'url': 'https://huggingface.co/hacksider/deep-live-cam/resolve/main/buffalo_l.zip',
            'description': 'Face Analysis Model (Buffalo_L)',
            'extract': True
        }
    }
    
    all_models_exist = True
    
    # Check which models are missing
    for model_name, model_info in models.items():
        model_path = os.path.join(models_dir, model_name)
        
        # For buffalo_l, check if directory exists instead of zip
        if model_name == 'buffalo_l.zip':
            buffalo_dir = os.path.join(models_dir, 'buffalo_l')
            if os.path.exists(buffalo_dir) and os.listdir(buffalo_dir):
                print(f"✅ {model_info['description']} already exists")
                continue
        elif os.path.exists(model_path):
            print(f"✅ {model_info['description']} already exists")
            continue
        
        print(f"❌ {model_info['description']} not found")
        all_models_exist = False
        
        # Download missing model
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