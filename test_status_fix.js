#!/usr/bin/env node

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

async function testStatusAndDownload() {
  console.log('🧪 Testing status checking and result download fixes...');
  
  try {
    // Test with a recent job ID that should have base64 results
    const jobId = process.argv[2] || 'job_1748148158093_t7v3tho4g'; // Replace with actual recent job ID
    
    console.log(`\n📋 Testing job: ${jobId}`);
    
    // Check job status multiple times to see the enhanced logging
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`\n🔄 Status check attempt ${attempt}:`);
      
      const statusResponse = await fetch(`${API_BASE}/status/${jobId}`);
      
      console.log(`   Response status: ${statusResponse.status}`);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        console.log(`   Success: ${statusData.success}`);
        console.log(`   Job status: ${statusData.data?.status}`);
        console.log(`   Progress: ${statusData.data?.progress}%`);
        console.log(`   Result URL: ${statusData.data?.result_url || 'Not available'}`);
        console.log(`   Error: ${statusData.data?.error_message || 'None'}`);
        
        if (statusData.data?.result_url) {
          console.log('\n🔗 Testing result download...');
          
          const downloadUrl = `${API_BASE}${statusData.data.result_url}`;
          const downloadResponse = await fetch(downloadUrl);
          
          console.log(`   Download status: ${downloadResponse.status}`);
          console.log(`   Content-Type: ${downloadResponse.headers.get('content-type')}`);
          console.log(`   Content-Length: ${downloadResponse.headers.get('content-length')}`);
          
          if (downloadResponse.ok) {
            // Verify it's a valid image by checking the file signature
            const arrayBuffer = await downloadResponse.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const signature = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
            
            console.log(`   File signature: ${signature}`);
            
            if (signature.startsWith('ffd8')) {
              console.log('   ✅ Valid JPEG file detected!');
            } else if (signature.startsWith('8950')) {
              console.log('   ✅ Valid PNG file detected!');
            } else {
              console.log('   ⚠️ Unknown file format');
            }
            
            console.log(`   📊 File size: ${bytes.length} bytes`);
            
            // Test completed successfully
            console.log('\n🎉 Status checking and download working correctly!');
            return true;
          } else {
            console.log(`   ❌ Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
          }
        } else if (statusData.data?.status === 'completed') {
          console.log('   ⚠️ Job completed but no result_url - this should be fixed now');
        } else if (statusData.data?.status === 'failed') {
          console.log(`   ❌ Job failed: ${statusData.data?.error_message}`);
          break;
        } else {
          console.log('   🔄 Job still processing...');
        }
        
      } else {
        const errorText = await statusResponse.text();
        console.log(`   ❌ Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
        console.log(`   Error response: ${errorText}`);
        
        if (statusResponse.status === 500) {
          console.log('   📝 500 error - check Worker logs for detailed error information');
        }
      }
      
      // Wait a bit between attempts
      if (attempt < 3) {
        console.log('   ⏳ Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n💡 If still seeing issues:');
    console.log('   1. Check Cloudflare Worker logs in dashboard');
    console.log('   2. Verify RunPod endpoint is working');
    console.log('   3. Test with a freshly submitted job');
    
    return false;
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

// Show usage if no job ID provided
if (process.argv.length < 3) {
  console.log('Usage: node test_status_fix.js <job_id>');
  console.log('');
  console.log('Example:');
  console.log('  node test_status_fix.js job_1748148158093_t7v3tho4g');
  console.log('');
  console.log('This will test the status checking and base64 result handling fixes.');
  process.exit(1);
}

testStatusAndDownload().then(success => {
  process.exit(success ? 0 : 1);
}); 