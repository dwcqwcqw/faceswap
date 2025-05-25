var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-0iAk0f/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-0iAk0f/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleCORS(request, env);
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith("/api/upload")) {
        return await handleUpload(request, env);
      } else if (path.startsWith("/api/process/")) {
        return await handleProcess(request, env, path);
      } else if (path.startsWith("/api/status/")) {
        return await handleStatus(request, env, path);
      } else if (path.startsWith("/api/download/")) {
        return await handleDownload(request, env, path);
      } else if (path.startsWith("/api/detect-faces")) {
        return await handleDetectFaces(request, env);
      } else {
        return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || "Internal server error"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};
function handleCORS(request, env) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleCORS, "handleCORS");
async function handleUpload(request, env) {
  try {
    console.log("Upload request received");
    console.log("Content-Type:", request.headers.get("content-type"));
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({
        success: false,
        error: "Content-Type must be multipart/form-data"
      }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    console.log("File received:", file ? file.name : "null");
    if (!file) {
      return new Response(JSON.stringify({
        success: false,
        error: "No file provided"
      }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const fileId = generateFileId();
    const fileExtension = getFileExtension(file.name);
    const fileName = `uploads/${fileId}.${fileExtension}`;
    console.log("Uploading to R2:", fileName);
    const uploadResult = await env.FACESWAP_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadTime: (/* @__PURE__ */ new Date()).toISOString(),
        fileType: file.type,
        fileSize: file.size.toString()
      }
    });
    if (!uploadResult) {
      throw new Error("Failed to upload file to R2");
    }
    console.log("Upload successful:", fileName);
    await scheduleFileDeletion(env, fileName, 24 * 60 * 60 * 1e3);
    return new Response(JSON.stringify({
      success: true,
      data: {
        fileId,
        fileName: file.name,
        url: `/api/download/${fileId}`,
        size: file.size,
        type: file.type
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Upload failed"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleUpload, "handleUpload");
async function handleProcess(request, env, path) {
  try {
    const processType = path.split("/").pop();
    const requestBody = await request.json();
    const jobId = generateJobId();
    const jobData = {
      id: jobId,
      type: processType,
      status: "pending",
      progress: 0,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      source_file: requestBody.source_file,
      target_file: requestBody.target_file,
      options: requestBody.options || {}
    };
    await env.JOBS.put(jobId, JSON.stringify(jobData));
    const runpodPayload = {
      input: {
        job_id: jobId,
        process_type: processType,
        source_file: await getR2FileUrl(env, requestBody.source_file),
        target_file: await getR2FileUrl(env, requestBody.target_file),
        options: requestBody.options || {}
      }
    };
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RUNPOD_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(runpodPayload)
    });
    const runpodResult = await runpodResponse.json();
    if (!runpodResponse.ok) {
      throw new Error(`RunPod error: ${runpodResult.error || "Unknown error"}`);
    }
    jobData.runpod_id = runpodResult.id;
    jobData.status = "processing";
    await env.JOBS.put(jobId, JSON.stringify(jobData));
    return new Response(JSON.stringify({
      success: true,
      data: { jobId }
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Process error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Processing failed"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleProcess, "handleProcess");
async function handleStatus(request, env, path) {
  try {
    const jobId = path.split("/").pop();
    console.log(`\u{1F4CB} Checking status for job: ${jobId}`);
    const jobData = await env.JOBS.get(jobId);
    if (!jobData) {
      console.log(`\u274C Job not found: ${jobId}`);
      return new Response(JSON.stringify({
        success: false,
        error: "Job not found"
      }), { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const job = JSON.parse(jobData);
    console.log(`\u{1F50D} Job status: ${job.status}, RunPod ID: ${job.runpod_id}`);
    if (job.status === "processing" && job.runpod_id) {
      console.log(`\u{1F504} Checking RunPod status for: ${job.runpod_id}`);
      const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_id}`, {
        headers: {
          "Authorization": `Bearer ${env.RUNPOD_TOKEN}`
        }
      });
      if (!runpodResponse.ok) {
        console.log(`\u26A0\uFE0F RunPod API error: ${runpodResponse.status} ${runpodResponse.statusText}`);
      } else {
        const runpodResult = await runpodResponse.json();
        console.log(`\u{1F4CA} RunPod result:`, JSON.stringify(runpodResult, null, 2));
        if (runpodResult.status === "COMPLETED") {
          console.log(`\u2705 RunPod job completed, processing result...`);
          job.status = "completed";
          job.progress = 100;
          job.completed_at = (/* @__PURE__ */ new Date()).toISOString();
          if (runpodResult.output) {
            console.log(`\u{1F50D} Processing RunPod output...`);
            try {
              if (runpodResult.output.result_url) {
                console.log(`\u{1F4CE} Found result_url format: ${runpodResult.output.result_url}`);
                const resultFileId = await storeResultFromUrl(env, runpodResult.output.result_url, jobId);
                job.result_url = `/api/download/${resultFileId}`;
              } else if (runpodResult.output.result) {
                console.log(`\u{1F4C4} Found base64 result format (${runpodResult.output.result.length} chars)`);
                const resultFileId = await storeResultFromBase64(env, runpodResult.output.result, jobId);
                job.result_url = `/api/download/${resultFileId}`;
              } else if (typeof runpodResult.output === "string") {
                console.log(`\u{1F4C4} Found direct base64 format (${runpodResult.output.length} chars)`);
                const resultFileId = await storeResultFromBase64(env, runpodResult.output, jobId);
                job.result_url = `/api/download/${resultFileId}`;
              } else {
                console.log(`\u26A0\uFE0F Unknown RunPod output format:`, Object.keys(runpodResult.output));
              }
            } catch (resultError) {
              console.error("\u274C Error processing result:", resultError);
              job.status = "failed";
              job.error_message = `Result processing failed: ${resultError.message}`;
            }
          } else {
            console.log(`\u26A0\uFE0F No output in RunPod result`);
          }
          await env.JOBS.put(jobId, JSON.stringify(job));
          console.log(`\u{1F4BE} Job updated with new status: ${job.status}`);
        } else if (runpodResult.status === "FAILED") {
          console.log(`\u274C RunPod job failed: ${runpodResult.error || "Unknown error"}`);
          job.status = "failed";
          job.error_message = runpodResult.error || "Processing failed";
          await env.JOBS.put(jobId, JSON.stringify(job));
        } else {
          console.log(`\u{1F504} RunPod job still in progress: ${runpodResult.status}`);
        }
      }
    }
    console.log(`\u{1F4E4} Returning job status: ${job.status}`);
    return new Response(JSON.stringify({
      success: true,
      data: job
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("\u274C Status error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Status check failed"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleStatus, "handleStatus");
async function handleDownload(request, env, path) {
  try {
    const fileId = path.split("/").pop();
    console.log("Download request for fileId:", fileId);
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
      console.log("Trying path:", testPath);
      r2Object = await env.FACESWAP_BUCKET.get(testPath);
      if (r2Object) {
        foundPath = testPath;
        console.log("Found file at:", foundPath);
        break;
      }
    }
    if (!r2Object) {
      console.log("File not found in any path");
      return new Response("File not found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Content-Type", r2Object.httpMetadata?.contentType || "application/octet-stream");
    let downloadFilename;
    if (foundPath.startsWith("results/")) {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      downloadFilename = `face_swap_result_${timestamp}.jpg`;
    } else {
      const originalName = r2Object.customMetadata?.originalName;
      if (originalName) {
        downloadFilename = originalName;
      } else {
        const pathParts = foundPath.split(".");
        const extension = pathParts.length > 1 ? pathParts.pop() : "jpg";
        downloadFilename = `file_${fileId}.${extension}`;
      }
    }
    headers.set("Content-Disposition", `attachment; filename="${downloadFilename}"`);
    console.log("Serving file:", foundPath, "as:", downloadFilename);
    return new Response(r2Object.body, { headers });
  } catch (error) {
    console.error("Download error:", error);
    return new Response("Download failed", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
__name(handleDownload, "handleDownload");
async function handleDetectFaces(request, env) {
  try {
    const requestBody = await request.json();
    const fileId = requestBody.fileId;
    if (!fileId) {
      return new Response(JSON.stringify({
        success: false,
        error: "No file ID provided"
      }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const runpodPayload = {
      input: {
        process_type: "detect-faces",
        image_file: await getR2FileUrl(env, fileId)
      }
    };
    console.log("\u{1F50D} Sending face detection request to RunPod:", JSON.stringify(runpodPayload, null, 2));
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RUNPOD_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(runpodPayload)
    });
    const runpodResult = await runpodResponse.json();
    console.log("\u{1F4CB} RunPod response:", JSON.stringify(runpodResult, null, 2));
    if (!runpodResponse.ok) {
      throw new Error(`RunPod error: ${runpodResult.error || "Unknown error"}`);
    }
    if (runpodResult.output) {
      console.log("\u2705 Synchronous response received");
      return new Response(JSON.stringify({
        success: true,
        data: runpodResult.output
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else if (runpodResult.id) {
      console.log("\u{1F504} Asynchronous response, polling for result...");
      const pollResult = await pollRunPodResult(env, runpodResult.id, 30);
      if (pollResult.success) {
        return new Response(JSON.stringify({
          success: true,
          data: pollResult.output
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        throw new Error(pollResult.error || "Polling failed");
      }
    } else {
      console.log("\u26A0\uFE0F Unknown RunPod response format");
      return new Response(JSON.stringify({
        success: true,
        data: {
          faces: [],
          total_faces: 0,
          image_path: await getR2FileUrl(env, fileId),
          message: "Face detection completed but no faces found"
        }
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  } catch (error) {
    console.error("Face detection error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Face detection failed"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleDetectFaces, "handleDetectFaces");
async function pollRunPodResult(env, jobId, timeoutSeconds = 30) {
  const maxAttempts = Math.ceil(timeoutSeconds / 2);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\u{1F504} Polling attempt ${attempt}/${maxAttempts} for job ${jobId}`);
      const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${env.RUNPOD_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        console.log(`\u26A0\uFE0F Polling failed with HTTP ${response.status}`);
        continue;
      }
      const result = await response.json();
      console.log(`\u{1F4CA} Job ${jobId} status: ${result.status}`);
      if (result.status === "COMPLETED") {
        console.log("\u2705 Job completed successfully");
        return { success: true, output: result.output };
      } else if (result.status === "FAILED") {
        console.log("\u274C Job failed");
        return { success: false, error: result.error || "Job failed" };
      } else {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2e3));
        }
      }
    } catch (error) {
      console.log(`\u26A0\uFE0F Polling error on attempt ${attempt}: ${error.message}`);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
    }
  }
  return { success: false, error: "Polling timeout" };
}
__name(pollRunPodResult, "pollRunPodResult");
function generateFileId() {
  return crypto.randomUUID();
}
__name(generateFileId, "generateFileId");
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
__name(generateJobId, "generateJobId");
function getFileExtension(filename) {
  return filename.split(".").pop() || "bin";
}
__name(getFileExtension, "getFileExtension");
async function getR2FileUrl(env, fileId) {
  return `https://faceswap-api.faceswap.workers.dev/api/download/${fileId}`;
}
__name(getR2FileUrl, "getR2FileUrl");
async function storeResultFromUrl(env, resultUrl, jobId) {
  try {
    const response = await fetch(resultUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch result file");
    }
    const resultFileId = `result_${jobId}_${Date.now()}`;
    const fileName = `results/${resultFileId}.jpg`;
    await env.FACESWAP_BUCKET.put(fileName, response.body, {
      customMetadata: {
        jobId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        originalUrl: resultUrl
      }
    });
    await scheduleFileDeletion(env, fileName, 7 * 24 * 60 * 60 * 1e3);
    return resultFileId;
  } catch (error) {
    console.error("Failed to store result:", error);
    throw error;
  }
}
__name(storeResultFromUrl, "storeResultFromUrl");
async function storeResultFromBase64(env, base64Data, jobId) {
  try {
    console.log(`\u{1F504} Storing base64 result for job ${jobId}...`);
    const resultFileId = `result_${jobId}_${Date.now()}`;
    const fileName = `results/${resultFileId}.jpg`;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log(`\u{1F4BE} Storing result file: ${fileName} (${bytes.length} bytes)`);
    await env.FACESWAP_BUCKET.put(fileName, bytes, {
      httpMetadata: {
        contentType: "image/jpeg"
      },
      customMetadata: {
        jobId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        type: "result"
      }
    });
    console.log(`\u{1F4BE} Result stored successfully`);
    return resultFileId;
  } catch (error) {
    console.error("Failed to store result:", error);
    throw error;
  }
}
__name(storeResultFromBase64, "storeResultFromBase64");
async function scheduleFileDeletion(env, fileName, delayMs) {
  console.log(`\u{1F5D1}\uFE0F File ${fileName} scheduled for deletion in ${delayMs}ms`);
}
__name(scheduleFileDeletion, "scheduleFileDeletion");

// ../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0iAk0f/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0iAk0f/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  handleCORS,
  handleDetectFaces,
  handleDownload,
  handleProcess,
  handleStatus,
  handleUpload
};
//# sourceMappingURL=worker.js.map
