// 调试任务管理器功能
console.log('🔍 调试任务管理器功能...')

// 模拟添加一个视频任务到历史记录
const testTask = {
  id: 'test_video_task_' + Date.now(),
  type: 'video',
  title: '测试视频换脸任务',
  status: 'processing',
  progress: 45,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  files: {
    source: 'test_face.jpg',
    target: 'test_video.mp4'
  }
}

// 检查localStorage中的任务历史
function checkTaskHistory() {
  const stored = localStorage.getItem('faceswap_task_history')
  if (stored) {
    const history = JSON.parse(stored)
    console.log('📋 当前任务历史:', history)
    
    const activeTasks = history.filter(task => 
      task.status === 'pending' || task.status === 'processing'
    )
    console.log('🔄 活跃任务:', activeTasks)
    
    return { history, activeTasks }
  } else {
    console.log('📋 没有找到任务历史')
    return { history: [], activeTasks: [] }
  }
}

// 添加测试任务
function addTestTask() {
  const history = JSON.parse(localStorage.getItem('faceswap_task_history') || '[]')
  history.unshift(testTask)
  localStorage.setItem('faceswap_task_history', JSON.stringify(history))
  console.log('✅ 已添加测试任务:', testTask.id)
}

// 清理测试任务
function cleanupTestTasks() {
  const history = JSON.parse(localStorage.getItem('faceswap_task_history') || '[]')
  const filtered = history.filter(task => !task.id.startsWith('test_'))
  localStorage.setItem('faceswap_task_history', JSON.stringify(filtered))
  console.log('🧹 已清理测试任务')
}

// 执行调试
console.log('1. 检查当前任务历史:')
const { history, activeTasks } = checkTaskHistory()

console.log('\n2. 添加测试任务:')
addTestTask()

console.log('\n3. 再次检查任务历史:')
checkTaskHistory()

console.log('\n4. 检查任务管理器状态:')
if (typeof window !== 'undefined' && window.taskManager) {
  console.log('📊 任务管理器活跃任务:', window.taskManager.getActiveTasks())
  console.log('📊 任务统计:', window.taskManager.getTaskStats())
} else {
  console.log('⚠️ 任务管理器未找到')
}

console.log('\n5. 清理测试任务:')
cleanupTestTasks()

console.log('\n✅ 调试完成') 