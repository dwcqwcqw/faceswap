# ⚡ 快速开始指南

基于 [Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam) 的换脸项目，一键部署到 RunPod Serverless。

## 🚀 30分钟完整部署

### 第1步：准备工作 (5分钟)
```bash
# 确保您有以下账户：
# - Docker Hub: https://hub.docker.com
# - RunPod: https://runpod.io
# - GitHub: https://github.com (可选)

# 检查本地环境
docker --version
git --version
```

### 第2步：同步代码到 GitHub (2分钟)
```bash
# 一键同步到您的 GitHub 仓库
./sync-to-github.sh
```

### 第3步：构建 Docker 镜像 (10分钟)
```bash
# 构建镜像
./build-docker.sh

# 推送到 Docker Hub（替换用户名）
DOCKER_USERNAME="your-dockerhub-username"
docker tag faceswap-runpod:latest $DOCKER_USERNAME/faceswap-runpod:latest
docker login
docker push $DOCKER_USERNAME/faceswap-runpod:latest
```

### 第4步：创建 RunPod Endpoint (8分钟)

1. 访问 [RunPod Console](https://runpod.io/console/serverless)
2. 点击 "New Endpoint"
3. 填写配置：

```yaml
Name: faceswap-api
Docker Image: your-dockerhub-username/faceswap-runpod:latest
Container Disk: 25 GB
GPU Types: RTX4090, RTXA6000, RTX3090
Max Workers: 3
Idle Timeout: 60s
Execution Timeout: 300s

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID: c7c141ce43d175e60601edc46d904553
  R2_BUCKET_NAME: faceswap-storage

Secrets:
  R2_ACCESS_KEY_ID: [您的R2访问密钥]
  R2_SECRET_ACCESS_KEY: [您的R2机密密钥]
```

4. 复制生成的 Endpoint ID

### 第5步：配置前端 (5分钟)
```bash
cd web/cloudflare

# 设置 RunPod 配置
wrangler secret put RUNPOD_API_KEY
# 输入您的 RunPod API Key

wrangler secret put RUNPOD_ENDPOINT_ID
# 输入步骤4中的 Endpoint ID

# 部署更新
wrangler deploy
```

### 第6步：测试部署 (2分钟)
```bash
# 返回项目根目录
cd ../..

# 测试 API 连接
node test-frontend.js

# 启动前端开发服务器
cd web/frontend && npm run dev
```

🎉 **完成！** 访问 http://localhost:3003 开始使用换脸功能！

---

## 📋 功能列表

✅ **单人图片换脸** - 将源人脸替换到目标图片  
✅ **多人图片换脸** - 批量替换多个人脸  
✅ **单人视频换脸** - 视频中的人脸替换  
✅ **多人视频换脸** - 视频中多个人脸批量替换

## 🔧 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: Cloudflare Workers + R2 Storage
- **AI处理**: RunPod Serverless + GPU
- **模型**: Deep-Live-Cam (inswapper + GFPGAN + buffalo_l)

## 💰 成本预估

### RunPod 费用（按需付费）
- **RTX 4090**: ~$0.50/小时（处理中才计费）
- **RTX A6000**: ~$0.35/小时
- **RTX 3090**: ~$0.25/小时

### 处理时间估算
- 图片换脸: 5-15秒
- 短视频(30s): 30-60秒
- 长视频(5min): 3-8分钟

### 月成本示例
- 轻度使用(100张图片): ~$5-10
- 中度使用(500张图片+视频): ~$20-40
- 重度使用(商业用途): ~$100-300

## 🛠️ 故障排除

### 常见问题
1. **Docker 构建失败**: 检查磁盘空间 (需要10GB+)
2. **RunPod 启动超时**: 增加 Container Disk 到 30GB
3. **前端连接失败**: 检查 API 密钥配置
4. **处理质量差**: 使用 RTX 4090 GPU

### 日志查看
```bash
# RunPod 日志
在 RunPod Console 中查看 "Logs" 标签

# Cloudflare 日志  
cd web/cloudflare && wrangler tail

# 前端日志
浏览器开发者工具 Console
```

## 📞 获取帮助

- **项目源码**: https://github.com/hacksider/Deep-Live-Cam
- **您的仓库**: https://github.com/dwcqwcqw/faceswap.git
- **RunPod 文档**: https://docs.runpod.io/serverless
- **Cloudflare 文档**: https://developers.cloudflare.com

---

🎯 **目标**: 打造最简单易用的换脸 API 服务！ 