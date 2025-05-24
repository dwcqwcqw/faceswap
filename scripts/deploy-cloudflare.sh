#!/bin/bash

# Cloudflare R2 FaceSwap Deployment Script
echo "🚀 Deploying FaceSwap to Cloudflare..."

# Navigate to cloudflare directory
cd web/cloudflare

echo "📝 Setting up secrets..."

# Set R2 secret access key
echo "Setting R2 secret access key..."
echo "a4415c670e669229db451ea7b38544c0a2e44dbe630f1f35f99f28a27593d181" | wrangler secret put R2_SECRET_ACCESS_KEY

# Set RunPod API key (you'll need to replace this with your actual key)
echo "⚠️  Please set your RunPod API key:"
echo "wrangler secret put RUNPOD_API_KEY"

echo "⚠️  Please set your RunPod Endpoint ID:"
echo "wrangler secret put RUNPOD_ENDPOINT_ID"

echo "📦 Creating R2 bucket..."
# Create R2 bucket if it doesn't exist
wrangler r2 bucket create faceswap-storage 2>/dev/null || echo "Bucket already exists or creation failed"

echo "🏗️  Deploying worker..."
# Deploy the worker
wrangler deploy

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set your RunPod API key: wrangler secret put RUNPOD_API_KEY"
echo "2. Set your RunPod Endpoint ID: wrangler secret put RUNPOD_ENDPOINT_ID"
echo "3. Test the deployment with your frontend"
echo ""
echo "🔗 Your worker will be available at: https://faceswap-api.your-subdomain.workers.dev" 