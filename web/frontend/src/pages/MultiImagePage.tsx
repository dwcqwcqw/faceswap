import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob, DetectedFaces } from '../types'
import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'

interface FaceMapping {
  faceId: string;
  sourceFile: File | null;  // 替换的源人脸文件
  previewUrl?: string;
}

export default function MultiImagePage() {
  const [targetImage, setTargetImage] = useState<File | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaces | null>(null)
  const [faceMappings, setFaceMappings] = useState<FaceMapping[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)

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

  const handleDetectFaces = async () => {
    if (!targetImage) return
    
    setIsDetecting(true)
    setError(null)
    
    try {
      // Upload source image first
      console.log('上传图片进行人脸检测...')
      const uploadResponse = await apiService.uploadFile(targetImage)
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('图片上传失败')
      }

      // Detect faces
      console.log('检测人脸...')
      const detectResponse = await apiService.detectFaces(uploadResponse.data.fileId)
      if (!detectResponse.success || !detectResponse.data) {
        throw new Error('人脸检测失败')
      }

      const faces = detectResponse.data
      setDetectedFaces(faces)
      
      // Initialize face mappings
      const mappings: FaceMapping[] = faces.faces.map((_, index) => ({
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
    if (!targetImage || !detectedFaces || faceMappings.some(m => !m.sourceFile)) return
    
    setIsProcessing(true)
    setError(null)
    setProcessingStatus(null)

    try {
      // Upload target image (the original multi-person image)
      console.log('上传目标图片（原多人图片）...')
      const targetResponse = await apiService.uploadFile(targetImage)
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error('目标图片上传失败')
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
      console.log('开始处理多人换脸...')
      const processResponse = await apiService.processMultiImage({
        source_file: '', // Not used for multi-face - individual mappings are used instead
        target_file: targetResponse.data.fileId,
        face_mappings: uploadedMappings,
        options: {
          many_faces: true,
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
          title: `多人换脸 - ${targetImage.name} (${faceMappings.length}个人脸)`,
          type: 'multi-image',
          files: {
            target: targetImage.name,
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
      link.download = 'multi-face-swap-result.jpg'
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

  const handleDownloadHistory = (task: TaskHistoryItem) => {
    if (task.result_url) {
      const link = document.createElement('a')
      link.href = apiService.getDownloadUrl(task.result_url.split('/').pop() || '')
      const extension = task.type === 'video' ? 'mp4' : 'jpg'
      link.download = `${task.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`
      link.click()
    }
  }

  const canDetect = targetImage && !isDetecting && !detectedFaces
  const canProcess = targetImage && detectedFaces && faceMappings.every(m => m.sourceFile) && !isProcessing

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">多人图片换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传包含多人的目标图片，系统将识别所有人脸并允许您为每个人脸选择替换的源人脸
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-sm">
              💡 <strong>操作流程：</strong>1. 上传目标图片（包含多人） → 2. 检测人脸 → 3. 为每个人脸选择替换的源人脸图片 → 4. 开始换脸
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

      {/* Step 1: Upload Target Image */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">第一步：上传目标图片</h2>
        <FileUpload
          label="包含多人的目标图片"
          description="上传包含多个人脸的目标图片"
          onFileSelect={setTargetImage}
          currentFile={targetImage}
          onRemove={() => {
            setTargetImage(null)
            setDetectedFaces(null)
            setFaceMappings([])
          }}
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
        />
        {targetImage && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <img
                src={URL.createObjectURL(targetImage)}
                alt="原图"
                className="w-full h-64 object-cover rounded-lg"
              />
              <p className="text-sm text-gray-500 mt-2">
                文件大小: {(targetImage.size / 1024 / 1024).toFixed(2)} MB
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
                    检测人脸
                  </>
                )}
              </button>
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
                
                {/* Face preview from original image */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">原图中的人脸:</p>
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
                    <p className="text-xs text-gray-500 mt-1">
                      置信度: {(face.confidence * 100).toFixed(1)}% | 
                      位置: ({face.x}, {face.y}) | 
                      大小: {face.width} × {face.height}
                    </p>
                  )}
                </div>

                {/* Target face upload */}
                <FileUpload
                  label={`替换人脸 ${index + 1}`}
                  description="上传要替换的人脸图片"
                  onFileSelect={(file) => handleFaceFileSelect(index, file)}
                  currentFile={faceMappings[index]?.sourceFile || null}
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
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                开始多人换脸
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
              <h3 className="text-lg font-medium text-blue-900">正在处理您的多人换脸请求</h3>
              <p className="text-blue-700">任务ID: {processingStatus.id}</p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">多人换脸结果</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <img
                src={apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')}
                alt="多人换脸结果"
                className="w-full rounded-lg shadow-sm"
                onError={(e) => {
                  console.error('Image load error:', e);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+加载失败</dGV4dD48L3N2Zz4=';
                }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">多人换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的多人换脸结果已生成，点击下载按钮保存图片。
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

      {/* Historical Result */}
      {selectedHistoryTask?.status === 'completed' && selectedHistoryTask.result_url && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">历史任务结果</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <img
                src={apiService.getDownloadUrl(selectedHistoryTask.result_url.split('/').pop() || '')}
                alt="历史多人换脸结果"
                className="w-full rounded-lg shadow-sm"
                onError={(e) => {
                  console.error('Historical image load error:', e);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+加载失败</dGV4dD48L3N2Zz4=';
                }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">{selectedHistoryTask.title}</h4>
              <p className="text-gray-600 mb-2">
                任务类型: {selectedHistoryTask.type}
              </p>
              <p className="text-gray-600 mb-4">
                完成时间: {new Date(selectedHistoryTask.updated_at).toLocaleString('zh-CN')}
              </p>
              <button
                onClick={() => handleDownloadHistory(selectedHistoryTask)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载结果
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task History */}
      <TaskHistory onTaskSelect={handleTaskSelect} />

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">多人换脸最佳实践:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• 确保原图中的人脸清晰可见，避免被遮挡或模糊</li>
          <li>• 为每个检测到的人脸准备相应的高质量替换图片</li>
          <li>• 替换图片中的人脸最好与原图中的角度和光线相似</li>
          <li>• 处理多人换脸可能需要更长时间，请耐心等待</li>
          <li>• 建议使用人脸较少的图片以获得更好的效果</li>
        </ul>
      </div>
    </div>
  )
} 