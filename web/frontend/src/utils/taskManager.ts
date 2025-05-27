import { ProcessingJob } from '../types'
import { taskHistory, TaskHistoryItem } from './taskHistory'
import apiService from '../services/api'

export interface ActiveTask {
  id: string
  type: TaskHistoryItem['type']
  title: string
  status: ProcessingJob['status']
  progress: number
  created_at: string
  updated_at: string
  result_url?: string
  error_message?: string
  pollInterval?: ReturnType<typeof setInterval>
}

class TaskManager {
  private activeTasks: Map<string, ActiveTask> = new Map()
  private readonly MAX_CONCURRENT_TASKS = 5 // 最大并发任务数
  private readonly POLL_INTERVAL = 10000 // 轮询间隔（毫秒）- 10秒

  // 获取所有活跃任务
  getActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values())
  }

  // 获取指定类型的活跃任务
  getActiveTasksByType(type: TaskHistoryItem['type']): ActiveTask[] {
    return this.getActiveTasks().filter(task => task.type === type)
  }

  // 检查是否可以启动新任务
  canStartNewTask(): boolean {
    const processingTasks = this.getActiveTasks().filter(
      task => task.status === 'pending' || task.status === 'processing'
    )
    return processingTasks.length < this.MAX_CONCURRENT_TASKS
  }

  // 获取当前并发任务数
  getConcurrentTaskCount(): number {
    return this.getActiveTasks().filter(
      task => task.status === 'pending' || task.status === 'processing'
    ).length
  }

  // 启动新任务
  async startTask(
    taskId: string,
    type: TaskHistoryItem['type'],
    title: string,
    files: { source?: string; target?: string; [key: string]: any }
  ): Promise<void> {
    if (!this.canStartNewTask()) {
      throw new Error(`已达到最大并发任务数限制 (${this.MAX_CONCURRENT_TASKS})`)
    }

    const task: ActiveTask = {
      id: taskId,
      type,
      title,
      status: 'pending',
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    this.activeTasks.set(taskId, task)

    // 添加到历史记录
    const historyTask: TaskHistoryItem = {
      ...task,
      files
    }
    taskHistory.addTask(historyTask)

    // 开始轮询状态
    this.startPolling(taskId)
  }

  // 开始轮询任务状态
  private startPolling(taskId: string): void {
    console.log(`🔄 Starting polling for task: ${taskId}`)
    
    const pollStatus = async () => {
      try {
        // 检查任务是否仍然存在且需要轮询
        const currentTask = this.activeTasks.get(taskId)
        if (!currentTask || currentTask.status === 'completed' || currentTask.status === 'failed') {
          console.log(`⏹️ Stopping polling for task ${taskId}: task completed or not found`)
          this.stopPolling(taskId)
          return
        }

        console.log(`📡 Polling status for task: ${taskId}`)
        const response = await apiService.getJobStatus(taskId)
        
        if (response.success && response.data) {
          console.log(`✅ Got status for task ${taskId}:`, response.data)
          this.updateTaskStatus(taskId, response.data)
        } else {
          console.warn(`⚠️ No data received for task ${taskId}:`, response)
        }
      } catch (error) {
        console.error(`❌ Failed to poll status for task ${taskId}:`, error)
        // 不要立即标记为失败，可能是网络临时问题
        // 只有在连续多次失败后才标记为失败
        const currentTask = this.activeTasks.get(taskId)
        if (currentTask) {
          // 增加错误计数
          const errorCount = (currentTask as any).errorCount || 0
          if (errorCount >= 3) {
            console.error(`❌ Task ${taskId} failed after 3 polling attempts`)
            this.updateTaskStatus(taskId, {
              status: 'failed',
              error_message: '无法获取任务状态'
            })
          } else {
            // 增加错误计数但继续轮询
            const updatedTask = { ...currentTask, errorCount: errorCount + 1 } as any
            this.activeTasks.set(taskId, updatedTask)
            console.warn(`⚠️ Polling error ${errorCount + 1}/3 for task ${taskId}, will retry`)
          }
        }
      }
    }

    // 立即执行一次
    pollStatus()

    // 设置定时轮询
    const interval = setInterval(async () => {
      await pollStatus()
    }, this.POLL_INTERVAL)

    // 保存轮询间隔ID
    const task = this.activeTasks.get(taskId)
    if (task) {
      task.pollInterval = interval
      this.activeTasks.set(taskId, task)
      console.log(`✅ Polling interval set for task: ${taskId}`)
    } else {
      console.error(`❌ Task ${taskId} not found when setting polling interval`)
      clearInterval(interval)
    }
  }

  // 更新任务状态
  private updateTaskStatus(taskId: string, updates: Partial<ProcessingJob>): void {
    const task = this.activeTasks.get(taskId)
    if (!task) {
      console.warn(`⚠️ Attempted to update non-existent task: ${taskId}`)
      return
    }

    console.log(`🔄 Updating task ${taskId}:`, updates)

    const updatedTask: ActiveTask = {
      ...task,
      ...updates,
      updated_at: new Date().toISOString()
    }

    // 清除错误计数（如果有的话）
    delete (updatedTask as any).errorCount

    this.activeTasks.set(taskId, updatedTask)

    // 更新历史记录
    taskHistory.updateTask(taskId, {
      ...updates,
      updated_at: updatedTask.updated_at
    })

    console.log(`✅ Task ${taskId} updated to status: ${updatedTask.status}, progress: ${updatedTask.progress}%`)

    // 如果任务完成或失败，停止轮询
    if (updates.status === 'completed' || updates.status === 'failed') {
      console.log(`🏁 Task ${taskId} finished with status: ${updates.status}`)
      this.stopPolling(taskId)
    }

    // 触发状态更新事件
    this.notifyStatusChange(taskId, updatedTask)
  }

  // 停止轮询
  private stopPolling(taskId: string): void {
    const task = this.activeTasks.get(taskId)
    if (task?.pollInterval) {
      console.log(`⏹️ Stopping polling for task: ${taskId}`)
      clearInterval(task.pollInterval)
      delete task.pollInterval
      this.activeTasks.set(taskId, task)
    }
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<void> {
    try {
      await apiService.cancelJob(taskId)
      this.stopPolling(taskId)
      this.activeTasks.delete(taskId)
      
      // 更新历史记录
      taskHistory.updateTask(taskId, {
        status: 'failed',
        error_message: '任务已取消',
        updated_at: new Date().toISOString()
      })
    } catch (error) {
      console.error(`Failed to cancel task ${taskId}:`, error)
      throw error
    }
  }

  // 获取特定任务
  getTask(taskId: string): ActiveTask | null {
    return this.activeTasks.get(taskId) || null
  }

  // 清理已完成的任务
  cleanupCompletedTasks(): void {
    const completedTasks = this.getActiveTasks().filter(
      task => task.status === 'completed' || task.status === 'failed'
    )

    completedTasks.forEach(task => {
      this.stopPolling(task.id)
      this.activeTasks.delete(task.id)
    })
  }

  // 状态变化通知（可以用于UI更新）
  private statusChangeListeners: Map<string, (task: ActiveTask) => void> = new Map()

  // 添加状态变化监听器
  addStatusChangeListener(taskId: string, listener: (task: ActiveTask) => void): void {
    this.statusChangeListeners.set(taskId, listener)
  }

  // 移除状态变化监听器
  removeStatusChangeListener(taskId: string): void {
    this.statusChangeListeners.delete(taskId)
  }

  // 通知状态变化
  private notifyStatusChange(taskId: string, task: ActiveTask): void {
    const listener = this.statusChangeListeners.get(taskId)
    if (listener) {
      listener(task)
    }
  }

  // 恢复页面刷新后的活跃任务
  restoreActiveTasks(): void {
    const activeTasks = taskHistory.getActiveTasks()
    
    activeTasks.forEach(task => {
      const activeTask: ActiveTask = {
        id: task.id,
        type: task.type,
        title: task.title,
        status: task.status,
        progress: task.progress || 0,
        created_at: task.created_at,
        updated_at: task.updated_at,
        result_url: task.result_url,
        error_message: task.error_message
      }

      this.activeTasks.set(task.id, activeTask)

      // 如果任务仍在进行中，恢复轮询
      if (task.status === 'pending' || task.status === 'processing') {
        this.startPolling(task.id)
      }
    })
  }

  // 获取任务统计信息
  getTaskStats(): {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  } {
    const tasks = this.getActiveTasks()
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    }
  }
}

export const taskManager = new TaskManager()

// 在应用启动时恢复活跃任务
if (typeof window !== 'undefined') {
  taskManager.restoreActiveTasks()
} 