# Cloudflare R2 Storage Setup

## 概述

本文档介绍如何配置Cloudflare R2存储来存储和管理FaceSwap应用的文件。

## R2配置信息

- **账户ID**: `c7c141ce43d175e60601edc46d904553`
- **R2 Access Key ID**: `5885b29961ce9fc2b593139d9de52f81`
- **R2 Secret Access Key**: `a4415c670e669229db451ea7b38544c0a2e44dbe630f1f35f99f28a27593d181`
- **Bucket名称**: `faceswap-storage`

## 文件存储架构

```
faceswap-storage/
├── uploads/          # 用户上传的文件 (24小时后自动清理)
│   ├── {fileId}.jpg
│   ├── {fileId}.png
│   └── {fileId}.mp4
└── results/          # 处理后的结果文件 (7天后自动清理)
    ├── single_image_{jobId}_{timestamp}.jpg
    ├── multi_image_{jobId}_{timestamp}.jpg
    ├── single_video_{jobId}_{timestamp}.mp4
    └── multi_video_{jobId}_{timestamp}.mp4
```

## 部署步骤

### 1. 安装Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录Cloudflare

```bash
wrangler login
```

### 3. 运行部署脚本

```bash
./scripts/deploy-cloudflare.sh
```

### 4. 手动设置敏感信息

```bash
# 进入Cloudflare目录
cd web/cloudflare

# 设置RunPod API密钥
wrangler secret put RUNPOD_API_KEY
# 输入你的RunPod API密钥

# 设置RunPod Endpoint ID
wrangler secret put RUNPOD_ENDPOINT_ID
# 输入你的RunPod Endpoint ID
```

## 环境变量

### Cloudflare Worker环境变量

在`wrangler.toml`中配置的变量：

```toml
[vars]
CLOUDFLARE_ACCOUNT_ID = "c7c141ce43d175e60601edc46d904553"
R2_BUCKET_NAME = "faceswap-storage"
R2_ACCESS_KEY_ID = "5885b29961ce9fc2b593139d9de52f81"
```

### Cloudflare Worker密钥

使用`wrangler secret put`设置的敏感信息：

- `R2_SECRET_ACCESS_KEY`: R2访问密钥
- `RUNPOD_API_KEY`: RunPod API密钥
- `RUNPOD_ENDPOINT_ID`: RunPod端点ID

### RunPod环境变量

在RunPod部署时需要设置：

```bash
CLOUDFLARE_ACCOUNT_ID=c7c141ce43d175e60601edc46d904553
R2_ACCESS_KEY_ID=5885b29961ce9fc2b593139d9de52f81
R2_SECRET_ACCESS_KEY=a4415c670e669229db451ea7b38544c0a2e44dbe630f1f35f99f28a27593d181
R2_BUCKET_NAME=faceswap-storage
```

## API端点

部署完成后，以下端点将可用：

### 文件上传
```
POST /api/upload
Content-Type: multipart/form-data
Body: file=<image/video file>
```

### 处理请求
```
POST /api/process/single-image
POST /api/process/multi-image
POST /api/process/single-video
POST /api/process/multi-video
```

### 状态查询
```
GET /api/status/{jobId}
```

### 文件下载
```
GET /api/download/{fileId}
```

### 人脸检测
```
POST /api/detect-faces
Body: { "fileId": "upload-file-id" }
```

## 文件生命周期

- **上传文件**: 24小时后自动删除
- **结果文件**: 7天后自动删除
- **临时文件**: 处理完成后立即删除

## 成本优化

### 免费额度
- **R2存储**: 10GB/月
- **Class A操作**: 1,000,000次/月 (上传)
- **Class B操作**: 10,000,000次/月 (下载)

### 推荐设置
- 自动清理策略已配置
- 使用高效的文件格式 (JPG for images, MP4 for videos)
- 启用压缩以减少存储成本

## 安全考虑

1. **访问控制**: R2访问密钥仅用于应用，不暴露给前端
2. **CORS配置**: 已正确配置跨域访问
3. **文件验证**: 上传时验证文件类型和大小
4. **临时URL**: 考虑使用预签名URL增强安全性

## 故障排除

### 常见问题

1. **上传失败**
   - 检查R2配置是否正确
   - 验证bucket是否存在
   - 确认网络连接

2. **下载失败**
   - 检查文件是否存在
   - 验证文件权限
   - 检查CORS配置

3. **处理超时**
   - 大文件可能需要更长处理时间
   - 检查RunPod连接状态
   - 验证GPU资源可用性

### 调试命令

```bash
# 查看bucket内容
wrangler r2 object list faceswap-storage

# 检查worker日志
wrangler tail

# 测试worker
curl -X POST https://your-worker.workers.dev/api/upload
``` 