# 🚨 Cloudflare Pages 紧急修复指南

## 🔍 **错误诊断**

根据部署日志分析，发现以下关键问题：

### **错误现象**：
```
Executing user command: npx vitepress build
[vitepress] 17 dead link(s) found.
build error: [vitepress] 17 dead link(s) found.
Failed: build command exited with code: 1
```

### **根本原因**：
1. **错误的构建工具**：Cloudflare Pages 执行了 `npx vitepress build` 而不是 React 构建
2. **配置问题**：构建设置没有正确指向 React 应用目录
3. **Monorepo 路径问题**：没有正确处理 `web/frontend` 子目录结构

## ⚡ **立即修复步骤**

### 1. **更新 Cloudflare Pages 设置**

在 Cloudflare Dashboard 中：

1. 进入您的 Pages 项目
2. 点击 **Settings** → **Builds & deployments**
3. **完全重新配置**构建设置：

```
Framework preset: None (不要选择任何预设)
Build command: cd web/frontend && npm install && npm run build
Build output directory: web/frontend/dist
Root directory: / (项目根目录)
Node.js version: 18.x
```

### 2. **环境变量设置**

确保设置以下环境变量：
```
NODE_VERSION=18
NPM_VERSION=latest
VITE_API_BASE_URL=https://faceswap-api.faceswap.workers.dev
```

### 3. **验证项目结构**

确认您的项目结构如下：
```
faceswap/                    # 根目录
├── web/
│   ├── frontend/           # React 应用
│   │   ├── src/
│   │   ├── package.json    # React 依赖
│   │   ├── vite.config.ts  # Vite 配置
│   │   └── dist/           # 构建输出
│   └── cloudflare/         # Worker 代码
└── runpod/                 # 后端代码
```

### 4. **触发重新部署**

- 点击 **Retry deployment** 或
- 推送一个新的 commit 到 GitHub

## 🔧 **为什么会出现 VitePress 错误？**

### **错误分析**：
1. **Framework 误识别**：Cloudflare Pages 可能误识别了项目类型
2. **构建命令错误**：没有正确指向 React 应用目录
3. **死链检查**：VitePress 检查了项目中的 Markdown 文件，发现了本地开发链接

### **正确的构建流程应该是**：
```bash
cd web/frontend          # 进入 React 应用目录
npm install             # 安装依赖
npm run build           # 使用 Vite 构建 React 应用
# 输出到 web/frontend/dist/
```

## 🎯 **验证修复成功**

重新部署后，检查构建日志应该显示：
```
✅ Installing project dependencies: npm install
✅ Executing user command: cd web/frontend && npm install && npm run build
✅ vite v4.5.14 building for production...
✅ ✓ built in XXXms
✅ Build completed successfully
```

## 🚀 **部署成功后验证**

1. **访问网站**：检查 `*.pages.dev` 域名是否正常加载
2. **测试路由**：验证 `/video`, `/multi-image` 等路由
3. **功能测试**：确认文件上传和任务提交正常工作

## 📞 **如果仍有问题**

1. **清除缓存**：在 Cloudflare Pages 设置中清除构建缓存
2. **检查日志**：仔细查看新的构建日志
3. **验证配置**：确认所有设置都按照上述要求配置

---

**预期结果**：修复后应该看到正常的 React 应用构建过程，而不是 VitePress 构建。 