import axios from 'axios'
import { ApiResponse, ProcessingJob, DetectedFaces, FaceSwapRequest } from '../types'

// 检测是否在本地开发环境
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

// 使用生产环境 API，如果生产环境不可用则使用本地模拟
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://faceswap-api.faceswap.workers.dev/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 增加超时时间到60秒
})

// Request interceptor for adding auth headers if needed
api.interceptors.request.use((config) => {
  // Add any auth headers here if needed
  return config
})

// Response interceptor for handling errors and fallback
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('API Error:', error)
    
    // 如果是本地开发环境且遇到网络错误，返回模拟响应
    if (isLocalDev && (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED')) {
      console.log('🔄 API 连接失败，使用本地模拟模式')
      
      // 模拟上传响应
      if (error.config?.url?.includes('/upload')) {
        return {
          data: {
            success: true,
            data: {
              fileId: `mock-${Date.now()}`,
              fileName: 'mock-file.jpg',
              url: `/api/download/mock-${Date.now()}`,
              size: 1024000,
              type: 'image/jpeg'
            }
          }
        }
      }
      
      // 模拟处理响应
      if (error.config?.url?.includes('/process/')) {
        return {
          data: {
            success: true,
            data: {
              jobId: `mock-job-${Date.now()}`
            }
          }
        }
      }
      
      // 模拟状态查询响应
      if (error.config?.url?.includes('/status/')) {
        return {
          data: {
            success: true,
            data: {
              id: error.config.url.split('/').pop(),
              status: 'completed',
              progress: 100,
              result_url: `/api/download/mock-result-${Date.now()}`
            }
          }
        }
      }
    }
    
    return Promise.reject(error)
  }
)

export const apiService = {
  // File upload
  async uploadFile(file: File): Promise<ApiResponse<{ fileId: string; fileName: string; url: string }>> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    return response.data
  },

  // Face detection
  async detectFaces(fileId: string): Promise<ApiResponse<DetectedFaces>> {
    const response = await api.post('/detect-faces', { fileId })
    return response.data
  },

  // Single image face swap
  async processSingleImage(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    // Add high quality default options
    const defaultOptions = {
      mouth_mask: true,
      use_face_enhancer: true,
      execution_provider: 'CPUExecutionProvider',
      ...request.options
    }
    
    const response = await api.post('/process/single-image', { ...request, options: defaultOptions })
    return response.data
  },

  // Multi-person image face swap
  async processMultiImage(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    // Add high quality default options
    const defaultOptions = {
      many_faces: true,
      mouth_mask: true,
      use_face_enhancer: true,
      execution_provider: 'CPUExecutionProvider',
      ...request.options
    }
    
    const response = await api.post('/process/multi-image', { ...request, options: defaultOptions })
    return response.data
  },

  // Single video face swap
  async processSingleVideo(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    // Add high quality default options for video
    const defaultOptions = {
      keep_fps: true,
      video_quality: 18,  // High quality
      video_encoder: 'libx264' as const,
      mouth_mask: true,
      use_face_enhancer: true,
      execution_provider: 'CPUExecutionProvider',
      ...request.options
    }
    
    const response = await api.post('/process/single-video', { ...request, options: defaultOptions })
    return response.data
  },

  // Multi-person video face swap
  async processMultiVideo(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    // Add high quality default options for multi-video
    const defaultOptions = {
      many_faces: true,
      keep_fps: true,
      video_quality: 18,  // High quality
      video_encoder: 'libx264' as const,
      mouth_mask: true,
      use_face_enhancer: true,
      execution_provider: 'CPUExecutionProvider',
      ...request.options
    }
    
    const response = await api.post('/process/multi-video', { ...request, options: defaultOptions })
    return response.data
  },

  // Check job status
  async getJobStatus(jobId: string): Promise<ApiResponse<ProcessingJob>> {
    const response = await api.get(`/status/${jobId}`)
    return response.data
  },

  // Download result
  async downloadResult(resultId: string): Promise<Blob> {
    const response = await api.get(`/download/${resultId}`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Get download URL
  getDownloadUrl(resultId: string): string {
    return `${API_BASE_URL}/download/${resultId}`
  },
}

export default apiService 