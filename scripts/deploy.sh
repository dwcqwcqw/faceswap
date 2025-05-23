#!/bin/bash

# Face Swap Application Deployment Script

set -e

echo "🚀 Starting Face Swap Application Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        print_warning "Wrangler CLI is not installed. Installing..."
        npm install -g wrangler
    fi
    
    print_status "Dependencies check completed ✅"
}

# Build frontend
build_frontend() {
    print_status "Building frontend application..."
    
    cd web/frontend
    
    # Install dependencies
    npm install
    
    # Build for production
    npm run build
    
    cd ../..
    
    print_status "Frontend build completed ✅"
}

# Deploy Cloudflare Worker
deploy_worker() {
    print_status "Deploying Cloudflare Worker..."
    
    cd web/cloudflare
    
    # Check if wrangler is authenticated
    if ! wrangler whoami &> /dev/null; then
        print_warning "Wrangler is not authenticated. Please run 'wrangler login' first."
        exit 1
    fi
    
    # Deploy the worker
    wrangler deploy
    
    cd ../..
    
    print_status "Cloudflare Worker deployed ✅"
}

# Deploy frontend to Cloudflare Pages
deploy_frontend() {
    print_status "Deploying frontend to Cloudflare Pages..."
    
    cd web/frontend
    
    # Deploy using wrangler pages
    wrangler pages deploy dist --project-name faceswap-frontend
    
    cd ../..
    
    print_status "Frontend deployed to Cloudflare Pages ✅"
}

# Setup RunPod serverless function
setup_runpod() {
    print_status "Setting up RunPod serverless function..."
    
    print_warning "Please manually deploy the RunPod serverless function:"
    echo "1. Create a new serverless endpoint on RunPod"
    echo "2. Upload the handler.py and requirements.txt from web/runpod/serverless/"
    echo "3. Set the handler to 'handler.handler'"
    echo "4. Configure the environment with your models"
    echo "5. Update the RUNPOD_ENDPOINT_ID in wrangler.toml"
    
    print_status "RunPod setup instructions provided ✅"
}

# Main deployment function
main() {
    print_status "Face Swap Application Deployment Started"
    
    # Check if we're in the right directory
    if [ ! -f "project_structure.md" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    check_dependencies
    build_frontend
    deploy_worker
    deploy_frontend
    setup_runpod
    
    print_status "🎉 Deployment completed successfully!"
    print_warning "Don't forget to:"
    echo "1. Configure your R2 bucket and KV namespace in Cloudflare"
    echo "2. Set up your RunPod API keys and endpoint ID"
    echo "3. Update the ALLOWED_ORIGINS in wrangler.toml"
    echo "4. Test the application thoroughly"
}

# Run main function
main "$@" 