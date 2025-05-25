#!/usr/bin/env node

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

async function testResultDownload() {
  console.log('🧪 Testing result download functionality...');
  
  try {
    // Test 1: Check the status of the previous job
    const jobId = 'job_1748141258077_ch97ullke';
    console.log(`\n📋 Checking status of job: ${jobId}`);
    
    const statusResponse = await fetch(`${API_BASE}/status/${jobId}`);
    const statusData = await statusResponse.json();
    
    console.log('Status response:', JSON.stringify(statusData, null, 2));
    
    if (statusData.success && statusData.data.result_url) {
      console.log(`\n✅ Found result URL: ${statusData.data.result_url}`);
      
      // Test download
      const downloadUrl = `${API_BASE}${statusData.data.result_url}`;
      console.log(`🔗 Attempting download from: ${downloadUrl}`);
      
      const downloadResponse = await fetch(downloadUrl);
      
      if (downloadResponse.ok) {
        const contentType = downloadResponse.headers.get('content-type');
        const contentLength = downloadResponse.headers.get('content-length');
        
        console.log(`✅ Download successful!`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Length: ${contentLength}`);
        
        // Save a small portion to verify it's an image
        const buffer = await downloadResponse.arrayBuffer();
        const fileSignature = new Uint8Array(buffer.slice(0, 4));
        const signature = Array.from(fileSignature).map(b => b.toString(16).padStart(2, '0')).join('');
        
        console.log(`   File signature: ${signature} (should start with FFD8 for JPEG)`);
        
        if (signature.startsWith('ffd8')) {
          console.log('🎉 Result is a valid JPEG image!');
        } else {
          console.log('⚠️ Result might not be a valid JPEG image');
        }
        
      } else {
        console.log(`❌ Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
      }
      
    } else {
      console.log('❌ No result URL found in job status');
      
      // This might be an old job before the fix, let's trigger status update
      console.log('\n🔄 The job might need status update. The result should be available after the next status check.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test 2: Show how to download from frontend
function showFrontendUsage() {
  console.log('\n📱 Frontend Usage Example:');
  console.log(`
// Get job status
const response = await fetch('${API_BASE}/status/YOUR_JOB_ID');
const { data } = await response.json();

if (data.result_url) {
  // Download the result image
  const downloadResponse = await fetch('${API_BASE}' + data.result_url);
  const blob = await downloadResponse.blob();
  
  // Display in browser
  const imageUrl = URL.createObjectURL(blob);
  document.getElementById('result-image').src = imageUrl;
  
  // Or trigger download
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = 'face_swap_result.jpg';
  link.click();
}
`);
}

if (require.main === module) {
  testResultDownload().then(() => {
    showFrontendUsage();
  });
}

module.exports = { testResultDownload }; 