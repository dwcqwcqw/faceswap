import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline'

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
  maxSize = 10 * 1024 * 1024,
  currentFile,
  onRemove,
  label,
  description
}: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxSize
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      {currentFile ? (
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <CloudArrowUpIcon className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{currentFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(currentFile.size)}</p>
              </div>
            </div>
            {onRemove && (
              <button
                onClick={onRemove}
                className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop the file here' : 'Upload a file'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {description || 'Drag and drop a file here, or click to select'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Max file size: {formatFileSize(maxSize)}
              </p>
            </div>
          </div>
        </div>
      )}

      {fileRejections.length > 0 && (
        <div className="mt-2">
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name} className="text-sm text-red-600">
              <p className="font-medium">{file.name}:</p>
              <ul className="list-disc list-inside">
                {errors.map(error => (
                  <li key={error.code}>{error.message}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 