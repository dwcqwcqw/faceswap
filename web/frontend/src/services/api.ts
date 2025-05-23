import axios from 'axios'
import { ApiResponse, ProcessingJob, DetectedFaces, FaceSwapRequest } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Request interceptor for adding auth headers if needed
api.interceptors.request.use((config) => {
  // Add any auth headers here if needed
  return config
})

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
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
    const response = await api.post('/process/single-image', request)
    return response.data
  },

  // Multi-person image face swap
  async processMultiImage(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    const response = await api.post('/process/multi-image', request)
    return response.data
  },

  // Single video face swap
  async processSingleVideo(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    const response = await api.post('/process/single-video', request)
    return response.data
  },

  // Multi-person video face swap
  async processMultiVideo(request: FaceSwapRequest): Promise<ApiResponse<{ jobId: string }>> {
    const response = await api.post('/process/multi-video', request)
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