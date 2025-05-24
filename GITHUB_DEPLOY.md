# 🚀 GitHub 直接部署 RunPod Serverless 指南

使用 GitHub 仓库直接部署到 RunPod Serverless，无需本地 Docker 构建。

## 🎯 优势

✅ **无需本地构建** - RunPod 服务器自动构建  
✅ **自动更新** - 代码推送后可快速重新部署  
✅ **简化流程** - 跳过 Docker Hub 推送步骤  
✅ **版本控制** - 直接从 Git 分支部署  

## 📋 前提条件

### 1. GitHub 仓库已就绪
您的代码已经同步到: https://github.com/dwcqwcqw/faceswap.git

### 2. 必要文件检查
确认以下文件存在：
- ✅ `Dockerfile` (已优化，无模型打包)
- ✅ `runpod/handler.py` (主处理函数)
- ✅ `runpod/requirements.txt` (Python 依赖)
- ✅ `runpod/download_models.py` (模型管理)
- ✅ `modules/` (核心模块)

## 🔧 RunPod Serverless 配置

### 步骤1：创建 Serverless Endpoint

1. 访问 [RunPod Console](https://runpod.io/console/serverless)
2. 点击 "Create Endpoint"

### 步骤2：选择 GitHub 源

在 "Source" 部分：

```yaml
Source Type: GitHub Repository
Repository: https://github.com/dwcqwcqw/faceswap.git
Branch: main
Build Context: /  # 根目录
Dockerfile Path: Dockerfile
```

### 步骤3：基本配置

```yaml
Endpoint Name: faceswap-api
GPU Types: RTX4090, RTXA6000, RTX3090
Max Workers: 3
Container Disk: 15 GB
Idle Timeout: 60 seconds
Execution Timeout: 300 seconds
```

### 步骤4：环境变量

在 "Environment Variables" 部分：

```yaml
CLOUDFLARE_ACCOUNT_ID: c7c141ce43d175e60601edc46d904553
R2_BUCKET_NAME: faceswap-storage
```

### 步骤5：机密变量 (Secrets)

在 "Secrets" 部分：

```yaml
R2_ACCESS_KEY_ID: [您的 Cloudflare R2 访问密钥]
R2_SECRET_ACCESS_KEY: [您的 Cloudflare R2 机密密钥]
```

### 步骤6：Network Volume (推荐)

为了最佳性能，添加 Volume：

1. 先创建 Network Volume：
   - Name: `faceswap-models`
   - Size: `20 GB`

2. 在 "Volume Mounts" 部分：
```yaml
Volume: faceswap-models
Mount Path: /runpod-volume
```

如果使用 Volume，将 Container Disk 减少到 `10 GB`

## 🏗️ 构建配置

RunPod 会自动读取您的 `Dockerfile` 并构建镜像。确保 Dockerfile 内容正确：

```dockerfile
# 确认关键部分
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04
WORKDIR /app

# 安装依赖
COPY runpod/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY modules/ /app/modules/
COPY locales/ /app/locales/
COPY runpod/handler.py /app/handler.py
COPY runpod/download_models.py /app/download_models.py

# 启动命令
CMD ["python", "-u", "handler.py"]
```

## 🔄 部署流程

### 1. 点击 "Create Endpoint"
RunPod 将：
- 从 GitHub 克隆仓库
- 读取 Dockerfile
- 构建 Docker 镜像
- 部署 Serverless 端点

### 2. 监控构建进度
在 "Build Logs" 中查看构建状态：
```
✅ Cloning repository...
✅ Building Docker image...
✅ Installing dependencies...
✅ Copying application files...
✅ Build completed!
```

### 3. 获取 Endpoint ID
构建完成后，复制生成的 Endpoint ID

## 🔗 前端集成

### 更新 Cloudflare Worker

```bash
cd web/cloudflare

# 设置 RunPod API 密钥
wrangler secret put RUNPOD_API_KEY
# 输入您的 RunPod API Key

# 设置 Endpoint ID
wrangler secret put RUNPOD_ENDPOINT_ID
# 输入刚获取的 Endpoint ID

# 部署更新
wrangler deploy
```

## 🧪 测试部署

### 1. 测试 API 连接
```bash
# 回到项目根目录
cd ../..

# 测试前端连接
node test-frontend.js
```

### 2. 测试单人换脸
```bash
curl -X POST "https://faceswap-api.faceswap.workers.dev/api/single-image" \
  -H "Content-Type: application/json" \
  -d '{
    "source_file": "https://example.com/source.jpg",
    "target_file": "https://example.com/target.jpg"
  }'
```

### 3. 启动前端
```bash
cd web/frontend && npm run dev
```

访问 http://localhost:3003 测试所有功能

## 🔄 代码更新流程

当您需要更新代码时：

### 1. 推送代码到 GitHub
```bash
git add .
git commit -m "Update face swap models"
git push origin main
```

### 2. 在 RunPod Console 中重新构建
1. 进入您的 Endpoint 设置
2. 点击 "Rebuild"
3. 等待构建完成

## 📊 构建时间估算

| 阶段 | 时间 | 说明 |
|------|------|------|
| 代码克隆 | 30秒 | 从 GitHub 下载代码 |
| 基础镜像拉取 | 2-3分钟 | 下载 PyTorch 基础镜像 |
| 依赖安装 | 3-5分钟 | 安装 Python 包 |
| 应用构建 | 1-2分钟 | 复制代码和设置 |
| **总计** | **7-11分钟** | 完整构建时间 |

## 🔍 监控和调试

### 查看构建日志
```bash
# 在 RunPod Console 中：
Endpoint → Build History → View Logs
```

### 查看运行时日志
```bash
# 在 RunPod Console 中：
Endpoint → Logs → Real-time logs
```

### 常见构建问题

1. **依赖安装失败**
   ```bash
   # 检查 runpod/requirements.txt 格式
   # 确保版本兼容性
   ```

2. **文件路径错误**
   ```bash
   # 检查 Dockerfile 中的 COPY 路径
   # 确保相对路径正确
   ```

3. **模型下载超时**
   ```bash
   # 使用 Network Volume 预装模型
   # 或增加构建超时时间
   ```

## 🎉 完成清单

部署完成后检查：

- [ ] ✅ Endpoint 状态显示 "Active"
- [ ] ✅ Build 状态显示 "Success"  
- [ ] ✅ 测试 API 调用成功
- [ ] ✅ 前端连接正常
- [ ] ✅ 模型文件加载成功
- [ ] ✅ 换脸功能测试通过

---

🎯 **GitHub 直接部署的优势：更简单、更自动化、更易维护！** 