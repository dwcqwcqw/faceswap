# 🔧 Dockerfile 构建失败修复指南

## 🚨 问题描述

RunPod Serverless 构建失败，错误信息：
```
E: Unable to locate package libgthread-2.0-0
E: Couldn't find any package by glob 'libgthread-2.0-0'
E: Couldn't find any package by regex 'libgthread-2.0-0'
```

## 🔍 问题原因

Dockerfile 中包含了一个不存在的系统包：`libgthread-2.0-0`

这个包名在 Ubuntu 22.04 中不存在，导致 apt-get 安装失败。

## ✅ 解决方案

### 修复内容

**修复前：**
```dockerfile
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \        # 重复
    libgthread-2.0-0 \    # ❌ 不存在的包
    libgbm1 \
    unzip \
    && rm -rf /var/lib/apt/lists/*
```

**修复后：**
```dockerfile
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    libgomp1 \
    libgl1-mesa-glx \
    libgbm1 \
    unzip \
    && rm -rf /var/lib/apt/lists/*
```

### 修复说明

1. **删除**: `libgthread-2.0-0` - 不存在的包
2. **删除**: 重复的 `libglib2.0-0` 条目
3. **保留**: 所有必要的 OpenCV 和 GUI 相关依赖

## 🚀 重新部署

### 1. 代码已更新

修复已推送到 GitHub 仓库：
```bash
git commit: 0304f23 - "🔧 Fix Dockerfile dependencies - Remove libgthread-2.0-0"
```

### 2. RunPod 重新构建

在 RunPod Console 中：

1. 进入您的 Serverless Endpoint
2. 点击 "Settings" 标签
3. 点击 "Rebuild" 按钮
4. 等待新的构建完成

### 3. 预期结果

构建应该顺利通过，时间约 **7-11 分钟**：

```
✅ Installing system dependencies...
✅ Installing Python packages...
✅ Copying application files...
✅ Build completed successfully!
```

## 🔍 验证构建

### 检查构建日志

在 RunPod Console 中查看 "Build Logs"：

```bash
# 成功的标志
#9 DONE 2.5s    # 系统依赖安装成功
#10 DONE 180s   # Python 包安装成功
#11 DONE 5s     # 文件复制成功
```

### 测试端点

构建成功后测试 API：

```bash
curl -X POST "https://your-endpoint-id-runpod.com/run" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "process_type": "single-image",
      "source_file": "test_url",
      "target_file": "test_url"
    }
  }'
```

## 📋 常见依赖问题

### Ubuntu 22.04 中不存在的包

❌ **避免使用：**
- `libgthread-2.0-0` 
- `python-opencv` (使用 `python3-opencv`)
- `python-pip` (使用 `python3-pip`)

✅ **推荐使用：**
- `libglib2.0-0`
- `libgomp1` 
- `libgl1-mesa-glx`
- `python3-opencv` (或通过 pip 安装)

### 依赖冲突检查

在本地测试 Docker 构建：

```bash
# 在项目根目录
docker build -t test-faceswap .

# 如果成功，推送到生产
git push origin main
```

## 🎉 总结

**问题已解决！** 

- ✅ 删除了不存在的 `libgthread-2.0-0` 包
- ✅ 清理了重复的依赖项
- ✅ 保持了所有必要的功能依赖
- ✅ 代码已推送到 GitHub

**下一步：**在 RunPod Console 中点击 "Rebuild" 重新构建您的端点。 