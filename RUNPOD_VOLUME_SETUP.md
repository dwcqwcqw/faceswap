# 🗂️ RunPod Network Volume 配置指南

使用 RunPod Network Volume 来存储模型文件，避免在 Docker 镜像中打包大文件，提高启动速度。

## 🎯 优势

✅ **更快的启动时间** - Docker 镜像更小（~500MB vs ~3GB+）  
✅ **模型复用** - 多个端点共享同一套模型  
✅ **更新方便** - 更新模型无需重建镜像  
✅ **成本优化** - 避免重复下载模型  

## 📋 步骤1：创建 Network Volume

### 在 RunPod Console 中：

1. 访问 [RunPod Console](https://runpod.io/console/pods)
2. 点击侧边栏 "Storage" → "Network Volumes"
3. 点击 "Create Network Volume"

### 配置：
```yaml
Name: faceswap-models
Size: 20 GB
Data Center: 选择与您的 Serverless 相同的区域
```

4. 点击 "Create Volume"

## 📋 步骤2：预装模型（可选）

### 方法A：通过临时 Pod 预装

1. 创建一个临时 Pod：
```yaml
Template: RunPod PyTorch 2.1.0
GPU: 任意（只用于下载）
Volume Storage: 挂载 faceswap-models 到 /workspace/models
```

2. 在 Pod 中运行：
```bash
# 连接到 Pod 终端
cd /workspace/models

# 下载模型文件
wget -O inswapper_128_fp16.onnx \
  "https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx"

wget -O GFPGANv1.4.pth \
  "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth"

wget -O buffalo_l.zip \
  "https://huggingface.co/hacksider/deep-live-cam/resolve/main/buffalo_l.zip"
unzip buffalo_l.zip && rm buffalo_l.zip

wget -O 79999_iter.pth \
  "https://huggingface.co/hacksider/deep-live-cam/resolve/main/79999_iter.pth"

# 设置权限
chmod -R 755 /workspace/models

# 验证文件
ls -la /workspace/models
```

3. 确认模型已下载完成，然后终止 Pod

### 方法B：自动下载（推荐）

让 Docker 容器在首次启动时自动下载模型（我们的脚本会处理这个）。

## 📋 步骤3：配置 Serverless Endpoint

### 在创建 Serverless Endpoint 时：

1. 进入 "Advanced Configuration"
2. 在 "Volume Mounts" 部分：

```yaml
Volume: faceswap-models
Mount Path: /runpod-volume
```

### 完整的 Endpoint 配置：

```yaml
Name: faceswap-api
Docker Image: your-dockerhub-username/faceswap-runpod:latest
Container Disk: 10 GB  # 现在只需要很小的空间
GPU Types: RTX4090, RTXA6000, RTX3090

Volume Mounts:
  - Volume: faceswap-models
    Mount Path: /runpod-volume

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID: c7c141ce43d175e60601edc46d904553
  R2_BUCKET_NAME: faceswap-storage

Secrets:
  R2_ACCESS_KEY_ID: [您的密钥]
  R2_SECRET_ACCESS_KEY: [您的机密密钥]
```

## 🔍 模型路径优先级

我们的系统会按以下顺序查找模型：

1. **`/runpod-volume/models`** - Network Volume（推荐）
2. **`/workspace/models`** - Workspace 目录
3. **`/app/models`** - Docker 容器内
4. **本地开发目录** - 相对路径

## 📊 性能对比

| 方案 | Docker 镜像大小 | 首次启动时间 | 模型加载时间 | 总启动时间 |
|------|----------------|--------------|--------------|------------|
| **镜像内置模型** | ~3.5GB | 60-120秒 | 即时 | 60-120秒 |
| **Network Volume** | ~500MB | 10-20秒 | 5-10秒 | 15-30秒 |
| **自动下载** | ~500MB | 10-20秒 | 30-60秒 | 40-80秒 |

## 🔧 故障排除

### 问题1：Volume 未挂载
```bash
# 检查挂载点
ls -la /runpod-volume

# 如果为空，检查 RunPod Console 中的 Volume 配置
```

### 问题2：模型文件损坏
```bash
# 重新下载模型
cd /runpod-volume/models
rm -rf *
# 重启容器，会自动重新下载
```

### 问题3：权限问题
```bash
# 修复权限
chmod -R 755 /runpod-volume/models
```

## 💡 最佳实践

1. **预先下载模型** - 在第一次使用前预装模型到 Volume
2. **定期备份** - 备份您的 Network Volume
3. **监控空间** - 确保 Volume 有足够空间
4. **区域一致** - Volume 和 Serverless 使用同一数据中心

---

🎉 **配置完成后，您的 Docker 镜像将显著减小，启动时间大幅缩短！** 