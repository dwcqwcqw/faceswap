export default {
  async fetch(request, env, ctx) {
    // CORS handling
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env)
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Route handling
      if (path.startsWith('/api/upload')) {
        return await handleUpload(request, env)
      } else if (path.startsWith('/api/process/')) {
        return await handleProcess(request, env, path)
      } else if (path.startsWith('/api/status/')) {
        return await handleStatus(request, env, path)
      } else if (path.startsWith('/api/download/')) {
        return await handleDownload(request, env, path)
      } else if (path.startsWith('/api/detect-faces')) {
        return await handleDetectFaces(request, env)
      } else {
        return new Response('Not Found', { status: 404 })
      }
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }
}

// CORS handler
export function handleCORS(request, env) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}

// Upload file to R2
export async function handleUpload(request, env) {
  try {
    console.log('Upload request received');
    console.log('Content-Type:', request.headers.get('content-type'));
    
    // Check if request has form data
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Content-Type must be multipart/form-data'
      }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }})
    }
    
    const formData = await request.formData()
    const file = formData.get('file')
    
    console.log('File received:', file ? file.name : 'null');
    
    if (!file) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No file provided'
      }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }})
    }

    // Generate unique file ID
    const fileId = generateFileId()
    const fileExtension = getFileExtension(file.name)
    const fileName = `uploads/${fileId}.${fileExtension}`

    console.log('Uploading to R2:', fileName);

    // Upload to R2
    const uploadResult = await env.FACESWAP_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadTime: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size.toString()
      }
    })

    if (!uploadResult) {
      throw new Error('Failed to upload file to R2')
    }

    console.log('Upload successful:', fileName);

    // Set expiration for uploaded files (24 hours)
    await scheduleFileDeletion(env, fileName, 24 * 60 * 60 * 1000) // 24 hours

    return new Response(JSON.stringify({
      success: true,
      data: {
        fileId: fileId,
        fileName: file.name,
        url: `/api/download/${fileId}`,
        size: file.size,
        type: file.type
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Upload failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Process face swap request
export async function handleProcess(request, env, path) {
  try {
    const processType = path.split('/').pop() // single-image, multi-image, etc.
    const requestBody = await request.json()
    
    // Generate job ID
    const jobId = generateJobId()
    
    // Store job in KV with pending status
    const jobData = {
      id: jobId,
      type: processType,
      status: 'pending',
      progress: 0,
      created_at: new Date().toISOString(),
      source_file: requestBody.source_file,
      target_file: requestBody.target_file,
      options: requestBody.options || {}
    }
    
    await env.JOBS.put(jobId, JSON.stringify(jobData))

    // Prepare RunPod request
    const runpodPayload = {
      input: {
        job_id: jobId,
        process_type: processType,
        source_file: await getR2FileUrl(env, requestBody.source_file),
        target_file: await getR2FileUrl(env, requestBody.target_file),
        options: requestBody.options || {}
      }
    }

    // Send to RunPod
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RUNPOD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runpodPayload)
    })

    const runpodResult = await runpodResponse.json()
    
    if (!runpodResponse.ok) {
      throw new Error(`RunPod error: ${runpodResult.error || 'Unknown error'}`)
    }

    // Update job with RunPod ID
    jobData.runpod_id = runpodResult.id
    jobData.status = 'processing'
    await env.JOBS.put(jobId, JSON.stringify(jobData))

    return new Response(JSON.stringify({
      success: true,
      data: { jobId }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Process error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Processing failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Get job status
export async function handleStatus(request, env, path) {
  try {
    const jobId = path.split('/').pop()
    
    // Get job from KV
    const jobData = await env.JOBS.get(jobId)
    if (!jobData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }})
    }

    const job = JSON.parse(jobData)

    // If processing, check RunPod status
    if (job.status === 'processing' && job.runpod_id) {
      const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_id}`, {
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_TOKEN}`
        }
      })

      const runpodResult = await runpodResponse.json()
      
      if (runpodResponse.ok) {
        // Update job based on RunPod status
        if (runpodResult.status === 'COMPLETED') {
          job.status = 'completed'
          job.progress = 100
          job.completed_at = new Date().toISOString()
          
          // Handle different result formats from RunPod
          if (runpodResult.output) {
            // Format 1: result_url (from old handler)
            if (runpodResult.output.result_url) {
              const resultFileId = await storeResultFromUrl(env, runpodResult.output.result_url, jobId)
              job.result_url = `/api/download/${resultFileId}`
            }
            // Format 2: base64 result (from serverless handler)
            else if (runpodResult.output.result) {
              const resultFileId = await storeResultFromBase64(env, runpodResult.output.result, jobId)
              job.result_url = `/api/download/${resultFileId}`
            }
            // Format 3: direct base64 (legacy)
            else if (typeof runpodResult.output === 'string') {
              const resultFileId = await storeResultFromBase64(env, runpodResult.output, jobId)
              job.result_url = `/api/download/${resultFileId}`
            }
          }
          
          await env.JOBS.put(jobId, JSON.stringify(job))
          
        } else if (runpodResult.status === 'FAILED') {
          job.status = 'failed'
          job.error_message = runpodResult.error || 'Processing failed'
          await env.JOBS.put(jobId, JSON.stringify(job))
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: job
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Status error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Status check failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Download file from R2
export async function handleDownload(request, env, path) {
  try {
    const fileId = path.split('/').pop()
    console.log('Download request for fileId:', fileId);
    
    // Try both uploads and results folders with different extensions
    const possiblePaths = [
      `uploads/${fileId}.jpg`,
      `uploads/${fileId}.jpeg`, 
      `uploads/${fileId}.png`,
      `uploads/${fileId}.webp`,
      `uploads/${fileId}.gif`,
      `uploads/${fileId}.bmp`,
      `uploads/${fileId}.svg`,
      `uploads/${fileId}.mp4`,
      `uploads/${fileId}.avi`,
      `uploads/${fileId}.mov`,
      `uploads/${fileId}`,
      `results/${fileId}.jpg`,
      `results/${fileId}.jpeg`,
      `results/${fileId}.png`,
      `results/${fileId}.webp`,
      `results/${fileId}.gif`,
      `results/${fileId}.bmp`, 
      `results/${fileId}.svg`,
      `results/${fileId}.mp4`,
      `results/${fileId}.avi`,
      `results/${fileId}.mov`,
      `results/${fileId}`
    ];
    
    let r2Object = null;
    let foundPath = null;
    
    for (const testPath of possiblePaths) {
      console.log('Trying path:', testPath);
      r2Object = await env.FACESWAP_BUCKET.get(testPath);
      if (r2Object) {
        foundPath = testPath;
        console.log('Found file at:', foundPath);
        break;
      }
    }
    
    if (!r2Object) {
      console.log('File not found in any path');
      return new Response('File not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    const headers = new Headers()
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Content-Type', r2Object.httpMetadata?.contentType || 'application/octet-stream')
    
    // Set filename for download
    const originalName = r2Object.customMetadata?.originalName || `file_${fileId}`
    headers.set('Content-Disposition', `attachment; filename="${originalName}"`)

    console.log('Serving file:', foundPath, 'as:', originalName);
    return new Response(r2Object.body, { headers })

  } catch (error) {
    console.error('Download error:', error)
    return new Response('Download failed', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// Face detection handler
export async function handleDetectFaces(request, env) {
  try {
    const requestBody = await request.json()
    const fileId = requestBody.fileId
    
    if (!fileId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No file ID provided'
      }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }})
    }

    // Prepare RunPod request for face detection
    const runpodPayload = {
      input: {
        process_type: 'detect-faces',
        image_file: await getR2FileUrl(env, fileId)
      }
    }

    // Send to RunPod
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RUNPOD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runpodPayload)
    })

    const runpodResult = await runpodResponse.json()
    
    if (!runpodResponse.ok) {
      throw new Error(`RunPod error: ${runpodResult.error || 'Unknown error'}`)
    }

    return new Response(JSON.stringify({
      success: true,
      data: runpodResult.output
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Face detection error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Face detection failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Helper functions
function generateFileId() {
  return crypto.randomUUID()
}

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getFileExtension(filename) {
  return filename.split('.').pop() || 'bin'
}

async function getR2FileUrl(env, fileId) {
  // Instead of generating a direct R2 URL that might not work due to missing extensions,
  // use our own Worker download endpoint which handles file extension detection
  return `https://faceswap-api.faceswap.workers.dev/api/download/${fileId}`
}

async function storeResultFromUrl(env, resultUrl, jobId) {
  try {
    // Download the result from RunPod
    const response = await fetch(resultUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch result file')
    }

    // Generate result file ID
    const resultFileId = `result_${jobId}_${Date.now()}`
    const fileName = `results/${resultFileId}.jpg` // Assume JPG for now

    // Store in R2
    await env.FACESWAP_BUCKET.put(fileName, response.body, {
      customMetadata: {
        jobId: jobId,
        createdAt: new Date().toISOString(),
        originalUrl: resultUrl
      }
    })

    // Set expiration for result files (7 days)
    await scheduleFileDeletion(env, fileName, 7 * 24 * 60 * 60 * 1000) // 7 days

    return resultFileId

  } catch (error) {
    console.error('Failed to store result:', error)
    throw error
  }
}

async function storeResultFromBase64(env, base64Data, jobId) {
  try {
    // Generate result file ID
    const resultFileId = `result_${jobId}_${Date.now()}`
    const fileName = `results/${resultFileId}.jpg` // Assume JPG for now

    // Decode base64 data to a Buffer
    const buffer = Buffer.from(base64Data, 'base64')

    // Store in R2
    await env.FACESWAP_BUCKET.put(fileName, buffer, {
      customMetadata: {
        jobId: jobId,
        createdAt: new Date().toISOString(),
        base64Data: base64Data
      }
    })

    // Set expiration for result files (7 days)
    await scheduleFileDeletion(env, fileName, 7 * 24 * 60 * 60 * 1000) // 7 days

    return resultFileId

  } catch (error) {
    console.error('Failed to store result:', error)
    throw error
  }
}

async function scheduleFileDeletion(env, fileName, delayMs) {
  // Use Cloudflare's Durable Objects or external service for file cleanup
  // For now, we'll rely on manual cleanup or lifecycle policies
  console.log(`File ${fileName} scheduled for deletion in ${delayMs}ms`)
} 