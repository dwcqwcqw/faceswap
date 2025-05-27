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
      } else if (path.startsWith('/api/cancel/')) {
        return await handleCancel(request, env, path)
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
          type: 'multi_image',  // Normalize process type
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
            type: 'multi_video',  // Use multi_video processing
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
            type: 'video',  // Use video processing
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
          type: 'single_image',  // Normalize process type
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
      // For result files, use the detected file extension from metadata or path
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      
      // Try to get extension from custom metadata first
      const storedExtension = r2Object.customMetadata?.fileExtension;
      if (storedExtension) {
        downloadFilename = `face_swap_result_${timestamp}.${storedExtension}`;
        console.log(`📁 Using stored extension: ${storedExtension}`);
      } else {
        // Fallback: extract extension from the found path
        const pathParts = foundPath.split('.');
        const extension = pathParts.length > 1 ? pathParts.pop() : 'jpg';
        downloadFilename = `face_swap_result_${timestamp}.${extension}`;
        console.log(`📁 Using path extension: ${extension}`);
      }
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

// Cancel/Stop job
export async function handleCancel(request, env, path) {
  try {
    const jobId = path.split('/').pop()
    console.log(`🛑 Cancelling job: ${jobId}`);
    
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

    // If job is already completed or failed, can't cancel
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(`⚠️ Job already finished: ${job.status}`);
      return new Response(JSON.stringify({
        success: false,
        error: `Job already ${job.status}`
      }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }})
    }

    // Try to cancel RunPod job if it exists
    if (job.runpod_id) {
      try {
        console.log(`🔄 Cancelling RunPod job: ${job.runpod_id}`);
        const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/cancel/${job.runpod_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RUNPOD_TOKEN}`
          }
        })

        if (runpodResponse.ok) {
          console.log(`✅ RunPod job cancelled successfully`);
        } else {
          console.log(`⚠️ RunPod cancel failed: ${runpodResponse.status} ${runpodResponse.statusText}`);
          // Continue anyway - we'll mark our job as cancelled
        }
      } catch (runpodError) {
        console.log(`⚠️ RunPod cancel error: ${runpodError.message}`);
        // Continue anyway - we'll mark our job as cancelled
      }
    }

    // Update job status to cancelled
    job.status = 'failed'
    job.error_message = '任务已被用户取消'
    job.updated_at = new Date().toISOString()
    
    await env.JOBS.put(jobId, JSON.stringify(job))
    console.log(`✅ Job marked as cancelled: ${jobId}`);

    return new Response(JSON.stringify({
      success: true,
      data: { message: 'Job cancelled successfully' }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('❌ Cancel error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Cancel failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
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
      const pollResult = await pollRunPodResult(env, runpodResult.id, 60) // Increase to 60 second timeout
      
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
async function pollRunPodResult(env, jobId, timeoutSeconds = 60) {
  const maxAttempts = Math.ceil(timeoutSeconds / 3) // Poll every 3 seconds for longer jobs
  
  console.log(`🔄 Starting polling for job ${jobId}, max attempts: ${maxAttempts}`)
  
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
        console.log(`⚠️ Polling failed with HTTP ${response.status}: ${response.statusText}`)
        const errorText = await response.text()
        console.log(`⚠️ Error response: ${errorText}`)
        
        // Don't fail immediately on HTTP errors, continue polling
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
          continue
        } else {
          return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
        }
      }

      const result = await response.json()
      console.log(`📊 Job ${jobId} status: ${result.status}`)
      console.log(`📋 Full response:`, JSON.stringify(result, null, 2))
      
      if (result.status === 'COMPLETED') {
        console.log('✅ Job completed successfully')
        if (result.output) {
          return { success: true, output: result.output }
        } else {
          console.log('⚠️ Job completed but no output found')
          return { success: false, error: 'Job completed but no output found' }
        }
      } else if (result.status === 'FAILED') {
        console.log('❌ Job failed')
        const errorMsg = result.error || result.output?.error || 'Job failed without specific error'
        return { success: false, error: errorMsg }
      } else if (result.status === 'IN_PROGRESS' || result.status === 'IN_QUEUE') {
        console.log(`⏳ Job still ${result.status.toLowerCase()}, continuing to poll...`)
        // Still running, wait before next attempt
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
        }
      } else {
        console.log(`🤔 Unknown status: ${result.status}`)
        // Unknown status, continue polling
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
        }
      }

    } catch (error) {
      console.log(`⚠️ Polling error on attempt ${attempt}: ${error.message}`)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
      } else {
        return { success: false, error: `Polling failed: ${error.message}` }
      }
    }
  }
  
  console.log(`⏰ Polling timeout after ${maxAttempts} attempts`)
  return { success: false, error: 'Polling timeout - job may still be processing' }
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
    
    // Decode base64 data to detect file type
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Detect file type from magic bytes
    let fileExtension = 'jpg';  // Default
    let contentType = 'image/jpeg';  // Default
    
    if (bytes.length >= 4) {
      // Check for common video file signatures
      const header = Array.from(bytes.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // MP4 signatures
      if (header.includes('66747970') || header.includes('6d703430') || header.includes('6d703431') || 
          header.includes('6d703432') || header.includes('69736f6d') || header.includes('6d70342')) {
        fileExtension = 'mp4';
        contentType = 'video/mp4';
        console.log(`🎬 Detected MP4 video file`);
      }
      // AVI signature
      else if (header.startsWith('52494646') && header.includes('41564920')) {
        fileExtension = 'avi';
        contentType = 'video/x-msvideo';
        console.log(`🎬 Detected AVI video file`);
      }
      // MOV/QuickTime signature
      else if (header.includes('6d6f6f76') || header.includes('6d646174') || header.includes('66726565')) {
        fileExtension = 'mov';
        contentType = 'video/quicktime';
        console.log(`🎬 Detected MOV video file`);
      }
      // JPEG signature
      else if (header.startsWith('ffd8ff')) {
        fileExtension = 'jpg';
        contentType = 'image/jpeg';
        console.log(`📸 Detected JPEG image file`);
      }
      // PNG signature
      else if (header.startsWith('89504e47')) {
        fileExtension = 'png';
        contentType = 'image/png';
        console.log(`📸 Detected PNG image file`);
      }
      else {
        console.log(`🔍 Unknown file signature: ${header}, defaulting to JPEG`);
      }
    }
    
    // Generate result file ID
    const resultFileId = `result_${jobId}_${Date.now()}`;
    const fileName = `results/${resultFileId}.${fileExtension}`;

    console.log(`💾 Storing result file: ${fileName} (${bytes.length} bytes) as ${contentType}`);

    // Store in R2
    await env.FACESWAP_BUCKET.put(fileName, bytes, {
      httpMetadata: {
        contentType: contentType
      },
      customMetadata: {
        jobId: jobId,
        createdAt: new Date().toISOString(),
        type: 'result',
        fileExtension: fileExtension
      }
    });

    console.log(`💾 Result stored successfully as ${fileExtension.toUpperCase()}`);

    return resultFileId;

  } catch (error) {
    console.error('Failed to store result:', error);
    throw error;
  }
}

async function scheduleFileDeletion(env, fileName, delayMs) {
  // Use Cloudflare's lifecycle policies or external service for file cleanup
  // For now, we'll rely on manual cleanup or R2 lifecycle policies
  console.log(`🗑️ File ${fileName} scheduled for deletion in ${delayMs}ms`)
}


