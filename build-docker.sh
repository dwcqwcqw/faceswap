#!/bin/bash

# Face Swap Docker Build Script
# Based on Deep-Live-Cam: https://github.com/hacksider/Deep-Live-Cam

set -e

echo "🚀 Building Face Swap Docker Image for RunPod Serverless..."

# Configuration
IMAGE_NAME="faceswap-runpod"
TAG=${1:-"latest"}
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"

echo "📋 Image: $FULL_IMAGE_NAME"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t $FULL_IMAGE_NAME .

# Get image size
IMAGE_SIZE=$(docker images $FULL_IMAGE_NAME --format "table {{.Size}}" | tail -1)
echo "📦 Image size: $IMAGE_SIZE"

echo "✅ Build completed successfully!"
echo ""
echo "🔍 Image details:"
docker images $FULL_IMAGE_NAME

echo ""
echo "🚀 Next steps:"
echo "1. Push to Docker Hub:"
echo "   docker tag $FULL_IMAGE_NAME your-dockerhub-username/$IMAGE_NAME:$TAG"
echo "   docker push your-dockerhub-username/$IMAGE_NAME:$TAG"
echo ""
echo "2. Use in RunPod:"
echo "   - Image: your-dockerhub-username/$IMAGE_NAME:$TAG"
echo "   - Container Disk: 20GB+"
echo "   - GPU: RTX 4090 or better recommended"
echo ""
echo "3. Test locally:"
echo "   docker run --rm -p 8000:8000 --gpus all $FULL_IMAGE_NAME" 