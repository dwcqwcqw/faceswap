import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, EyeIcon, PlayIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob, DetectedFaces, ApiResponse } from '../types'
import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'

interface FaceMapping {
  faceId: string;
  sourceFile: File | null;  // 替换的源人脸文件
  previewUrl?: string;
}

export default function MultiVideoPage() {
  const [targetVideo, setTargetVideo] = useState<File | null>(null)
  const [targetVideoThumbnail, setTargetVideoThumbnail] = useState<string | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaces | null>(null)
  const [faceMappings, setFaceMappings] = useState<FaceMapping[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)

  // 在组件加载时检查是否有活跃任务需要恢复
  useEffect(() => {
    const activeTask = taskHistory.getLatestActiveTask('multi-video')
    if (activeTask) {
      console.log('🔄 恢复活跃多人视频任务:', activeTask.id)
      setProcessingStatus(activeTask)
      setIsProcessing(true)
      setError(null)
      
      // 恢复轮询
      setTimeout(() => pollJobStatus(activeTask.id), 1000)
    }
  }, [])

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await apiService.getJobStatus(jobId)
      if (response.success && response.data) {
        const status = response.data
        setProcessingStatus(status)
        
        // Update task history
        taskHistory.updateTask(jobId, {
          ...status,
          updated_at: new Date().toISOString()
        })
        
        if (status.status === 'completed') {
          setIsProcessing(false)
        } else if (status.status === 'failed') {
          setIsProcessing(false)
          setError(status.error_message || '处理失败')
        } else {
          setTimeout(() => pollJobStatus(jobId), 3000)
        }
      }
    } catch (error) {
      console.error('Failed to check job status:', error)
      setError('无法获取处理状态')
      setIsProcessing(false)
    }
  }

  const generateVideoThumbnail = (videoFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      video.addEventListener('loadedmetadata', () => {
        // 降低缩略图分辨率以提高速度
        const maxWidth = 640  // 限制最大宽度
        const maxHeight = 480 // 限制最大高度
        
        let { videoWidth, videoHeight } = video
        
        // 按比例缩放
        if (videoWidth > maxWidth || videoHeight > maxHeight) {
          const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight)
          videoWidth = Math.floor(videoWidth * ratio)
          videoHeight = Math.floor(videoHeight * ratio)
        }
        
        canvas.width = videoWidth
        canvas.height = videoHeight
        video.currentTime = 0.5 // 获取0.5秒的帧，更快
      })
      
      video.addEventListener('seeked', () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.6) // 降低质量到0.6
          resolve(thumbnailDataUrl)
        } else {
          reject(new Error('无法创建canvas context'))
        }
      })
      
      video.addEventListener('error', () => {
        reject(new Error('视频加载失败'))
      })
      
      // 添加超时机制
      const timeout = setTimeout(() => {
        reject(new Error('缩略图生成超时'))
      }, 10000) // 10秒超时
      
      video.onloadedmetadata = () => {
        clearTimeout(timeout)
      }
      
      video.src = URL.createObjectURL(videoFile)
    })
  }

  const handleVideoSelect = async (file: File | null) => {
    setTargetVideo(file)
    setDetectedFaces(null)
    setFaceMappings([])
    setTargetVideoThumbnail(null)
    
    if (file) {
      try {
        const thumbnail = await generateVideoThumbnail(file)
        setTargetVideoThumbnail(thumbnail)
      } catch (error) {
        console.error('生成视频缩略图失败:', error)
      }
    }
  }

  const handleDetectFaces = async () => {
    if (!targetVideoThumbnail) return
    
    setIsDetecting(true)
    setError(null)
    
    try {
      // 将缩略图转换为File对象用于人脸检测
      const response = await fetch(targetVideoThumbnail)
      const blob = await response.blob()
      const thumbnailFile = new File([blob], 'video_thumbnail.jpg', { type: 'image/jpeg' })
      
      console.log('上传视频缩略图进行人脸检测...')
      const uploadResponse = await apiService.uploadFile(thumbnailFile)
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('缩略图上传失败')
      }

      // Detect faces with timeout and retry
      console.log('检测人脸...')
      const detectResponse = await Promise.race([
        apiService.detectFaces(uploadResponse.data.fileId),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('人脸检测超时，请重试')), 180000) // 3分钟超时
        )
      ]) as ApiResponse<DetectedFaces>
      
      if (!detectResponse.success || !detectResponse.data) {
        throw new Error('人脸检测失败')
      }

      const faces = detectResponse.data
      setDetectedFaces(faces)
      
      // Initialize face mappings
      const mappings: FaceMapping[] = faces.faces.map((_: any, index: number) => ({
        faceId: `face_${index}`,
        sourceFile: null
      }))
      setFaceMappings(mappings)
      
    } catch (error: any) {
      console.error('人脸检测错误:', error)
      
      // 提供更具体的错误信息和解决建议
      let errorMessage = '人脸检测过程中出现错误'
      
      if (error.message?.includes('timeout') || error.message?.includes('超时')) {
        errorMessage = '人脸检测超时，请确保网络连接稳定后重试。注意：人脸检测通常需要1-3分钟，请耐心等待'
      } else if (error.message?.includes('500')) {
        errorMessage = '服务器处理错误，请稍后重试或更换视频文件'
      } else if (error.message?.includes('upload') || error.message?.includes('上传')) {
        errorMessage = '缩略图上传失败，请检查网络连接'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setError(errorMessage)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleFaceFileSelect = (faceIndex: number, file: File | null) => {
    const newMappings = [...faceMappings]
    newMappings[faceIndex].sourceFile = file
    newMappings[faceIndex].previewUrl = file ? URL.createObjectURL(file) : undefined
    setFaceMappings(newMappings)
  }

  const handleProcess = async () => {
    if (!targetVideo || !detectedFaces || faceMappings.some(m => !m.sourceFile)) return
    
    setIsProcessing(true)
    setError(null)
    setProcessingStatus(null)

    try {
      // Upload target video
      console.log('上传目标视频...')
      const targetResponse = await apiService.uploadFile(targetVideo)
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error('目标视频上传失败')
      }

      // Upload all source faces and create mappings
      const uploadedMappings: { [key: string]: string } = {}
      
      console.log('📤 开始上传人脸映射文件，共', faceMappings.length, '个')
      
      for (let i = 0; i < faceMappings.length; i++) {
        const mapping = faceMappings[i]
        if (mapping.sourceFile) {
          console.log(`上传替换人脸 ${i + 1}...`)
          const sourceResponse = await apiService.uploadFile(mapping.sourceFile)
          if (!sourceResponse.success || !sourceResponse.data) {
            throw new Error(`替换人脸 ${i + 1} 上传失败`)
          }
          uploadedMappings[`face_${i}`] = sourceResponse.data.fileId
          console.log(`✅ 人脸 ${i + 1} 上传成功:`, sourceResponse.data.fileId)
        } else {
          console.error(`❌ 人脸 ${i + 1} 没有文件`)
        }
      }
      
      console.log('🎯 最终映射结果:', uploadedMappings)

      // Start processing (using multi-video processing)
      console.log('开始处理多人视频换脸...')
      console.log('📋 Face mappings:', uploadedMappings)
      console.log('📋 Target file:', targetResponse.data.fileId)
      
      // 确保face_mappings不为空
      if (Object.keys(uploadedMappings).length === 0) {
        throw new Error('没有有效的人脸映射，请确保所有人脸都已上传替换图片')
      }
      
      const processResponse = await apiService.processMultiVideo({
        source_file: '', // Not used for multi-face - individual mappings are used instead
        target_file: targetResponse.data.fileId,
        face_mappings: uploadedMappings,
        options: {
          many_faces: true,
          keep_fps: true,
          video_quality: 20,  // 使用新的优化配置
          mouth_mask: false,  // 使用新的优化配置
          use_face_enhancer: true,  // 使用新的优化配置
        }
      })

      if (processResponse.success && processResponse.data) {
        const jobId = processResponse.data.jobId
        
        const initialStatus: ProcessingJob = {
          id: jobId,
          status: 'pending' as const,
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setProcessingStatus(initialStatus)
        
        // Add to task history
        const historyTask: TaskHistoryItem = {
          ...initialStatus,
          title: `多人视频换脸 - ${targetVideo.name} (${faceMappings.length}个人脸)`,
          type: 'multi-video',
          files: {
            target: targetVideo.name,
            source: faceMappings.map(m => m.sourceFile?.name).filter(Boolean).join(', ')
          }
        }
        taskHistory.addTask(historyTask)
        
        setTimeout(() => pollJobStatus(jobId), 2000)
      } else {
        throw new Error('处理启动失败')
      }
      
    } catch (error: any) {
      console.error('处理错误:', error)
      setError(error.message || '处理过程中出现错误')
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (processingStatus?.result_url) {
      const link = document.createElement('a')
      link.href = apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')
      link.download = 'multi-face-video-swap-result.mp4'
      link.click()
    }
  }

  const handleTaskSelect = (task: TaskHistoryItem) => {
    setSelectedHistoryTask(task)
    // Clear current processing state to show historical result
    setProcessingStatus(null)
    setIsProcessing(false)
    setError(null)
  }

  const handleCloseTaskDetail = () => {
    setSelectedHistoryTask(null)
  }

  const canDetect = targetVideo && targetVideoThumbnail && !isDetecting && !detectedFaces
  const canProcess = targetVideo && detectedFaces && faceMappings.every(m => m.sourceFile) && !isProcessing

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">多人视频换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传包含多人的目标视频，系统将识别所有人脸并允许您为每个人脸选择替换的源人脸
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-sm">
              💡 <strong>操作流程：</strong>1. 上传目标视频（包含多人） → 2. 检测人脸 → 3. 为每个人脸选择替换的源人脸图片 → 4. 开始换脸
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">处理错误</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              
              {/* 错误类型判断和建议 */}
              <div className="mt-3 text-sm text-red-600">
                {error.includes('unexpected EOF') || error.includes('corrupted') ? (
                  <div className="bg-red-100 p-3 rounded border-l-4 border-red-500">
                    <p className="font-medium">🛠️ 文件损坏问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>请重新选择文件并重试</li>
                      <li>确保文件完整且未损坏</li>
                      <li>尝试使用其他视频格式（MP4/AVI/MOV）</li>
                      <li>检查网络连接是否稳定</li>
                    </ul>
                  </div>
                ) : error.includes('timeout') || error.includes('超时') ? (
                  <div className="bg-yellow-100 p-3 rounded border-l-4 border-yellow-500">
                    <p className="font-medium">⏱️ 超时问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>检查网络连接</li>
                      <li>尝试压缩视频文件大小</li>
                      <li>稍后重试</li>
                    </ul>
                  </div>
                ) : error.includes('format') || error.includes('格式') ? (
                  <div className="bg-blue-100 p-3 rounded border-l-4 border-blue-500">
                    <p className="font-medium">📁 格式问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>确保使用支持的视频格式（MP4、AVI、MOV）</li>
                      <li>避免使用损坏或特殊格式的文件</li>
                      <li>尝试重新编码视频</li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-gray-100 p-3 rounded border-l-4 border-gray-500">
                    <p className="font-medium">💡 通用解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>检查网络连接</li>
                      <li>刷新页面重试</li>
                      <li>更换不同的视频文件</li>
                      <li>稍后再试</li>
                    </ul>
                  </div>
                )}
              </div>
              
              {/* 重试按钮 */}
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  关闭错误信息
                </button>
                {canProcess && (
                  <button
                    onClick={handleProcess}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                    重试处理
                  </button>
                )}
                {canDetect && (
                  <button
                    onClick={handleDetectFaces}
                    disabled={!canDetect}
                    className={`
                      inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
                      ${canDetect
                        ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                      }
                      transition-colors
                    `}
                  >
                    {isDetecting ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                        检测人脸中...
                      </>
                    ) : (
                      <>
                        <EyeIcon className="h-4 w-4 mr-2" />
                        检测视频中的人脸
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Size Warning - Removed size restrictions */}

      {/* Step 1: Upload Target Video */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">第一步：上传目标视频</h2>
        <FileUpload
          label="包含多人的目标视频"
          description="上传包含多个人脸的目标视频"
          onFileSelect={handleVideoSelect}
          currentFile={targetVideo}
          onRemove={() => {
            setTargetVideo(null)
            setTargetVideoThumbnail(null)
            setDetectedFaces(null)
            setFaceMappings([])
          }}
          accept={{ 
            'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.3gp', '.m4v', '.webm', '.ogg', '.mpg', '.mpeg']
          }}
        />
        {targetVideo && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              {targetVideoThumbnail ? (
                <img
                  src={targetVideoThumbnail}
                  alt="视频缩略图"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <VideoCameraIcon className="h-16 w-16 text-gray-400" />
                </div>
              )}
              <p className="text-sm text-gray-500 mt-2">
                文件大小: {(targetVideo.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <button
                onClick={handleDetectFaces}
                disabled={!canDetect}
                className={`
                  inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
                  ${canDetect
                    ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  }
                  transition-colors
                `}
              >
                {isDetecting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    检测人脸中...
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-4 w-4 mr-2" />
                    检测视频中的人脸
                  </>
                )}
              </button>
              {canDetect && (
                <p className="text-sm text-blue-600 mt-2">
                  💡 提示：人脸检测通常需要1-3分钟，请耐心等待
                </p>
              )}
              {isDetecting && (
                <p className="text-sm text-orange-600 mt-2">
                  ⏳ 正在检测人脸，请勿关闭页面，预计需要1-3分钟...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Detected Faces and Source Upload */}
      {detectedFaces && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            第二步：为每个检测到的人脸选择替换的源人脸 (检测到 {detectedFaces.faces.length} 个人脸)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {detectedFaces.faces.map((face, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">人脸 {index + 1}</h3>
                
                {/* Face preview from video thumbnail */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">视频中的人脸:</p>
                  {face.preview ? (
                    <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={`data:image/jpeg;base64,${face.preview}`}
                        alt={`人脸 ${index + 1}`}
                        className="max-w-full max-h-full object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-gray-500 text-sm block">
                          位置: ({face.x}, {face.y})
                        </span>
                        <span className="text-gray-500 text-sm block">
                          大小: {face.width} × {face.height}
                        </span>
                        <span className="text-gray-500 text-sm block">
                          置信度: {(face.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {face.preview && (
                    <div className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-medium">位置:</span> ({face.x}, {face.y})
                        </div>
                        <div>
                          <span className="font-medium">大小:</span> {face.width} × {face.height}
                        </div>
                        <div>
                          <span className="font-medium">置信度:</span> {(face.confidence * 100).toFixed(1)}%
                        </div>
                        {face.center_x && face.center_y && (
                          <div>
                            <span className="font-medium">中心:</span> ({face.center_x}, {face.center_y})
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-blue-600 text-xs">
                        💡 人脸按位置排序：从上到下，从左到右
                      </div>
                    </div>
                  )}
                </div>

                {/* Source face upload */}
                <FileUpload
                  label={`替换人脸 ${index + 1}`}
                  description="上传要替换的人脸图片"
                  onFileSelect={(file) => handleFaceFileSelect(index, file)}
                  currentFile={faceMappings[index]?.sourceFile || null}
                  onRemove={() => handleFaceFileSelect(index, null)}
                  accept={{ 
                    'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
                  }}
                />

                {/* Source face preview */}
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
          
          {faceMappings.some(m => !m.sourceFile) && (
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
                ⚠️ 多人视频处理需要很长时间，请耐心等待...
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
                  const errorDiv = e.currentTarget.nextElementSibling as HTMLDivElement;
                  if (errorDiv) {
                    errorDiv.style.display = 'block';
                  }
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div 
                className="text-center py-8 text-red-600" 
                style={{ display: 'none' }}
              >
                ❌ 视频加载失败，请尝试重新下载
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">多人视频换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的多人视频换脸结果已生成，点击下载按钮保存视频文件。
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载结果
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail */}
      {selectedHistoryTask && (
        <TaskDetail 
          task={selectedHistoryTask} 
          onClose={handleCloseTaskDetail}
        />
      )}

      {/* Task History - 只显示多人视频换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="multi-video"
      />

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">多人视频换脸最佳实践:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• <strong>格式支持：</strong>人脸图片支持 JPG、PNG、BMP、TIFF、WebP、GIF、HEIC等格式</li>
          <li>• <strong>视频格式：</strong>支持 MP4、AVI、MOV、MKV、WMV、FLV、3GP、WebM等格式</li>
          <li>• 确保视频中的人脸清晰可见，避免被遮挡或模糊</li>
          <li>• 为每个检测到的人脸准备相应的高质量替换图片</li>
          <li>• 替换图片中的人脸最好与视频中的角度和光线相似</li>
          <li>• <strong>⚡ 优化建议：</strong>使用较短的视频（15秒内）和较少人脸（2-3人）可显著减少处理时间</li>
          <li>• <strong>🎬 质量设置：</strong>系统平衡了质量和速度，保留人脸增强，多人处理需要较长时间</li>
          <li>• <strong>📱 移动设备：</strong>强烈建议在WiFi环境下使用，避免使用移动数据</li>
          <li>• 💡 人脸检测按位置排序：从上到下，从左到右</li>
          <li>• <strong>⏰ 超时提示：</strong>如果人脸检测超时，请尝试更换更清晰的视频或图片</li>
          <li>• <strong>⌛ 处理时间：</strong>人脸检测通常需要1-3分钟，请耐心等待，勿关闭页面</li>
          <li>• <strong>🔄 重试建议：</strong>如果检测失败，请检查网络连接后重试</li>
        </ul>
      </div>
    </div>
  )
} 