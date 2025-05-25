export interface Face {
  id: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
  embedding?: number[]
  preview?: string  // Base64 encoded face image
}

export interface DetectedFaces {
  faces: Face[]
  image_path: string
  total_faces: number
}

export interface ProcessingJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result_url?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface UploadedFile {
  id: string
  filename: string
  url: string
  type: 'image' | 'video'
  size: number
  upload_date: string
}

export interface FaceSwapRequest {
  source_file: string
  target_file: string
  face_mappings?: { [key: string]: string }
  options?: {
    many_faces?: boolean
    mouth_mask?: boolean
    keep_fps?: boolean
    video_quality?: number
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ProcessingOptions {
  many_faces: boolean
  mouth_mask: boolean
  keep_fps: boolean
  video_quality: number  // 0-51, lower = better quality
  video_encoder: 'libx264' | 'libx265' | 'libvpx-vp9'
  execution_provider: string
  use_face_enhancer: boolean  // Enable face enhancement for better quality
} 