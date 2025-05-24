# Deployment Configuration

This document explains how to configure and deploy the face swap application in different environments.

## Model Path Configuration

The application automatically detects the environment and uses the appropriate model paths:

### Local Development
- **Models Directory**: `./models/`
- **Detection**: Checks if `/workspace/faceswap` exists (RunPod indicator)
- **Required Models**:
  - `inswapper_128_fp16.onnx` (264MB) - Face swapping model
  - `GFPGANv1.4.pth` (332MB) - Face enhancement model (optional)

### RunPod Deployment
- **Models Directory**: `/workspace/faceswap/`
- **Volume Mount**: Models should be directly in RunPod volume workspace
- **Required Files**: Model files should be in the workspace root

## Local Development Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   cd web/frontend && npm install
   ```

2. **Verify Models**:
   ```bash
   ls -la models/
   # Should show:
   # - inswapper_128_fp16.onnx (264MB)
   # - GFPGANv1.4.pth (332MB)
   ```

3. **Start Frontend**:
   ```bash
   cd web/frontend && npm run dev
   # Access: http://localhost:3001
   ```

4. **Test Backend** (Optional):
   ```bash
   python3 run.py
   ```

## RunPod Deployment

### 1. Volume Setup

Prepare your RunPod volume with the following structure:
```
/workspace/faceswap/
├── modules/                    # Core face swap modules
├── inswapper_128_fp16.onnx    # Face swapping model (REQUIRED)
├── GFPGANv1.4.pth            # Face enhancement model (REQUIRED for quality)
├── web/runpod/               # RunPod serverless handler
└── requirements.txt          # Python dependencies
```

### 2. Model Files

Download required models directly to your RunPod workspace:
```bash
# Connect to RunPod instance
cd /workspace/faceswap/

# Download inswapper model
curl -L https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx -o inswapper_128_fp16.onnx

# Download GFPGAN model (REQUIRED for high quality)
curl -L https://huggingface.co/hacksider/deep-live-cam/resolve/main/GFPGANv1.4.pth -o GFPGANv1.4.pth
```

### 3. Serverless Configuration

The `web/runpod/serverless/handler.py` automatically:
- Detects RunPod environment
- Uses `/workspace/faceswap/models/` for model loading
- Creates models directory if missing
- Loads face swap modules correctly

### 4. Cloudflare Integration

The Cloudflare Worker (`web/cloudflare/worker.js`) handles:
- File uploads to R2 storage
- Job queue management with KV storage
- Communication with RunPod serverless API
- Result retrieval and download

## Environment Detection

The application uses this logic to detect the environment:

```python
def get_models_dir():
    """Get models directory path, supporting both local development and RunPod deployment"""
    
    # Check if we're running in RunPod environment
    if os.path.exists('/workspace/faceswap'):
        # RunPod environment - models are directly in workspace
        models_dir = '/workspace/faceswap'
    else:
        # Local development - use relative path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(os.path.dirname(current_dir), 'models')
    
    return models_dir
```

## Testing

### Local Testing
```bash
# Test model paths
python3 -c "import os; print('Models exist:', os.path.exists('models/inswapper_128_fp16.onnx'))"

# Test frontend
cd web/frontend && npm run dev
```

### RunPod Testing
```bash
# In RunPod environment
python3 -c "import sys; sys.path.append('/workspace/faceswap'); import modules.globals; print('RunPod models:', modules.globals.get_models_dir())"
```

## Troubleshooting

### Common Issues

1. **Models not found**:
   - Verify model files exist in correct directory
   - Check file permissions (should be readable)
   - Ensure correct naming (case-sensitive)

2. **Import errors**:
   - Verify Python path includes `/workspace/faceswap`
   - Check all dependencies are installed
   - Verify OpenCV and other packages are available

3. **RunPod volume issues**:
   - Ensure volume is properly mounted
   - Check `/workspace/faceswap` exists
   - Verify write permissions for model downloads

### Debugging

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check model loading:
```python
from modules.processors.frame.face_swapper import get_face_swapper
swapper = get_face_swapper()  # Should load without errors
```

## Security Notes

- Model files are for **non-commercial research purposes only**
- Never commit model files to version control (they're in `.gitignore`)
- In production, ensure proper access controls to model storage
- Validate all file uploads and sanitize paths

## Performance

- **GPU**: Use CUDA providers when available
- **CPU**: Fallback for CPU-only environments
- **Memory**: Models require ~600MB RAM when loaded
- **Storage**: Total model size is ~596MB 