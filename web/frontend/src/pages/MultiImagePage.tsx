import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { DetectedFaces, ApiResponse } from '../types'
import { TaskHistoryItem } from '../utils/taskHistory'
import { taskManager } from '../utils/taskManager'

interface FaceMapping {
  faceId: string;
  sourceFile: File | null;  // 替换的源人脸文件
  previewUrl?: string;
  croppedFaceUrl?: string; // 添加裁剪后的人脸预览
}

export default function MultiImagePage() {
  const [targetImage, setTargetImage] = useState<File | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaces | null>(null)
  const [faceMappings, setFaceMappings] = useState<FaceMapping[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageSize, setImageSize] = useState<{width: number, height: number} | null>(null)
  
  // 添加延迟控制状态
  const [lastRequestTime, setLastRequestTime] = useState<number>(0)
  const [requestInProgress, setRequestInProgress] = useState(false)
  const MIN_REQUEST_INTERVAL = 10000 // 10秒最小间隔

  // 组件加载时的初始化
  useEffect(() => {
    // 任务管理器会自动恢复活跃任务，无需手动处理
  }, [])

  // 添加用于裁剪人脸的函数
  const cropFaceFromImage = (imageFile: File, face: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      img.onload = () => {
        try {
          // 计算裁剪区域，添加一些边距以获得更完整的人脸
          const margin = Math.max(face.width, face.height) * 0.2 // 20%边距
          const cropX = Math.max(0, face.x - margin)
          const cropY = Math.max(0, face.y - margin)
          const cropWidth = Math.min(img.naturalWidth - cropX, face.width + margin * 2)
          const cropHeight = Math.min(img.naturalHeight - cropY, face.height + margin * 2)
          
          canvas.width = cropWidth
          canvas.height = cropHeight
          
          if (ctx) {
            // 绘制裁剪后的人脸
            ctx.drawImage(
              img,
              cropX, cropY, cropWidth, cropHeight,
              0, 0, cropWidth, cropHeight
            )
            
            // 转换为blob URL
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                resolve(url)
              } else {
                reject(new Error('无法生成人脸预览'))
              }
            }, 'image/jpeg', 0.8)
          } else {
            reject(new Error('无法创建canvas上下文'))
          }
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = URL.createObjectURL(imageFile)
    })
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
      const mappings: FaceMapping[] = []
      
      // 为每个检测到的人脸生成裁剪预览
      for (let i = 0; i < faces.faces.length; i++) {
        const face = faces.faces[i]
        try {
          const croppedUrl = await cropFaceFromImage(targetImage, face)
          mappings.push({
            faceId: `face_${i}`,
            sourceFile: null,
            croppedFaceUrl: croppedUrl
          })
        } catch (error) {
          console.warn(`生成人脸 ${i + 1} 预览失败:`, error)
          mappings.push({
            faceId: `face_${i}`,
            sourceFile: null
          })
        }
      }
      
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
    
    // 检查是否可以启动新任务
    if (!taskManager.canStartNewTask()) {
      setError(`已达到最大并发任务数限制 (${taskManager.getConcurrentTaskCount()}/5)`)
      return
    }
    
    setIsSubmitting(true)
    setError(null)

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
      console.log('📋 Face mappings:', uploadedMappings)
      console.log('📋 Target file ID:', targetResponse.data.fileId)
      
      const processResponse = await apiService.processMultiImage({
        source_file: Object.values(uploadedMappings)[0] || '', // Use first face as fallback for source_file 
        target_file: targetResponse.data.fileId,
        face_mappings: uploadedMappings,
        options: {
          many_faces: true,
          mouth_mask: true,
        }
      })

      if (processResponse.success && processResponse.data) {
        const jobId = processResponse.data.jobId
        console.log('✅ 多人换脸任务创建成功:', jobId)
        
        // 使用任务管理器启动任务
        await taskManager.startTask(
          jobId,
          'multi-image',
          `多人换脸 - ${targetImage.name} (${faceMappings.length}个人脸)`,
          {
            target: targetImage.name,
            source: faceMappings.map(m => m.sourceFile?.name).filter(Boolean).join(', ')
          }
        )
        
        // 清空表单
        setTargetImage(null)
        setDetectedFaces(null)
        setFaceMappings([])
        
        console.log('✅ 多人换脸任务已提交，可以继续提交新任务')
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

  const canDetect = targetImage && !isDetecting && !detectedFaces
  const canProcess = targetImage && detectedFaces && faceMappings.every(m => m.sourceFile) && !isSubmitting

  return (
    <div className="container-xs sm:max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8 mb-16 sm:mb-0">
      <div className="text-center mb-4 sm:mb-6 lg:mb-8">
        <h1 className="heading-responsive text-gray-900">多人图片换脸</h1>
        <p className="mt-2 text-mobile-body sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
          上传包含多人的图片，系统将识别所有人脸并允许您为每个人脸选择替换的源人脸
        </p>
        <div className="mt-3 sm:mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-xs sm:text-sm text-center leading-relaxed">
              💡 <strong>操作流程：</strong><br className="sm:hidden" />
              1. 上传目标图片（包含多人） → 2. 检测人脸 → 3. 为每个人脸选择替换的源人脸图片 → 4. 开始换脸
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

      {/* Step 1: Target Image Upload */}
      <div className="card-mobile sm:bg-white sm:rounded-lg sm:shadow-sm sm:border sm:border-gray-200 sm:p-4 lg:p-6 mb-4 sm:mb-6 lg:mb-8">
        <h2 className="text-mobile-title sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">步骤 1: 上传目标图片</h2>
        <FileUpload
          label="目标图片（包含多人）"
          description="上传包含多个人脸的图片，系统将自动检测所有人脸"
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


        {/* Face Detection Button */}
        {targetImage && !detectedFaces && (
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
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    <span>检测人脸中...</span>
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-5 w-5 mr-2" />
                    <span>检测人脸</span>
                  </>
                )}
              </button>
              {canDetect && (
                <p className="text-xs sm:text-sm text-blue-600 mt-3 text-center px-2">
                  💡 提示：人脸检测通常需要1-3分钟，请耐心等待
                </p>
              )}
              {isDetecting && (
                <p className="text-xs sm:text-sm text-orange-600 mt-3 text-center px-2">
                  ⏳ 正在检测人脸，请勿关闭页面，预计需要1-3分钟...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Detected Faces and Target Upload */}
      {detectedFaces && (
        <div className="card-mobile sm:bg-white sm:rounded-lg sm:shadow-sm sm:border sm:border-gray-200 sm:p-4 lg:p-6 mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-mobile-title sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
            步骤 2: 为每个人脸选择替换图片 ({detectedFaces.faces.length} 个人脸)
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 leading-relaxed">
            系统检测到 {detectedFaces.faces.length} 个人脸，请为每个人脸上传对应的替换图片。
            人脸编号按从左到右、从上到下的顺序排列。
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {detectedFaces.faces.map((face: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white shadow-sm">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-2 sm:mb-3 text-center">
                  人脸 {index + 1}
                </h3>
                
                {/* Show detected face - 显示实际的人脸预览 */}
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 text-center">检测到的人脸:</p>
                  <div className="relative overflow-hidden rounded border bg-gray-50 flex items-center justify-center" style={{ minHeight: '120px' }}>
                    {faceMappings[index]?.croppedFaceUrl ? (
                      <img
                        src={faceMappings[index].croppedFaceUrl}
                        alt={`检测人脸 ${index + 1}`}
                        className="max-w-full max-h-32 object-contain rounded"
                      />
                    ) : (
                      /* 备用方案：显示带框标注的原图 */
                      <>
                        <img
                          src={URL.createObjectURL(targetImage!)}
                          alt={`原图 ${index + 1}`}
                          className="w-full h-24 sm:h-32 object-contain"
                          onLoad={(e) => {
                            const img = e.target as HTMLImageElement
                            if (!imageSize) {
                              setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
                            }
                          }}
                        />
                        {/* Face overlay box */}
                        {imageSize && face.x !== undefined && face.y !== undefined && (
                          <div 
                            className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
                            style={{
                              left: `${(face.x / imageSize.width) * 100}%`,
                              top: `${(face.y / imageSize.height) * 100}%`,
                              width: `${((face.width || 50) / imageSize.width) * 100}%`,
                              height: `${((face.height || 50) / imageSize.height) * 100}%`,
                            }}
                          >
                            <div className="absolute -top-6 left-0 text-xs text-blue-600 font-medium bg-white px-1 rounded">
                              #{index + 1}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    置信度: {(face.confidence * 100).toFixed(1)}%
                  </p>
                </div>

                {/* 箭头指向 */}
                <div className="flex items-center justify-center mb-3">
                  <div className="text-2xl text-blue-500">↓</div>
                </div>

                {/* Upload replacement face */}
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 text-center font-medium">替换为:</p>
                  <FileUpload
                    label=""
                    description={`上传要替换人脸 ${index + 1} 的图片`}
                    onFileSelect={(file) => handleFaceFileSelect(index, file)}
                    currentFile={faceMappings[index]?.sourceFile || null}
                    onRemove={() => handleFaceFileSelect(index, null)}
                    accept={{ 
                      'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
                    }}
                  />

                  {/* 显示预览对比 */}
                  {faceMappings[index]?.sourceFile && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-700 text-center font-medium">
                        ✓ 人脸 {index + 1} 的替换图片已选择
                      </p>
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
        <div className="text-center mb-4 sm:mb-6 lg:mb-8">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={`
              btn-mobile w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg transition-all duration-200 focus-enhanced transform
              ${canProcess
                ? 'text-white bg-primary-600 hover:bg-primary-700 hover:scale-105 shadow-lg hover:shadow-xl'
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }
            `}
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                <span>处理中...</span>
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                开始多人换脸
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

      {/* Task History - 只显示多人图片换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="multi-image"
      />

      {/* Tips */}
      <div className="mt-6 sm:mt-8 bg-gray-50 rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">获得最佳效果的建议:</h3>
        <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
          <li>• 使用高分辨率、人脸清晰、光线充足的图片</li>
          <li>• 确保替换人脸图片中的人脸朝向正前方</li>
          <li>• 人脸编号按从左到右、从上到下的顺序排列</li>
          <li>• 尽量使用光线条件相似的图片</li>
          <li>• 支持多种图片格式：JPG、PNG、BMP、TIFF、WebP、GIF、HEIC等</li>
          <li>• 多人换脸处理时间较长，请耐心等待</li>
        </ul>
      </div>
    </div>
  )
} 