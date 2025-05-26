export interface ErrorSuggestion {
  type: 'file-corruption' | 'timeout' | 'format' | 'network' | 'server' | 'generic'
  title: string
  suggestions: string[]
  color: 'red' | 'yellow' | 'blue' | 'gray'
}

export function analyzeError(error: string): ErrorSuggestion {
  const errorLower = error.toLowerCase()
  
  // 文件损坏错误
  if (errorLower.includes('unexpected eof') || 
      errorLower.includes('corrupted') || 
      errorLower.includes('truncated') ||
      errorLower.includes('invalid file') ||
      errorLower.includes('file might be corrupted')) {
    return {
      type: 'file-corruption',
      title: '🛠️ 文件损坏问题的解决方案：',
      suggestions: [
        '请重新选择文件并重试',
        '确保文件完整且未损坏',
        '尝试使用其他文件格式',
        '检查网络连接是否稳定',
        '如果是视频文件，尝试重新编码'
      ],
      color: 'red'
    }
  }
  
  // 超时错误
  if (errorLower.includes('timeout') || 
      errorLower.includes('超时') ||
      errorLower.includes('timed out') ||
      errorLower.includes('request timeout')) {
    return {
      type: 'timeout',
      title: '⏱️ 超时问题的解决方案：',
      suggestions: [
        '检查网络连接',
        '尝试压缩文件大小',
        '稍后重试',
        '确保网络环境稳定'
      ],
      color: 'yellow'
    }
  }
  
  // 格式错误
  if (errorLower.includes('format') || 
      errorLower.includes('格式') ||
      errorLower.includes('unsupported') ||
      errorLower.includes('invalid format') ||
      errorLower.includes('codec')) {
    return {
      type: 'format',
      title: '📁 格式问题的解决方案：',
      suggestions: [
        '确保使用支持的文件格式',
        '图片：JPG、PNG、BMP、TIFF、WebP、GIF、HEIC等',
        '视频：MP4、AVI、MOV、MKV、WMV、FLV、3GP、WebM等',
        '避免使用损坏或特殊格式的文件',
        '尝试重新保存或编码文件'
      ],
      color: 'blue'
    }
  }
  
  // 网络错误
  if (errorLower.includes('network') || 
      errorLower.includes('connection') ||
      errorLower.includes('网络') ||
      errorLower.includes('econnreset') ||
      errorLower.includes('enotfound')) {
    return {
      type: 'network',
      title: '🌐 网络问题的解决方案：',
      suggestions: [
        '检查网络连接',
        '尝试刷新页面',
        '检查防火墙设置',
        '稍后重试'
      ],
      color: 'yellow'
    }
  }
  
  // 服务器错误
  if (errorLower.includes('server error') || 
      errorLower.includes('internal server') ||
      errorLower.includes('服务器') ||
      errorLower.includes('500') ||
      errorLower.includes('502') ||
      errorLower.includes('503')) {
    return {
      type: 'server',
      title: '🔧 服务器问题的解决方案：',
      suggestions: [
        '服务器暂时不可用',
        '请稍后重试',
        '如果问题持续，请联系技术支持',
        '尝试使用较小的文件'
      ],
      color: 'red'
    }
  }
  
  // 通用错误
  return {
    type: 'generic',
    title: '💡 通用解决方案：',
    suggestions: [
      '检查网络连接',
      '刷新页面重试',
      '更换不同的文件',
      '稍后再试',
      '如果问题持续，请联系技术支持'
    ],
    color: 'gray'
  }
}

export function getErrorColorClasses(color: ErrorSuggestion['color']) {
  switch (color) {
    case 'red':
      return {
        container: 'bg-red-100 border-l-4 border-red-500',
        text: 'text-red-800'
      }
    case 'yellow':
      return {
        container: 'bg-yellow-100 border-l-4 border-yellow-500',
        text: 'text-yellow-800'
      }
    case 'blue':
      return {
        container: 'bg-blue-100 border-l-4 border-blue-500',
        text: 'text-blue-800'
      }
    case 'gray':
    default:
      return {
        container: 'bg-gray-100 border-l-4 border-gray-500',
        text: 'text-gray-800'
      }
  }
}

// 错误重试策略
export function shouldRetryError(error: string, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false
  
  const errorLower = error.toLowerCase()
  
  // 可重试的错误类型
  const retryableErrors = [
    'timeout',
    'network',
    'connection',
    'econnreset',
    'enotfound',
    'unexpected eof',
    'corrupted',
    '500',
    '502',
    '503',
    '504'
  ]
  
  return retryableErrors.some(keyword => errorLower.includes(keyword))
}

// 计算重试延迟（指数退避）
export function getRetryDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 10000): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
} 