import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { TaskHistoryItem } from '../utils/taskHistory'
import { taskManager } from '../utils/taskManager'

export default function VideoPage() {
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 组件加载时的初始化
  useEffect(() => {
    // 任务管理器会自动恢复活跃任务，无需手动处理
  }, [])

  const handleProcess = async () => {
    if (!sourceVideo || !targetFace) return
    
    // 检查是否可以启动新任务
    if (!taskManager.canStartNewTask()) {
      setError(`已达到最大并发任务数限制 (${taskManager.getConcurrentTaskCount()}/5)`)
      return
    }
    
    setIsSubmitting(true)
    setError(null)

    try {
      // Upload source video (actually the face image)
      console.log('上传人脸图片...')
      const sourceResponse = await apiService.uploadFile(sourceVideo)
      if (!sourceResponse.success || !sourceResponse.data) {
        throw new Error('人脸图片上传失败')
      }

      // Upload target video
      console.log('上传目标视频...')
      const targetResponse = await apiService.uploadFile(targetFace)
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error('目标视频上传失败')
      }

      // Start processing
      console.log('开始视频换脸处理...')
      const processResponse = await apiService.processSingleVideo({
        source_file: sourceResponse.data.fileId,
        target_file: targetResponse.data.fileId,
        options: {
          keep_fps: true,
          video_quality: 18, // High quality
          mouth_mask: true,
        }
      })

      if (processResponse.success && processResponse.data) {
        const jobId = processResponse.data.jobId
        console.log('✅ 视频换脸任务创建成功:', jobId)
        
        // 使用任务管理器启动任务
        await taskManager.startTask(
          jobId,
          'single-video',
          `视频换脸 - ${targetFace.name} → ${sourceVideo.name}`,
          {
            source: sourceVideo.name,
            target: targetFace.name
          }
        )
        
        // 清空表单
        setSourceVideo(null)
        setTargetFace(null)
        
        console.log('✅ 视频换脸任务已提交，可以继续提交新任务')
      } else {
        throw new Error('处理启动失败')
      }
      
    } catch (error: any) {
      console.error('视频处理错误:', error)
      setError(error.message || '视频处理过程中出现错误')
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

  const canProcess = sourceVideo && targetFace && !isSubmitting

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">视频换脸</h1>
        <p className="mt-2 text-base sm:text-lg text-gray-600">
          上传人脸图片和目标视频，AI将为视频中的人脸进行换脸处理
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-sm">
              💡 <strong>上传要求：</strong>左侧上传人脸图片，右侧上传目标视频
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-0 sm:mr-2 mb-2 sm:mb-0 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">处理错误</h3>
              <p className="text-sm text-red-700 mt-1 break-words">{error}</p>
              <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex items-center justify-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  关闭错误信息
                </button>
                {canProcess && (
                  <button
                    onClick={handleProcess}
                    className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                    重试处理
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
        {/* Source Face Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <FileUpload
            label="源人脸图片"
            description="上传要替换到视频中的人脸图片"
            onFileSelect={setSourceVideo}
            currentFile={sourceVideo}
            onRemove={() => setSourceVideo(null)}
            accept={{ 
              'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
            }}
          />

        </div>

        {/* Target Video Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <FileUpload
            label="目标视频"
            description="上传需要换脸的视频文件"
            onFileSelect={setTargetFace}
            currentFile={targetFace}
            onRemove={() => setTargetFace(null)}
            accept={{ 
              'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.3gp', '.m4v', '.webm']
            }}
          />

        </div>
      </div>

      {/* Process Button */}
      <div className="text-center mb-6 sm:mb-8">
        <button
          onClick={handleProcess}
          disabled={!canProcess}
          className={`
            inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md w-full sm:w-auto
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
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              开始视频换脸
            </>
          )}
        </button>
      </div>

      {/* Task Detail */}
      {selectedHistoryTask && (
        <TaskDetail 
          task={selectedHistoryTask} 
          onClose={handleCloseTaskDetail}
        />
      )}

      {/* Task History - 只显示视频换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="single-video"
      />

      {/* Tips */}
      <div className="mt-6 sm:mt-8 bg-gray-50 rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">获得最佳效果的建议:</h3>
        <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
          <li>• 使用高分辨率、人脸清晰的源人脸图片</li>
          <li>• 确保源人脸图片中的人脸朝向正前方</li>
          <li>• 视频中的人脸应该清晰可见，避免过度遮挡</li>
          <li>• 支持多种视频格式：MP4、AVI、MOV、MKV、WMV等</li>
          <li>• 视频处理时间较长，请耐心等待</li>
          <li>• 建议使用较短的视频（1-2分钟）以减少处理时间</li>
        </ul>
      </div>
    </div>
  )
} 