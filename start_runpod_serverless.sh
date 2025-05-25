#!/bin/bash

# RunPod Serverless Startup Script
# Ensures path compatibility between RunPod Pod and Serverless environments

echo "🚀 Starting RunPod Serverless Face Swap Handler..."

# ====== RunPod Serverless Path Compatibility ======
# Handle the difference between RunPod Pod (/workspace) and Serverless (/runpod-volume)

if [ -d "/runpod-volume" ] && [ ! -d "/workspace" ]; then
    echo "🔧 Detected RunPod Serverless environment"
    echo "📁 Creating symbolic link: /runpod-volume -> /workspace"
    
    # Create symbolic link for backward compatibility
    ln -sf /runpod-volume /workspace
    
    if [ -d "/workspace/faceswap" ]; then
        echo "✅ Path compatibility verified: /workspace/faceswap accessible"
    else
        echo "⚠️ Warning: /workspace/faceswap not found via symbolic link"
    fi
    
elif [ -d "/workspace" ]; then
    echo "🔍 Detected traditional RunPod Pod environment"
    echo "ℹ️ No path conversion needed"
else
    echo "🏠 Detected local development environment"
    echo "ℹ️ No path conversion needed"
fi

# ====== Environment Setup ======
export PYTHONPATH="/app:$PYTHONPATH"
export DISPLAY=""
export HEADLESS="1"

# Set models directory based on environment
if [ -d "/runpod-volume/faceswap" ]; then
    export MODELS_DIR="/runpod-volume/faceswap"
    echo "🔧 Set MODELS_DIR to: $MODELS_DIR"
elif [ -d "/workspace/faceswap" ]; then
    export MODELS_DIR="/workspace/faceswap"
    echo "🔧 Set MODELS_DIR to: $MODELS_DIR"
fi

# ====== RunPod Handler Startup ======
echo "🎯 Starting RunPod Handler..."

# Run the RunPod Serverless handler
cd /app
python3 -m runpod.serverless.start runpod/handler_serverless.py 