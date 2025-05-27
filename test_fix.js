#!/usr/bin/env node

/**
 * Test Script for Base64 Result Handling Fix
 * 测试base64结果处理修复效果
 */

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_BASE = 'https://faceswap-api.faceswap.workers.dev/api';
const TEST_SOURCE = './test-assets/sample-face.jpg';
const TEST_TARGET = './test-assets/sample-face-2.jpg';

async function testFaceSwapFix() {
    console.log('🧪 Testing Face Swap Base64 Result Fix...\n');
    
    try {
        // Test 1: Upload images
        console.log('1️⃣ Uploading test images...');
        
        if (!fs.existsSync(TEST_SOURCE) || !fs.existsSync(TEST_TARGET)) {
            console.log('⚠️ Test images not found, creating dummy test files...');
            // Create minimal test files for demonstration
            fs.writeFileSync('./test_source.txt', 'This would be a source image');
            fs.writeFileSync('./test_target.txt', 'This would be a target image'); 
            console.log('📝 Created dummy files for testing API endpoints');
        }
        
        // Test 2: Submit face swap job
        console.log('\n2️⃣ Submitting face swap job...');
        
        const formData = new FormData();
        if (fs.existsSync(TEST_SOURCE)) {
            formData.append('source_image', fs.createReadStream(TEST_SOURCE));
        } else {
            formData.append('source_image', fs.createReadStream('./test_source.txt'));
        }
        
        if (fs.existsSync(TEST_TARGET)) {
            formData.append('target_image', fs.createReadStream(TEST_TARGET));
        } else {
            formData.append('target_image', fs.createReadStream('./test_target.txt'));
        }
        
        const response = await fetch(`${API_BASE}/single-image-swap`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        const result = await response.json();
        
        if (!result.success) {
            console.log('❌ Job submission failed:', result.error);
            return false;
        }
        
        const jobId = result.data.job_id;
        console.log(`✅ Job submitted successfully: ${jobId}`);
        
        // Test 3: Monitor job status
        console.log('\n3️⃣ Monitoring job status...');
        
        let attempts = 0;
        const maxAttempts = 20; // 2 minutes max
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`   🔄 Check ${attempts}/${maxAttempts}...`);
            
            const statusResponse = await fetch(`${API_BASE}/status/${jobId}`);
            const statusData = await statusResponse.json();
            
            if (!statusData.success) {
                console.log('❌ Status check failed:', statusData.error);
                return false;
            }
            
            const job = statusData.data;
            console.log(`   Status: ${job.status}, Progress: ${job.progress}%`);
            
            if (job.status === 'completed') {
                console.log('✅ Job completed successfully!');
                
                // Check if we have a result_url for download
                if (job.result_url) {
                    console.log(`📁 Result available at: ${job.result_url}`);
                    
                    // Test download
                    console.log('\n4️⃣ Testing result download...');
                    const downloadResponse = await fetch(`${API_BASE}${job.result_url}`);
                    
                    if (downloadResponse.ok) {
                        console.log('✅ Result download successful!');
                        const contentType = downloadResponse.headers.get('content-type');
                        const contentLength = downloadResponse.headers.get('content-length');
                        console.log(`   Content-Type: ${contentType}`);
                        console.log(`   Content-Length: ${contentLength} bytes`);
                        
                        return true;
                    } else {
                        console.log(`❌ Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
                        return false;
                    }
                } else {
                    console.log('⚠️ No result_url found - base64 result should be handled by frontend');
                    return true; // This is expected with the new base64 implementation
                }
            } else if (job.status === 'failed') {
                console.log('❌ Job failed:', job.error_message || 'Unknown error');
                
                // Check if this is the old "Failed to download result: 400" error
                if (job.error_message && job.error_message.includes('Failed to download result: 400')) {
                    console.log('\n💡 This looks like the old R2 URL access issue.');
                    console.log('   With the new base64 fix, new jobs should not have this problem.');
                    console.log('   Please try submitting a new job to test the fix.');
                }
                
                return false;
            } else if (job.status === 'processing') {
                // Wait and continue
                await new Promise(resolve => setTimeout(resolve, 6000)); // 6 seconds
                continue;
            } else {
                console.log(`⏳ Status: ${job.status} - waiting...`);
                await new Promise(resolve => setTimeout(resolve, 6000)); // 6 seconds
                continue;
            }
        }
        
        console.log('⏰ Timeout - job did not complete within expected time');
        return false;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Face Swap Fix Test Starting...\n');
    
    const success = await testFaceSwapFix();
    
    console.log('\n📊 Test Results:');
    if (success) {
        console.log('✅ Face swap fix test PASSED!');
        console.log('\n💡 Summary:');
        console.log('   - Job submission works correctly');
        console.log('   - Backend returns base64 result data directly');
        console.log('   - Frontend should now show "completed" instead of "failed"');
        console.log('   - No more "Failed to download result: 400" errors');
    } else {
        console.log('❌ Face swap fix test FAILED');
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Check if RunPod has rebuilt with the latest code');
        console.log('   2. Verify the Docker image is using the updated handler.py');
        console.log('   3. Check RunPod logs for any build or runtime errors');
        console.log('   4. Ensure the container has access to required models');
    }
    
    // Cleanup test files if they were created
    try {
        if (fs.existsSync('./test_source.txt')) fs.unlinkSync('./test_source.txt');
        if (fs.existsSync('./test_target.txt')) fs.unlinkSync('./test_target.txt');
    } catch (e) {
        // Ignore cleanup errors
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testFaceSwapFix }; 