#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

// Simple test image data (1x1 pixel JPEG)
const TEST_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

async function createTestImageFile() {
  const buffer = Buffer.from(TEST_JPEG_BASE64, 'base64');
  const testFilePath = path.join(__dirname, 'test_image.jpg');
  fs.writeFileSync(testFilePath, buffer);
  return testFilePath;
}

async function uploadFile(filePath, fileName) {
  console.log(`📤 Uploading ${fileName}...`);
  
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  
  formData.append('file', blob, fileName);
  
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(`✅ Uploaded ${fileName}: ${result.data.fileId}`);
    return result.data.fileId;
  } else {
    throw new Error(`Upload failed: ${result.error}`);
  }
}

async function processFaceSwap(sourceFileId, targetFileId) {
  console.log('🔄 Starting face swap processing...');
  
  const requestBody = {
    source_file: sourceFileId,
    target_file: targetFileId,
    options: {
      mouth_mask: true,
      use_face_enhancer: true,
      execution_provider: 'CPUExecutionProvider'
    }
  };
  
  const response = await fetch(`${API_BASE}/process/single-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(`✅ Processing started: ${result.data.jobId}`);
    return result.data.jobId;
  } else {
    throw new Error(`Processing failed: ${result.error}`);
  }
}

async function checkJobStatus(jobId, maxAttempts = 30) {
  console.log(`📋 Checking job status: ${jobId}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   Attempt ${attempt}/${maxAttempts}...`);
    
    const response = await fetch(`${API_BASE}/status/${jobId}`);
    const result = await response.json();
    
    if (result.success) {
      const status = result.data.status;
      const progress = result.data.progress || 0;
      
      console.log(`   Status: ${status} (${progress}%)`);
      
      if (status === 'completed') {
        console.log('✅ Job completed successfully!');
        if (result.data.result_url) {
          console.log(`📁 Result URL: ${result.data.result_url}`);
        } else {
          console.log('⚠️ Job completed but no result_url found');
        }
        return result.data;
      } else if (status === 'failed') {
        console.log(`❌ Job failed: ${result.data.error_message}`);
        return null;
      } else {
        // Still processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      }
    } else {
      console.log(`❌ Status check failed: ${result.error}`);
      return null;
    }
  }
  
  console.log('⏰ Job status check timed out');
  return null;
}

async function downloadResult(resultUrl) {
  console.log(`⬇️ Downloading result from: ${resultUrl}`);
  
  const downloadUrl = `${API_BASE}${resultUrl}`;
  const response = await fetch(downloadUrl);
  
  if (response.ok) {
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.log('✅ Download successful!');
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength} bytes`);
    
    // Save the result to a local file
    const buffer = await response.arrayBuffer();
    const resultPath = path.join(__dirname, 'face_swap_result.jpg');
    fs.writeFileSync(resultPath, Buffer.from(buffer));
    
    console.log(`💾 Result saved to: ${resultPath}`);
    
    return resultPath;
  } else {
    console.log(`❌ Download failed: ${response.status} ${response.statusText}`);
    return null;
  }
}

async function runCompleteTest() {
  console.log('🚀 Starting complete face swap test...\n');
  
  try {
    // Step 1: Create test images
    console.log('1️⃣ Creating test images...');
    const testImagePath = await createTestImageFile();
    
    // Step 2: Upload source and target images
    console.log('\n2️⃣ Uploading images...');
    const sourceFileId = await uploadFile(testImagePath, 'source.jpg');
    const targetFileId = await uploadFile(testImagePath, 'target.jpg');
    
    // Step 3: Start face swap processing
    console.log('\n3️⃣ Processing face swap...');
    const jobId = await processFaceSwap(sourceFileId, targetFileId);
    
    // Step 4: Wait for completion
    console.log('\n4️⃣ Waiting for completion...');
    const jobResult = await checkJobStatus(jobId);
    
    if (jobResult && jobResult.result_url) {
      // Step 5: Download result
      console.log('\n5️⃣ Downloading result...');
      const resultPath = await downloadResult(jobResult.result_url);
      
      if (resultPath) {
        console.log('\n🎉 Complete test successful!');
        console.log(`📁 Result image saved to: ${resultPath}`);
        
        // Clean up test files
        fs.unlinkSync(testImagePath);
        console.log('🧹 Cleaned up test files');
        
        return true;
      }
    }
    
    console.log('\n❌ Test failed at result download step');
    return false;
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

if (require.main === module) {
  runCompleteTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runCompleteTest }; 