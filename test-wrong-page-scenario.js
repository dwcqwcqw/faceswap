// Test script to simulate uploading video file on single-image page
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev/api';

async function testWrongPageScenario() {
  console.log('🧪 Testing wrong page scenario: uploading video on single-image page...');
  
  try {
    // Create dummy files
    console.log('📁 Creating test files...');
    
    // Create a dummy image file (1x1 pixel PNG)
    const dummyImageData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC2, 0x5D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    // Create a dummy video file (minimal MP4 header)
    const dummyVideoData = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
      0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
      0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    
    // Upload source image (face)
    console.log('📤 Uploading source image...');
    const imageFormData = new FormData();
    imageFormData.append('file', dummyImageData, {
      filename: 'test-face.png',
      contentType: 'image/png'
    });
    
    const imageUploadResponse = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: imageFormData
    });
    
    const imageUploadResult = await imageUploadResponse.json();
    console.log('📋 Image upload result:', imageUploadResult);
    
    // Upload target video (but will be processed as image)
    console.log('📤 Uploading target video...');
    const videoFormData = new FormData();
    videoFormData.append('file', dummyVideoData, {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });
    
    const videoUploadResponse = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: videoFormData
    });
    
    const videoUploadResult = await videoUploadResponse.json();
    console.log('📋 Video upload result:', videoUploadResult);
    
    // Process as SINGLE-IMAGE (wrong!) - this simulates user being on wrong page
    console.log('🖼️ Processing as single-image (WRONG PAGE SCENARIO)...');
    const processResponse = await fetch(`${API_BASE_URL}/process/single-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_file: imageUploadResult.data.fileId,  // Face image
        target_file: videoUploadResult.data.fileId,  // Video (but treated as image!)
        options: {
          mouth_mask: true,
          use_face_enhancer: true,
        }
      })
    });

    const processResult = await processResponse.json();
    console.log('📊 Process response status:', processResponse.status);
    console.log('📋 Process response body:', JSON.stringify(processResult, null, 2));
    
    if (processResult.success) {
      console.log('✅ Request accepted, job ID:', processResult.data?.jobId);
      
      // Check job status to see the error
      console.log('🔍 Checking job status for expected error...');
      
      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`${API_BASE_URL}/status/${processResult.data.jobId}`);
      const statusResult = await statusResponse.json();
      console.log('📋 Job status:', JSON.stringify(statusResult, null, 2));
      
    } else {
      console.log('❌ Request failed:', processResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testWrongPageScenario(); 