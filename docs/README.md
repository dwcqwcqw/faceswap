# Face Swap Web Application

A modern, AI-powered face swapping web application built with React, Cloudflare Workers, and RunPod serverless infrastructure.

## Features

- **Single Image Face Swap**: Swap faces between two images
- **Multi-Person Image Face Swap**: Detect and swap multiple faces in a single image
- **Video Face Swap**: Apply face swapping to video content
- **Multi-Person Video Face Swap**: Advanced video processing with multiple face detection
- **Real-time Processing**: Powered by RunPod serverless infrastructure
- **Secure Storage**: Files stored securely in Cloudflare R2
- **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Cloudflare      │    │    RunPod       │
│   (React)       │───▶│   Worker API     │───▶│   Serverless    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │  Cloudflare R2   │◀────────────┘
         │              │    Storage       │
         │              └──────────────────┘
         │                       ▲
         └───────────────────────┘
```

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Headless UI** for accessible components
- **Heroicons** for icons
- **React Router** for navigation
- **Axios** for API communication
- **React Dropzone** for file uploads

### Backend
- **Cloudflare Workers** for API endpoints
- **Cloudflare R2** for file storage
- **Cloudflare KV** for session management
- **RunPod Serverless** for AI processing

### AI Processing
- **InsightFace** for face detection and analysis
- **ONNX Runtime** for model inference
- **OpenCV** for image processing
- **Custom face swap models** optimized for quality

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account
- RunPod account
- Wrangler CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dwcqwcqw/faceswap.git
   cd faceswap
   ```

2. **Install frontend dependencies**
   ```bash
   cd web/frontend
   npm install
   cd ../..
   ```

3. **Configure Cloudflare**
   - Create a Cloudflare R2 bucket named `faceswap-storage`
   - Create a KV namespace for sessions
   - Update `web/cloudflare/wrangler.toml` with your configuration

4. **Set up RunPod**
   - Create a serverless endpoint on RunPod
   - Upload the models to `/workspace/faceswap/models/`
   - Deploy the handler from `web/runpod/serverless/`

5. **Deploy the application**
   ```bash
   ./scripts/deploy.sh
   ```

## Development

### Local Development

1. **Start the frontend development server**
   ```bash
   cd web/frontend
   npm run dev
   ```

2. **Start the Cloudflare Worker locally**
   ```bash
   cd web/cloudflare
   wrangler dev
   ```

### Project Structure

```
faceswap/
├── modules/                    # Original face swap core modules
├── web/                        # Web application
│   ├── frontend/              # React frontend
│   │   ├── src/
│   │   │   ├── components/    # Reusable UI components
│   │   │   ├── pages/         # Page components
│   │   │   ├── services/      # API services
│   │   │   ├── types/         # TypeScript definitions
│   │   │   └── utils/         # Utility functions
│   │   ├── public/            # Static assets
│   │   └── dist/              # Build output
│   ├── cloudflare/            # Cloudflare Worker
│   │   ├── worker.js          # Main worker script
│   │   └── wrangler.toml      # Worker configuration
│   └── runpod/                # RunPod serverless
│       ├── serverless/        # Serverless functions
│       └── requirements.txt   # Python dependencies
├── scripts/                   # Deployment scripts
└── docs/                      # Documentation
```

## API Endpoints

### File Management
- `POST /api/upload` - Upload files
- `GET /api/download/{fileId}` - Download files

### Face Processing
- `POST /api/process/single-image` - Single image face swap
- `POST /api/process/multi-image` - Multi-person image face swap
- `POST /api/process/single-video` - Video face swap
- `POST /api/process/multi-video` - Multi-person video face swap

### Job Management
- `GET /api/status/{jobId}` - Check processing status
- `POST /api/detect-faces` - Detect faces in images

## Configuration

### Environment Variables

#### Cloudflare Worker
```toml
# wrangler.toml
[vars]
RUNPOD_API_KEY = "your-runpod-api-key"
RUNPOD_ENDPOINT_ID = "your-runpod-endpoint-id"
ALLOWED_ORIGINS = "https://your-domain.com"
```

#### Frontend
```env
# .env
VITE_API_URL=https://your-worker.your-subdomain.workers.dev
```

### RunPod Setup

1. **Create a serverless endpoint**
2. **Configure the environment**:
   - Python 3.10+
   - CUDA support (recommended)
   - Minimum 8GB RAM
   - Models stored in `/workspace/faceswap/models/`

3. **Upload required models**:
   - `inswapper_128_fp16.onnx`
   - Face detection models
   - Enhancement models (optional)

## Usage

### Single Image Face Swap

1. Navigate to the "Single Image" page
2. Upload the original image (the image you want to modify)
3. Upload the target face (the face you want to swap in)
4. Click "Start Face Swap"
5. Wait for processing to complete
6. Download the result

### Multi-Person Face Swap

1. Navigate to the "Multi Image" page
2. Upload an image with multiple faces
3. The system will detect all faces automatically
4. Upload replacement faces for each detected face
5. Start the processing
6. Download the result

### Video Face Swap

1. Navigate to the "Video Swap" page
2. Upload the source video
3. Upload the target face image
4. Configure processing options (quality, frame rate, etc.)
5. Start processing (this may take several minutes)
6. Download the processed video

## Performance Optimization

### Frontend
- Images are compressed before upload
- Progressive loading for large files
- Efficient state management with Zustand
- Optimized bundle size with tree shaking

### Backend
- Serverless architecture for automatic scaling
- Efficient file storage with R2
- Optimized model loading and caching
- GPU acceleration on RunPod

## Security

- CORS protection
- File type validation
- Size limits on uploads
- Secure file storage
- No permanent data retention
- Content filtering for inappropriate material

## Troubleshooting

### Common Issues

1. **Upload fails**
   - Check file size (max 10MB for images, 100MB for videos)
   - Verify file format (JPG, PNG for images; MP4 for videos)
   - Ensure stable internet connection

2. **Processing takes too long**
   - Video processing can take 1-5 minutes per minute of video
   - Check RunPod endpoint status
   - Verify sufficient credits in RunPod account

3. **Poor quality results**
   - Use high-resolution source images
   - Ensure faces are clearly visible and well-lit
   - Avoid extreme angles or occlusions

### Error Codes

- `400` - Bad request (invalid file or parameters)
- `413` - File too large
- `429` - Rate limit exceeded
- `500` - Server error (check RunPod status)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Disclaimer

This software is designed for educational and creative purposes. Users are responsible for:

- Obtaining consent when using real people's faces
- Clearly labeling AI-generated content
- Complying with local laws and regulations
- Not creating harmful or inappropriate content

We prohibit the use of this software for:
- Non-consensual face swapping
- Creating misleading or harmful content
- Violating privacy or dignity of individuals
- Any illegal activities

## Support

For support, please:
1. Check the troubleshooting section
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Contact the development team

## Roadmap

- [ ] Real-time face swapping
- [ ] Mobile app development
- [ ] Advanced face editing features
- [ ] Batch processing capabilities
- [ ] API rate limiting and authentication
- [ ] Enhanced quality models
- [ ] Multi-language support 