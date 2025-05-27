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
        return addCorsHeaders(await handleUpload(request, env), request)
      } else if (path.startsWith('/api/process/')) {
        return addCorsHeaders(await handleProcess(request, env, path), request)
      } else if (path.startsWith('/api/status/')) {
        return addCorsHeaders(await handleStatus(request, env, path), request)
      } else if (path.startsWith('/api/download/')) {
        return addCorsHeaders(await handleDownload(request, env, path), request)
      } else if (path.startsWith('/api/detect-faces')) {
        return addCorsHeaders(await handleDetectFaces(request, env), request)
      } else if (path.startsWith('/api/cancel/')) {
        return addCorsHeaders(await handleCancel(request, env, path), request)
      } else if (path.startsWith('/api/single-image-swap')) {
        return addCorsHeaders(await handleSingleImageSwap(request, env), request)
      } else {
        return new Response('Not Found', { status: 404 })
      }
    } catch (error) {
      console.error('Worker error:', error)
      const errorResponse = new Response(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return addCorsHeaders(errorResponse, request)
    }
  }
}

// CORS handler
function handleCORS(request, env) {
  const origin = request.headers.get('Origin')
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ]
  
  const responseHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  }

  // Check if origin is allowed (localhost/127.0.0.1 or *.pages.dev)
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.pages.dev'))) {
    responseHeaders['Access-Control-Allow-Origin'] = origin
  } else if (!origin) {
    // For same-origin requests or when no origin header is present
    responseHeaders['Access-Control-Allow-Origin'] = '*'
  }

  return new Response(null, {
    status: 200,
    headers: responseHeaders
  })
}

// Add CORS headers to responses
function addCorsHeaders(response, request) {
  const origin = request.headers.get('Origin')
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ]

  const newResponse = new Response(response.body, response)
  
  // Check if origin is allowed (localhost/127.0.0.1 or *.pages.dev)
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.pages.dev'))) {
    newResponse.headers.set('Access-Control-Allow-Origin', origin)
  } else if (!origin) {
    // For same-origin requests or when no origin header is present
    newResponse.headers.set('Access-Control-Allow-Origin', '*')
  }
  
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  newResponse.headers.set('Access-Control-Allow-Credentials', 'false')
  
  return newResponse
}

// Upload file to R2
async function handleUpload(request, env) {
  try {
    console.log('Upload request received');
    console.log('Content-Type:', request.headers.get('content-type'));
    
    // Check if request has form data
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Content-Type must be multipart/form-data'
      }), { status: 400, headers: { 'Content-Type': 'application/json' }})
    }
    
    const formData = await request.formData()
    const file = formData.get('file')
    
    console.log('File received:', file ? file.name : 'null');
    
    if (!file) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No file provided'
      }), { status: 400, headers: { 'Content-Type': 'application/json' }})
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
        'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
      }
    })
  }
}

