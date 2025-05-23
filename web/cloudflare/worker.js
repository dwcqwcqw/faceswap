import { handleCORS, handleUpload, handleProcess, handleStatus, handleDownload } from './handlers'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env)
    }

    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    try {
      let response

      // Route handling
      if (path.startsWith('/api/upload') && request.method === 'POST') {
        response = await handleUpload(request, env)
      } else if (path.startsWith('/api/process/') && request.method === 'POST') {
        response = await handleProcess(request, env, path)
      } else if (path.startsWith('/api/status/') && request.method === 'GET') {
        response = await handleStatus(request, env, path)
      } else if (path.startsWith('/api/download/') && request.method === 'GET') {
        response = await handleDownload(request, env, path)
      } else {
        response = new Response('Not Found', { status: 404 })
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    } catch (error) {
      console.error('Worker error:', error)
      const errorResponse = new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal server error',
          message: error.message 
        }), 
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
      return errorResponse
    }
  }
}

// CORS handler
export function handleCORS(request, env) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}

// Upload handler
export async function handleUpload(request, env) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique filename
    const fileId = crypto.randomUUID()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${fileId}.${fileExtension}`

    // Upload to R2
    await env.FACESWAP_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fileId,
          fileName,
          originalName: file.name,
          size: file.size,
          type: file.type
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Process handler
export async function handleProcess(request, env, path) {
  try {
    const body = await request.json()
    const processType = path.split('/').pop()

    // Generate job ID
    const jobId = crypto.randomUUID()

    // Create job record
    const job = {
      id: jobId,
      type: processType,
      status: 'pending',
      progress: 0,
      created_at: new Date().toISOString(),
      ...body
    }

    // Store job in KV
    await env.SESSIONS.put(`job:${jobId}`, JSON.stringify(job))

    // Trigger RunPod serverless function
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          job_id: jobId,
          process_type: processType,
          ...body
        }
      })
    })

    if (!runpodResponse.ok) {
      throw new Error('Failed to start RunPod job')
    }

    const runpodData = await runpodResponse.json()

    // Update job with RunPod ID
    job.runpod_id = runpodData.id
    job.status = 'processing'
    await env.SESSIONS.put(`job:${jobId}`, JSON.stringify(job))

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          jobId,
          status: 'processing',
          message: 'Face swap processing started'
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Status handler
export async function handleStatus(request, env, path) {
  try {
    const jobId = path.split('/').pop()
    const jobData = await env.SESSIONS.get(`job:${jobId}`)

    if (!jobData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const job = JSON.parse(jobData)

    // Check RunPod status if still processing
    if (job.status === 'processing' && job.runpod_id) {
      const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_id}`, {
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
        }
      })

      if (runpodResponse.ok) {
        const runpodData = await runpodResponse.json()
        
        if (runpodData.status === 'COMPLETED') {
          job.status = 'completed'
          job.progress = 100
          job.result_url = runpodData.output?.result_url
          job.completed_at = new Date().toISOString()
          await env.SESSIONS.put(`job:${jobId}`, JSON.stringify(job))
        } else if (runpodData.status === 'FAILED') {
          job.status = 'failed'
          job.error_message = runpodData.error || 'Processing failed'
          await env.SESSIONS.put(`job:${jobId}`, JSON.stringify(job))
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          result_url: job.result_url,
          error_message: job.error_message,
          created_at: job.created_at,
          completed_at: job.completed_at
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Download handler
export async function handleDownload(request, env, path) {
  try {
    const fileId = path.split('/').pop()
    const object = await env.FACESWAP_BUCKET.get(fileId)

    if (!object) {
      return new Response('File not found', { status: 404 })
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileId}"`,
      }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
} 