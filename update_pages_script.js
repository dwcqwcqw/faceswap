const fs = require('fs');
const path = require('path');

// 页面文件路径
const pages = [
  'web/frontend/src/pages/VideoPage.tsx',
  'web/frontend/src/pages/MultiVideoPage.tsx'
];

// 更新函数
function updatePageForMultiTask(filePath, taskType) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. 添加导入
  if (!content.includes('import { taskManager }')) {
    content = content.replace(
      /import { taskHistory, TaskHistoryItem } from '\.\.\/utils\/taskHistory'/,
      `import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'\nimport { taskManager } from '../utils/taskManager'`
    );
  }
  
  if (!content.includes('InformationCircleIcon')) {
    content = content.replace(
      /from '@heroicons\/react\/24\/outline'/,
      (match) => match.replace('} from', ', InformationCircleIcon } from')
    );
  }

  // 2. 移除旧状态
  content = content.replace(/const \[isProcessing, setIsProcessing\] = useState<boolean>\(false\)/g, '');
  content = content.replace(/const \[processingStatus, setProcessingStatus\] = useState<ProcessingJob \| null>\(null\)/g, '');
  
  // 3. 添加新状态
  if (!content.includes('const [isSubmitting, setIsSubmitting]')) {
    content = content.replace(
      /const \[selectedHistoryTask, setSelectedHistoryTask\] = useState<TaskHistoryItem \| null>\(null\)/,
      `const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)`
    );
  }

  // 4. 更新useEffect
  content = content.replace(
    /\/\/ 在组件加载时检查是否有活跃任务需要恢复[\s\S]*?}, \[\]\)/,
    `// 组件加载时的初始化
  useEffect(() => {
    // 任务管理器会自动恢复活跃任务，无需手动处理
  }, [])`
  );

  // 5. 移除pollJobStatus函数
  content = content.replace(
    /const pollJobStatus = async \(jobId: string\) => \{[\s\S]*?\n  \}/,
    ''
  );

  // 6. 更新handleProcess函数
  const handleProcessRegex = /const handleProcess = async \(\) => \{[\s\S]*?\n  \}/;
  if (handleProcessRegex.test(content)) {
    content = content.replace(handleProcessRegex, (match) => {
      // 提取文件上传和API调用逻辑，但更新任务管理部分
      let newHandleProcess = match
        .replace(/setIsProcessing\(true\)/, 'setIsSubmitting(true)')
        .replace(/setProcessingStatus\(null\)/, '')
        .replace(/setIsProcessing\(false\)/g, '')
        .replace(/setProcessingStatus\(initialStatus\)/, '')
        .replace(/taskHistory\.addTask\(historyTask\)/, '')
        .replace(/setTimeout\(\(\) => pollJobStatus\(jobId\), \d+\)/, '');
      
      // 添加任务管理器逻辑
      if (!newHandleProcess.includes('taskManager.canStartNewTask()')) {
        newHandleProcess = newHandleProcess.replace(
          /if \(!.*?\) return/,
          `if (!sourceVideo || !targetFace) return
    
    // 检查是否可以启动新任务
    if (!taskManager.canStartNewTask()) {
      setError(\`已达到最大并发任务数限制 (\${taskManager.getConcurrentTaskCount()}/5)\`)
      return
    }`
        );
      }
      
      return newHandleProcess;
    });
  }

  // 7. 移除handleDownload函数
  content = content.replace(
    /const handleDownload = \(\) => \{[\s\S]*?\n  \}/,
    ''
  );

  // 8. 更新handleTaskSelect
  content = content.replace(
    /const handleTaskSelect = \(task: TaskHistoryItem\) => \{[\s\S]*?\n  \}/,
    `const handleTaskSelect = (task: TaskHistoryItem) => {
    setSelectedHistoryTask(task)
    setError(null)
  }`
  );

  // 9. 更新canProcess
  content = content.replace(/!isProcessing/g, '!isSubmitting');

  // 10. 更新UI中的按钮文本
  content = content.replace(/处理中\.\.\./g, '提交中...');
  content = content.replace(/isProcessing \?/g, 'isSubmitting ?');

  // 11. 移除处理状态显示的UI
  content = content.replace(
    /\{\/\* Processing Status \*\/\}[\s\S]*?\{\/\* Result \*\/\}[\s\S]*?\)\}/,
    `{/* 多任务状态提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex items-center">
          <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2" />
          <div className="text-sm text-blue-800">
            <strong>多任务支持：</strong>您可以同时提交多个任务。当前活跃任务数：
            <span className="font-medium ml-1">{taskManager.getConcurrentTaskCount()}/5</span>
            。任务状态可在右下角查看。
          </div>
        </div>
      </div>`
  );

  // 12. 更新TaskHistory组件的taskType
  content = content.replace(
    /<TaskHistory[\s\S]*?\/>/,
    `<TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="${taskType}"
      />`
  );

  // 写回文件
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated: ${filePath}`);
}

// 执行更新
console.log('🚀 Starting multi-task update for remaining pages...');

updatePageForMultiTask('web/frontend/src/pages/VideoPage.tsx', 'video');
updatePageForMultiTask('web/frontend/src/pages/MultiVideoPage.tsx', 'multi-video');

console.log('🎉 Multi-task update completed!'); 