#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';

// Create a simple test image (1x1 pixel PNG)
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createTestImageFile() {
  const buffer = Buffer.from(TEST_PNG_BASE64, 'base64');
  const testFilePath = path.join(__dirname, 'test_image.png');
  fs.writeFileSync(testFilePath, buffer);
  return testFilePath;
}

async function testUpload() {
  console.log('🧪 Testing upload functionality...');
  
  try {
    // Test 1: Check if API is accessible
    console.log('\n1️⃣ Testing API accessibility...');
    
    try {
      const healthResponse = await fetch(`${API_BASE}/status/test`);
      console.log(`   API response status: ${healthResponse.status}`);
      
      if (healthResponse.status === 404) {
        console.log('   ✅ API is accessible (404 expected for test endpoint)');
      } else {
        const text = await healthResponse.text();
        console.log(`   Response: ${text.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`   ❌ API not accessible: ${error.message}`);
      return false;
    }
    
    // Test 2: Create and upload a test image
    console.log('\n2️⃣ Testing image upload...');
    
    const testImagePath = await createTestImageFile();
    console.log(`   Created test image: ${testImagePath}`);
    
    // Create form data
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(testImagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    
    formData.append('file', blob, 'test_image.png');
    
    console.log('   📤 Uploading image...');
    
    const uploadResponse = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    
    console.log(`   Upload response status: ${uploadResponse.status}`);
    console.log(`   Content-Type: ${uploadResponse.headers.get('content-type')}`);
    
    const responseText = await uploadResponse.text();
    console.log(`   Response body: ${responseText}`);
    
    if (uploadResponse.ok) {
      const uploadResult = JSON.parse(responseText);
      console.log('   ✅ Upload successful!');
      console.log(`   File ID: ${uploadResult.data?.fileId}`);
      console.log(`   Download URL: ${uploadResult.data?.url}`);
      
      // Test 3: Try to download the uploaded file
      if (uploadResult.data?.url) {
        console.log('\n3️⃣ Testing file download...');
        
        const downloadUrl = `${API_BASE}${uploadResult.data.url}`;
        const downloadResponse = await fetch(downloadUrl);
        
        console.log(`   Download status: ${downloadResponse.status}`);
        
        if (downloadResponse.ok) {
          const downloadedData = await downloadResponse.arrayBuffer();
          console.log(`   ✅ Download successful! Size: ${downloadedData.byteLength} bytes`);
        } else {
          console.log(`   ❌ Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
        }
      }
      
      // Clean up
      fs.unlinkSync(testImagePath);
      return true;
      
    } else {
      console.log('   ❌ Upload failed!');
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        console.log(`   Error: ${errorData.error}`);
      } catch {
        console.log(`   Raw error: ${responseText}`);
      }
      
      // Clean up
      fs.unlinkSync(testImagePath);
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

async function testCORS() {
  console.log('\n🔍 Testing CORS configuration...');
  
  try {
    const corsResponse = await fetch(`${API_BASE}/upload`, {
      method: 'OPTIONS'
    });
    
    console.log(`   OPTIONS response status: ${corsResponse.status}`);
    console.log(`   Access-Control-Allow-Origin: ${corsResponse.headers.get('Access-Control-Allow-Origin')}`);
    console.log(`   Access-Control-Allow-Methods: ${corsResponse.headers.get('Access-Control-Allow-Methods')}`);
    console.log(`   Access-Control-Allow-Headers: ${corsResponse.headers.get('Access-Control-Allow-Headers')}`);
    
    if (corsResponse.status === 200) {
      console.log('   ✅ CORS preflight working');
    } else {
      console.log('   ⚠️ CORS preflight issues');
    }
    
  } catch (error) {
    console.log(`   ❌ CORS test failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting upload diagnostics...\n');
  
  await testCORS();
  const uploadSuccess = await testUpload();
  
  console.log('\n📊 Test Summary:');
  if (uploadSuccess) {
    console.log('✅ Upload functionality is working correctly!');
    console.log('\n💡 If you\'re still seeing issues in the frontend:');
    console.log('   1. Check browser console for detailed errors');
    console.log('   2. Verify the file size is not too large');
    console.log('   3. Try different image formats (PNG, JPEG)');
    console.log('   4. Check if it\'s a frontend CORS issue');
  } else {
    console.log('❌ Upload functionality has issues');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check Cloudflare Worker logs in dashboard');
    console.log('   2. Verify R2 bucket configuration');
    console.log('   3. Check environment variables and secrets');
    console.log('   4. Verify wrangler.toml bindings');
  }
  
  return uploadSuccess;
}

if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testUpload, testCORS }; 