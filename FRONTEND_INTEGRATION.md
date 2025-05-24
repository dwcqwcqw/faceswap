# 🔗 前端集成配置指南

恭喜您的 RunPod Serverless Worker 部署成功！现在需要配置前端和后端的连接。

## 📋 需要的信息

请提供以下信息来完成集成：

### 1. 🔑 RunPod API Key
```bash
# 在 RunPod Console 中获取：
# 1. 访问：https://runpod.io/console/user/settings
# 2. 点击 "API Keys" 标签
# 3. 点击 "Create API Key" 
# 4. 复制生成的 API Key

格式：runpod-api-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. 🎯 Endpoint ID
```bash
# 在您的 Serverless Endpoint 页面获取：
# 1. 访问：https://runpod.io/console/serverless
# 2. 点击您的 "faceswap-api" endpoint
# 3. 复制 Endpoint ID

格式：abc123def456789ghi
```

### 3. ✅ 验证信息

请确认以下状态：
- [ ] Endpoint Status: **Active** 
- [ ] Build Status: **Success**
- [ ] Worker Status: **Ready**

## 🔧 配置步骤

一旦您提供了上述信息，我将帮您：

### Step 1: 更新 Cloudflare Worker 配置

```bash
# 配置 RunPod 集成
cd web/cloudflare

# 设置 API Key (保密信息)
wrangler secret put RUNPOD_API_KEY
# 输入您的：runpod-api-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 设置 Endpoint ID (保密信息)  
wrangler secret put RUNPOD_ENDPOINT_ID
# 输入您的：abc123def456789ghi

# 部署更新
wrangler deploy
```

### Step 2: 测试 API 连接

```bash
# 测试前端到后端连接
node test-frontend.js

# 测试 RunPod 集成
curl -X POST "https://faceswap-api.faceswap.workers.dev/api/detect-faces" \
  -H "Content-Type: application/json" \
  -d '{"image_file": "test_url"}'
```

### Step 3: 启动前端开发

```bash
# 启动前端开发服务器
cd web/frontend
npm run dev

# 访问 http://localhost:3003
```

## 🏗️ 集成架构

```yaml
用户界面 (React):
  ↓ (上传文件)
前端 (localhost:3003):
  ↓ (API 调用)
Cloudflare Worker (faceswap-api.faceswap.workers.dev):
  ↓ (发送任务)
RunPod Serverless (您的 Endpoint):
  ↓ (AI 处理)
结果存储 (Cloudflare R2):
  ↓ (下载结果)
用户界面 (React)
```

## 🧪 测试流程

### 1. 单人图片换脸测试

```bash
# API 测试
curl -X POST "https://faceswap-api.faceswap.workers.dev/api/process/single-image" \
  -H "Content-Type: application/json" \
  -d '{
    "source_file": "uploaded_file_id",
    "target_file": "uploaded_file_id",
    "options": {}
  }'
```

### 2. 检查处理状态

```bash
# 状态查询
curl "https://faceswap-api.faceswap.workers.dev/api/status/{job_id}"
```

### 3. 前端完整测试

```bash
# 访问前端界面
open http://localhost:3003

# 测试功能：
# 1. 上传源人脸图片 ✅
# 2. 上传目标图片 ✅  
# 3. 点击开始换脸 ✅
# 4. 查看处理进度 ✅
# 5. 下载处理结果 ✅
```

## 📊 处理流程

### 文件处理流程
1. **用户上传** → Cloudflare R2 存储
2. **发起处理** → RunPod Serverless 处理
3. **AI 计算** → GPU 加速换脸算法
4. **结果存储** → Cloudflare R2 存储
5. **用户下载** → 前端界面展示

### 支持的处理类型
- ✅ **single-image** - 单人图片换脸
- ✅ **multi-image** - 多人图片换脸  
- ✅ **single-video** - 单人视频换脸
- ✅ **multi-video** - 多人视频换脸
- ✅ **detect-faces** - 人脸检测

## ⚡ 性能优化

### 当前配置
- **冷启动时间**: 15-30秒 (优化后)
- **图片处理**: 5-15秒/张
- **视频处理**: 30秒-5分钟
- **并发处理**: 最多 3 个 worker

### 成本估算
- **按需付费**: 仅处理时计费
- **存储费用**: 很低 (Cloudflare R2)
- **计算费用**: ~$0.25-0.50/小时 (根据 GPU 类型)

---

## 🎯 准备好了吗？

请提供以下信息，我将立即为您完成配置：

1. **RunPod API Key**: `runpod-api-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
2. **Endpoint ID**: `abc123def456789ghi`
3. **确认状态**: Endpoint 是否显示 "Active" 和 "Success"

提供信息后，我将在 **5 分钟内**完成所有配置！🚀 