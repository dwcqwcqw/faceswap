import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline'
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

  /*
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
          // setTargetVideoThumbnail(canvas.toDataURL()) // This was the original line causing error
        }
        URL.revokeObjectURL(video.src)
      }
    } else {
      // setTargetVideoThumbnail(null) // This was the original line causing error
      setDetectedFaces(null)
      setFaceMappings([])
    }
  }
  */

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
    <div className="container-xs sm:max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8 mb-16 sm:mb-0">
      <div className="text-center mb-4 sm:mb-6 lg:mb-8">
        <h1 className="heading-responsive text-gray-900">多人视频换脸</h1>
        <p className="mt-2 text-mobile-body sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
          上传包含多人的视频，系统将识别所有人脸并允许您为每个人脸选择替换的源人脸
        </p>
        <div className="mt-3 sm:mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-xs sm:text-sm text-center leading-relaxed">
              💡 <strong>操作流程：</strong><br className="sm:hidden" />
              1. 上传目标视频（包含多人） → 2. 检测人脸 → 3. 为每个人脸选择替换的源人脸图片 → 4. 开始换脸
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 animate-slide-down">
          <div className="flex flex-col">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800">处理错误</h3>
                <p className="text-sm text-red-700 mt-1 break-words">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
              <button
                onClick={() => setError(null)}
                className="touch-target flex-1 xs:flex-initial inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus-enhanced transition-colors"
              >
                关闭错误信息
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Target Video Upload */}
      <div className="card-mobile sm:bg-white sm:rounded-lg sm:shadow-sm sm:border sm:border-gray-200 sm:p-4 lg:p-6 mb-4 sm:mb-6 lg:mb-8">
        <h2 className="text-mobile-title sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">步骤 1: 上传目标视频</h2>
        <FileUpload
          label="目标视频（包含多人）"
          description="上传包含多个人脸的视频，系统将自动检测所有人脸"
          onFileSelect={setTargetVideo}
          currentFile={targetVideo}
          onRemove={() => {
            setTargetVideo(null)
            setDetectedFaces(null)
            setFaceMappings([])
          }}
          accept={{ 
            'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.3gp', '.m4v', '.webm']
          }}
        />


        {/* Face Detection Button */}
        {targetVideo && !detectedFaces && (
          <div className="mt-4 sm:mt-6 text-center">
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={handleDetectFaces}
                disabled={!canDetect}
                className={`
                  btn-mobile w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg transition-all duration-200 focus-enhanced
                  ${canDetect
                    ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  }
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
                    检测人脸
                  </>
                )}
              </button>
              {canDetect && (
                <p className="text-xs sm:text-sm text-blue-600 mt-3 text-center px-2">
                  💡 提示：视频人脸检测通常需要3-5分钟，请耐心等待
                </p>
              )}
              {isDetecting && (
                <p className="text-xs sm:text-sm text-orange-600 mt-3 text-center px-2">
                  ⏳ 正在检测视频中的人脸，请勿关闭页面，预计需要3-5分钟...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Detected Faces and Source Upload */}
      {detectedFaces && (
        <div className="card-mobile sm:bg-white sm:rounded-lg sm:shadow-sm sm:border sm:border-gray-200 sm:p-4 lg:p-6 mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-mobile-title sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
            步骤 2: 为每个人脸选择替换图片 ({detectedFaces.faces.length} 个人脸)
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 leading-relaxed">
            系统检测到 {detectedFaces.faces.length} 个人脸，请为每个人脸上传对应的替换图片。
            人脸编号按从左到右、从上到下的顺序排列。
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {detectedFaces.faces.map((face: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-base font-medium text-gray-900 mb-3">
                  人脸 {index + 1}：这个位置的人脸将被替换为您上传的图片
                </h3>
                
                {/* Show detected face preview */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">检测到的人脸:</p>
                  <div className="w-full h-32 bg-gray-100 rounded border flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-gray-500 text-sm">
                        视频人脸 {index + 1}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        置信度: {(face.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload replacement face */}
                <div>
                  <FileUpload
                    label={`替换人脸 ${index + 1}`}
                    description="上传要替换到此位置的人脸图片"
                    onFileSelect={(file) => handleFaceFileSelect(index, file)}
                    currentFile={faceMappings[index]?.sourceFile || null}
                    onRemove={() => handleFaceFileSelect(index, null)}
                    accept={{ 
                      'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
                    }}
                  />
                  {faceMappings[index]?.previewUrl && (
                    <div className="mt-2">
                      <img
                        src={faceMappings[index].previewUrl}
                        alt={`替换人脸 ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Process Button */}
      {detectedFaces && (
        <div className="text-center mb-6 sm:mb-8">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={`
              btn-mobile w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg transition-all duration-200 focus-enhanced
              ${canProcess
                ? 'text-white bg-primary-600 hover:bg-primary-700 hover:scale-105 shadow-lg hover:shadow-xl'
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }
            `}
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                开始多人视频换脸
              </>
            )}
          </button>
          {canProcess && (
            <p className="text-sm text-gray-600 mt-2">
              已为 {faceMappings.filter(m => m.sourceFile).length}/{faceMappings.length} 个人脸选择了替换图片
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
      <div className="mt-6 sm:mt-8 bg-gray-50 rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">获得最佳效果的建议:</h3>
        <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
          <li>• 使用高分辨率、人脸清晰的视频和替换图片</li>
          <li>• 确保替换人脸图片中的人脸朝向正前方</li>
          <li>• 视频中的人脸应该清晰可见，避免过度遮挡</li>
          <li>• 人脸编号按从左到右、从上到下的顺序排列</li>
          <li>• 支持多种视频格式：MP4、AVI、MOV、MKV、WMV等</li>
          <li>• 多人视频换脸处理时间很长，请耐心等待</li>
          <li>• 建议使用较短的视频（30秒-1分钟）以减少处理时间</li>
        </ul>
      </div>
    </div>
  )
} 