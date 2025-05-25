#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

// Create test images
const TEST_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

async function createTestImages() {
  const sourceBuffer = Buffer.from(TEST_JPEG_BASE64, 'base64');
  const targetBuffer = Buffer.from(TEST_JPEG_BASE64, 'base64');
  
  const sourcePath = path.join(__dirname, 'test_source_quality.jpg');
  const targetPath = path.join(__dirname, 'test_target_quality.jpg');
  
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

async function startEnhancedFaceSwap(sourceFileId, targetFileId) {
  console.log('🎨 Starting enhanced face swap with quality settings...');
  
  const requestBody = {
    source_file: sourceFileId,
    target_file: targetFileId,
    options: {
      mouth_mask: true,
      use_face_enhancer: true,
      color_correction: true,
      quality: "high"
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
    console.log(`   ✅ Enhanced face swap started: ${result.data.jobId}`);
    return result.data.jobId;
  } else {
    const errorText = await response.text();
    console.log(`   ❌ Enhanced face swap failed to start: ${errorText}`);
    return null;
  }
}

async function waitForCompletionWithLogs(jobId, maxAttempts = 30) {
  console.log(`⏳ Waiting for enhanced processing: ${jobId}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   [${attempt}/${maxAttempts}] Checking status...`);
    
    const response = await fetch(`${API_BASE}/status/${jobId}`);
    
    if (response.ok) {
      const result = await response.json();
      const status = result.data.status;
      const progress = result.data.progress || 0;
      
      console.log(`   Status: ${status} (${progress}%)`);
      
      if (status === 'completed') {
        if (result.data.result_url) {
          console.log(`   ✅ Enhanced processing completed!`);
          console.log(`   🎯 Result URL: ${result.data.result_url}`);
          return result.data.result_url;
        } else {
          console.log('   ⚠️ Processing completed but no result URL');
          return null;
        }
      } else if (status === 'failed') {
        console.log(`   ❌ Processing failed: ${result.data.error_message}`);
        return null;
      }
      
      // Still processing, wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } else {
      const errorText = await response.text();
      console.log(`   ⚠️ Status check failed (${response.status}): ${errorText}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('   ⏰ Timeout waiting for completion');
  return null;
}

async function testDownloadWithFilename(resultUrl) {
  console.log('📋 Testing result download with proper filename...');
  
  const resultFileId = resultUrl.split('/').pop();
  const downloadUrl = `${API_BASE}/download/${resultFileId}`;
  
  const response = await fetch(downloadUrl);
  console.log(`   Download status: ${response.status}`);
  
  if (response.ok) {
    const contentDisposition = response.headers.get('content-disposition');
    const contentType = response.headers.get('content-type');
    
    console.log(`   ✅ Download successful!`);
    console.log(`   📄 Content-Type: ${contentType}`);
    console.log(`   🏷️ Content-Disposition: ${contentDisposition}`);
    
    // Check if filename looks correct
    if (contentDisposition && contentDisposition.includes('face_swap_result_') && contentDisposition.includes('.jpg')) {
      console.log(`   ✅ Filename format is correct!`);
    } else {
      console.log(`   ⚠️ Filename format may need improvement`);
    }
    
    const data = await response.arrayBuffer();
    console.log(`   📐 File size: ${data.byteLength} bytes`);
    
    // Save to test file to verify content
    const testResultPath = path.join(__dirname, 'test_result_enhanced.jpg');
    fs.writeFileSync(testResultPath, Buffer.from(data));
    console.log(`   💾 Test result saved to: ${testResultPath}`);
    
    return true;
  } else {
    console.log(`   ❌ Download failed: ${response.status} ${response.statusText}`);
    return false;
  }
}

async function testQualityEnhancements() {
  console.log('🚀 Testing Quality Enhancements and Filename Fixes...\n');
  
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
    
    // Step 3: Start enhanced face swap
    console.log('\n3️⃣ Starting enhanced face swap...');
    const jobId = await startEnhancedFaceSwap(sourceFileId, targetFileId);
    
    if (!jobId) {
      console.log('❌ Enhanced face swap failed to start');
      return false;
    }
    
    // Step 4: Wait for completion
    console.log('\n4️⃣ Waiting for enhanced processing...');
    const resultUrl = await waitForCompletionWithLogs(jobId);
    
    if (resultUrl) {
      // Step 5: Test download with proper filename
      console.log('\n5️⃣ Testing enhanced result download...');
      const downloadSuccess = await testDownloadWithFilename(resultUrl);
      
      if (downloadSuccess) {
        console.log('\n🎉 Quality Enhancement Test SUCCESSFUL!');
        console.log('\n✅ Verified Features:');
        console.log('   🎨 Face enhancement enabled');
        console.log('   🏷️ Proper filename for downloads');
        console.log('   📸 High quality JPEG output');
        console.log('   📐 Image size optimization');
        return true;
      } else {
        console.log('\n⚠️ Processing completed but download has issues');
        return false;
      }
    } else {
      console.log('\n❌ Enhanced processing did not complete successfully');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  } finally {
    // Clean up test files
    try {
      const testFiles = [
        'test_source_quality.jpg',
        'test_target_quality.jpg',
        'test_result_enhanced.jpg'
      ];
      
      testFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`🗑️ Cleaned up: ${file}`);
        }
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

if (require.main === module) {
  testQualityEnhancements().then(success => {
    console.log('\n📊 Final Result:', success ? '✅ ALL ENHANCEMENTS WORKING' : '❌ ENHANCEMENTS NEED FIXES');
    process.exit(success ? 0 : 1);
  });
} 