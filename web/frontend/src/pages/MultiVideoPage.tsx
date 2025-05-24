import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, EyeIcon, PlayIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob, DetectedFaces } from '../types'

interface FaceMapping {
  faceId: string;
  targetFile: File | null;
  previewUrl?: string;
}

export default function MultiVideoPage() {
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaces | null>(null)
  const [faceMappings, setFaceMappings] = useState<FaceMapping[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await apiService.getJobStatus(jobId)
      if (response.success && response.data) {
        const status = response.data
        setProcessingStatus(status)
        
        if (status.status === 'completed') {
          setIsProcessing(false)
        } else if (status.status === 'failed') {
          setIsProcessing(false)
          setError(status.error_message || '视频处理失败')
        } else {
          setTimeout(() => pollJobStatus(jobId), 8000) // Video processing takes much longer
        }
      }
    } catch (error) {
      console.error('Failed to check job status:', error)
      setError('无法获取处理状态')
      setIsProcessing(false)
    }
  }

  const handleDetectFaces = async () => {
    if (!sourceVideo) return
    
    setIsDetecting(true)
    setError(null)
    
    try {
      // Upload source video first - we'll detect faces from the first frame
      console.log('上传视频进行人脸检测...')
      const uploadResponse = await apiService.uploadFile(sourceVideo)
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('视频上传失败')
      }

      // Detect faces - the API should extract the first frame and detect faces
      console.log('检测视频中的人脸...')
      const detectResponse = await apiService.detectFaces(uploadResponse.data.fileId)
      if (!detectResponse.success || !detectResponse.data) {
        throw new Error('视频人脸检测失败')
      }

      const faces = detectResponse.data
      setDetectedFaces(faces)
      
      // Initialize face mappings
      const mappings: FaceMapping[] = faces.faces.map((_, index) => ({
        faceId: `face_${index}`,
        targetFile: null
      }))
      setFaceMappings(mappings)
      
    } catch (error: any) {
      console.error('视频人脸检测错误:', error)
      setError(error.message || '视频人脸检测过程中出现错误')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleFaceFileSelect = (faceIndex: number, file: File | null) => {
    const newMappings = [...faceMappings]
    newMappings[faceIndex].targetFile = file
    newMappings[faceIndex].previewUrl = file ? URL.createObjectURL(file) : undefined
    setFaceMappings(newMappings)
  }

  const handleProcess = async () => {
    if (!sourceVideo || !detectedFaces || faceMappings.some(m => !m.targetFile)) return
    
    setIsProcessing(true)
    setError(null)
    setProcessingStatus(null)

    try {
      // Upload source video
      console.log('上传原视频...')
      const sourceResponse = await apiService.uploadFile(sourceVideo)
      if (!sourceResponse.success || !sourceResponse.data) {
        throw new Error('原视频上传失败')
      }

      // Upload all target faces and create mappings
      const uploadedMappings: { [key: string]: string } = {}
      
      for (let i = 0; i < faceMappings.length; i++) {
        const mapping = faceMappings[i]
        if (mapping.targetFile) {
          console.log(`上传目标人脸 ${i + 1}...`)
          const targetResponse = await apiService.uploadFile(mapping.targetFile)
          if (!targetResponse.success || !targetResponse.data) {
            throw new Error(`目标人脸 ${i + 1} 上传失败`)
          }
          uploadedMappings[`face_${i}`] = targetResponse.data.fileId
        }
      }

      // Start processing
      console.log('开始处理多人视频换脸...')
      const processResponse = await apiService.processMultiVideo({
        source_file: sourceResponse.data.fileId,
        target_file: '', // Not used for multi-face
        face_mappings: uploadedMappings,
        options: {
          many_faces: true,
          keep_fps: true,
          video_quality: 18,
          mouth_mask: true,
        }
      })

      if (processResponse.success && processResponse.data) {
        const jobId = processResponse.data.jobId
        setProcessingStatus({
          id: jobId,
          status: 'pending',
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        
        setTimeout(() => pollJobStatus(jobId), 5000)
      } else {
        throw new Error('视频处理启动失败')
      }
      
    } catch (error: any) {
      console.error('视频处理错误:', error)
      setError(error.message || '视频处理过程中出现错误')
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (processingStatus?.result_url) {
      const link = document.createElement('a')
      link.href = apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')
      link.download = 'multi-video-face-swap-result.mp4'
      link.click()
    }
  }

  const canDetect = sourceVideo && !isDetecting && !detectedFaces
  const canProcess = sourceVideo && detectedFaces && faceMappings.every(m => m.targetFile) && !isProcessing
  const videoSizeLimit = 200 * 1024 * 1024 // 200MB for multi-video
  const isVideoTooLarge = sourceVideo ? sourceVideo.size > videoSizeLimit : false

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">多人视频换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传包含多人的视频，系统将识别所有人脸并允许您分别替换
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">处理错误</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video Size Warning */}
      {isVideoTooLarge && sourceVideo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">文件大小警告</h3>
              <p className="text-sm text-yellow-700">
                视频文件过大 ({(sourceVideo.size / 1024 / 1024).toFixed(2)} MB)，建议压缩到200MB以下以获得更快的处理速度。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Upload Source Video */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">第一步：上传原视频</h2>
        <FileUpload
          label="包含多人的原视频"
          description="上传包含多个人脸的视频文件"
          onFileSelect={setSourceVideo}
          currentFile={sourceVideo}
          onRemove={() => {
            setSourceVideo(null)
            setDetectedFaces(null)
            setFaceMappings([])
          }}
          accept={{ 'video/*': ['.mp4', '.avi', '.mov', '.mkv'] }}
        />
        {sourceVideo && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center mb-3">
                <VideoCameraIcon className="h-8 w-8 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">{sourceVideo.name}</p>
                  <p className="text-sm text-gray-500">
                    文件大小: {(sourceVideo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-500">
                    类型: {sourceVideo.type}
                  </p>
                </div>
              </div>
              <video
                src={URL.createObjectURL(sourceVideo)}
                className="w-full h-48 object-cover rounded-lg"
                controls
                preload="metadata"
              />
            </div>
            <div className="flex flex-col justify-center">
              <button
                onClick={handleDetectFaces}
                disabled={!canDetect || isVideoTooLarge}
                className={`
                  inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
                  ${canDetect && !isVideoTooLarge
                    ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  }
                  transition-colors
                `}
              >
                {isDetecting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    检测视频人脸中...
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-4 w-4 mr-2" />
                    检测视频中的人脸
                  </>
                )}
              </button>
              
              {isVideoTooLarge && (
                <p className="mt-2 text-sm text-red-600">
                  请上传小于200MB的视频文件
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Detected Faces and Target Upload */}
      {detectedFaces && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            第二步：为每个人脸选择替换图片 (检测到 {detectedFaces.faces.length} 个人脸)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {detectedFaces.faces.map((face, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">人脸 {index + 1}</h3>
                
                {/* Face preview from video frame */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">视频中的人脸:</p>
                  <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-sm text-center">
                      位置: ({face.x}, {face.y})<br/>
                      置信度: {(face.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Target face upload */}
                <FileUpload
                  label={`替换人脸 ${index + 1}`}
                  description="上传要替换的人脸图片"
                  onFileSelect={(file) => handleFaceFileSelect(index, file)}
                  currentFile={faceMappings[index]?.targetFile || null}
                  onRemove={() => handleFaceFileSelect(index, null)}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
                />

                {/* Target face preview */}
                {faceMappings[index]?.previewUrl && (
                  <div className="mt-3">
                    <img
                      src={faceMappings[index].previewUrl}
                      alt={`替换人脸 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Process Button */}
      {detectedFaces && (
        <div className="text-center mb-8">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={`
              inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md
              ${canProcess
                ? 'text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }
              transition-colors
            `}
          >
            {isProcessing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <PlayIcon className="h-5 w-5 mr-2" />
                开始多人视频换脸
              </>
            )}
          </button>
          
          {faceMappings.some(m => !m.targetFile) && (
            <p className="mt-2 text-sm text-red-600">
              请为所有检测到的人脸上传替换图片
            </p>
          )}
        </div>
      )}

      {/* Processing Status */}
      {processingStatus && isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="loading-spinner mr-3"></div>
            <div>
              <h3 className="text-lg font-medium text-blue-900">正在处理您的多人视频换脸请求</h3>
              <p className="text-blue-700">任务ID: {processingStatus.id}</p>
              <p className="text-blue-700">
                状态: {processingStatus.status} | 进度: {processingStatus.progress}%
              </p>
              <p className="text-sm text-blue-600 mt-2">
                ⚠️ 多人视频处理时间很长，可能需要数十分钟，请耐心等待...
              </p>
            </div>
          </div>
          <div className="mt-4 bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${processingStatus.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Result */}
      {processingStatus?.status === 'completed' && processingStatus.result_url && !isProcessing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">多人视频换脸结果</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <video
                src={apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')}
                className="w-full rounded-lg shadow-sm"
                controls
                preload="metadata"
                onError={(e) => {
                  console.error('Video load error:', e);
                }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">多人视频换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的多人视频换脸结果已生成，点击下载按钮保存视频。
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mb-3"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载视频结果
              </button>
              
              <div className="text-sm text-gray-500">
                <p>💡 提示：下载的视频可能很大，请确保网络连接稳定</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">多人视频换脸最佳实践:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• 支持 MP4、AVI、MOV、MKV 等常见视频格式</li>
          <li>• 建议视频分辨率不超过1080p，文件大小不超过200MB</li>
          <li>• 确保视频中的人脸清晰可见，避免快速移动或模糊</li>
          <li>• 为每个检测到的人脸准备相应的高质量替换图片</li>
          <li>• 替换图片中的人脸最好与视频中的角度和光线相似</li>
          <li>• 多人视频处理时间很长，通常需要数十分钟到几小时</li>
          <li>• 建议使用人脸较少且时长较短的视频以获得更好的效果</li>
        </ul>
      </div>
    </div>
  )
} 