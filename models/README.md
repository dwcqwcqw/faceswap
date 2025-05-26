# Required Models

This directory should contain the following model files for the face swap application to work:

## Required Models

### 1. Face Swapping Model
- **File**: `inswapper_128_fp16.onnx`
- **Size**: ~264MB
- **Download**: [Hugging Face](https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx)
- **Alternative**: [ComfyUI Repository](https://huggingface.co/fofr/comfyui/resolve/main/insightface/inswapper_128_fp16.onnx)

### 2. Face Enhancement Model (Optional)
- **File**: `GFPGANv1.4.pth`
- **Size**: ~332MB
- **Download**: [Hugging Face](https://huggingface.co/hacksider/deep-live-cam/resolve/main/GFPGANv1.4.pth)

### 3. Super Resolution Models (Optional but Recommended)
- **File**: `RealESRGAN_x4plus.pth`
- **Size**: ~64MB
- **Download**: [GitHub](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth)
- **Description**: AI Super Resolution model for 4x upscaling

- **File**: `RealESRGAN_x2plus.pth`  
- **Size**: ~64MB
- **Download**: [GitHub](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth)
- **Description**: AI Super Resolution model for 2x upscaling

## Download Instructions

### Option 1: Manual Download
1. Download the files from the links above
2. Place them in this `models/` directory
3. The directory structure should look like:
   ```
   models/
   ├── inswapper_128_fp16.onnx
   ├── GFPGANv1.4.pth (optional)
   ├── RealESRGAN_x4plus.pth (optional)
   ├── RealESRGAN_x2plus.pth (optional)
   └── README.md (this file)
   ```

### Option 2: Command Line Download
```bash
# Navigate to the models directory
cd models/

# Download inswapper model
curl -L https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx -o inswapper_128_fp16.onnx

# Download GFPGAN model (optional, for face enhancement)
curl -L https://huggingface.co/hacksider/deep-live-cam/resolve/main/GFPGANv1.4.pth -o GFPGANv1.4.pth

# Download RealESRGAN models (optional, for super resolution)
curl -L https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -o RealESRGAN_x4plus.pth
curl -L https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth -o RealESRGAN_x2plus.pth
```

### Option 3: Using wget
```bash
cd models/
wget https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx
wget https://huggingface.co/hacksider/deep-live-cam/resolve/main/GFPGANv1.4.pth
wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth
```

## Verification

After downloading, verify the files:
```bash
ls -la models/
# Should show both .onnx and .pth files with correct sizes
```

## Notes

- **inswapper_128_fp16.onnx** is **required** for face swapping functionality
- **GFPGANv1.4.pth** is **optional** and used for face enhancement
- **RealESRGAN_x4plus.pth** and **RealESRGAN_x2plus.pth** are **optional** and used for super resolution
- Models are not included in the repository due to their large size (596MB total)
- First run will be slower as the application loads these models
- These models are for **non-commercial research purposes only**

## Troubleshooting

If you encounter download issues:
1. Check your internet connection
2. Try the alternative download links
3. Use a VPN if Hugging Face is blocked in your region
4. Download manually through a web browser 