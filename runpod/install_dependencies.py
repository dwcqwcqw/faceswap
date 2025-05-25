#!/usr/bin/env python3
"""
Install Dependencies for Enhanced Face Swap Processing
Installs Real-ESRGAN and other optional dependencies for super resolution
"""

import subprocess
import sys
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def install_package(package_name, import_name=None):
    """Install a Python package using pip"""
    try:
        # Try to import first
        if import_name:
            try:
                __import__(import_name)
                logger.info(f"✅ {package_name} already installed")
                return True
            except ImportError:
                pass
        
        logger.info(f"📦 Installing {package_name}...")
        result = subprocess.run([
            sys.executable, "-m", "pip", "install", package_name
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info(f"✅ Successfully installed {package_name}")
            return True
        else:
            logger.error(f"❌ Failed to install {package_name}: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error installing {package_name}: {e}")
        return False

def install_realesrgan():
    """Install Real-ESRGAN and its dependencies"""
    logger.info("🚀 Installing Real-ESRGAN for super resolution...")
    
    # Install dependencies
    dependencies = [
        ("basicsr", "basicsr"),
        ("facexlib", "facexlib"),
        ("gfpgan", "gfpgan"),
        ("realesrgan", "realesrgan")
    ]
    
    success_count = 0
    for package, import_name in dependencies:
        if install_package(package, import_name):
            success_count += 1
    
    if success_count == len(dependencies):
        logger.info("✅ Real-ESRGAN installation completed successfully")
        return True
    else:
        logger.warning(f"⚠️ Real-ESRGAN installation partially completed ({success_count}/{len(dependencies)})")
        return False

def install_additional_dependencies():
    """Install additional optional dependencies for enhanced processing"""
    logger.info("📦 Installing additional dependencies...")
    
    optional_packages = [
        ("opencv-python-headless", "cv2"),
        ("Pillow", "PIL"),
        ("numpy", "numpy"),
        ("torch", "torch"),
        ("torchvision", "torchvision")
    ]
    
    for package, import_name in optional_packages:
        install_package(package, import_name)

def verify_installation():
    """Verify that all components are properly installed"""
    logger.info("🔍 Verifying installation...")
    
    try:
        # Test basic imports
        import cv2
        import numpy as np
        from PIL import Image
        logger.info("✅ Basic dependencies verified")
        
        # Test Real-ESRGAN
        try:
            import basicsr
            from realesrgan import RealESRGANer
            logger.info("✅ Real-ESRGAN successfully imported")
            return True
        except ImportError as e:
            logger.warning(f"⚠️ Real-ESRGAN not available: {e}")
            return False
            
    except ImportError as e:
        logger.error(f"❌ Basic dependencies missing: {e}")
        return False

def main():
    """Main installation function"""
    logger.info("🚀 Starting enhanced dependencies installation...")
    
    # Install additional dependencies first
    install_additional_dependencies()
    
    # Install Real-ESRGAN
    realesrgan_success = install_realesrgan()
    
    # Verify installation
    verification_success = verify_installation()
    
    if realesrgan_success and verification_success:
        logger.info("🎉 All enhanced dependencies installed successfully!")
        logger.info("💡 Super resolution is now available for ultra-high quality output")
    elif verification_success:
        logger.info("✅ Basic functionality verified")
        logger.info("⚠️ Super resolution may not be available but face swapping will work")
    else:
        logger.warning("⚠️ Some dependencies may be missing")
        logger.info("🔄 Face swapping will still work with fallback methods")

if __name__ == "__main__":
    main() 