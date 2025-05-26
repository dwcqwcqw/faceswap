import { ProcessingJob } from '../types'

export interface TaskHistoryItem extends ProcessingJob {
  title: string;
  type: 'single-image' | 'multi-image' | 'video' | 'multi-video';
  thumbnail?: string;
  files: {
    source?: string;
    target?: string;
    [key: string]: any;
  };
}

class TaskHistoryManager {
  private readonly STORAGE_KEY = 'faceswap_task_history';
  private readonly MAX_HISTORY_ITEMS = 50;

  // 获取所有历史任务
  getHistory(): TaskHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const history = JSON.parse(stored) as TaskHistoryItem[];
      // 按创建时间倒序排列
      return history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      console.error('Failed to load task history:', error);
      return [];
    }
  }

  // 获取指定类型的历史任务
  getHistoryByType(type: TaskHistoryItem['type']): TaskHistoryItem[] {
    return this.getHistory().filter(task => task.type === type);
  }

  // 添加新任务到历史记录
  addTask(task: TaskHistoryItem): void {
    try {
      const history = this.getHistory();
      
      // 检查是否已存在相同ID的任务
      const existingIndex = history.findIndex(item => item.id === task.id);
      
      if (existingIndex >= 0) {
        // 更新现有任务
        history[existingIndex] = task;
      } else {
        // 添加新任务
        history.unshift(task);
        
        // 限制历史记录数量
        if (history.length > this.MAX_HISTORY_ITEMS) {
          history.splice(this.MAX_HISTORY_ITEMS);
        }
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save task to history:', error);
    }
  }

  // 更新任务状态
  updateTask(taskId: string, updates: Partial<TaskHistoryItem>): void {
    try {
      const history = this.getHistory();
      const taskIndex = history.findIndex(item => item.id === taskId);
      
      if (taskIndex >= 0) {
        history[taskIndex] = { ...history[taskIndex], ...updates };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
      }
    } catch (error) {
      console.error('Failed to update task history:', error);
    }
  }

  // 删除任务
  removeTask(taskId: string): void {
    try {
      const history = this.getHistory();
      const filteredHistory = history.filter(item => item.id !== taskId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
      console.error('Failed to remove task from history:', error);
    }
  }

  // 清空历史记录
  clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear task history:', error);
    }
  }

  // 获取正在进行的任务
  getActiveTasks(): TaskHistoryItem[] {
    return this.getHistory().filter(task => 
      task.status === 'pending' || task.status === 'processing'
    );
  }

  // 获取指定类型的活跃任务
  getActiveTasksByType(type: TaskHistoryItem['type']): TaskHistoryItem[] {
    return this.getActiveTasks().filter(task => task.type === type);
  }

  // 获取最近的活跃任务（用于页面恢复）
  getLatestActiveTask(type?: TaskHistoryItem['type']): TaskHistoryItem | null {
    const activeTasks = type ? this.getActiveTasksByType(type) : this.getActiveTasks();
    return activeTasks.length > 0 ? activeTasks[0] : null;
  }

  // 获取已完成的任务
  getCompletedTasks(): TaskHistoryItem[] {
    return this.getHistory().filter(task => 
      task.status === 'completed'
    );
  }

  // 获取失败的任务
  getFailedTasks(): TaskHistoryItem[] {
    return this.getHistory().filter(task => 
      task.status === 'failed'
    );
  }

  // 获取特定任务
  getTask(taskId: string): TaskHistoryItem | null {
    const history = this.getHistory();
    return history.find(task => task.id === taskId) || null;
  }
}

export const taskHistory = new TaskHistoryManager(); 