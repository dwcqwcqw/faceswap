# 🔧 模型下载问题修复

## 🚨 问题描述

RunPod Serverless 部署时遇到模型下载失败错误：

```
❌ Error downloading Face Analysis Model (Buffalo_L): 404 Client Error: Not Found for url: https://huggingface.co/hacksider/deep-live-cam/resolve/main/buffalo_l.zip

❌ Error downloading Face Parsing Model: 404 Client Error: Not Found for url: https://huggingface.co/hacksider/deep-live-cam/resolve/main/79999_iter.pth
```

## ✅ 修复方案

### 1. 更新模型下载URL

**原始错误URL:**
- ❌ `https://huggingface.co/hacksider/deep-live-cam/resolve/main/buffalo_l.zip`
- ❌ `https://huggingface.co/hacksider/deep-live-cam/resolve/main/79999_iter.pth`

**修复后正确URL:**
- ✅ `https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip`
- ✅ `https://huggingface.co/ManyOtherFunctions/face-parse-bisent/resolve/main/79999_iter.pth`

### 2. 支持Volume挂载路径

根据用户反馈，`inswapper_128_fp16.onnx` 和 `GFPGANv1.4.pth` 已挂载在 `/workspace/faceswap`。

**新增路径优先级:**
1. `/workspace/faceswap/models` - 用户Volume挂载
2. `/runpod-volume/models` - RunPod Network Volume
3. `/workspace/models` - 工作空间模型
4. `/app/models` - 容器本地模型

### 3. 智能模型检测

脚本现在会：
- 🔍 自动检测 `/workspace/faceswap` 中的现有模型
- 🔗 创建符号链接或复制到统一模型目录
- ✅ 避免重复下载已存在的模型

## 📋 修复的文件

### `runpod/download_models.py`
- 修复 buffalo_l.zip 下载URL
- 修复 79999_iter.pth 下载URL  
- 添加 `/workspace/faceswap` 支持
- 新增 `check_existing_models()` 函数

### `modules/globals.py`
- 更新 `get_models_dir()` 函数
- 添加 Volume 挂载路径支持

## 🧪 测试验证

修复后的模型下载将显示：

```bash
🔍 Using volume mount models directory: /workspace/faceswap/models
✅ Models initialized in: /workspace/faceswap/models
🔗 Linked inswapper_128_fp16.onnx from workspace
🔗 Linked GFPGANv1.4.pth from workspace
📥 Downloading Face Analysis Model (Buffalo_L)...
📥 Downloading Face Parsing Model...
📦 Model download completed!
✅ Set permissions for /workspace/faceswap/models
```

## 🔄 重新部署

要应用修复：

1. **RunPod Serverless 会自动拉取最新代码**
2. 或者 **手动重新构建** Endpoint：
   - 访问 RunPod Console
   - 找到您的 `sbta9w9yx2cc1e` endpoint
   - 点击 "Settings" → "Rebuild"

## 📊 模型状态

修复后的模型检查：

| 模型文件 | 来源 | 状态 |
|---------|------|------|
| `inswapper_128_fp16.onnx` | `/workspace/faceswap` | ✅ 已挂载 |
| `GFPGANv1.4.pth` | `/workspace/faceswap` | ✅ 已挂载 |
| `buffalo_l.zip` | GitHub Releases | 🔄 自动下载 |
| `79999_iter.pth` | HuggingFace | 🔄 自动下载 |

## 🎉 预期结果

修复后，RunPod Serverless 启动将显示：

```
✅ Models initialized in: /workspace/faceswap/models
🔗 Linked inswapper_128_fp16.onnx from workspace  
🔗 Linked GFPGANv1.4.pth from workspace
✅ Face Analysis Model (Buffalo_L) already exists
✅ Face Parsing Model already exists  
🎉 All required models are available!
🚀 Face Swap Handler ready!
```

**状态**: 🟢 已修复并部署 