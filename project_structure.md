# Face Swap Web Application Project Structure

## Directory Structure
```
faceswap/
├── modules/                    # Original face swap core modules
├── web/                        # New web application
│   ├── frontend/              # React frontend application
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── pages/         # Page components
│   │   │   ├── services/      # API services
│   │   │   ├── utils/         # Utility functions
│   │   │   └── types/         # TypeScript types
│   │   ├── public/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── backend/               # Backend API services
│   │   ├── api/               # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── models/            # Data models
│   │   ├── utils/             # Utilities
│   │   └── config/            # Configuration
│   ├── cloudflare/            # Cloudflare Workers
│   │   ├── worker.js          # Main worker script
│   │   ├── wrangler.toml      # Worker configuration
│   │   └── r2-storage.js      # R2 storage utilities
│   └── runpod/                # RunPod integration
│       ├── serverless/        # Serverless functions
│       ├── models/            # Model management
│       └── api/               # RunPod API integration
├── docker/                    # Docker configurations
├── scripts/                   # Deployment scripts
└── docs/                      # Documentation
```

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **UI Library**: Tailwind CSS + Headless UI
- **State Management**: Zustand
- **File Upload**: React Dropzone
- **HTTP Client**: Axios
- **Build Tool**: Vite

### Backend
- **Runtime**: Python FastAPI
- **Task Queue**: Celery with Redis
- **Database**: SQLite/PostgreSQL
- **File Storage**: Cloudflare R2
- **Authentication**: JWT

### Infrastructure
- **Frontend Hosting**: Cloudflare Pages
- **API Hosting**: Cloudflare Workers
- **Compute**: RunPod Serverless
- **Storage**: Cloudflare R2
- **CDN**: Cloudflare

## API Endpoints

### Face Processing
- `POST /api/upload` - Upload files and initiate processing
- `GET /api/detect-faces` - Detect faces in uploaded media
- `POST /api/process/single-image` - Single person image face swap
- `POST /api/process/multi-image` - Multi-person image face swap
- `POST /api/process/single-video` - Single person video face swap
- `POST /api/process/multi-video` - Multi-person video face swap
- `GET /api/status/{job_id}` - Check processing status
- `GET /api/download/{result_id}` - Download processed result

### File Management
- `POST /api/upload/temp` - Upload temporary files
- `DELETE /api/cleanup/{session_id}` - Cleanup temporary files
- `GET /api/storage/presigned-url` - Get presigned URLs for direct upload

## Data Flow

1. **Upload Flow**:
   User → Frontend → Cloudflare Worker → R2 Storage

2. **Processing Flow**:
   Cloudflare Worker → RunPod Serverless → Face Processing → Result Upload → R2

3. **Download Flow**:
   Frontend → Cloudflare Worker → R2 Storage → User

## Feature Implementation Priority

### Phase 1: Core Infrastructure
1. Project setup and structure
2. Cloudflare Worker setup
3. R2 storage integration
4. RunPod API integration

### Phase 2: Basic Face Swap
1. Single image face swap
2. File upload/download
3. Basic UI

### Phase 3: Advanced Features
1. Multi-person detection
2. Video processing
3. Enhanced UI/UX

### Phase 4: Optimization
1. Performance optimization
2. Error handling
3. Monitoring and logging 