// Process face swap request
async function handleProcess(request, env, path) {
  try {
    const processType = path.split('/').pop() // single-image, multi-image, etc.
    const requestBody = await request.json()
    
    console.log(`🔧 Processing ${processType} request:`, JSON.stringify(requestBody, null, 2));
    console.log(`📍 Full path: ${path}`);
    console.log(`🔍 Extracted processType: '${processType}'`);
    console.log(`🔍 processType === 'single-video': ${processType === 'single-video'}`);
    console.log(`🔍 processType === 'multi-video': ${processType === 'multi-video'}`);
    
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
      face_mappings: requestBody.face_mappings || {},
      options: requestBody.options || {}
    }
    
    await env.JOBS.put(jobId, JSON.stringify(jobData))

    // Prepare RunPod request based on process type
    let runpodPayload;
    
    if (processType === 'multi-image') {
      console.log(`🔀 Taking multi-image branch`);
      // For multi-image, convert face_mappings file IDs to URLs
      const faceMappingUrls = {};
      if (requestBody.face_mappings) {
        for (const [faceId, fileId] of Object.entries(requestBody.face_mappings)) {
          faceMappingUrls[faceId] = await getR2FileUrl(env, fileId);
        }
      }
      
      runpodPayload = {
        input: {
          job_id: jobId,
          process_type: 'multi_image',  // Normalize process type
          target_file: await getR2FileUrl(env, requestBody.target_file),  // Multi-person image
          face_mappings: faceMappingUrls,  // Individual face replacement images
          options: requestBody.options || {}
        }
      }
      
      console.log(`🎯 Multi-image payload:`, JSON.stringify(runpodPayload, null, 2));
    } else if (processType === 'single-video' || processType === 'multi-video') {
      console.log(`🔀 Taking video branch (processType: '${processType}')`);
      
      if (processType === 'multi-video') {
        // For multi-video, convert face_mappings file IDs to URLs like multi-image
        const faceMappingUrls = {};
        if (requestBody.face_mappings) {
          for (const [faceId, fileId] of Object.entries(requestBody.face_mappings)) {
            faceMappingUrls[faceId] = await getR2FileUrl(env, fileId);
          }
        }
        
        runpodPayload = {
          input: {
            job_id: jobId,
            process_type: 'multi_video',  // Use multi_video processing
            target_file: await getR2FileUrl(env, requestBody.target_file),  // Target video with multiple people
            face_mappings: faceMappingUrls,  // Individual face replacement images
            options: requestBody.options || {}
          }
        }
        
        console.log(`🎬 Multi-video payload:`, JSON.stringify(runpodPayload, null, 2));
      } else {
        // Single video processing
        runpodPayload = {
          input: {
            job_id: jobId,
            process_type: 'single-video',  // Use video processing
            source_file: await getR2FileUrl(env, requestBody.source_file),  // Source face image
            target_file: await getR2FileUrl(env, requestBody.target_file),   // Target video
            options: requestBody.options || {}
          }
        }
        
        console.log(`🎬 Single-video payload:`, JSON.stringify(runpodPayload, null, 2));
      }
    } else {
      console.log(`🔀 Taking else branch (default single-image) for processType: '${processType}'`);
      // Standard single-image processing
      runpodPayload = {
        input: {
          job_id: jobId,
          process_type: 'single-image',  // Normalize process type
          source_file: await getR2FileUrl(env, requestBody.source_file),
          target_file: await getR2FileUrl(env, requestBody.target_file),
          options: requestBody.options || {}
        }
      }
      
      console.log(`🖼️ Single-image payload:`, JSON.stringify(runpodPayload, null, 2));
    }

    console.log(`🚀 Sending to RunPod:`, JSON.stringify(runpodPayload, null, 2));

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
    console.log(`📊 RunPod response:`, JSON.stringify(runpodResult, null, 2));
    
    if (!runpodResponse.ok) {
      console.error('❌ RunPod error:', runpodResult);
      throw new Error(`RunPod error: ${runpodResult.error || 'Unknown error'}`)
    }

    // Update job with RunPod ID and processing status
    jobData.runpod_id = runpodResult.id
    jobData.status = 'processing'
    await env.JOBS.put(jobId, JSON.stringify(jobData))

    console.log(`✅ Job ${jobId} created and started with RunPod ID: ${runpodResult.id}`);

    return new Response(JSON.stringify({
      success: true,
      data: { jobId: jobId }
    }), {
      headers: {
        'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
      }
    })
  }
}

