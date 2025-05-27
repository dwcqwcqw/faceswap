// 这是一个工具脚本，用于快速更新所有页面以支持多任务
// 主要修改：
// 1. 移除 isProcessing 和 processingStatus 状态
// 2. 添加 isSubmitting 状态
// 3. 使用 taskManager 管理任务
// 4. 添加多任务状态提示

export const pageUpdateInstructions = {
  // 需要在每个页面中进行的修改
  imports: `
    import { taskManager } from '../utils/taskManager'
    import { InformationCircleIcon } from '@heroicons/react/24/outline'
  `,
  
  stateChanges: `
    // 移除这些状态：
    // const [isProcessing, setIsProcessing] = useState(false)
    // const [processingStatus, setProcessingStatus] = useState<ProcessingJob | null>(null)
    
    // 添加这个状态：
    const [isSubmitting, setIsSubmitting] = useState(false)
  `,
  
  handleProcessChanges: `
    // 在 handleProcess 函数开始添加：
    if (!taskManager.canStartNewTask()) {
      setError(\`已达到最大并发任务数限制 (\${taskManager.getConcurrentTaskCount()}/5)\`)
      return
    }
    
    setIsSubmitting(true)
    
    // 在成功创建任务后：
    await taskManager.startTask(
      jobId,
      'task-type', // 替换为对应的任务类型
      'Task Title',
      { source: 'filename', target: 'filename' }
    )
    
    // 清空表单（可选）
    setSourceImage(null)
    setTargetFace(null)
    
    // 在 finally 块中：
    setIsSubmitting(false)
  `,
  
  uiChanges: `
    // 添加多任务状态提示：
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <div className="flex items-center">
        <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2" />
        <div className="text-sm text-blue-800">
          <strong>多任务支持：</strong>您可以同时提交多个任务。当前活跃任务数：
          <span className="font-medium ml-1">{taskManager.getConcurrentTaskCount()}/5</span>
          。任务状态可在右下角查看。
        </div>
      </div>
    </div>
    
    // 修改按钮状态：
    {isSubmitting ? '提交中...' : '开始处理'}
    
    // 移除所有 processingStatus 相关的UI
  `
}

// 各页面的具体任务类型
export const taskTypes = {
  SingleImagePage: 'single-image',
  MultiImagePage: 'multi-image', 
  VideoPage: 'video',
  MultiVideoPage: 'multi-video'
} 