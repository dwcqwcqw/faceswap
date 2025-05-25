#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

// Simple test images (1x1 pixel)
const TEST_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

async function createTestImages() {
  const sourceBuffer = Buffer.from(TEST_JPEG_BASE64, 'base64');
  const targetBuffer = Buffer.from(TEST_JPEG_BASE64, 'base64');
  
  const sourcePath = path.join(__dirname, 'test_source.jpg');
  const targetPath = path.join(__dirname, 'test_target.jpg');
  
  fs.writeFileSync(sourcePath, sourceBuffer);
  fs.writeFileSync(targetPath, targetBuffer);
  
  return { sourcePath, targetPath };
}

async function uploadFile(filePath, description) {
  console.log(`📤 Uploading ${description}...`);
  
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  
  formData.append('file', blob, fileName);
  
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  });
  
  console.log(`   Upload status: ${response.status}`);
  
  if (response.ok) {
    const result = await response.json();
    console.log(`   ✅ ${description} uploaded: ${result.data.fileId}`);
    return result.data.fileId;
  } else {
    const errorText = await response.text();
    console.log(`   ❌ ${description} upload failed: ${errorText}`);
    return null;
  }
}

async function testDownload(fileId, description, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`🔗 Testing ${description} download (attempt ${attempt}/${retries})...`);
    
    const downloadUrl = `${API_BASE}/download/${fileId}`;
    const response = await fetch(downloadUrl);
    
    console.log(`   Download status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.arrayBuffer();
      console.log(`   ✅ ${description} download successful: ${data.byteLength} bytes`);
      return true;
    } else {
      console.log(`   ❌ ${description} download failed: ${response.status} ${response.statusText}`);
      
      if (attempt < retries) {
        console.log('   ⏳ Waiting 2 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  return false;
}

async function startFaceSwap(sourceFileId, targetFileId) {
  console.log('🔄 Starting face swap processing...');
  
  const requestBody = {
    source_file: sourceFileId,
    target_file: targetFileId,
    options: {
      mouth_mask: true,
      use_face_enhancer: true
    }
  };
  
  const response = await fetch(`${API_BASE}/process/single-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  console.log(`   Process status: ${response.status}`);
  
  if (response.ok) {
    const result = await response.json();
    console.log(`   ✅ Face swap started: ${result.data.jobId}`);
    return result.data.jobId;
  } else {
    const errorText = await response.text();
    console.log(`   ❌ Face swap failed to start: ${errorText}`);
    return null;
  }
}

async function waitForCompletion(jobId, maxAttempts = 30) {
  console.log(`⏳ Waiting for job completion: ${jobId}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   Checking status (${attempt}/${maxAttempts})...`);
    
    const response = await fetch(`${API_BASE}/status/${jobId}`);
    
    if (response.ok) {
      const result = await response.json();
      const status = result.data.status;
      const progress = result.data.progress || 0;
      
      console.log(`   Status: ${status} (${progress}%)`);
      
      if (status === 'completed') {
        if (result.data.result_url) {
          console.log(`   ✅ Job completed with result: ${result.data.result_url}`);
          return result.data.result_url;
        } else {
          console.log('   ⚠️ Job completed but no result URL');
          return null;
        }
      } else if (status === 'failed') {
        console.log(`   ❌ Job failed: ${result.data.error_message}`);
        return null;
      }
      
      // Still processing, wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } else {
      console.log(`   ⚠️ Status check failed: ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('   ⏰ Timeout waiting for completion');
  return null;
}

async function testCompleteFlow() {
  console.log('🚀 Testing complete face swap flow...\n');
  
  try {
    // Step 1: Create test images
    console.log('1️⃣ Creating test images...');
    const { sourcePath, targetPath } = await createTestImages();
    
    // Step 2: Upload images
    console.log('\n2️⃣ Uploading images...');
    const sourceFileId = await uploadFile(sourcePath, 'source image');
    const targetFileId = await uploadFile(targetPath, 'target image');
    
    if (!sourceFileId || !targetFileId) {
      console.log('❌ Upload failed, stopping test');
      return false;
    }
    
    // Step 3: Test downloads
    console.log('\n3️⃣ Testing file downloads...');
    const sourceDownload = await testDownload(sourceFileId, 'source image');
    const targetDownload = await testDownload(targetFileId, 'target image');
    
    if (!sourceDownload || !targetDownload) {
      console.log('⚠️ Download issues detected, but continuing with face swap test');
    }
    
    // Step 4: Start face swap
    console.log('\n4️⃣ Starting face swap...');
    const jobId = await startFaceSwap(sourceFileId, targetFileId);
    
    if (!jobId) {
      console.log('❌ Face swap failed to start');
      return false;
    }
    
    // Step 5: Wait for completion
    console.log('\n5️⃣ Waiting for completion...');
    const resultUrl = await waitForCompletion(jobId);
    
    if (resultUrl) {
      console.log('\n6️⃣ Testing result download...');
      const resultFileId = resultUrl.split('/').pop();
      const resultDownload = await testDownload(resultFileId, 'result image');
      
      if (resultDownload) {
        console.log('\n🎉 Complete flow test successful!');
        return true;
      } else {
        console.log('\n⚠️ Face swap completed but result download failed');
        return false;
      }
    } else {
      console.log('\n❌ Face swap did not complete successfully');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  } finally {
    // Clean up test files
    try {
      if (fs.existsSync('test_source.jpg')) fs.unlinkSync('test_source.jpg');
      if (fs.existsSync('test_target.jpg')) fs.unlinkSync('test_target.jpg');
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

if (require.main === module) {
  testCompleteFlow().then(success => {
    console.log('\n📊 Final Result:', success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    process.exit(success ? 0 : 1);
  });
} 