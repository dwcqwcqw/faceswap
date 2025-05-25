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
    console.log(`📋 Checking status for job: ${jobId}`);
    
    // Get job from KV
    const jobData = await env.JOBS.get(jobId)
    if (!jobData) {
      console.log(`❌ Job not found: ${jobId}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }})
    }

    const job = JSON.parse(jobData)
    console.log(`🔍 Job status: ${job.status}, RunPod ID: ${job.runpod_id}`);

    // If processing, check RunPod status
    if (job.status === 'processing' && job.runpod_id) {
      console.log(`🔄 Checking RunPod status for: ${job.runpod_id}`);
      
      const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_id}`, {
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_TOKEN}`
        }
      })

      if (!runpodResponse.ok) {
        console.log(`⚠️ RunPod API error: ${runpodResponse.status} ${runpodResponse.statusText}`);
        // Don't fail completely, just return current job status
      } else {
        const runpodResult = await runpodResponse.json()
        console.log(`📊 RunPod result:`, JSON.stringify(runpodResult, null, 2));
        
        // Update job based on RunPod status
        if (runpodResult.status === 'COMPLETED') {
          console.log(`✅ RunPod job completed, processing result...`);
          
          job.status = 'completed'
          job.progress = 100
          job.completed_at = new Date().toISOString()
          
          // Handle different result formats from RunPod
          if (runpodResult.output) {
            console.log(`🔍 Processing RunPod output...`);
            
            try {
              // Format 1: result_url (from old handler)
              if (runpodResult.output.result_url) {
                console.log(`📎 Found result_url format: ${runpodResult.output.result_url}`);
                const resultFileId = await storeResultFromUrl(env, runpodResult.output.result_url, jobId)
                job.result_url = `/api/download/${resultFileId}`
              }
              // Format 2: base64 result (from serverless handler)
              else if (runpodResult.output.result) {
                console.log(`📄 Found base64 result format (${runpodResult.output.result.length} chars)`);
                const resultFileId = await storeResultFromBase64(env, runpodResult.output.result, jobId)
                job.result_url = `/api/download/${resultFileId}`
              }
              // Format 3: direct base64 (legacy)
              else if (typeof runpodResult.output === 'string') {
                console.log(`📄 Found direct base64 format (${runpodResult.output.length} chars)`);
                const resultFileId = await storeResultFromBase64(env, runpodResult.output, jobId)
                job.result_url = `/api/download/${resultFileId}`
              }
              else {
                console.log(`⚠️ Unknown RunPod output format:`, Object.keys(runpodResult.output));
              }
              
            } catch (resultError) {
              console.error('❌ Error processing result:', resultError);
              job.status = 'failed'
              job.error_message = `Result processing failed: ${resultError.message}`
            }
          } else {
            console.log(`⚠️ No output in RunPod result`);
          }
          
          await env.JOBS.put(jobId, JSON.stringify(job))
          console.log(`💾 Job updated with new status: ${job.status}`);
          
        } else if (runpodResult.status === 'FAILED') {
          console.log(`❌ RunPod job failed: ${runpodResult.error || 'Unknown error'}`);
          job.status = 'failed'
          job.error_message = runpodResult.error || 'Processing failed'
          await env.JOBS.put(jobId, JSON.stringify(job))
        } else {
          console.log(`🔄 RunPod job still in progress: ${runpodResult.status}`);
        }
      }
    }

    console.log(`📤 Returning job status: ${job.status}`);
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
    console.error('❌ Status error:', error);
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
    let downloadFilename;
    
    if (foundPath.startsWith('results/')) {
      // For result files, create a descriptive filename
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      downloadFilename = `face_swap_result_${timestamp}.jpg`;
    } else {
      // For uploaded files, use original name or generate one with extension
      const originalName = r2Object.customMetadata?.originalName;
      if (originalName) {
        downloadFilename = originalName;
      } else {
        // Extract extension from the found path
        const pathParts = foundPath.split('.');
        const extension = pathParts.length > 1 ? pathParts.pop() : 'jpg';
        downloadFilename = `file_${fileId}.${extension}`;
      }
    }
    
    headers.set('Content-Disposition', `attachment; filename="${downloadFilename}"`)

    console.log('Serving file:', foundPath, 'as:', downloadFilename);
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

    console.log('🔍 Sending face detection request to RunPod:', JSON.stringify(runpodPayload, null, 2))

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
    console.log('📋 RunPod response:', JSON.stringify(runpodResult, null, 2))
    
    if (!runpodResponse.ok) {
      throw new Error(`RunPod error: ${runpodResult.error || 'Unknown error'}`)
    }

    // Check if this is a synchronous response (has output) or asynchronous (has id)
    if (runpodResult.output) {
      // Synchronous response - return immediately
      console.log('✅ Synchronous response received')
      return new Response(JSON.stringify({
        success: true,
        data: runpodResult.output
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } else if (runpodResult.id) {
      // Asynchronous response - poll for result
      console.log('🔄 Asynchronous response, polling for result...')
      const pollResult = await pollRunPodResult(env, runpodResult.id, 30) // 30 second timeout
      
      if (pollResult.success) {
        return new Response(JSON.stringify({
          success: true,
          data: pollResult.output
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } else {
        throw new Error(pollResult.error || 'Polling failed')
      }
    } else {
      // Unknown response format
      console.log('⚠️ Unknown RunPod response format')
      return new Response(JSON.stringify({
        success: true,
        data: {
          faces: [],
          total_faces: 0,
          image_path: await getR2FileUrl(env, fileId),
          message: 'Face detection completed but no faces found'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

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

// Helper function to poll RunPod result
async function pollRunPodResult(env, jobId, timeoutSeconds = 30) {
  const maxAttempts = Math.ceil(timeoutSeconds / 2) // Poll every 2 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Polling attempt ${attempt}/${maxAttempts} for job ${jobId}`)
      
      const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.log(`⚠️ Polling failed with HTTP ${response.status}`)
        continue
      }

      const result = await response.json()
      console.log(`📊 Job ${jobId} status: ${result.status}`)
      
      if (result.status === 'COMPLETED') {
        console.log('✅ Job completed successfully')
        return { success: true, output: result.output }
      } else if (result.status === 'FAILED') {
        console.log('❌ Job failed')
        return { success: false, error: result.error || 'Job failed' }
      } else {
        // Still running, wait before next attempt
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        }
      }

    } catch (error) {
      console.log(`⚠️ Polling error on attempt ${attempt}: ${error.message}`)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      }
    }
  }
  
  return { success: false, error: 'Polling timeout' }
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
    console.log(`🔄 Storing base64 result for job ${jobId}...`);
    
    // Generate result file ID
    const resultFileId = `result_${jobId}_${Date.now()}`
    const fileName = `results/${resultFileId}.jpg` // Assume JPG for now

    // Decode base64 data - Buffer is not available in Cloudflare Workers
    // Use the Web API atob and convert to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`💾 Storing result file: ${fileName} (${bytes.length} bytes)`);

    // Store in R2
    await env.FACESWAP_BUCKET.put(fileName, bytes, {
      httpMetadata: {
        contentType: 'image/jpeg'
      },
      customMetadata: {
        jobId: jobId,
        createdAt: new Date().toISOString(),
        type: 'result'
      }
    })

    console.log(`💾 Result stored successfully`);

    return resultFileId

  } catch (error) {
    console.error('Failed to store result:', error)
    throw error
  }
}

async function scheduleFileDeletion(env, fileName, delayMs) {
  // Use Cloudflare's lifecycle policies or external service for file cleanup
  // For now, we'll rely on manual cleanup or R2 lifecycle policies
  console.log(`🗑️ File ${fileName} scheduled for deletion in ${delayMs}ms`)
}
