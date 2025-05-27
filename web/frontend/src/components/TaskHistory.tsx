import { useState, useEffect } from 'react'
import { ClockIcon, CheckCircleIcon, XCircleIcon, TrashIcon, ArrowPathIcon, DocumentArrowDownIcon, EyeIcon, StopIcon } from '@heroicons/react/24/outline'
import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'
import apiService from '../services/api'

interface TaskHistoryProps {
  onTaskSelect?: (task: TaskHistoryItem) => void;
  taskType?: TaskHistoryItem['type'];
}

export default function TaskHistory({ onTaskSelect, taskType }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')
  const [isExpanded, setIsExpanded] = useState(false)

  const getTaskTypeLabel = (type: TaskHistoryItem['type']) => {
    switch (type) {
      case 'single-image':
        return '单人图片换脸历史'
      case 'multi-image':
        return '多人图片换脸历史'
      case 'video':
        return '视频换脸历史'
      case 'multi-video':
        return '多人视频换脸历史'
      default:
        return '任务历史'
    }
  }

  useEffect(() => {
    loadTasks()
    
    // 定期刷新活跃任务状态
    const interval = setInterval(() => {
      const activeTasks = taskType 
        ? taskHistory.getActiveTasksByType(taskType)
        : taskHistory.getActiveTasks()
      if (activeTasks.length > 0) {
        refreshActiveTasks()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [taskType])

  const loadTasks = () => {
    const allTasks = taskType 
      ? taskHistory.getHistoryByType(taskType)
      : taskHistory.getHistory()
    setTasks(allTasks)
  }

  const refreshActiveTasks = async () => {
    const activeTasks = taskType 
      ? taskHistory.getActiveTasksByType(taskType)
      : taskHistory.getActiveTasks()
    
    console.log(`🔄 刷新${taskType || '所有'}活跃任务，共${activeTasks.length}个`)
    
    for (const task of activeTasks) {
      try {
        console.log(`📋 检查任务 ${task.id} 状态...`)
        const response = await apiService.getJobStatus(task.id)
        if (response.success && response.data) {
          const updatedTask = {
            ...task,
            ...response.data,
            updated_at: new Date().toISOString()
          }
          
          console.log(`📊 任务 ${task.id} 状态更新: ${task.status} -> ${response.data.status}`)
          taskHistory.updateTask(task.id, updatedTask)
        }
      } catch (error: any) {
        console.error(`❌ 刷新任务 ${task.id} 失败:`, error)
        
        // 如果是网络错误，可能需要标记任务为失败状态
        if (error.message?.includes('Network Error') || error.message?.includes('500')) {
          console.log(`⚠️ 标记任务 ${task.id} 为失败状态`)
          taskHistory.updateTask(task.id, {
            status: 'failed',
            error_message: '网络错误或服务器错误',
            updated_at: new Date().toISOString()
          })
        }
      }
    }
    
    loadTasks()
  }

  const getFilteredTasks = () => {
    switch (filter) {
      case 'active':
        return tasks.filter(task => task.status === 'pending' || task.status === 'processing')
      case 'completed':
        return tasks.filter(task => task.status === 'completed')
      case 'failed':
        return tasks.filter(task => task.status === 'failed')
      default:
        return tasks
    }
  }

  const handleDeleteTask = (taskId: string) => {
    if (confirm('确定要删除此任务吗？')) {
      taskHistory.removeTask(taskId)
      loadTasks()
    }
  }

  const handleClearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？此操作无法撤销。')) {
      taskHistory.clearHistory()
      loadTasks()
    }
  }

  const handleDownload = (task: TaskHistoryItem) => {
    if (task.result_url) {
      const link = document.createElement('a')
      link.href = apiService.getDownloadUrl(task.result_url.split('/').pop() || '')
      
      const extension = task.type === 'video' ? 'mp4' : 'jpg'
      link.download = `${task.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`
      link.click()
    }
  }

  const handleCancelTask = async (task: TaskHistoryItem) => {
    if (!confirm('确定要停止此任务吗？')) {
      return
    }

    try {
      console.log(`🛑 正在停止任务: ${task.id}`)
      await apiService.cancelJob(task.id)
      
      // 更新任务状态为已取消
      taskHistory.updateTask(task.id, {
        status: 'failed',
        error_message: '用户手动停止',
        updated_at: new Date().toISOString()
      })
      
      loadTasks()
      console.log(`✅ 任务已停止: ${task.id}`)
    } catch (error: any) {
      console.error('❌ 停止任务失败:', error)
      alert(`停止任务失败: ${error.message}`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'processing':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      case 'processing':
        return '处理中'
      default:
        return '等待中'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 2) {
      return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays <= 7) {
      return `${diffDays - 1}天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  const filteredTasks = getFilteredTasks()
  const activeTasks = tasks.filter(task => task.status === 'pending' || task.status === 'processing')

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="text-lg font-medium text-gray-900">
              {taskType ? getTaskTypeLabel(taskType) : '任务历史'}
            </h3>
            {activeTasks.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeTasks.length} 个活跃任务
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? '收起' : '展开'}
            </button>
            {tasks.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                清空历史
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {isExpanded && (
          <div className="mt-4 flex space-x-2">
            {[
              { key: 'all', label: '全部', count: tasks.length },
              { key: 'active', label: '进行中', count: activeTasks.length },
              { key: 'completed', label: '已完成', count: tasks.filter(t => t.status === 'completed').length },
              { key: 'failed', label: '失败', count: tasks.filter(t => t.status === 'failed').length }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task List */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <ClockIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>暂无任务记录</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <div key={task.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        {getStatusIcon(task.status)}
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <span className="capitalize">{task.type.replace('-', ' ')}</span>
                            <span className="mx-1">•</span>
                            <span>{getStatusText(task.status)}</span>
                            <span className="mx-1">•</span>
                            <span>{formatDate(task.created_at)}</span>
                          </div>
                          {(task.progress > 0 || task.status === 'processing') && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>进度</span>
                                <span>{task.progress || 0}%</span>
                              </div>
                              <div className="bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-500 ${
                                    task.status === 'processing' ? 'bg-blue-600' : 'bg-gray-400'
                                  }`}
                                  style={{ width: `${task.progress || (task.status === 'processing' ? 10 : 0)}%` }}
                                ></div>
                              </div>
                              {task.status === 'processing' && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {task.progress > 0 ? `处理中... ${task.progress}%` : '正在初始化...'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {(task.status === 'pending' || task.status === 'processing') && (
                        <button
                          onClick={() => handleCancelTask(task)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="停止任务"
                        >
                          <StopIcon className="h-4 w-4" />
                        </button>
                      )}
                      {task.status === 'completed' && task.result_url && (
                        <>
                          <button
                            onClick={() => onTaskSelect?.(task)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="查看结果"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(task)}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="下载结果"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="删除任务"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 