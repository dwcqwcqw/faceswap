import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { ArrowPathIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'

export default function SingleImagePage() {
  const [sourceImage, setSourceImage] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleProcess = async () => {
    if (!sourceImage || !targetFace) return
    
    setIsProcessing(true)
    // TODO: Implement API call to process the face swap
    
    // Simulate processing delay
    setTimeout(() => {
      setIsProcessing(false)
      setResult('https://example.com/result.jpg') // Mock result
    }, 3000)
  }

  const handleDownload = () => {
    if (result) {
      // TODO: Implement download functionality
      const link = document.createElement('a')
      link.href = result
      link.download = 'face-swap-result.jpg'
      link.click()
    }
  }

  const canProcess = sourceImage && targetFace && !isProcessing

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Single Image Face Swap</h1>
        <p className="mt-2 text-lg text-gray-600">
          Upload an original image and a target face to create a face swap
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Image Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="Original Image"
            description="Upload the image you want to modify"
            onFileSelect={setSourceImage}
            currentFile={sourceImage}
            onRemove={() => setSourceImage(null)}
            accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
          />
          {sourceImage && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(sourceImage)}
                alt="Source"
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Target Face Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FileUpload
            label="Target Face"
            description="Upload the face you want to swap in"
            onFileSelect={setTargetFace}
            currentFile={targetFace}
            onRemove={() => setTargetFace(null)}
            accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
          />
          {targetFace && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(targetFace)}
                alt="Target"
                className="w-full h-48 object-cover rounded-lg"
              />
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
              Processing...
            </>
          ) : (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              Start Face Swap
            </>
          )}
        </button>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="loading-spinner mr-3"></div>
            <div>
              <h3 className="text-lg font-medium text-blue-900">Processing Your Face Swap</h3>
              <p className="text-blue-700">
                This may take a few minutes. Please don't close this page.
              </p>
            </div>
          </div>
          <div className="mt-4 bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/3"></div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !isProcessing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Result</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <img
                src={result}
                alt="Face swap result"
                className="w-full rounded-lg shadow-sm"
              />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">Your face swap is ready!</h4>
              <p className="text-gray-600 mb-4">
                Click the download button below to save your result.
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                Download Result
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Tips for best results:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• Use high-resolution images with clear, well-lit faces</li>
          <li>• Ensure the face in the target image is facing forward</li>
          <li>• Avoid images with multiple faces for single face swap</li>
          <li>• Use images with similar lighting conditions when possible</li>
        </ul>
      </div>
    </div>
  )
} 