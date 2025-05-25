#!/usr/bin/env python3
"""
RunPod Serverless Path Compatibility Fix
Handles the difference between RunPod Pod (/workspace) and Serverless (/runpod-volume) environments
"""

import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_path_compatibility():
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

def get_compatible_models_paths():
    """Get compatible model paths for both environments"""
    
    # Priority order for model directories
    model_paths = [
        # RunPod Serverless paths
        '/runpod-volume/faceswap',
        '/runpod-volume/faceswap/models', 
        '/runpod-volume/models',
        
        # Traditional RunPod Pod paths  
        '/workspace/faceswap',
        '/workspace/faceswap/models',
        '/workspace/models',
        
        # Docker paths
        '/app/models',
        
        # Local development
        './models'
    ]
    
    logger.info("🔍 Searching for models in compatible paths...")
    
    for path in model_paths:
        if os.path.exists(path):
            logger.info(f"✅ Found models directory: {path}")
            return path
    
    logger.warning("⚠️ No models directory found in any compatible path")
    return None

def update_environment_variables():
    """Update environment variables for path compatibility"""
    
    # Set models directory
    models_dir = get_compatible_models_paths()
    if models_dir:
        os.environ['MODELS_DIR'] = models_dir
        logger.info(f"🔧 Set MODELS_DIR environment variable: {models_dir}")
    
    # Set workspace directory for compatibility
    if os.path.exists('/runpod-volume'):
        os.environ['WORKSPACE_DIR'] = '/runpod-volume'
        logger.info("🔧 Set WORKSPACE_DIR environment variable: /runpod-volume")
    elif os.path.exists('/workspace'):
        os.environ['WORKSPACE_DIR'] = '/workspace'  
        logger.info("🔧 Set WORKSPACE_DIR environment variable: /workspace")

def main():
    """Main function to setup RunPod Serverless compatibility"""
    
    logger.info("🚀 Starting RunPod Serverless Path Compatibility Setup...")
    
    # Setup path compatibility
    setup_path_compatibility()
    
    # Update environment variables
    update_environment_variables()
    
    # Log final status
    logger.info("✅ RunPod Serverless path compatibility setup completed")
    
    # Verify paths
    test_paths = [
        '/workspace/faceswap',
        '/runpod-volume/faceswap', 
        '/workspace/models',
        '/runpod-volume/models'
    ]
    
    logger.info("🔍 Final path verification:")
    for path in test_paths:
        exists = "✅" if os.path.exists(path) else "❌"
        logger.info(f"   {exists} {path}")

if __name__ == "__main__":
    main()
