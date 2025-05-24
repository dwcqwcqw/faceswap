# 🔧 RunPod Serverless GUI 依赖修复

## 🚨 问题描述

RunPod Serverless 部署时遇到以下错误：

```bash
ModuleNotFoundError: No module named 'tkinter'
```

**错误原因：**
- 原代码包含GUI依赖（tkinter、customtkinter）
- RunPod Serverless 容器不支持GUI库
- NumPy 2.0 兼容性问题

## ✅ 修复方案

### 1. 创建无GUI版本处理器

**新文件：`runpod/handler_serverless.py`**
- 移除所有GUI相关导入
- 设置 `HEADLESS=1` 环境变量
- 创建专用的图片/视频处理函数

### 2. 修复依赖问题

**更新 `runpod/requirements.txt`：**
```txt
# 固定NumPy版本避免兼容性问题
numpy<2.0.0

# 移除GUI依赖
# customtkinter  # 已移除
# tkinter        # 不支持

# 固定核心依赖版本
torch==2.0.1+cu118
torchvision==0.15.2+cu118
onnxruntime-gpu==1.16.3
```

### 3. Headless 模式支持

**修改 `modules/globals.py`：**
```python
# 检测 headless 模式
headless = (os.environ.get('HEADLESS', 'false').lower() == 'true' or 
           os.environ.get('DISPLAY', '') == '')
```

**修改 `modules/core.py`：**
```python
# 条件导入UI模块
if not is_headless:
    try:
        import modules.ui as ui
    except ImportError:
        ui = MockUI()
else:
    ui = MockUI()
```

### 4. 更新 Dockerfile

**修改后的 `Dockerfile`：**
```dockerfile
# 设置headless环境变量
ENV HEADLESS=1
ENV DISPLAY=

# 移除GUI依赖
RUN pip install --no-cache-dir \
    typing-extensions>=4.8.0 \
    cv2_enumerate_cameras==1.1.15 \
    psutil==5.9.8 \
    opennsfw2==0.10.2 \
    protobuf==4.23.2
    # customtkinter 已移除

# 使用无GUI处理器
COPY runpod/handler_serverless.py /app/handler.py
```

## 🧪 测试验证

修复后的启动日志应显示：

```bash
✅ Core modules imported successfully
🔍 Using volume mount models directory: /workspace/faceswap/models
🔗 Linked inswapper_128_fp16.onnx from workspace
🔗 Linked GFPGANv1.4.pth from workspace
📥 Downloading Face Analysis Model (Buffalo_L)...
✅ Models ready in: /workspace/faceswap/models
🚀 Face Swap Handler ready!
```

## 📊 API 接口

修复后的 Serverless 支持以下请求格式：

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

要应用修复：

1. **RunPod Console 自动拉取最新代码**
2. 或者手动重建 Endpoint：
   - 访问 https://runpod.io/console/serverless
   - 找到 endpoint `sbta9w9yx2cc1e`
   - 点击 "Settings" → "Rebuild"

## 📋 修复文件列表

| 文件 | 修改内容 |
|------|----------|
| `runpod/handler_serverless.py` | ✅ 新建无GUI处理器 |
| `runpod/requirements.txt` | ✅ 移除GUI依赖，固定版本 |
| `modules/globals.py` | ✅ 添加headless检测 |
| `modules/core.py` | ✅ 条件导入UI模块 |
| `Dockerfile` | ✅ 设置headless环境 |

## 🎉 预期结果

修复完成后：

- ✅ 成功启动 RunPod Serverless
- ✅ 正确加载所有AI模型
- ✅ 支持图片换脸API调用
- ✅ 无GUI依赖错误
- ✅ NumPy兼容性问题解决

**状态**: 🟢 已修复并部署 