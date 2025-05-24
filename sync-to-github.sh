#!/bin/bash

# GitHub 同步脚本
# 目标仓库: https://github.com/dwcqwcqw/faceswap.git

set -e

echo "🔄 同步代码到 GitHub..."

# 配置
REMOTE_REPO="https://github.com/dwcqwcqw/faceswap.git"
BRANCH="main"

# 检查是否在 git 仓库中
if [ ! -d ".git" ]; then
    echo "📋 初始化 Git 仓库..."
    git init
    git remote add origin $REMOTE_REPO
else
    echo "📋 检查远程仓库..."
    # 更新远程仓库地址（如果不匹配）
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
    if [ "$CURRENT_REMOTE" != "$REMOTE_REPO" ]; then
        echo "🔧 更新远程仓库地址..."
        git remote set-url origin $REMOTE_REPO
    fi
fi

# 检查分支
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "🌿 切换到 $BRANCH 分支..."
    git checkout -b $BRANCH 2>/dev/null || git checkout $BRANCH
fi

# 添加所有文件（除了 .gitignore 中的）
echo "📁 添加文件..."
git add .

# 检查是否有变更
if git diff --staged --quiet; then
    echo "ℹ️  没有新的变更需要提交"
else
    # 提交变更
    COMMIT_MSG="🚀 Face Swap Project - Docker & RunPod Serverless Ready

基于 Deep-Live-Cam 项目的完整换脸解决方案

新增功能:
- ✅ Docker 镜像配置 (RunPod Serverless 兼容)
- ✅ 完整的前端应用 (React + TypeScript)
- ✅ Cloudflare Workers 后端 API
- ✅ R2 对象存储集成
- ✅ 4种换脸功能: 单人图片、多人图片、单人视频、多人视频

模型支持:
- inswapper_128_fp16.onnx (换脸模型)
- GFPGANv1.4.pth (人脸增强)
- buffalo_l (人脸分析)

部署就绪:
- Docker 镜像: faceswap-runpod:latest
- RunPod Serverless 配置
- GitHub 代码同步

来源: https://github.com/hacksider/Deep-Live-Cam"

    echo "💾 提交变更..."
    git commit -m "$COMMIT_MSG"
fi

# 推送到 GitHub
echo "🚀 推送到 GitHub..."
git push -u origin $BRANCH

echo "✅ 同步完成！"
echo ""
echo "🔗 GitHub 仓库: $REMOTE_REPO"
echo "📋 分支: $BRANCH"
echo ""
echo "📦 下一步:"
echo "1. 构建 Docker 镜像: ./build-docker.sh"
echo "2. 推送到 Docker Hub"
echo "3. 在 RunPod 创建 Serverless Endpoint"
echo "4. 配置前端 API 密钥" 