# AI Face Swap Platform

基于先进AI技术的图片和视频换脸平台，支持单人和多人换脸，提供专业级的处理效果和用户体验。

## 🌟 功能特性

### 1. 单人图片换脸
- 上传原图和目标人脸
- AI自动识别并进行换脸处理
- 操作简单快速

### 2. 多人图片换脸
- 自动检测图片中的多个人脸
- 可以分别为每个人脸上传不同的替换图片
- 支持批量处理

### 3. 视频换脸
- 为视频中的人脸进行换脸处理
- 采用逐帧处理技术确保视频流畅自然
- 支持多种视频格式

### 4. 多人视频换脸
- 高级视频处理功能
- 检测视频中的多个人脸并分别进行替换处理
- 专业级视频处理效果

## 🏗️ 技术架构

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **UI组件**: Heroicons
- **路由**: React Router
- **HTTP客户端**: Axios

### 后端
- **平台**: Cloudflare Workers
- **存储**: Cloudflare R2
- **数据库**: Cloudflare KV
- **AI处理**: RunPod Serverless GPU

### 部署
- **前端**: 可部署到任何静态托管平台
- **后端**: Cloudflare Workers (已部署)
- **API地址**: https://faceswap-api.faceswap.workers.dev

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd faceswap
```

### 2. 安装依赖
```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd web/frontend
npm install
```

### 3. 启动开发服务器
```bash
# 在 web/frontend 目录下
npm run dev
```

### 4. 访问应用
打开浏览器访问: http://localhost:3004

## 📱 页面导航

- **首页**: `/` - 功能介绍和导航
- **单人图片换脸**: `/single-image`
- **多人图片换脸**: `/multi-image`
- **视频换脸**: `/video`
- **多人视频换脸**: `/multi-video`

## 🔧 配置说明

### 环境变量
```bash
# 可选：自定义API地址
VITE_API_URL=https://your-api-domain.com/api
```

### API配置
当前API已部署到Cloudflare Workers，无需额外配置即可使用基础功能。

要启用完整的AI处理功能，需要配置RunPod API密钥：
1. 登录RunPod控制台
2. 获取API密钥
3. 在Cloudflare Workers中设置环境变量

## 📁 项目结构

```
faceswap/
├── web/
│   └── frontend/           # React前端应用
│       ├── src/
│       │   ├── components/ # 可复用组件
│       │   ├── pages/      # 页面组件
│       │   ├── services/   # API服务
│       │   ├── types/      # TypeScript类型定义
│       │   └── utils/      # 工具函数
│       ├── public/         # 静态资源
│       └── package.json    # 前端依赖
├── cloudflare/
│   ├── worker.js          # Cloudflare Worker代码
│   ├── wrangler.toml      # Cloudflare配置
│   └── package.json       # 后端依赖
├── docs/                  # 文档
├── scripts/               # 部署脚本
└── test-assets/          # 测试资源
```

## 🎯 使用指南

### 单人图片换脸
1. 点击"单人图片换脸"
2. 上传原图（包含要替换的人脸）
3. 上传目标人脸图片
4. 点击"开始换脸"
5. 等待处理完成并下载结果

### 多人图片换脸
1. 点击"多人图片换脸"
2. 上传包含多人的原图
3. 点击"检测人脸"
4. 为每个检测到的人脸上传替换图片
5. 点击"开始多人换脸"
6. 等待处理完成并下载结果

### 视频换脸
1. 点击"视频换脸"
2. 上传原视频文件
3. 上传目标人脸图片
4. 点击"开始视频换脸"
5. 等待处理完成并下载结果

### 多人视频换脸
1. 点击"多人视频换脸"
2. 上传包含多人的原视频
3. 点击"检测视频中的人脸"
4. 为每个检测到的人脸上传替换图片
5. 点击"开始多人视频换脸"
6. 等待处理完成并下载结果

## 📋 最佳实践

### 图片要求
- 使用高分辨率、人脸清晰、光线充足的图片
- 确保目标人脸图片中的人脸朝向正前方
- 尽量使用光线条件相似的图片
- 支持 JPG、PNG 格式，建议文件大小不超过10MB

### 视频要求
- 支持 MP4、AVI、MOV、MKV 等常见视频格式
- 建议视频分辨率不超过1080p
- 单人视频建议文件大小不超过100MB
- 多人视频建议文件大小不超过200MB
- 确保视频中的人脸清晰可见，避免快速移动或模糊

## ⚠️ 重要说明

请负责任地使用本技术：
- 使用他人肖像时请务必获得同意
- 分享AI生成内容时请明确标注
- 严禁创建不当、有害或未经同意的内容
- 本平台仅供学习研究和正当用途

## 🔒 隐私保护

- 数据加密传输
- 处理完成后自动删除文件
- 不存储用户个人信息
- 符合数据保护法规

## 🛠️ 开发

### 本地开发
```bash
# 启动前端开发服务器
cd web/frontend
npm run dev

# 启动本地Worker (可选)
cd cloudflare
wrangler dev
```

### 构建部署
```bash
# 构建前端
cd web/frontend
npm run build

# 部署Worker
cd cloudflare
wrangler deploy
```

## 📞 支持

如有问题或建议，请通过以下方式联系：
- 创建Issue
- 发送邮件
- 查看文档

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

🎉 **享受AI换脸的乐趣，但请负责任地使用！**
