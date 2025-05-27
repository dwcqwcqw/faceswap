# 🚀 Cloudflare Pages 部署指南

## 📋 **部署前准备**

### 1. **项目结构确认**
```
web/frontend/
├── src/                 # React源代码
├── public/              # 静态资源
│   └── _redirects      # SPA重定向配置
├── dist/               # 构建输出目录
├── package.json        # 依赖配置
├── vite.config.ts      # Vite配置
└── _redirects          # 备用重定向配置
```

### 2. **构建配置优化**
- ✅ Vite配置已优化用于生产环境
- ✅ 代码分割配置（vendor, router chunks）
- ✅ SPA重定向规则已配置
- ✅ 移除了不必要的调试日志

## 🔧 **部署步骤**

### 方法一：通过Git仓库部署（推荐）

1. **推送代码到Git仓库**
   ```bash
   git add .
   git commit -m "Prepare for Cloudflare Pages deployment"
   git push origin main
   ```

2. **在Cloudflare Dashboard创建Pages项目**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 进入 "Pages" 部分
   - 点击 "Create a project"
   - 选择 "Connect to Git"

3. **配置构建设置**
   ```
   Framework preset: Vite
   Build command: cd web/frontend && npm run build
   Build output directory: web/frontend/dist
   Root directory: /
   Node.js version: 18.x
   ```

4. **环境变量配置**
   ```
   NODE_VERSION=18
   NPM_VERSION=latest
   ```

### 方法二：直接上传构建文件

1. **本地构建**
   ```bash
   cd web/frontend
   npm install
   npm run build
   ```

2. **上传dist目录**
   - 在Cloudflare Pages中选择 "Upload assets"
   - 上传 `web/frontend/dist` 目录中的所有文件

## ⚙️ **重要配置**

### 1. **API端点配置**
确保前端API调用指向正确的Cloudflare Worker：
```typescript
// web/frontend/src/services/api.ts
const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev'
```

### 2. **CORS配置**
Cloudflare Worker已配置允许所有来源：
```javascript
'Access-Control-Allow-Origin': '*'
```

### 3. **路由配置**
`_redirects` 文件确保SPA路由正常工作：
```
/*    /index.html   200
```

## 🔍 **部署验证**

部署完成后，验证以下功能：

### ✅ **基础功能**
- [ ] 页面正常加载
- [ ] 路由切换正常（/single-image, /multi-image, /video, /multi-video）
- [ ] 文件上传功能
- [ ] 任务提交功能

### ✅ **任务管理**
- [ ] 任务历史显示正常
- [ ] 任务状态更新
- [ ] 任务取消功能
- [ ] 结果下载功能

### ✅ **API连接**
- [ ] 文件上传到Cloudflare Worker
- [ ] 任务状态查询
- [ ] 结果文件下载

## 🐛 **常见问题解决**

### 1. **路由404错误**
**问题**: 直接访问 `/video` 等路由返回404
**解决**: 确保 `_redirects` 文件在构建输出中

### 2. **API请求失败**
**问题**: 前端无法连接到后端API
**解决**: 
- 检查API_BASE_URL配置
- 确认Cloudflare Worker正常运行
- 检查CORS设置

### 3. **构建失败**
**问题**: Cloudflare Pages构建失败
**解决**:
- 检查Node.js版本（推荐18.x）
- 确认构建命令路径正确
- 检查package.json依赖

### 4. **静态资源加载失败**
**问题**: CSS/JS文件404
**解决**: 确认 `base: '/'` 在vite.config.ts中设置

## 📝 **部署后配置**

### 1. **自定义域名**（可选）
- 在Cloudflare Pages设置中添加自定义域名
- 配置DNS记录指向Cloudflare

### 2. **环境变量**
如需不同环境的API端点：
```
VITE_API_BASE_URL=https://your-worker.workers.dev
```

### 3. **缓存配置**
Cloudflare自动处理静态资源缓存，无需额外配置。

## 🎯 **性能优化**

### 已实现的优化：
- ✅ 代码分割（vendor/router chunks）
- ✅ 移除source maps（生产环境）
- ✅ 移除调试日志
- ✅ 优化bundle大小

### 建议的进一步优化：
- 图片压缩和懒加载
- Service Worker缓存
- CDN资源优化

## 🔗 **相关链接**

- [Cloudflare Pages文档](https://developers.cloudflare.com/pages/)
- [Vite部署指南](https://vitejs.dev/guide/static-deploy.html)
- [React Router部署](https://reactrouter.com/en/main/guides/deploying)

## 📞 **支持**

如果部署过程中遇到问题：
1. 检查Cloudflare Pages构建日志
2. 验证API Worker状态
3. 检查浏览器控制台错误
4. 确认网络连接和CORS设置 