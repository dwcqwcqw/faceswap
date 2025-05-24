#!/usr/bin/env node

const WORKER_URL = 'https://faceswap-api.faceswap.workers.dev';

async function testWorker() {
    console.log('🚀 Testing Cloudflare Worker...');
    
    try {
        // Test 1: Basic connectivity
        console.log('Testing basic connectivity...');
        const response = await fetch(`${WORKER_URL}/`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${await response.text()}`);
        
        // Test 2: CORS preflight
        console.log('\nTesting CORS...');
        const corsResponse = await fetch(`${WORKER_URL}/api/upload`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3001',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        console.log(`CORS Status: ${corsResponse.status}`);
        console.log(`CORS Headers:`, corsResponse.headers);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('fetch')) {
            console.log('💡 The worker might still be propagating. Please wait a few minutes and try again.');
            console.log('💡 You can also check the worker status at: https://dash.cloudflare.com');
        }
    }
}

testWorker(); 