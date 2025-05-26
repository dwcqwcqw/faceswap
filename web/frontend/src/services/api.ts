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
    // 文件完整性和格式验证
    try {
      // 1. 基本文件验证
      if (!file || file.size === 0) {
        throw new Error('文件为空或无效')
      }

      // 2. 文件大小检查
      const maxSize = 200 * 1024 * 1024 // 200MB
      if (file.size > maxSize) {
        throw new Error(`文件过大，请选择小于 ${Math.round(maxSize / 1024 / 1024)}MB 的文件`)
      }

      // 3. 文件格式验证
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      
      if (!isImage && !isVideo) {
        throw new Error('只支持图片（JPG、PNG）和视频（MP4、AVI、MOV）格式')
      }

      // 4. 详细格式检查
      const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png']
      const supportedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime']
      
      if (isImage && !supportedImageTypes.includes(file.type)) {
        throw new Error('图片格式不支持，请使用 JPG 或 PNG 格式')
      }
      
      if (isVideo && !supportedVideoTypes.includes(file.type)) {
        throw new Error('视频格式不支持，请使用 MP4、AVI 或 MOV 格式')
      }

      // 5. 文件头验证 (Magic Bytes)
      await this.validateFileHeader(file)

      console.log(`📤 开始上传文件: ${file.name} (${file.type}, ${(file.size / 1024 / 1024).toFixed(2)}MB)`)

      const formData = new FormData()
      formData.append('file', file)
      
      // 添加超时和重试机制
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2分钟超时
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            console.log(`📤 上传进度: ${percentCompleted}%`)
          }
        }
      })
      
      // 验证响应
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || '上传失败，服务器返回无效响应')
      }

      if (!response.data.data?.fileId) {
        throw new Error('上传失败，未获得有效的文件ID')
      }

      console.log(`✅ 文件上传成功: ${response.data.data.fileId}`)
      return response.data

    } catch (error: any) {
      console.error('❌ 文件上传失败:', error)
      
      // 提供更友好的错误信息
      if (error.code === 'ECONNABORTED') {
        throw new Error('上传超时，请检查网络连接并重试')
      } else if (error.code === 'ERR_NETWORK') {
        throw new Error('网络错误，请检查网络连接')
      } else if (error.response?.status === 413) {
        throw new Error('文件过大，服务器拒绝接收')
      } else if (error.response?.status === 415) {
        throw new Error('文件格式不支持')
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      } else {
        throw new Error(error.message || '上传失败，请重试')
      }
    }
  },

  // 文件头验证函数
  async validateFileHeader(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          if (!arrayBuffer) {
            reject(new Error('无法读取文件内容'))
            return
          }

          const bytes = new Uint8Array(arrayBuffer.slice(0, 12))
          const header = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
          
          // 验证文件头是否与扩展名匹配
          const isValidImage = this.validateImageHeader(header, file.type)
          const isValidVideo = this.validateVideoHeader(header, file.type)
          
          if (!isValidImage && !isValidVideo) {
            reject(new Error('文件已损坏或格式不正确，请重新选择文件'))
            return
          }

          resolve()
        } catch (error) {
          reject(new Error('文件验证失败，文件可能已损坏'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('无法读取文件，文件可能已损坏'))
      }
      
      // 只读取前12字节用于验证
      reader.readAsArrayBuffer(file.slice(0, 12))
    })
  },

  // 图片文件头验证
  validateImageHeader(header: string, mimeType: string): boolean {
    const jpegHeaders = ['ffd8ff', 'ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8']
    const pngHeader = '89504e47'
    
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return jpegHeaders.some(jpegHeader => header.startsWith(jpegHeader))
    } else if (mimeType.includes('png')) {
      return header.startsWith(pngHeader)
    }
    
    return false
  },

  // 视频文件头验证
  validateVideoHeader(header: string, mimeType: string): boolean {
    const mp4Headers = ['66747970', '00000018', '00000020']
    const aviHeader = '52494646'
    const movHeaders = ['66747970', '6d6f6f76', '6d646174']
    
    if (mimeType.includes('mp4')) {
      return mp4Headers.some(mp4Header => header.includes(mp4Header))
    } else if (mimeType.includes('avi')) {
      return header.startsWith(aviHeader)
    } else if (mimeType.includes('mov') || mimeType.includes('quicktime')) {
      return movHeaders.some(movHeader => header.includes(movHeader))
    }
    
    return true // 对于其他视频格式，暂时放行
  },

  // Face detection
  async detectFaces(fileId: string): Promise<ApiResponse<DetectedFaces>> {
    return this.withRetry(async () => {
      const response = await api.post('/detect-faces', { fileId })
      
      if (!response.data?.success) {
        throw new Error(response.data?.error || '人脸检测失败')
      }
      
      if (!response.data?.data?.faces) {
        throw new Error('人脸检测响应格式无效')
      }
      
      return response.data
    }, 'detectFaces')
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
    
    return this.withRetry(async () => {
      const response = await api.post('/process/single-image', { ...request, options: defaultOptions })
      
      if (!response.data?.success || !response.data?.data?.jobId) {
        throw new Error('处理任务创建失败，未获得有效任务ID')
      }
      
      return response.data
    }, 'processSingleImage')
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
    
    return this.withRetry(async () => {
      const response = await api.post('/process/multi-image', { ...request, options: defaultOptions })
      
      if (!response.data?.success || !response.data?.data?.jobId) {
        throw new Error('多人处理任务创建失败，未获得有效任务ID')
      }
      
      return response.data
    }, 'processMultiImage')
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
    
    return this.withRetry(async () => {
      const response = await api.post('/process/single-video', { ...request, options: defaultOptions })
      
      if (!response.data?.success || !response.data?.data?.jobId) {
        throw new Error('视频处理任务创建失败，未获得有效任务ID')
      }
      
      return response.data
    }, 'processSingleVideo')
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
    
    return this.withRetry(async () => {
      const response = await api.post('/process/multi-video', { ...request, options: defaultOptions })
      
      if (!response.data?.success || !response.data?.data?.jobId) {
        throw new Error('多人视频处理任务创建失败，未获得有效任务ID')
      }
      
      return response.data
    }, 'processMultiVideo')
  },

  // Check job status
  async getJobStatus(jobId: string): Promise<ApiResponse<ProcessingJob>> {
    return this.withRetry(async () => {
      const response = await api.get(`/status/${jobId}`)
      
      // 验证响应有效性
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('服务器返回无效状态响应')
      }
      
      return response.data
    }, 'getJobStatus')
  },

  // 通用重试机制
  async withRetry<T>(operation: () => Promise<T>, operationName: string, maxRetries: number = 3): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operationName} 尝试 ${attempt}/${maxRetries}`)
        const result = await operation()
        
        if (attempt > 1) {
          console.log(`✅ ${operationName} 重试成功`)
        }
        
        return result
      } catch (error: any) {
        lastError = error
        console.warn(`⚠️ ${operationName} 尝试 ${attempt} 失败:`, error.message)
        
        // 检查是否应该重试
        const shouldRetry = this.shouldRetryError(error, attempt, maxRetries)
        
        if (!shouldRetry) {
          console.error(`❌ ${operationName} 最终失败:`, error.message)
          throw error
        }
        
        // 等待后重试 (指数退避)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 最多等待10秒
        console.log(`⏳ ${delay/1000}秒后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error(`${operationName} 重试${maxRetries}次后仍然失败`)
  },

  // 判断错误是否应该重试
  shouldRetryError(error: any, attempt: number, maxRetries: number): boolean {
    // 最后一次尝试不重试
    if (attempt >= maxRetries) return false
    
    // 特定错误类型重试
    const retryableErrors = [
      'ECONNABORTED',     // 超时
      'ERR_NETWORK',      // 网络错误
      'ENOTFOUND',        // DNS解析失败
      'ECONNRESET',       // 连接重置
      'unexpected EOF',   // 文件截断
      'corrupted',        // 文件损坏
    ]
    
    // 检查错误消息
    const errorMessage = error.message?.toLowerCase() || ''
    const hasRetryableKeyword = retryableErrors.some(keyword => 
      errorMessage.includes(keyword.toLowerCase())
    )
    
    // 检查HTTP状态码
    const status = error.response?.status
    const retryableStatuses = [429, 500, 502, 503, 504] // 限流、服务器错误
    const hasRetryableStatus = status && retryableStatuses.includes(status)
    
    return hasRetryableKeyword || hasRetryableStatus
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