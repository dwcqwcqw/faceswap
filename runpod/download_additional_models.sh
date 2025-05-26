#!/bin/bash

# RunPod Volume - Additional Models Download Script
# 在Volume终端中运行此脚本来下载所有额外的模型

echo "🚀 Starting additional models download for multi-person video processing..."
echo "📁 Current directory: $(pwd)"

# 确保在正确的目录
if [[ ! -d "faceswap" ]]; then
    echo "⚠️ faceswap directory not found. Creating it..."
    mkdir -p faceswap
fi

cd faceswap
echo "📁 Working in: $(pwd)"

# 创建GFPGAN weights目录
mkdir -p gfpgan/weights
echo "📁 Created gfpgan/weights directory"

echo ""
echo "📥 Downloading additional models..."
echo "=================================================="

# 1. GFPGAN v1.3 (更自然的结果)
echo "📥 [1/10] Downloading GFPGANv1.3.pth (332MB)..."
wget -c "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth" \
    -O GFPGANv1.3.pth
echo "✅ GFPGANv1.3.pth downloaded"

# 2. GFPGAN v1.4 (最新版本)
echo "📥 [2/10] Downloading GFPGANv1.4.pth (332MB)..."
wget -c "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth" \
    -O GFPGANv1.4.pth
echo "✅ GFPGANv1.4.pth downloaded"

# 3. RetinaFace ResNet50 检测模型 (高精度人脸检测)
echo "📥 [3/10] Downloading detection_Resnet50_Final.pth (109MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth" \
    -O detection_Resnet50_Final.pth
echo "✅ detection_Resnet50_Final.pth downloaded"

# 4. MobileNet 检测模型 (轻量级快速检测)
echo "📥 [4/10] Downloading detection_mobilenet0.25_Final.pth (1.7MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_mobilenet0.25_Final.pth" \
    -O detection_mobilenet0.25_Final.pth
echo "✅ detection_mobilenet0.25_Final.pth downloaded"

# 5. ParseNet 人脸解析模型 (多人视频处理)
echo "📥 [5/10] Downloading parsing_parsenet.pth (85MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth" \
    -O parsing_parsenet.pth
echo "✅ parsing_parsenet.pth downloaded"

# 6. WFLW 人脸对齐模型 (精确关键点检测)
echo "📥 [6/10] Downloading alignment_WFLW_4HG.pth (59MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.2.0/alignment_WFLW_4HG.pth" \
    -O alignment_WFLW_4HG.pth
echo "✅ alignment_WFLW_4HG.pth downloaded"

# 7. HopeNet 头部姿态估计模型
echo "📥 [7/10] Downloading headpose_hopenet_alpha1.pth (23MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.2.0/headpose_hopenet_alpha1.pth" \
    -O headpose_hopenet_alpha1.pth
echo "✅ headpose_hopenet_alpha1.pth downloaded"

# 8. MODNet 肖像抠图模型
echo "📥 [8/10] Downloading matting_modnet_photographic_portrait_matting.ckpt (24MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.2.0/matting_modnet_photographic_portrait_matting.ckpt" \
    -O matting_modnet_photographic_portrait_matting.ckpt
echo "✅ matting_modnet_photographic_portrait_matting.ckpt downloaded"

# 9. ArcFace 人脸识别模型
echo "📥 [9/10] Downloading recognition_arcface_ir_se50.pth (92MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.2.0/recognition_arcface_ir_se50.pth" \
    -O recognition_arcface_ir_se50.pth
echo "✅ recognition_arcface_ir_se50.pth downloaded"

# 10. HyperIQA 图像质量评估模型
echo "📥 [10/10] Downloading assessment_hyperIQA.pth (112MB)..."
wget -c "https://github.com/xinntao/facexlib/releases/download/v0.2.0/assessment_hyperIQA.pth" \
    -O assessment_hyperIQA.pth
echo "✅ assessment_hyperIQA.pth downloaded"

echo ""
echo "🔗 Creating symbolic links in gfpgan/weights directory..."
echo "=================================================="

# 为GFPGAN相关模型创建软链接
ln -sf "$(pwd)/detection_Resnet50_Final.pth" "gfpgan/weights/detection_Resnet50_Final.pth"
ln -sf "$(pwd)/parsing_parsenet.pth" "gfpgan/weights/parsing_parsenet.pth"
ln -sf "$(pwd)/detection_mobilenet0.25_Final.pth" "gfpgan/weights/detection_mobilenet0.25_Final.pth"
ln -sf "$(pwd)/alignment_WFLW_4HG.pth" "gfpgan/weights/alignment_WFLW_4HG.pth"
ln -sf "$(pwd)/headpose_hopenet_alpha1.pth" "gfpgan/weights/headpose_hopenet_alpha1.pth"
ln -sf "$(pwd)/matting_modnet_photographic_portrait_matting.ckpt" "gfpgan/weights/matting_modnet_photographic_portrait_matting.ckpt"
ln -sf "$(pwd)/recognition_arcface_ir_se50.pth" "gfpgan/weights/recognition_arcface_ir_se50.pth"
ln -sf "$(pwd)/assessment_hyperIQA.pth" "gfpgan/weights/assessment_hyperIQA.pth"

echo "✅ Symbolic links created in gfpgan/weights/"

echo ""
echo "📊 Verifying downloads..."
echo "=================================================="

# 验证下载的文件
total_size=0
file_count=0

for file in GFPGANv1.3.pth GFPGANv1.4.pth detection_Resnet50_Final.pth detection_mobilenet0.25_Final.pth parsing_parsenet.pth alignment_WFLW_4HG.pth headpose_hopenet_alpha1.pth matting_modnet_photographic_portrait_matting.ckpt recognition_arcface_ir_se50.pth assessment_hyperIQA.pth; do
    if [[ -f "$file" ]]; then
        size=$(du -h "$file" | cut -f1)
        echo "✅ $file ($size)"
        file_count=$((file_count + 1))
        # 计算总大小（以字节为单位）
        size_bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
        total_size=$((total_size + size_bytes))
    else
        echo "❌ $file (missing)"
    fi
done

# 转换总大小为MB
total_size_mb=$((total_size / 1024 / 1024))

echo ""
echo "🎉 Download Summary:"
echo "=================================================="
echo "✅ Successfully downloaded: $file_count/10 models"
echo "📊 Total size: ${total_size_mb}MB"
echo "📁 Location: $(pwd)"
echo ""
echo "🚀 All additional models are ready for multi-person video processing!"
echo "💡 These models will be automatically detected by the RunPod serverless handler."

# 显示目录结构
echo ""
echo "📁 Final directory structure:"
echo "=================================================="
ls -la
echo ""
echo "📁 gfpgan/weights/ directory:"
ls -la gfpgan/weights/

echo ""
echo "✅ Setup completed! You can now use enhanced multi-person video processing features." 