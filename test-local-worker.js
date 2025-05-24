#!/usr/bin/env node

const LOCAL_WORKER_URL = 'http://127.0.0.1:8787';

async function testLocalWorker() {
    console.log('🚀 Testing Local Cloudflare Worker...');
    
    try {
        // Test 1: Basic connectivity
        console.log('Testing basic connectivity...');
        const response = await fetch(`${LOCAL_WORKER_URL}/`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${await response.text()}`);
        
        // Test 2: CORS preflight
        console.log('\nTesting CORS...');
        const corsResponse = await fetch(`${LOCAL_WORKER_URL}/api/upload`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3001',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        console.log(`CORS Status: ${corsResponse.status}`);
        console.log(`CORS Response: ${await corsResponse.text()}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testLocalWorker(); 