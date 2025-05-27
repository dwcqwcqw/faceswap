import { useState, useEffect } from 'react'
import { XMarkIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon, StopIcon } from '@heroicons/react/24/outline'
import { taskManager, ActiveTask } from '../utils/taskManager'

export default function GlobalTaskStatus() {
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // 初始加载活跃任务
    const initialTasks = taskManager.getActiveTasks()
    console.log('🔄 GlobalTaskStatus初始化，活跃任务数:', initialTasks.length, initialTasks)
    setActiveTasks(initialTasks)

    // 设置定时更新
    const interval = setInterval(() => {
      const currentTasks = taskManager.getActiveTasks()
      console.log('🔄 GlobalTaskStatus更新，活跃任务数:', currentTasks.length)
      setActiveTasks(currentTasks)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleCancelTask = async (taskId: string) => {
    if (confirm('确定要取消这个任务吗？')) {
      try {
        await taskManager.cancelTask(taskId)
        setActiveTasks(taskManager.getActiveTasks())
      } catch (error) {
        console.error('Failed to cancel task:', error)
      }
    }
  }

  const getStatusIcon = (status: ActiveTask['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />
      case 'processing':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      case 'failed':
        return <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: ActiveTask['status']) => {
    switch (status) {
      case 'pending':
        return '等待中'
      case 'processing':
        return '处理中'
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      default:
        return '未知'
    }
  }

  const getTaskTypeLabel = (type: ActiveTask['type']) => {
    switch (type) {
      case 'single-image':
        return '单图换脸'
      case 'multi-image':
        return '多图换脸'
      case 'single-video':
        return '视频换脸'
      case 'multi-video':
        return '多人视频换脸'
      default:
        return '任务'
    }
  }

  const processingTasks = activeTasks.filter(task => 
    task.status === 'pending' || task.status === 'processing'
  )

  const completedTasks = activeTasks.filter(task => 
    task.status === 'completed' || task.status === 'failed'
  )

  if (activeTasks.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* 任务状态指示器 */}
      <div 
        className="bg-white rounded-lg shadow-lg border border-gray-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="p-3 flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {processingTasks.length > 0 && (
              <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span className="text-sm font-medium text-gray-900">
              任务 ({processingTasks.length}/{activeTasks.length})
            </span>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            {isExpanded ? (
              <XMarkIcon className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4 border border-gray-400 rounded" />
            )}
          </button>
        </div>

        {/* 展开的任务列表 */}
        {isExpanded && (
          <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
            {/* 进行中的任务 */}
            {processingTasks.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <h4 className="text-xs font-medium text-gray-700 mb-2">进行中的任务</h4>
                <div className="space-y-2">
                  {processingTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {getStatusIcon(task.status)}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {getTaskTypeLabel(task.type)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {getStatusText(task.status)} {task.progress > 0 && `(${task.progress}%)`}
                          </div>
                          {task.progress > 0 && (
                            <div className="mt-1 bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-blue-600 h-1 rounded-full transition-all duration-500"
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancelTask(task.id)
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600"
                        title="取消任务"
                      >
                        <StopIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已完成的任务 */}
            {completedTasks.length > 0 && (
              <div className="p-3">
                <h4 className="text-xs font-medium text-gray-700 mb-2">最近完成</h4>
                <div className="space-y-2">
                  {completedTasks.slice(0, 3).map(task => (
                    <div key={task.id} className="flex items-center space-x-2">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {getTaskTypeLabel(task.type)}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {getStatusText(task.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 