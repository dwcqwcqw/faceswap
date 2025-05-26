// Test script to simulate video processing request
const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev/api';

async function testVideoRequest() {
  console.log('🧪 Testing video processing request...');
  
  try {
    // Simulate the request that the frontend would make
    const response = await fetch(`${API_BASE_URL}/process/single-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_file: 'test-face-image-id',
        target_file: 'test-video-file-id',
        options: {
          keep_fps: true,
          video_quality: 18,
          mouth_mask: true,
        }
      })
    });

    const result = await response.json();
    console.log('📊 Response status:', response.status);
    console.log('📋 Response body:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Request successful, job ID:', result.data?.jobId);
    } else {
      console.log('❌ Request failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testVideoRequest(); 