import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CloudArrowUpIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: Record<string, string[]>
  multiple?: boolean
  maxSize?: number
  currentFile?: File | null
  onRemove?: () => void
  label: string
  description?: string
}

export default function FileUpload({
  onFileSelect,
  accept = { 'image/*': ['.png', '.jpg', '.jpeg'] },
  multiple = false,
  maxSize,
  currentFile,
  onRemove,
  label,
  description
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Additional file type validation
      const acceptedTypes = Object.values(accept).flat();
      const isValidType = acceptedTypes.some(type => 
        file.name.toLowerCase().endsWith(type.toLowerCase()) ||
        file.type.startsWith(type.replace('/*', '').replace('*', ''))
      );
      
      if (!isValidType) {
        console.error('Invalid file type:', file.type, file.name);
        return;
      }
      
      // Check for video files in image upload
      if (accept['image/*'] && file.type.startsWith('video/')) {
        alert('检测到视频文件！请前往"视频换脸"页面处理视频文件。');
        return;
      }
      
      // Check for image files in video upload
      if (accept['video/*'] && file.type.startsWith('image/')) {
        alert('检测到图片文件！当前是视频上传区域，请上传视频文件或前往图片换脸页面。');
        return;
      }
      
      // Generate preview URL for images
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
      
      onFileSelect(file);
    }
  }, [onFileSelect, accept])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    multiple,
    ...(maxSize && { maxSize }),
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (onRemove) {
      onRemove();
    }
  }

  const isImageFile = currentFile?.type?.startsWith('image/') || false

  return (
    <div className="w-full">
      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
        {label}
      </label>
      
      {currentFile ? (
        <div className="bg-white border border-gray-300 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                {isImageFile ? (
                  <PhotoIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                ) : (
                  <CloudArrowUpIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
                  {currentFile.name}
                </p>
                <div className="flex flex-col xs:flex-row xs:items-center xs:space-x-2 text-xs sm:text-sm text-gray-500">
                  <span>{formatFileSize(currentFile.size)}</span>
                  <span className="hidden xs:inline">•</span>
                  <span className="capitalize">{currentFile.type}</span>
                </div>
              </div>
            </div>
            {onRemove && (
              <button
                onClick={handleRemove}
                className="touch-target flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 ml-2 focus-enhanced"
                aria-label="删除文件"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* File Preview */}
          {currentFile && (
            <div className="relative">
              {isImageFile ? (
                <img
                  src={previewUrl || URL.createObjectURL(currentFile)}
                  alt="文件预览"
                  className="w-full max-w-full h-auto rounded-lg border border-gray-200 shadow-sm object-contain"
                  style={{ maxHeight: '400px' }}
                  onLoad={() => {
                    // Clean up any previous preview URL
                    if (previewUrl && previewUrl !== URL.createObjectURL(currentFile)) {
                      URL.revokeObjectURL(previewUrl);
                    }
                  }}
                />
              ) : currentFile.type.startsWith('video/') ? (
                <video
                  controls
                  className="w-full max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                  style={{ maxHeight: '400px' }}
                >
                  <source src={URL.createObjectURL(currentFile)} type={currentFile.type} />
                  您的浏览器不支持视频播放
                </video>
              ) : (
                <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">文件预览不可用</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100">
                <span className="text-white text-sm font-medium bg-black bg-opacity-50 px-3 py-1 rounded-full">
                  {isImageFile ? '预览图片' : currentFile.type.startsWith('video/') ? '播放视频' : '预览文件'}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            {...getRootProps()}
            className={`
              dropzone transition-all duration-200 focus-enhanced relative overflow-hidden
              ${isDragActive || dragOver ? 'active border-primary-600 bg-primary-100 scale-[1.02]' : ''}
              ${isDragActive ? 'animate-pulse' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-center">
              <CloudArrowUpIcon className={`mx-auto h-10 w-10 sm:h-12 sm:w-12 transition-all duration-200 ${
                isDragActive ? 'text-primary-500 scale-110' : 'text-gray-400'
              }`} />
              <div className="mt-3 sm:mt-4">
                <p className={`text-base sm:text-lg font-medium transition-colors duration-200 ${
                  isDragActive ? 'text-primary-600' : 'text-gray-900'
                }`}>
                  {isDragActive ? '松开以上传文件' : '点击或拖拽上传'}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 px-2 leading-relaxed">
                  {description || '支持拖拽文件到这里，或点击选择文件'}
                </p>
                {maxSize && (
                  <p className="text-xs text-gray-500 mt-2">
                    最大文件大小: {formatFileSize(maxSize)}
                  </p>
                )}
                
                {/* Supported formats hint */}
                {accept && (
                  <div className="mt-2 sm:mt-3">
                    <p className="text-xs text-gray-500">
                      支持格式: {Object.values(accept).flat().join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Visual enhancement for drag state */}
            {isDragActive && (
              <div className="absolute inset-0 border-2 border-dashed border-primary-400 rounded-lg animate-pulse"></div>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {fileRejections.length > 0 && (
        <div className="mt-3 sm:mt-4 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
          <div className="text-sm text-red-600">
            <p className="font-medium mb-2">上传失败:</p>
            {fileRejections.map(({ file, errors }) => (
              <div key={file.name} className="mb-2 last:mb-0">
                <p className="font-medium break-words text-xs sm:text-sm">
                  {file.name}:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {errors.map(error => (
                    <li key={error.code} className="break-words text-xs sm:text-sm">
                      {error.message === 'File type not accepted' ? '不支持的文件类型' :
                       error.message === 'File is larger than 100000000 bytes' ? '文件过大' :
                       error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 