# 🚀 RunPod Serverless 部署指南

基于 [Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam) 项目的换脸 API 服务部署

## 📋 准备工作

### 1. 所需账户
- [Docker Hub](https://hub.docker.com/) 账户（用于存储镜像）
- [RunPod](https://runpod.io/) 账户（用于运行服务）
- [Cloudflare](https://cloudflare.com/) 账户（已配置 R2 存储）

### 2. 本地环境要求
- Docker 安装并运行
- Git 客户端
- 至少 10GB 可用磁盘空间

## 🔨 构建 Docker 镜像

### 步骤1：构建镜像
```bash
# 构建 Docker 镜像
./build-docker.sh

# 或者指定版本标签
./build-docker.sh v1.0
```

### 步骤2：推送到 Docker Hub
```bash
# 替换为您的 Docker Hub 用户名
DOCKER_USERNAME="your-dockerhub-username"

# 标记镜像
docker tag faceswap-runpod:latest $DOCKER_USERNAME/faceswap-runpod:latest

# 登录 Docker Hub
docker login

# 推送镜像
docker push $DOCKER_USERNAME/faceswap-runpod:latest
```

## 🔧 RunPod 配置

### 步骤1：创建 Serverless Endpoint

1. 登录 [RunPod Console](https://runpod.io/console/serverless)
2. 点击 "New Endpoint"
3. 配置以下设置：

**基本设置**
- Name: `faceswap-api`
- Docker Image: `your-dockerhub-username/faceswap-runpod:latest`
- Container Disk: `25 GB`

**环境变量**
```
CLOUDFLARE_ACCOUNT_ID=c7c141ce43d175e60601edc46d904553
R2_BUCKET_NAME=faceswap-storage
```

**机密变量**（Secrets）
```
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
```

**GPU设置**
- Preferred GPU: RTX 4090, RTX A6000, RTX 3090
- Max Workers: 3
- Idle Timeout: 60 秒
- Execution Timeout: 300 秒

### 步骤2：获取 Endpoint ID
创建完成后，复制生成的 Endpoint ID（格式类似：`abc123def456`）

## 🔗 前端集成

### 更新 Cloudflare Worker 配置

在 `web/cloudflare/wrangler.toml` 中设置：

```bash
cd web/cloudflare
wrangler secret put RUNPOD_API_KEY
# 输入您的 RunPod API Key

wrangler secret put RUNPOD_ENDPOINT_ID  
# 输入您的 Endpoint ID

# 部署更新
wrangler deploy
```

## 🧪 测试部署

### 本地测试
```bash
# 测试前端连接
node test-frontend.js

# 测试文件上传
node test-upload.js
```

### API 测试
```bash
# 测试单人换脸
curl -X POST "https://faceswap-api.faceswap.workers.dev/api/single-image" \
  -H "Content-Type: application/json" \
  -d '{
    "source_file": "https://example.com/source.jpg",
    "target_file": "https://example.com/target.jpg"
  }'
```

## 📊 性能优化

### GPU 选择建议
- **RTX 4090**: 最佳性能，推荐用于生产环境
- **RTX A6000**: 平衡性能与成本
- **RTX 3090**: 基础性能，适合测试

### 成本估算
- 镜像存储: ~500MB (优化后，原来 3GB+)
- Network Volume: 20GB (一次性设置)
- 运行时内存: 8-12GB
- 处理时间: 
  - 图片换脸: 5-15秒
  - 视频换脸: 1-5分钟（取决于长度）

## 🗂️ Network Volume 配置 (推荐)

为了获得最佳性能，建议使用 RunPod Network Volume 存储模型：

1. **创建 Network Volume**:
   - Name: `faceswap-models`
   - Size: `20 GB`
   - 与 Serverless 同一数据中心

2. **在 Endpoint 配置中添加 Volume Mount**:
   ```yaml
   Volume Mounts:
     - Volume: faceswap-models
       Mount Path: /runpod-volume
   ```

3. **容器磁盘减少到**: `10 GB` (因为模型存储在 Volume 中)

详细配置请参考：[RUNPOD_VOLUME_SETUP.md](./RUNPOD_VOLUME_SETUP.md)

## 🔍 监控和日志

### RunPod 监控
1. 登录 RunPod Console
2. 查看 Endpoint 状态和日志
3. 监控 GPU 使用率和延迟

### 错误排查
常见问题：
- **模型加载失败**: 检查容器磁盘空间
- **内存不足**: 增加 GPU 内存或减少并发
- **超时错误**: 增加执行超时时间

## 🚀 生产部署清单

- [ ] Docker 镜像已推送到 Docker Hub
- [ ] RunPod Endpoint 创建并配置完成
- [ ] 环境变量和机密设置正确
- [ ] Cloudflare Worker 更新并部署
- [ ] API 测试通过
- [ ] 监控和告警设置完成

## 📞 获取支持

如果遇到问题：
1. 检查 RunPod 日志
2. 验证环境变量配置
3. 确认 Docker 镜像可正常运行
4. 查看 Cloudflare R2 存储权限

---

🎉 **部署完成后，您将拥有一个完全功能的换脸 API 服务！** 