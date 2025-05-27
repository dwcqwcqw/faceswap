#!/usr/bin/env node

// Simple test to verify API endpoint
async function testAPI() {
  const FormData = require('form-data');
  const fs = require('fs');
  
  console.log('🧪 Testing single-image-swap API...');
  
  try {
    // Create a simple test image (1x1 PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk header
      0x54, 0x08, 0x1D, 0x01, 0x01, 0x00, 0x00, 0xFF, // Image data
      0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00, // More image data
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
      0xAE, 0x42, 0x60, 0x82                           // CRC
    ]);
    
    // Create form data
    const form = new FormData();
    form.append('source_image', testImageBuffer, {
      filename: 'source.png',
      contentType: 'image/png'
    });
    form.append('target_image', testImageBuffer, {
      filename: 'target.png', 
      contentType: 'image/png'
    });
    
    console.log('📤 Sending request to API...');
    
    const response = await fetch('https://faceswap-api.faceswap.workers.dev/api/single-image-swap', {
      method: 'POST',
      body: form,
      headers: {
        'Origin': 'https://test.example.com'
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP ${response.status}: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data?.job_id) {
      console.log(`🎉 API test successful! Job ID: ${data.data.job_id}`);
    } else {
      console.log(`⚠️ API returned error: ${data.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAPI().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test error:', error);
  process.exit(1);
}); 