import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob, DetectedFaces, ApiResponse } from '../types'
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
  
  // 添加延迟控制状态
  const [lastRequestTime, setLastRequestTime] = useState<number>(0)
  const [requestInProgress, setRequestInProgress] = useState(false)
  const MIN_REQUEST_INTERVAL = 10000 // 10秒最小间隔

  // 在组件加载时检查是否有活跃任务需要恢复
  useEffect(() => {
    const activeTask = taskHistory.getLatestActiveTask('multi-image')
    if (activeTask) {
      console.log('🔄 恢复活跃多人任务:', activeTask.id)
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

  const handleDetectFaces = async () => {
    if (!targetImage) return
    
    // 检查是否有请求正在进行
    if (requestInProgress || isDetecting) {
      setError('请等待当前操作完成')
      return
    }

    // 检查请求间隔
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const remainingTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000)
      setError(`请等待 ${remainingTime} 秒后再试，给后端模型足够的启动时间`)
      return
    }
    
    setRequestInProgress(true)
    setLastRequestTime(now)
    setIsDetecting(true)
    setError(null)
    
    // 显示启动提示
    console.log('正在启动人脸检测模型，首次启动可能需要10-15秒...')
    
    try {
      // Upload source image first
      console.log('上传图片进行人脸检测...')
      const uploadResponse = await apiService.uploadFile(targetImage)
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('图片上传失败')
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
      
      // 确保人脸按照从左到右、从上到下的顺序排列
      // 这样可以保证UI显示的顺序与处理时的映射一致
      faces.faces.sort((a: any, b: any) => {
        // 首先按Y坐标排序（从上到下）
        if (Math.abs(a.y - b.y) > 20) { // 20像素的容错范围
          return a.y - b.y
        }
        // 如果Y坐标相近，则按X坐标排序（从左到右）
        return a.x - b.x
      })
      
      console.log('人脸检测结果（已排序）:', faces.faces.map((face: any, idx: number) => ({
        index: idx,
        position: `(${face.x}, ${face.y})`,
        confidence: face.confidence
      })))
      
      setDetectedFaces(faces)
      
      // Initialize face mappings - 确保索引与排序后的人脸一致
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
        errorMessage = '服务器处理错误，请稍后重试或更换图片文件'
      } else if (error.message?.includes('upload') || error.message?.includes('上传')) {
        errorMessage = '图片上传失败，请检查网络连接'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setError(errorMessage)
    } finally {
      setIsDetecting(false)
      setRequestInProgress(false)
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
      // 确保人脸映射顺序与检测到的人脸顺序一致
      const uploadedMappings: { [key: string]: string } = {}
      
      for (let i = 0; i < faceMappings.length; i++) {
        const mapping = faceMappings[i]
        if (mapping.sourceFile) {
          console.log(`上传替换人脸 ${i + 1} (对应检测人脸 ${i + 1})...`)
          const sourceResponse = await apiService.uploadFile(mapping.sourceFile)
          if (!sourceResponse.success || !sourceResponse.data) {
            throw new Error(`替换人脸 ${i + 1} 上传失败`)
          }
          // 使用与人脸检测相同的索引顺序
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

  const handleCloseTaskDetail = () => {
    setSelectedHistoryTask(null)
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
                      <li>尝试使用其他图片格式（JPG/PNG）</li>
                      <li>检查网络连接是否稳定</li>
                    </ul>
                  </div>
                ) : error.includes('timeout') || error.includes('超时') ? (
                  <div className="bg-yellow-100 p-3 rounded border-l-4 border-yellow-500">
                    <p className="font-medium">⏱️ 超时问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>检查网络连接</li>
                      <li>尝试压缩图片大小</li>
                      <li>稍后重试</li>
                    </ul>
                  </div>
                ) : error.includes('format') || error.includes('格式') ? (
                  <div className="bg-blue-100 p-3 rounded border-l-4 border-blue-500">
                    <p className="font-medium">📁 格式问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>确保使用支持的图片格式（JPG、PNG）</li>
                      <li>避免使用损坏或特殊格式的文件</li>
                      <li>尝试重新保存图片</li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-gray-100 p-3 rounded border-l-4 border-gray-500">
                    <p className="font-medium">💡 通用解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>检查网络连接</li>
                      <li>刷新页面重试</li>
                      <li>更换不同的图片文件</li>
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
          accept={{ 
            'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
          }}
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
                        💡 人脸 {index + 1}：这个位置的人脸将被替换为您上传的图片
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

      {/* Task Detail */}
      {selectedHistoryTask && (
        <TaskDetail 
          task={selectedHistoryTask} 
          onClose={handleCloseTaskDetail}
        />
      )}

      {/* Task History - 只显示多人图片换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="multi-image"
      />

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">多人图片换脸最佳实践:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• <strong>格式支持：</strong>图片支持 JPG、PNG、BMP、TIFF、WebP、GIF、HEIC等格式</li>
          <li>• 确保原图中的人脸清晰可见，避免被遮挡或模糊</li>
          <li>• 为每个检测到的人脸准备相应的高质量替换图片</li>
          <li>• 替换图片中的人脸最好与原图中的角度和光线相似</li>
          <li>• <strong>⏰ 处理时间：</strong>人脸检测通常需要1-3分钟，处理多人图片需要更长时间</li>
          <li>• <strong>🔄 重试建议：</strong>如果检测超时，请检查网络连接后重试</li>
          <li>• <strong>💡 优化建议：</strong>使用人脸较少的图片（2-3人）可显著减少处理时间</li>
          <li>• 💡 人脸按位置自动排序：从上到下，从左到右</li>
          <li>• <strong>⚠️ 注意事项：</strong>请勿在检测或处理过程中关闭页面</li>
          <li>• <strong>📱 网络建议：</strong>强烈建议在WiFi环境下使用</li>
        </ul>
      </div>
    </div>
  )
} 