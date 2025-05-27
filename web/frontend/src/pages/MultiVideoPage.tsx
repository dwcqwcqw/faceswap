import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, ExclamationTriangleIcon, EyeIcon, PlayIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { DetectedFaces } from '../types'
import { TaskHistoryItem } from '../utils/taskHistory'
import { taskManager } from '../utils/taskManager'

interface FaceMapping {
  faceId: string;
  sourceFile: File | null;
  previewUrl?: string;
}

export default function MultiVideoPage() {
  const [targetVideo, setTargetVideo] = useState<File | null>(null)
  const [targetVideoThumbnail, setTargetVideoThumbnail] = useState<string | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaces | null>(null)
  const [faceMappings, setFaceMappings] = useState<FaceMapping[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 组件加载时的初始化
  useEffect(() => {
    // 任务管理器会自动恢复活跃任务，无需手动处理
  }, [])

  const handleVideoSelect = (file: File | null) => {
    setTargetVideo(file)
    if (file) {
      // 生成视频缩略图
      const video = document.createElement('video')
      video.src = URL.createObjectURL(file)
      video.currentTime = 1 // 获取第1秒的帧
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          setTargetVideoThumbnail(canvas.toDataURL())
        }
        URL.revokeObjectURL(video.src)
      }
    } else {
      setTargetVideoThumbnail(null)
      setDetectedFaces(null)
      setFaceMappings([])
    }
  }

  const handleDetectFaces = async () => {
    if (!targetVideo) return
    
    setIsDetecting(true)
    setError(null)
    
    try {
      // Upload video first
      console.log('上传视频进行人脸检测...')
      const uploadResponse = await apiService.uploadFile(targetVideo)
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('视频上传失败')
      }

      // Detect faces
      console.log('检测视频中的人脸...')
      const detectResponse = await apiService.detectFaces(uploadResponse.data.fileId)
      
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
      setError(error.message || '人脸检测过程中出现错误')
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
    
    // 检查是否可以启动新任务
    if (!taskManager.canStartNewTask()) {
      setError(`已达到最大并发任务数限制 (${taskManager.getConcurrentTaskCount()}/5)`)
      return
    }
    
    setIsSubmitting(true)
    setError(null)

    try {
      // Upload target video
      console.log('上传目标视频...')
      const targetResponse = await apiService.uploadFile(targetVideo)
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error('目标视频上传失败')
      }

      // Upload all source faces and create mappings
      const uploadedMappings: { [key: string]: string } = {}
      
      for (let i = 0; i < faceMappings.length; i++) {
        const mapping = faceMappings[i]
        if (mapping.sourceFile) {
          console.log(`上传替换人脸 ${i + 1}...`)
          const sourceResponse = await apiService.uploadFile(mapping.sourceFile)
          if (!sourceResponse.success || !sourceResponse.data) {
            throw new Error(`替换人脸 ${i + 1} 上传失败`)
          }
          uploadedMappings[`face_${i}`] = sourceResponse.data.fileId
        }
      }

      // Start processing
      console.log('开始多人视频换脸处理...')
      const processResponse = await apiService.processMultiVideo({
        source_file: '', // Not used for multi-face
        target_file: targetResponse.data.fileId,
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
        console.log('✅ 多人视频换脸任务创建成功:', jobId)
        
        // 使用任务管理器启动任务
        await taskManager.startTask(
          jobId,
          'multi-video',
          `多人视频换脸 - ${targetVideo.name} (${faceMappings.length}个人脸)`,
          {
            target: targetVideo.name,
            source: faceMappings.map(m => m.sourceFile?.name).filter(Boolean).join(', ')
          }
        )
        
        // 清空表单
        setTargetVideo(null)
        setTargetVideoThumbnail(null)
        setDetectedFaces(null)
        setFaceMappings([])
        
        console.log('✅ 多人视频换脸任务已提交，可以继续提交新任务')
      } else {
        throw new Error('处理启动失败')
      }
      
    } catch (error: any) {
      console.error('处理错误:', error)
      setError(error.message || '处理过程中出现错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTaskSelect = (task: TaskHistoryItem) => {
    setSelectedHistoryTask(task)
    setError(null)
  }

  const handleCloseTaskDetail = () => {
    setSelectedHistoryTask(null)
  }

  const canDetect = targetVideo && !isDetecting && !detectedFaces
  const canProcess = targetVideo && detectedFaces && faceMappings.every(m => m.sourceFile) && !isSubmitting

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
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    重新检测人脸
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Upload Target Video */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">第一步：上传目标视频</h2>
        <FileUpload
          label="包含多人的目标视频"
          description="上传包含多个人脸的目标视频"
          onFileSelect={handleVideoSelect}
          currentFile={targetVideo}
          onRemove={() => handleVideoSelect(null)}
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

      {/* Step 2: Detected Faces and Target Upload */}
      {detectedFaces && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            第二步：为每个检测到的人脸选择替换的源人脸 (检测到 {detectedFaces.faces.length} 个人脸)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {detectedFaces.faces.map((face, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">人脸 {index + 1}</h3>
                
                {/* Face preview from original video */}
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
                        <span className="text-gray-500 text-sm">
                          置信度: {(face.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Target face upload */}
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
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                提交中...
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
          <li>• <strong>格式支持：</strong>视频支持 MP4、AVI、MOV、MKV、WMV等格式</li>
          <li>• 确保视频中的人脸清晰可见，避免被遮挡或模糊</li>
          <li>• 为每个检测到的人脸准备相应的高质量替换图片</li>
          <li>• 替换图片中的人脸最好与视频中的角度和光线相似</li>
          <li>• <strong>⏰ 处理时间：</strong>多人视频换脸通常需要10-30分钟，具体取决于视频长度和人脸数量</li>
          <li>• <strong>🎬 输出质量：</strong>系统会保持原视频的帧率和高质量输出</li>
          <li>• <strong>🔊 音频保留：</strong>处理后的视频会保留原始音频</li>
          <li>• <strong>💡 优化建议：</strong>使用人脸较少的视频（2-3人）可显著减少处理时间</li>
          <li>• <strong>⚠️ 注意事项：</strong>请勿在检测或处理过程中关闭页面</li>
          <li>• <strong>📱 网络建议：</strong>强烈建议在WiFi环境下使用</li>
        </ul>
      </div>
    </div>
  )
} 