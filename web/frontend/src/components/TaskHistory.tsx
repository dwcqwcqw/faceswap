import { useState, useEffect } from 'react'
import { ClockIcon, CheckCircleIcon, XCircleIcon, TrashIcon, ArrowPathIcon, DocumentArrowDownIcon, EyeIcon } from '@heroicons/react/24/outline'
import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'
import apiService from '../services/api'

interface TaskHistoryProps {
  onTaskSelect?: (task: TaskHistoryItem) => void;
}

export default function TaskHistory({ onTaskSelect }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    loadTasks()
    
    // 定期刷新活跃任务状态
    const interval = setInterval(() => {
      const activeTasks = taskHistory.getActiveTasks()
      if (activeTasks.length > 0) {
        refreshActiveTasks()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const loadTasks = () => {
    setTasks(taskHistory.getHistory())
  }

  const refreshActiveTasks = async () => {
    const activeTasks = taskHistory.getActiveTasks()
    
    for (const task of activeTasks) {
      try {
        const response = await apiService.getJobStatus(task.id)
        if (response.success && response.data) {
          const updatedTask = {
            ...task,
            ...response.data,
            updated_at: new Date().toISOString()
          }
          taskHistory.updateTask(task.id, updatedTask)
        }
      } catch (error) {
        console.error(`Failed to refresh task ${task.id}:`, error)
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
            <h3 className="text-lg font-medium text-gray-900">任务历史</h3>
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
                          {task.progress > 0 && task.status === 'processing' && (
                            <div className="mt-2 bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-blue-600 h-1 rounded-full transition-all duration-500"
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
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