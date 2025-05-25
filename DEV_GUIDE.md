# 🛠️ 开发环境指南

## 🚀 快速开始

### 1. 启动开发环境

```bash
# 1. 启动前端开发服务器
cd web/frontend
npm run dev
# 前端将在 http://localhost:3000 运行

# 2. (可选) 启动本地 API 服务器
cd web/cloudflare  
npx wrangler dev --port 8787 --env production
# API 将在 http://localhost:8787 运行
```

### 2. 访问应用

打开浏览器访问：http://localhost:3000

## 🔧 API 配置说明

### 生产环境 API (推荐)
- **URL**: https://faceswap-api.faceswap.workers.dev/api
- **功能**: 完整的文件上传、处理、存储功能
- **限制**: 需要网络连接，部分网络环境可能有 SSL 连接问题

### 本地 API 服务器 (有限制)
- **URL**: http://localhost:8787/api
- **功能**: 基础的 API 响应和 CORS 支持
- **限制**: ⚠️ 没有 R2 存储绑定，文件上传会失败

### 模拟 API (开发测试)
- **触发条件**: 当网络 API 不可用时自动启用
- **功能**: 模拟所有 API 响应，用于 UI 开发和测试
- **优点**: 无需网络连接，响应速度快

## 📋 开发模式说明

### 🟢 模拟模式 (Mock Mode)

当 API 连接失败时，前端会自动切换到模拟模式：

```javascript
// 自动检测本地开发环境
const isLocalDev = window.location.hostname === 'localhost'

// 网络错误时使用模拟响应
if (isLocalDev && error.code === 'ERR_NETWORK') {
  console.log('🔄 API 连接失败，使用本地模拟模式')
  // 返回模拟数据...
}
```

**模拟功能**:
- ✅ 文件上传 (返回虚拟文件 ID)
- ✅ 处理任务 (返回虚拟任务 ID)  
- ✅ 状态查询 (返回完成状态)
- ❌ 实际的 AI 处理 (仅 UI 测试)

### 🟡 本地 API 模式

启动本地 Cloudflare Worker：

```bash
cd web/cloudflare
npx wrangler dev --port 8787 --env production
```

**功能限制**:
- ✅ CORS 支持
- ✅ 基础路由
- ❌ R2 存储 (文件上传失败)
- ❌ KV 数据库
- ❌ 环境变量和密钥

### 🟢 生产 API 模式

直接使用部署的生产环境 API：

```bash
# 设置环境变量 (可选)
export VITE_API_URL=https://faceswap-api.faceswap.workers.dev/api
```

**功能完整**:
- ✅ 文件上传和存储
- ✅ AI 处理 (需要 RunPod 配置)
- ✅ 任务管理
- ✅ 结果下载

## 🧪 测试和调试

### 连接测试

```bash
# 测试前端和后端连接
node test-connection.js
```

### 手动 API 测试

```bash
# 测试 CORS
curl -X OPTIONS http://localhost:8787/api/upload \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"

# 测试文件上传 (会失败，但可以看到错误信息)
curl -X POST http://localhost:8787/api/upload \
  -F "file=@test-image.jpg"
```

### 浏览器开发者工具

1. **Network 标签**: 查看 API 请求和响应
2. **Console 标签**: 查看模拟模式日志
3. **Application 标签**: 检查本地存储

## 📁 文件结构

```
faceswap/
├── web/
│   ├── frontend/          # React 前端
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   └── api.ts # API 服务 (包含模拟逻辑)
│   │   │   └── pages/     # 页面组件
│   │   └── package.json
│   └── cloudflare/        # Cloudflare Worker
│       ├── worker.js      # API 处理逻辑
│       └── wrangler.toml  # Worker 配置
├── test-connection.js     # 连接测试脚本
└── DEV_GUIDE.md          # 本文档
```

## 💡 开发技巧

### 1. 模拟数据调试

在 `api.ts` 中修改模拟响应：

```javascript
// 模拟不同的处理状态
if (error.config?.url?.includes('/status/')) {
  return {
    data: {
      success: true,
      data: {
        status: 'processing', // 改为 'failed' 测试错误处理
        progress: 50,         // 调整进度条
        // ...
      }
    }
  }
}
```

### 2. 强制使用特定 API

在 `.env.local` 中设置：

```bash
# 强制使用本地 API
VITE_API_URL=http://localhost:8787/api

# 强制使用生产 API  
VITE_API_URL=https://faceswap-api.faceswap.workers.dev/api
```

### 3. 网络问题排查

如果遇到网络连接问题：

1. **检查 DNS**: `nslookup faceswap-api.faceswap.workers.dev`
2. **检查防火墙**: 确保允许 HTTPS 连接
3. **使用代理**: 设置 HTTP_PROXY 环境变量
4. **使用模拟模式**: 依赖自动降级到模拟 API

## 🚀 部署前检查

在部署到生产环境前：

1. **测试所有页面**: 单人图片、多人图片、视频等
2. **检查错误处理**: 故意上传无效文件测试
3. **验证响应式设计**: 在不同设备尺寸下测试
4. **性能检查**: 使用浏览器性能工具
5. **确认生产 API**: 确保指向正确的生产环境

---

## 📞 需要帮助？

如果遇到问题：

1. **查看浏览器控制台**: 检查错误日志
2. **运行连接测试**: `node test-connection.js`
3. **检查本文档**: 寻找类似问题的解决方案
4. **模拟模式测试**: 确认 UI 功能是否正常

**记住**: 模拟模式只用于 UI 开发，实际的 AI 功能需要配置完整的生产环境！ 