// Get job status
async function handleStatus(request, env, path) {
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
      }), { status: 404, headers: { 'Content-Type': 'application/json' }})
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

      if (runpodResponse.ok) {
        const runpodResult = await runpodResponse.json()
        console.log(`📊 RunPod status response:`, JSON.stringify(runpodResult, null, 2));
        
        if (runpodResult.status === 'COMPLETED') {
          console.log(`✅ Job completed`);
          job.status = 'completed'
          job.progress = 100
          job.completed_at = new Date().toISOString()
          
          // Process result from RunPod
          if (runpodResult.output) {
            
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
          console.log(`❌ Job failed`);
          job.status = 'failed'
          job.error_message = runpodResult.error || 'Processing failed on RunPod'
          await env.JOBS.put(jobId, JSON.stringify(job))
        } else if (runpodResult.status === 'IN_PROGRESS') {
          // Update progress if available
          if (runpodResult.progress) {
            job.progress = Math.round(runpodResult.progress * 100)
            await env.JOBS.put(jobId, JSON.stringify(job))
          }
        }
      } else {
        console.log(`⚠️ RunPod status check failed: ${runpodResponse.status}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: job
    }), {
      headers: {
        'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
      }
    })
  }
}

// Download file from R2
async function handleDownload(request, env, path) {
  try {
    const fileId = path.split('/').pop()
    console.log(`📥 Download request for file: ${fileId}`);

    // Try different file extensions to find the file
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', '3gp', 'm4v', 'webm']
    let file = null
    let fileName = null

    // First try uploads directory
    for (const ext of extensions) {
      fileName = `uploads/${fileId}.${ext}`
      file = await env.FACESWAP_BUCKET.get(fileName)
      if (file) break
    }

    // If not found in uploads, try results directory
    if (!file) {
      for (const ext of extensions) {
        fileName = `results/${fileId}.${ext}`
        file = await env.FACESWAP_BUCKET.get(fileName)
        if (file) break
      }
    }

    if (!file) {
      console.log(`❌ File not found: ${fileId}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'File not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' }})
    }

    console.log(`✅ File found: ${fileName}`);
    
    // Get file metadata
    const metadata = file.customMetadata || {}
    const contentType = file.httpMetadata?.contentType || 'application/octet-stream'
    
    // Set response headers for file download
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Disposition', `attachment; filename="${metadata.originalName || fileId}"`)
    headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    
    return new Response(file.body, { headers })

  } catch (error) {
    console.error('Download error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Download failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

// Cancel job
async function handleCancel(request, env, path) {
  try {
    const jobId = path.split('/').pop()
    console.log(`🚫 Cancel request for job: ${jobId}`);

    // Get job from KV
    const jobData = await env.JOBS.get(jobId)
    if (!jobData) {
      console.log(`❌ Job not found: ${jobId}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' }})
    }

    const job = JSON.parse(jobData)

    // If job is still processing and has a RunPod ID, try to cancel it on RunPod
    if (job.status === 'processing' && job.runpod_id) {
      console.log(`🔄 Attempting to cancel RunPod job: ${job.runpod_id}`);
      
      try {
        const cancelResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/cancel/${job.runpod_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RUNPOD_TOKEN}`
          }
        })
        
        console.log(`📊 RunPod cancel response status: ${cancelResponse.status}`);
      } catch (cancelError) {
        console.log(`⚠️ Failed to cancel on RunPod: ${cancelError.message}`);
      }
    }

    // Update job status to cancelled
    job.status = 'cancelled'
    job.cancelled_at = new Date().toISOString()
    await env.JOBS.put(jobId, JSON.stringify(job))

    console.log(`✅ Job cancelled: ${jobId}`);

    return new Response(JSON.stringify({
      success: true,
      data: { message: 'Job cancelled' }
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Cancel error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Cancel failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

// Face detection handler
async function handleDetectFaces(request, env) {
  try {
    const requestBody = await request.json()
    const fileId = requestBody.fileId
    
    if (!fileId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No file ID provided'
      }), { status: 400, headers: { 'Content-Type': 'application/json' }})
    }

    // Prepare RunPod request for face detection
    const runpodPayload = {
      input: {
        process_type: 'detect_faces',
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

    // Wait for result since face detection is usually quick
    console.log('⏳ Waiting for face detection result...')
    const result = await pollRunPodResult(env, runpodResult.id)
    
    if (result.status === 'COMPLETED') {
      console.log('✅ Face detection completed')
      return new Response(JSON.stringify({
        success: true,
        data: result.output
      }), {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } else {
      throw new Error('Face detection failed or timed out')
    }

  } catch (error) {
    console.error('Face detection error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Face detection failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

// Poll RunPod for result
async function pollRunPodResult(env, runpodJobId, timeoutSeconds = 60) {
  const startTime = Date.now()
  const timeoutMs = timeoutSeconds * 1000
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`, {
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_TOKEN}`
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.status === 'COMPLETED' || result.status === 'FAILED') {
          return result
        }
        
        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        console.log(`Poll failed with status: ${response.status}`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.log(`Poll error: ${error.message}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  throw new Error('Polling timed out')
}

// Utility functions
function generateFileId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function generateJobId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
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
  console.log(`📥 Downloading result from URL: ${resultUrl}`);
  
  // Download the result file
  const response = await fetch(resultUrl)
  if (!response.ok) {
    throw new Error(`Failed to download result: ${response.status}`)
  }
  
  // Get content type to determine file extension
  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  let extension = 'bin'
  if (contentType.includes('image/jpeg')) extension = 'jpg'
  else if (contentType.includes('image/png')) extension = 'png'
  else if (contentType.includes('image/gif')) extension = 'gif'
  else if (contentType.includes('video/mp4')) extension = 'mp4'
  else if (contentType.includes('video/')) extension = 'mp4' // Default video extension
  else if (contentType.includes('image/')) extension = 'jpg' // Default image extension
  
  const resultFileId = generateFileId()
  const fileName = `results/${resultFileId}.${extension}`
  
  console.log(`💾 Storing result as: ${fileName}`);
  
  // Store in R2
  await env.FACESWAP_BUCKET.put(fileName, response.body, {
    httpMetadata: {
      contentType: contentType
    },
    customMetadata: {
      jobId: jobId,
      originalUrl: resultUrl,
      storeTime: new Date().toISOString()
    }
  })
  
  return resultFileId
}

async function storeResultFromBase64(env, base64Data, jobId) {
  console.log(`📄 Storing base64 result (${base64Data.length} chars)`);
  
  // Remove data URL prefix if present
  let cleanBase64 = base64Data
  if (base64Data.startsWith('data:')) {
    cleanBase64 = base64Data.split(',')[1]
  }
  
  // Convert base64 to binary
  const binaryData = atob(cleanBase64)
  const bytes = new Uint8Array(binaryData.length)
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i)
  }
  
  // Determine file type from base64 header or default to jpg
  let contentType = 'image/jpeg'
  let extension = 'jpg'
  
  if (base64Data.startsWith('data:image/png')) {
    contentType = 'image/png'
    extension = 'png'
  } else if (base64Data.startsWith('data:video/mp4')) {
    contentType = 'video/mp4'
    extension = 'mp4'
  }
  
  const resultFileId = generateFileId()
  const fileName = `results/${resultFileId}.${extension}`
  
  console.log(`💾 Storing base64 result as: ${fileName}`);
  
  // Store in R2
  await env.FACESWAP_BUCKET.put(fileName, bytes, {
    httpMetadata: {
      contentType: contentType
    },
    customMetadata: {
      jobId: jobId,
      storeTime: new Date().toISOString(),
      source: 'base64'
    }
  })
  
  return resultFileId
}

// File cleanup scheduler
async function scheduleFileDeletion(env, fileName, delayMs) {
  // This would typically use Durable Objects or scheduled workers
  // For now, just log the intent
  console.log(`🗑️ File ${fileName} scheduled for deletion in ${delayMs}ms`)
}

// Single image swap with FormData upload
async function handleSingleImageSwap(request, env) {
  try {
    console.log('Single image swap request received');
    console.log('Content-Type:', request.headers.get('content-type'));
    
    // Check if request has form data
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Content-Type must be multipart/form-data'
      }), { status: 400, headers: { 'Content-Type': 'application/json' }})
    }
    
    const formData = await request.formData()
    const sourceImage = formData.get('source_image')
    const targetImage = formData.get('target_image')
    
    console.log('Source image received:', sourceImage ? sourceImage.name : 'null');
    console.log('Target image received:', targetImage ? targetImage.name : 'null');
    
    if (!sourceImage || !targetImage) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Both source_image and target_image are required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' }})
    }

    // Upload source image to R2
    const sourceFileId = generateFileId()
    const sourceExtension = getFileExtension(sourceImage.name)
    const sourceFileName = `uploads/${sourceFileId}.${sourceExtension}`

    console.log('Uploading source image to R2:', sourceFileName);

    const sourceUploadResult = await env.FACESWAP_BUCKET.put(sourceFileName, sourceImage.stream(), {
      httpMetadata: {
        contentType: sourceImage.type
      },
      customMetadata: {
        originalName: sourceImage.name,
        uploadTime: new Date().toISOString(),
        fileType: sourceImage.type,
        fileSize: sourceImage.size.toString()
      }
    })

    if (!sourceUploadResult) {
      throw new Error('Failed to upload source image to R2')
    }

    // Upload target image to R2
    const targetFileId = generateFileId()
    const targetExtension = getFileExtension(targetImage.name)
    const targetFileName = `uploads/${targetFileId}.${targetExtension}`

    console.log('Uploading target image to R2:', targetFileName);

    const targetUploadResult = await env.FACESWAP_BUCKET.put(targetFileName, targetImage.stream(), {
      httpMetadata: {
        contentType: targetImage.type
      },
      customMetadata: {
        originalName: targetImage.name,
        uploadTime: new Date().toISOString(),
        fileType: targetImage.type,
        fileSize: targetImage.size.toString()
      }
    })

    if (!targetUploadResult) {
      throw new Error('Failed to upload target image to R2')
    }

    // Generate job ID
    const jobId = generateJobId()
    
    // Store job in KV with pending status
    const jobData = {
      id: jobId,
      type: 'single-image',
      status: 'pending',
      progress: 0,
      created_at: new Date().toISOString(),
      source_file: sourceFileId,
      target_file: targetFileId,
      options: {
        mouth_mask: true,
        use_face_enhancer: true,
        execution_provider: 'CPUExecutionProvider'
      }
    }
    
    await env.JOBS.put(jobId, JSON.stringify(jobData))

    // Prepare RunPod request
    const runpodPayload = {
      input: {
        job_id: jobId,
        process_type: 'single-image',
        source_file: await getR2FileUrl(env, sourceFileId),
        target_file: await getR2FileUrl(env, targetFileId),
        options: jobData.options
      }
    }

    console.log(`🚀 Sending to RunPod:`, JSON.stringify(runpodPayload, null, 2));

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
    console.log(`📊 RunPod response:`, JSON.stringify(runpodResult, null, 2));
    
    if (!runpodResponse.ok) {
      console.error('❌ RunPod error:', runpodResult);
      throw new Error(`RunPod error: ${runpodResult.error || 'Unknown error'}`)
    }

    // Update job with RunPod ID and processing status
    jobData.runpod_id = runpodResult.id
    jobData.status = 'processing'
    await env.JOBS.put(jobId, JSON.stringify(jobData))

    console.log(`✅ Job ${jobId} created and started with RunPod ID: ${runpodResult.id}`);

    // Set expiration for uploaded files (24 hours)
    await scheduleFileDeletion(env, sourceFileName, 24 * 60 * 60 * 1000)
    await scheduleFileDeletion(env, targetFileName, 24 * 60 * 60 * 1000)

    return new Response(JSON.stringify({
      success: true,
      data: {
        job_id: jobId
      }
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Single image swap error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Single image swap failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}


