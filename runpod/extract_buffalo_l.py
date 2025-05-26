#!/usr/bin/env python3
"""
Script to find and extract buffalo_l model from RunPod Volume
"""

import os
import zipfile
import tarfile
import logging
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def find_buffalo_files(volume_path):
    """Find buffalo_l related files in the volume"""
    
    logger.info(f"🔍 Searching for buffalo_l files in: {volume_path}")
    
    if not os.path.exists(volume_path):
        logger.error(f"❌ Volume path not found: {volume_path}")
        return []
    
    buffalo_files = []
    
    # Search for buffalo related files
    for root, dirs, files in os.walk(volume_path):
        for file in files:
            if 'buffalo' in file.lower():
                file_path = os.path.join(root, file)
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
                logger.info(f"📦 Found: {file_path} ({file_size:.1f}MB)")
                buffalo_files.append(file_path)
    
    return buffalo_files

def extract_buffalo_archive(archive_path, extract_to):
    """Extract buffalo_l archive to specified directory"""
    
    logger.info(f"📂 Extracting: {archive_path}")
    logger.info(f"📁 Extract to: {extract_to}")
    
    try:
        # Ensure extraction directory exists
        os.makedirs(extract_to, exist_ok=True)
        
        # Determine archive type and extract
        if archive_path.endswith('.zip'):
            logger.info("🔄 Extracting ZIP archive...")
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_to)
                logger.info(f"✅ ZIP extraction completed")
                
        elif archive_path.endswith(('.tar.gz', '.tgz')):
            logger.info("🔄 Extracting TAR.GZ archive...")
            with tarfile.open(archive_path, 'r:gz') as tar_ref:
                tar_ref.extractall(extract_to)
                logger.info(f"✅ TAR.GZ extraction completed")
                
        elif archive_path.endswith('.tar'):
            logger.info("🔄 Extracting TAR archive...")
            with tarfile.open(archive_path, 'r') as tar_ref:
                tar_ref.extractall(extract_to)
                logger.info(f"✅ TAR extraction completed")
                
        else:
            logger.warning(f"⚠️ Unknown archive format: {archive_path}")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"❌ Extraction failed: {e}")
        return False

def organize_buffalo_l(extract_path, models_dir):
    """Organize extracted buffalo_l files to correct location"""
    
    logger.info(f"🗂️ Organizing buffalo_l files...")
    
    # Look for buffalo_l directory in extracted files
    buffalo_l_target = os.path.join(models_dir, 'buffalo_l')
    
    # Search for buffalo_l directory in extracted content
    for root, dirs, files in os.walk(extract_path):
        if 'buffalo_l' in dirs:
            source_buffalo = os.path.join(root, 'buffalo_l')
            logger.info(f"📁 Found buffalo_l directory: {source_buffalo}")
            
            # Move to models directory
            if os.path.exists(buffalo_l_target):
                logger.info("🔄 Removing existing buffalo_l directory...")
                shutil.rmtree(buffalo_l_target)
            
            logger.info(f"📦 Moving buffalo_l to: {buffalo_l_target}")
            shutil.move(source_buffalo, buffalo_l_target)
            
            # Verify the move
            if os.path.exists(buffalo_l_target):
                file_count = len(os.listdir(buffalo_l_target))
                logger.info(f"✅ buffalo_l organized successfully ({file_count} files)")
                return True
    
    # If no buffalo_l directory found, look for individual files
    logger.info("🔍 Looking for individual buffalo_l files...")
    for root, dirs, files in os.walk(extract_path):
        buffalo_files = [f for f in files if 'buffalo' in f.lower() or any(ext in f for ext in ['.onnx', '.pth'])]
        if buffalo_files:
            logger.info(f"📁 Found {len(buffalo_files)} potential buffalo_l files")
            
            # Create buffalo_l directory
            os.makedirs(buffalo_l_target, exist_ok=True)
            
            # Move files
            for file in buffalo_files:
                src = os.path.join(root, file)
                dst = os.path.join(buffalo_l_target, file)
                logger.info(f"📦 Moving: {file}")
                shutil.move(src, dst)
            
            logger.info(f"✅ buffalo_l files organized successfully")
            return True
    
    logger.warning("⚠️ No buffalo_l files found in extracted content")
    return False

def main():
    """Main function to find and extract buffalo_l"""
    
    # Check if we're in RunPod environment
    volume_path = '/runpod-volume/faceswap'
    models_dir = volume_path
    
    if not os.path.exists(volume_path):
        logger.error(f"❌ RunPod Volume not found: {volume_path}")
        logger.info("ℹ️ This script should be run in RunPod environment")
        return False
    
    logger.info("🚀 Starting buffalo_l extraction process...")
    
    # Find buffalo files
    buffalo_files = find_buffalo_files(volume_path)
    
    if not buffalo_files:
        logger.warning("⚠️ No buffalo files found in Volume")
        return False
    
    # Try to extract each archive
    for file_path in buffalo_files:
        logger.info(f"🔄 Processing: {os.path.basename(file_path)}")
        
        # Create temporary extraction directory
        temp_extract = os.path.join(volume_path, 'temp_buffalo_extract')
        
        try:
            # Extract the archive
            if extract_buffalo_archive(file_path, temp_extract):
                # Organize the extracted files
                if organize_buffalo_l(temp_extract, models_dir):
                    logger.info("✅ buffalo_l extraction and organization completed!")
                    
                    # Cleanup temp directory
                    if os.path.exists(temp_extract):
                        shutil.rmtree(temp_extract)
                    
                    # Verify final result
                    buffalo_l_final = os.path.join(models_dir, 'buffalo_l')
                    if os.path.exists(buffalo_l_final):
                        file_count = len(os.listdir(buffalo_l_final))
                        total_size = sum(os.path.getsize(os.path.join(buffalo_l_final, f)) 
                                       for f in os.listdir(buffalo_l_final) 
                                       if os.path.isfile(os.path.join(buffalo_l_final, f)))
                        size_mb = total_size / (1024 * 1024)
                        logger.info(f"🎉 buffalo_l ready: {file_count} files, {size_mb:.1f}MB")
                    
                    return True
                    
        except Exception as e:
            logger.error(f"❌ Error processing {file_path}: {e}")
            
        finally:
            # Cleanup temp directory
            if os.path.exists(temp_extract):
                try:
                    shutil.rmtree(temp_extract)
                except:
                    pass
    
    logger.error("❌ Failed to extract buffalo_l from any archive")
    return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 