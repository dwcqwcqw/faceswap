#!/usr/bin/env node

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

async function triggerStatusUpdate(jobId) {
  console.log(`🔄 Triggering status update for job: ${jobId}`);
  
  try {
    // Get current status
    const statusResponse = await fetch(`${API_BASE}/status/${jobId}`);
    const statusData = await statusResponse.json();
    
    console.log('Current status:', statusData.data.status);
    console.log('Has result_url:', !!statusData.data.result_url);
    console.log('RunPod ID:', statusData.data.runpod_id);
    
    if (statusData.data.status === 'completed' && !statusData.data.result_url && statusData.data.runpod_id) {
      console.log('\n💡 This job is completed but missing result_url. This triggers our new base64 handling logic.');
      
      // Just calling the status endpoint again should trigger the RunPod status check
      // which will now handle base64 results with our updated code
      console.log('🔄 Calling status endpoint again to trigger update...');
      
      const updateResponse = await fetch(`${API_BASE}/status/${jobId}`);
      const updateData = await updateResponse.json();
      
      console.log('\nUpdated status:', JSON.stringify(updateData, null, 2));
      
      if (updateData.data.result_url) {
        console.log('✅ Success! result_url is now available:', updateData.data.result_url);
        
        // Test the download
        const downloadUrl = `${API_BASE}${updateData.data.result_url}`;
        console.log(`\n🔗 Testing download from: ${downloadUrl}`);
        
        const downloadResponse = await fetch(downloadUrl);
        if (downloadResponse.ok) {
          console.log('✅ Download test successful!');
          console.log(`   Status: ${downloadResponse.status}`);
          console.log(`   Content-Type: ${downloadResponse.headers.get('content-type')}`);
          console.log(`   Content-Length: ${downloadResponse.headers.get('content-length')}`);
        } else {
          console.log(`❌ Download test failed: ${downloadResponse.status}`);
        }
        
      } else {
        console.log('⚠️ result_url still not available. The RunPod job might not have base64 result data.');
      }
    } else {
      console.log('ℹ️ Job already has result_url or is not in completed status.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const jobId = process.argv[2] || 'job_1748141258077_ch97ullke';

console.log('🧪 Testing status update with base64 result handling...');
console.log(`Target job: ${jobId}\n`);

triggerStatusUpdate(jobId); 