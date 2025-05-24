import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, PlayIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob } from '../types'

export default function VideoPage() {
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
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
          // Continue polling if still processing
          setTimeout(() => pollJobStatus(jobId), 5000) // Video processing takes longer
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
        setProcessingStatus({
          id: jobId,
          status: 'pending',
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        
        // Start polling for status
        setTimeout(() => pollJobStatus(jobId), 3000)
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
      link.download = 'video-face-swap-result.mp4'
      link.click()
    }
  }

  const canProcess = sourceVideo && targetFace && !isProcessing
  const videoSizeLimit = 100 * 1024 * 1024 // 100MB
  const isVideoTooLarge = sourceVideo ? sourceVideo.size > videoSizeLimit : false

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">视频换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传视频和目标人脸，AI将为视频中的人脸进行换脸处理
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
                视频文件过大 ({(sourceVideo.size / 1024 / 1024).toFixed(2)} MB)，建议压缩到100MB以下以获得更快的处理速度。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Video Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="原视频"
            description="上传需要换脸的视频文件"
            onFileSelect={setSourceVideo}
            currentFile={sourceVideo}
            onRemove={() => setSourceVideo(null)}
            accept={{ 'video/*': ['.mp4', '.avi', '.mov', '.mkv'] }}
          />
          {sourceVideo && (
            <div className="mt-4">
              <div className="bg-gray-100 rounded-lg p-4 flex items-center">
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
              {/* Video preview if supported */}
              <video
                src={URL.createObjectURL(sourceVideo)}
                className="w-full h-48 object-cover rounded-lg mt-3"
                controls
                preload="metadata"
              />
            </div>
          )}
        </div>

        {/* Target Face Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="目标人脸"
            description="上传要替换的人脸图片"
            onFileSelect={setTargetFace}
            currentFile={targetFace}
            onRemove={() => setTargetFace(null)}
            accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
          />
          {targetFace && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(targetFace)}
                alt="目标人脸"
                className="w-full h-48 object-cover rounded-lg"
              />
              <p className="text-sm text-gray-500 mt-2">
                文件大小: {(targetFace.size / 1024 / 1024).toFixed(2)} MB
              </p>
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
              <h4 className="text-lg font-medium text-gray-900 mb-2">视频换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的视频换脸结果已生成，点击下载按钮保存视频。
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mb-3"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载视频结果
              </button>
              
              <div className="text-sm text-gray-500">
                <p>💡 提示：下载的视频可能较大，请确保网络连接稳定</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">视频换脸最佳实践:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• 支持 MP4、AVI、MOV、MKV 等常见视频格式</li>
          <li>• 建议视频分辨率不超过1080p，文件大小不超过100MB</li>
          <li>• 确保视频中的人脸清晰可见，避免快速移动或模糊</li>
          <li>• 目标人脸图片最好与视频中的人脸角度和光线相似</li>
          <li>• 视频处理时间较长，通常需要几分钟到几十分钟</li>
          <li>• 较短的视频片段能获得更快的处理速度和更好的效果</li>
        </ul>
      </div>
    </div>
  )
} 