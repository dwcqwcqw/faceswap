#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

const LOCAL_WORKER_URL = 'http://127.0.0.1:8787';
const TEST_IMAGE_PATH = './test-assets/sample-face.jpg';

async function testFileUpload() {
    console.log('🚀 Testing File Upload...');
    
    try {
        // Check if test file exists
        if (!fs.existsSync(TEST_IMAGE_PATH)) {
            console.error(`❌ Test image not found: ${TEST_IMAGE_PATH}`);
            return;
        }
        
        console.log('📁 Creating form data...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(TEST_IMAGE_PATH));
        
        console.log('📤 Uploading file...');
        const response = await fetch(`${LOCAL_WORKER_URL}/api/upload`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        console.log(`Status: ${response.status}`);
        const result = await response.json();
        console.log('Response:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ File upload successful!');
            console.log(`File ID: ${result.data.fileId}`);
            console.log(`Download URL: ${result.data.url}`);
            
            // Test download
            console.log('\n📥 Testing file download...');
            const downloadResponse = await fetch(`${LOCAL_WORKER_URL}${result.data.url}`);
            console.log(`Download Status: ${downloadResponse.status}`);
            console.log(`Content-Type: ${downloadResponse.headers.get('content-type')}`);
            console.log(`Content-Length: ${downloadResponse.headers.get('content-length')}`);
            
        } else {
            console.error('❌ Upload failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testFileUpload(); 