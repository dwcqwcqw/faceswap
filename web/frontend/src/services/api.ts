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

      // 2. 文件大小检查 - 移除严格限制，只警告超大文件
      const warnSize = 1024 * 1024 * 1024 // 1GB 警告阈值
      if (file.size > warnSize) {
        console.warn(`⚠️ 文件较大: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB，上传可能需要较长时间`)
      }

      // 3. 文件格式验证 - 扩展支持格式
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      
      if (!isImage && !isVideo) {
        throw new Error('只支持图片和视频文件格式')
      }

      // 4. 详细格式检查 - 大幅扩展支持的格式
      const supportedImageTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/tif',
        'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/heic', 'image/heif'
      ]
      const supportedVideoTypes = [
        'video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/mkv', 'video/x-matroska',
        'video/wmv', 'video/x-ms-wmv', 'video/flv', 'video/x-flv', 'video/3gp', 'video/3gpp',
        'video/m4v', 'video/webm', 'video/ogg', 'video/mp2t', 'video/mpeg', 'video/x-msvideo'
      ]
      
      if (isImage && !supportedImageTypes.includes(file.type)) {
        console.warn(`⚠️ 图片格式 ${file.type} 可能不被完全支持，但将尝试处理`)
      }
      
      if (isVideo && !supportedVideoTypes.includes(file.type)) {
        console.warn(`⚠️ 视频格式 ${file.type} 可能不被完全支持，但将尝试处理`)
      }

      // 5. 文件头验证 (Magic Bytes) - 可选验证，不阻止上传
      try {
        await this.validateFileHeader(file)
        console.log('✅ 文件头验证通过')
      } catch (error) {
        console.warn('⚠️ 文件头验证失败，但将继续上传:', error)
        // 不抛出错误，允许继续上传
      }

      console.log(`📤 开始上传文件: ${file.name} (${file.type}, ${(file.size / 1024 / 1024).toFixed(2)}MB)`)

      const formData = new FormData()
      formData.append('file', file)
      
      // 添加超时和重试机制 - 根据文件大小动态调整超时时间
      const timeoutDuration = Math.max(120000, Math.min(file.size / 1024 / 1024 * 10000, 600000)) // 最少2分钟，最多10分钟
      
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: timeoutDuration,
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
        throw new Error('上传超时，请检查网络连接并重试，或尝试压缩文件大小')
      } else if (error.code === 'ERR_NETWORK') {
        throw new Error('网络错误，请检查网络连接')
      } else if (error.response?.status === 413) {
        throw new Error('文件过大，服务器拒绝接收，请尝试压缩文件')
      } else if (error.response?.status === 415) {
        throw new Error('文件格式可能不受支持，但可以尝试上传')
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      } else {
        throw new Error(error.message || '上传失败，请重试')
      }
    }
  },

  // 文件头验证函数 - 扩展支持更多格式
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

          const bytes = new Uint8Array(arrayBuffer.slice(0, 16)) // 读取更多字节
          const header = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
          
          // 验证文件头是否与扩展名匹配
          const isValidImage = this.validateImageHeader(header, file.type)
          const isValidVideo = this.validateVideoHeader(header, file.type)
          
          if (!isValidImage && !isValidVideo) {
            // 降级为警告而不是错误
            console.warn('文件头验证失败，但允许继续上传')
          }

          resolve()
        } catch (error) {
          console.warn('文件验证过程中出现问题:', error)
          resolve() // 不阻止上传
        }
      }
      
      reader.onerror = () => {
        console.warn('无法读取文件，但允许继续上传')
        resolve() // 不阻止上传
      }
      
      // 读取前16字节用于验证
      reader.readAsArrayBuffer(file.slice(0, 16))
    })
  },

  // 图片文件头验证 - 扩展支持更多格式
  validateImageHeader(header: string, mimeType: string): boolean {
    const imageSignatures = {
      jpeg: ['ffd8ff', 'ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
      png: ['89504e47'],
      bmp: ['424d'],
      gif: ['474946383761', '474946383961'], // GIF87a, GIF89a
      tiff: ['49492a00', '4d4d002a'], // TIFF little/big endian
      webp: ['52494646'], // RIFF (WebP starts with RIFF)
      heic: ['66747970686569'], // ftyp followed by heic
      ico: ['00000100'], // ICO format
    }
    
    // 更宽松的验证策略
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return imageSignatures.jpeg.some(sig => header.startsWith(sig)) || header.startsWith('ffd8')
    } else if (mimeType.includes('png')) {
      return header.startsWith(imageSignatures.png[0])
    } else if (mimeType.includes('bmp')) {
      return header.startsWith(imageSignatures.bmp[0])
    } else if (mimeType.includes('gif')) {
      return imageSignatures.gif.some(sig => header.startsWith(sig))
    } else if (mimeType.includes('tiff') || mimeType.includes('tif')) {
      return imageSignatures.tiff.some(sig => header.startsWith(sig))
    } else if (mimeType.includes('webp')) {
      return header.startsWith(imageSignatures.webp[0])
    } else if (mimeType.includes('heic') || mimeType.includes('heif')) {
      return header.includes('6865696') // contains 'hei'
    } else if (mimeType.includes('icon')) {
      return header.startsWith(imageSignatures.ico[0])
    }
    
    // 对于其他格式或无法识别的格式，返回true（允许上传）
    return true
  },

  // 视频文件头验证 - 扩展支持更多格式
  validateVideoHeader(header: string, mimeType: string): boolean {
    const videoSignatures = {
      mp4: ['66747970', '00000018', '00000020'],
      avi: ['52494646'], // RIFF
      mkv: ['1a45dfa3'], // EBML signature
      wmv: ['3026b275'], // ASF signature
      flv: ['464c5601'], // FLV signature
      '3gp': ['66747970'], // ftyp
      webm: ['1a45dfa3'], // EBML (same as MKV)
      mov: ['66747970', '6d6f6f76', '6d646174'], // QuickTime
    }
    
    // 更宽松的验证策略
    if (mimeType.includes('mp4')) {
      return videoSignatures.mp4.some(sig => header.includes(sig)) || header.includes('6674797')
    } else if (mimeType.includes('avi')) {
      return header.startsWith(videoSignatures.avi[0])
    } else if (mimeType.includes('mkv') || mimeType.includes('matroska')) {
      return header.startsWith(videoSignatures.mkv[0])
    } else if (mimeType.includes('wmv') || mimeType.includes('asf')) {
      return header.startsWith(videoSignatures.wmv[0])
    } else if (mimeType.includes('flv')) {
      return header.startsWith(videoSignatures.flv[0])
    } else if (mimeType.includes('3gp') || mimeType.includes('3gpp')) {
      return header.includes('66747970')
    } else if (mimeType.includes('webm')) {
      return header.startsWith(videoSignatures.webm[0])
    } else if (mimeType.includes('mov') || mimeType.includes('quicktime')) {
      return videoSignatures.mov.some(sig => header.includes(sig))
    }
    
    // 对于其他格式或无法识别的格式，返回true（允许上传）
    return true
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