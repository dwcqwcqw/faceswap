# 🔧 Model Path Troubleshooting Guide

## Quick Fix for "model_file should exist" Error

If you're getting the error:
```
Processing failed: ❌ Face swapper model not found. Searched paths: ...
```

### 1. 🚀 Automatic Fix (Recommended)

Run the automatic model download script:
```bash
# In your RunPod container
cd /app
python runpod/download_missing_models.py
```

This will:
- ✅ Check if models exist in `/workspace/faceswap/`
- ✅ Download missing models automatically
- ✅ Verify file integrity

### 2. 🔍 Debug Current State

Check what's currently available:
```bash
# Test model detection
python test_model_detection.py

# Manual check
ls -la /workspace/faceswap/
ls -la /workspace/faceswap/inswapper_128_fp16.onnx
```

### 3. 📥 Manual Download (If Automatic Fails)

```bash
# Create directory
mkdir -p /workspace/faceswap

# Download the face swapper model
wget https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx \
     -O /workspace/faceswap/inswapper_128_fp16.onnx

# Download the face enhancer model (optional but recommended)
wget https://huggingface.co/hacksider/deep-live-cam/resolve/main/GFPGANv1.4.pth \
     -O /workspace/faceswap/GFPGANv1.4.pth

# Verify files
ls -la /workspace/faceswap/
```

### 4. 🔧 Advanced Debugging

If models still not found, check the detailed logs:

```bash
# The enhanced detection now shows detailed debugging:
# 🔍 Searching for face swapper model...
#    Primary models_dir: /app/models
#    Primary exists: False
#    Primary path not found, checking alternatives...
#    Alternative 1: /workspace/faceswap/inswapper_128_fp16.onnx
#      exists: True, is_file: True, readable: True
# ✅ Found model at alternative path: /workspace/faceswap/inswapper_128_fp16.onnx
```

Look for:
- **exists**: Should be `True`
- **is_file**: Should be `True`  
- **readable**: Should be `True`

### 5. 🐛 Common Issues

#### Issue: File exists but readable = False
```bash
# Fix permissions
chmod 644 /workspace/faceswap/inswapper_128_fp16.onnx
chown root:root /workspace/faceswap/inswapper_128_fp16.onnx
```

#### Issue: Directory doesn't exist
```bash
# Create the directory structure
mkdir -p /workspace/faceswap
```

#### Issue: File is corrupted (size = 0)
```bash
# Remove and re-download
rm /workspace/faceswap/inswapper_128_fp16.onnx
python runpod/download_missing_models.py
```

### 6. ✅ Verification

After fixing, test that it works:
```bash
# Test model loading
python test_model_detection.py

# Should show:
# 🎉 Face swapper model loaded successfully!
```

### 7. 🔄 If Still Not Working

1. **Check RunPod Volume Mount**: Ensure `/workspace` is properly mounted
2. **Check Container Permissions**: RunPod container should have read/write access
3. **Try Alternative Path**: Copy model to `/app/models/` instead:
   ```bash
   mkdir -p /app/models
   cp /workspace/faceswap/inswapper_128_fp16.onnx /app/models/
   ```

### 8. 📞 Get Help

If nothing works, run the debug script and share the output:
```bash
python test_model_detection.py > model_debug.log 2>&1
cat model_debug.log
```

The detailed output will help identify the exact issue.

---

## Model Files Required

| File | Size | Description |
|------|------|-------------|
| `inswapper_128_fp16.onnx` | ~554MB | Main face swapper model (required) |
| `GFPGANv1.4.pth` | ~349MB | Face enhancer model (optional) |

## Expected File Structure

```
/workspace/faceswap/
├── inswapper_128_fp16.onnx  ← This file must exist
├── GFPGANv1.4.pth          ← Optional but recommended
└── other files...
``` 