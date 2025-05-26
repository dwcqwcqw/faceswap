import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, PlayIcon, VideoCameraIcon, PhotoIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob } from '../types'
import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'

export default function VideoPage() {
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)

  // 在组件加载时检查是否有活跃任务需要恢复
  useEffect(() => {
    const activeTask = taskHistory.getLatestActiveTask('video')
    if (activeTask) {
      console.log('🔄 恢复活跃视频任务:', activeTask.id)
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

  const handleProcess = async () => {
    if (!sourceVideo || !targetFace) return
    
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

      // Upload target face
      console.log('上传目标人脸...')
      const targetResponse = await apiService.uploadFile(targetFace)
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error('目标人脸上传失败')
      }

      // Start processing
      console.log('开始视频换脸处理...')
      console.log('📋 Request payload:', {
        source_file: sourceResponse.data.fileId,
        target_file: targetResponse.data.fileId,
        source_file_info: {
          name: sourceVideo.name,
          type: sourceVideo.type,
          size: sourceVideo.size
        },
        target_file_info: {
          name: targetFace.name,
          type: targetFace.type,  
          size: targetFace.size
        },
        options: {
          keep_fps: true,
          video_quality: 18,
          mouth_mask: true,
        }
      })
      
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
          title: `视频换脸 - ${sourceVideo.name} → ${targetFace.name}`,
          type: 'video',
          files: {
            source: sourceVideo.name,
            target: targetFace.name
          }
        }
        taskHistory.addTask(historyTask)
        
        setTimeout(() => pollJobStatus(jobId), 2000)
      } else {
        throw new Error('处理启动失败')
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
      link.download = 'video-face-swap-result.mp4'
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



  const canProcess = sourceVideo && targetFace && !isProcessing
  const videoSizeLimit = 100 * 1024 * 1024 // 100MB
  const isVideoTooLarge = targetFace ? targetFace.size > videoSizeLimit : false

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">视频换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传人脸图片和目标视频，AI将为视频中的人脸进行换脸处理
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-sm">
              💡 <strong>上传要求：</strong>左侧上传人脸图片（JPG/PNG），右侧上传目标视频（MP4/AVI/MOV）
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
                {canProcess && !isVideoTooLarge && (
                  <button
                    onClick={handleProcess}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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

      {/* Video Size Warning */}
      {isVideoTooLarge && targetFace && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">文件大小警告</h3>
              <p className="text-sm text-yellow-700">
                视频文件过大 ({(targetFace.size / 1024 / 1024).toFixed(2)} MB)，建议压缩到100MB以下以获得更快的处理速度。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Face Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="人脸图片"
            description="上传要替换的人脸图片（仅限JPG/PNG格式）"
            onFileSelect={setSourceVideo}
            currentFile={sourceVideo}
            onRemove={() => setSourceVideo(null)}
            accept={{ 
              'image/*': ['.png', '.jpg', '.jpeg']
            }}
          />
          {sourceVideo && (
            <div className="mt-4">
              <div className="bg-gray-100 rounded-lg p-4 flex items-center">
                <PhotoIcon className="h-8 w-8 text-gray-400 mr-3" />
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
              {/* Image preview */}
              <img
                src={URL.createObjectURL(sourceVideo)}
                alt="人脸图片预览"
                className="w-full h-48 object-cover rounded-lg mt-3"
              />
            </div>
          )}
        </div>

        {/* Target Video Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="目标视频"
            description="上传需要换脸的视频文件（仅限MP4/AVI/MOV格式）"
            onFileSelect={setTargetFace}
            currentFile={targetFace}
            onRemove={() => setTargetFace(null)}
            accept={{ 
              'video/*': ['.mp4', '.avi', '.mov', '.mkv']
            }}
          />
          {targetFace && (
            <div className="mt-4">
              <div className="bg-gray-100 rounded-lg p-4 flex items-center">
                <VideoCameraIcon className="h-8 w-8 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">{targetFace.name}</p>
                  <p className="text-sm text-gray-500">
                    文件大小: {(targetFace.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-500">
                    类型: {targetFace.type}
                  </p>
                </div>
              </div>
              {/* Video preview */}
              <video
                src={URL.createObjectURL(targetFace)}
                className="w-full h-48 object-cover rounded-lg mt-3"
                controls
                preload="metadata"
              />
            </div>
          )}
        </div>
      </div>

      {/* Process Button */}
      <div className="text-center mb-8">
        <button
          onClick={handleProcess}
          disabled={!canProcess || isVideoTooLarge}
          className={`
            inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md
            ${canProcess && !isVideoTooLarge
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
              开始视频换脸
            </>
          )}
        </button>
        
        {isVideoTooLarge && (
          <p className="mt-2 text-sm text-red-600">
            请上传小于100MB的视频文件
          </p>
        )}
      </div>

      {/* Processing Status */}
      {processingStatus && isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="loading-spinner mr-3"></div>
            <div>
              <h3 className="text-lg font-medium text-blue-900">正在处理您的视频换脸请求</h3>
              <p className="text-blue-700">任务ID: {processingStatus.id}</p>
              <p className="text-blue-700">
                状态: {processingStatus.status} | 进度: {processingStatus.progress}%
              </p>
              <p className="text-sm text-blue-600 mt-2">
                ⚠️ 视频处理通常需要较长时间，请耐心等待...
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">视频换脸结果</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {/* Video display only - no image fallback needed for video results */}
              <video
                src={apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')}
                className="w-full rounded-lg shadow-sm"
                controls
                preload="metadata"
                onError={(e) => {
                  console.error('Video load error:', e);
                  // Show error message instead of fallback
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
              <h4 className="text-lg font-medium text-gray-900 mb-2">视频换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的视频换脸结果已生成，点击下载按钮保存视频文件。
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mb-3"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载视频结果
              </button>
              
              <div className="text-sm text-gray-500">
                <p>💡 提示：下载的视频文件可能较大，请确保网络连接稳定</p>
                <p>🎬 结果格式：MP4高质量视频</p>
              </div>
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

      {/* Task History - 只显示视频换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="video"
      />

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">视频换脸最佳实践:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• <strong>严格格式要求：</strong>人脸图片仅支持 JPG、PNG 格式，目标视频仅支持 MP4、AVI、MOV 格式</li>
          <li>• <strong>上传顺序：</strong>左侧上传人脸图片，右侧上传目标视频</li>
          <li>• 建议视频分辨率不超过1080p，文件大小不超过100MB</li>
          <li>• <strong>AI超分辨率：</strong>自动为低分辨率视频（&lt;1024px）提供2x高清增强</li>
          <li>• 确保视频中的人脸清晰可见，避免快速移动或模糊</li>
          <li>• 人脸图片最好与视频中的人脸角度和光线相似</li>
          <li>• 视频处理时间较长，通常需要几分钟到几十分钟</li>
          <li>• 较短的视频片段能获得更快的处理速度和更好的效果</li>
          <li>• <strong>结果格式：</strong>视频换脸结果始终为MP4格式的高质量视频</li>
        </ul>
      </div>
    </div>
  )
} 