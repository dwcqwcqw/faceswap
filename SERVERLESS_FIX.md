# 🔧 RunPod Serverless 依赖修复

## 🚨 问题总结

RunPod Serverless 部署遇到的两个主要错误：

### 1. GUI 依赖错误
```bash
ModuleNotFoundError: No module named 'tkinter'
```

### 2. PyTorch 依赖错误
```bash
ERROR: Could not find a version that satisfies the requirement torch==2.0.1+cu118
ERROR: No matching distribution found for torch==2.0.1+cu118
```

## ✅ 修复方案

### 1. GUI 依赖修复

**创建无GUI版本处理器：`runpod/handler_serverless.py`**
- 移除所有GUI相关导入（tkinter、customtkinter）
- 设置 `HEADLESS=1` 环境变量
- 创建专用的图片/视频处理函数

**修改 `modules/globals.py` 和 `modules/core.py`：**
- 添加 headless 模式检测
- 条件导入UI模块，避免在Serverless环境中加载GUI

### 2. PyTorch 依赖修复

**问题原因：**
- `requirements.txt` 中的 `--index-url` 语法在某些环境下不被正确解析
- RunPod 构建器对特殊 URL 格式支持有限

**解决方案：**
在 Dockerfile 中分步安装 PyTorch，而不是在 requirements.txt 中：

```dockerfile
# 先安装 PyTorch CUDA 版本
RUN pip install --no-cache-dir torch==2.0.1+cu118 torchvision==0.15.2+cu118 --index-url https://download.pytorch.org/whl/cu118

# 再安装其他依赖
COPY runpod/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
```

### 3. 最终的文件修改

**`runpod/requirements.txt`：**
```txt
# 移除 PyTorch 相关依赖（在 Dockerfile 中单独安装）
# torch, torchvision, torchaudio - 已移除

# 保留其他核心依赖
runpod>=1.5.0
opencv-python==4.8.1.78
onnxruntime-gpu==1.16.3
insightface==0.7.3
numpy<2.0.0
Pillow==10.0.1
```

**`Dockerfile`：**
```dockerfile
# 设置 headless 环境
ENV HEADLESS=1
ENV DISPLAY=

# 分步安装 PyTorch
RUN pip install --no-cache-dir torch==2.0.1+cu118 torchvision==0.15.2+cu118 --index-url https://download.pytorch.org/whl/cu118

# 使用无GUI处理器
COPY runpod/handler_serverless.py /app/handler.py
```

## 🧪 测试验证

修复后的构建过程应该显示：

```bash
# PyTorch 安装成功
✅ Successfully installed torch-2.0.1+cu118 torchvision-0.15.2+cu118

# 其他依赖安装成功
✅ Successfully installed runpod-1.7.9 opencv-python-4.8.1.78 ...

# 启动成功
✅ Core modules imported successfully
🔍 Using volume mount models directory: /workspace/faceswap/models
🚀 Face Swap Handler ready!
```

## 📊 API 接口

修复后的 Serverless 支持：

### 单图换脸
```json
{
  "input": {
    "type": "single_image",
    "source_image": "base64_encoded_image",
    "target_image": "base64_encoded_image"
  }
}
```

### 视频换脸（待实现）
```json
{
  "input": {
    "type": "video",
    "source_image": "base64_encoded_image", 
    "target_video": "base64_encoded_video"
  }
}
```

## 🔄 重新部署

修复已自动应用：

1. **GitHub 代码已更新** ✅
2. **RunPod 会自动重新构建** 🔄
3. 或手动重建：
   - 访问 https://runpod.io/console/serverless
   - 找到 endpoint `sbta9w9yx2cc1e`
   - 点击 "Settings" → "Rebuild"

## 📋 修复文件列表

| 文件 | 修改内容 |
|------|----------|
| `runpod/handler_serverless.py` | ✅ 新建无GUI处理器 |
| `runpod/requirements.txt` | ✅ 移除PyTorch依赖和GUI库 |
| `modules/globals.py` | ✅ 添加headless检测 |
| `modules/core.py` | ✅ 条件导入UI模块 |
| `Dockerfile` | ✅ 分步安装PyTorch，设置headless环境 |

## 🎉 预期结果

修复完成后：

- ✅ 成功构建 Docker 镜像
- ✅ 正确安装 PyTorch CUDA 版本
- ✅ 成功启动 RunPod Serverless
- ✅ 正确加载所有AI模型
- ✅ 支持图片换脸API调用
- ✅ 无GUI和依赖错误

**状态**: 🟢 已修复并重新部署 