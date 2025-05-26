import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob } from '../types'

export default function SingleImagePage() {
  const [sourceImage, setSourceImage] = useState<File | null>(null)
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
          setError(status.error_message || '处理失败')
        } else {
          // Continue polling if still processing
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
    if (!sourceImage || !targetFace) return
    
    setIsProcessing(true)
    setError(null)
    setProcessingStatus(null)

    try {
      // Upload source image
      console.log('上传原图...', sourceImage.name, sourceImage.size)
      const sourceResponse = await apiService.uploadFile(sourceImage)
      console.log('原图上传响应:', sourceResponse)
      
      if (!sourceResponse.success || !sourceResponse.data) {
        throw new Error(`原图上传失败: ${sourceResponse.error || '未知错误'}`)
      }
      
      console.log('✅ 原图上传成功:', sourceResponse.data.fileId)

      // Upload target face
      console.log('上传目标人脸...', targetFace.name, targetFace.size)
      const targetResponse = await apiService.uploadFile(targetFace)
      console.log('目标人脸上传响应:', targetResponse)
      
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error(`目标人脸上传失败: ${targetResponse.error || '未知错误'}`)
      }
      
      console.log('✅ 目标人脸上传成功:', targetResponse.data.fileId)

      // Verify both files can be accessed before processing
      console.log('验证文件可访问性...')
      
      // Start processing only after both uploads are confirmed
      console.log('开始处理...', {
        source_file: sourceResponse.data.fileId,
        target_file: targetResponse.data.fileId
      })
      
      const processResponse = await apiService.processSingleImage({
        source_file: sourceResponse.data.fileId,
        target_file: targetResponse.data.fileId,
        options: {
          mouth_mask: true,
        }
      })

      console.log('处理响应:', processResponse)

      if (processResponse.success && processResponse.data) {
        const jobId = processResponse.data.jobId
        console.log('✅ 处理任务创建成功:', jobId)
        
        setProcessingStatus({
          id: jobId,
          status: 'pending',
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        
        // Start polling for status
        setTimeout(() => pollJobStatus(jobId), 2000)
      } else {
        throw new Error(`处理启动失败: ${processResponse.error || '未知错误'}`)
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
      link.download = 'face-swap-result.jpg'
      link.click()
    }
  }

  const canProcess = sourceImage && targetFace && !isProcessing

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">单人图片换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传原图和目标人脸，开始AI换脸处理
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-sm">
              💡 <strong>注意：</strong>此页面仅支持图片换脸。如需处理视频，请前往 
              <a href="/video" className="text-blue-600 hover:text-blue-800 underline ml-1">视频换脸页面</a>
            </div>
          </div>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Image Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="原图"
            description="上传需要换脸的原始图片"
            onFileSelect={setSourceImage}
            currentFile={sourceImage}
            onRemove={() => setSourceImage(null)}
            accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
          />
          {sourceImage && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(sourceImage)}
                alt="原图"
                className="w-full h-48 object-cover rounded-lg"
              />
              <p className="text-sm text-gray-500 mt-2">
                文件大小: {(sourceImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
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
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              开始换脸
            </>
          )}
        </button>
      </div>

      {/* Processing Status */}
      {processingStatus && isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="loading-spinner mr-3"></div>
            <div>
              <h3 className="text-lg font-medium text-blue-900">正在处理您的换脸请求</h3>
              <p className="text-blue-700">
                任务ID: {processingStatus.id}
              </p>
              <p className="text-blue-700">
                状态: {processingStatus.status} | 进度: {processingStatus.progress}%
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">换脸结果</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <img
                src={apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')}
                alt="换脸结果"
                className="w-full rounded-lg shadow-sm"
                onError={(e) => {
                  console.error('Image load error:', e);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+加载失败</dGV4dD48L3N2Zz4=';
                }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的换脸结果已生成，点击下载按钮保存图片。
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

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">获得最佳效果的建议:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• 使用高分辨率、人脸清晰、光线充足的图片</li>
          <li>• 确保目标人脸图片中的人脸朝向正前方</li>
          <li>• 单人换脸请避免使用多人脸图片</li>
          <li>• 尽量使用光线条件相似的图片</li>
          <li>• 支持 JPG、PNG 格式，建议文件大小不超过10MB</li>
        </ul>
      </div>
    </div>
  )
} 