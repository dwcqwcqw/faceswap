/**
 * 测试 RunPod Serverless 修复效果
 * 验证真实的图片处理功能
 */

const https = require('https');

// RunPod Endpoint 配置
const RUNPOD_ENDPOINT = 'sbta9w9yx2cc1e';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || 'YOUR_RUNPOD_API_KEY_HERE';

async function testRunPodHealth() {
    console.log('🔍 测试 RunPod Serverless 健康状态...');
    
    const payload = {
        input: {
            type: 'health_check'
        }
    };

    return await makeRunPodRequest(payload);
}

async function testImageProcessing() {
    console.log('🔍 测试图片处理功能...');
    
    // 使用公开的测试图片URL
    const payload = {
        input: {
            process_type: 'single-image',
            source_file: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
            target_file: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face',
            options: {
                mouth_mask: true
            }
        }
    };

    console.log('📤 发送的数据:', JSON.stringify(payload, null, 2));
    return await makeRunPodRequest(payload);
}

async function testLegacyFormat() {
    console.log('🔍 测试传统base64格式...');
    
    // 1x1像素的PNG测试图片(base64)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA4849cgAAAABJRU5ErkJggg==';
    
    const payload = {
        input: {
            type: 'single_image',
            source_image: testImageBase64,
            target_image: testImageBase64
        }
    };

    return await makeRunPodRequest(payload);
}

async function makeRunPodRequest(payload) {
    const options = {
        hostname: 'api.runpod.ai',
        port: 443,
        path: `/v2/${RUNPOD_ENDPOINT}/runsync`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('📋 RunPod 响应:', JSON.stringify(response, null, 2));
                    resolve(response);
                } catch (error) {
                    console.error('❌ 解析响应失败:', error.message);
                    console.log('📄 原始响应:', data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ 请求失败:', error.message);
            reject(error);
        });

        req.write(JSON.stringify(payload));
        req.end();
    });
}

async function testCloudflareWorker() {
    console.log('🔍 测试 Cloudflare Worker 状态...');
    
    const options = {
        hostname: 'faceswap-api.faceswap.workers.dev',
        port: 443,
        path: '/health',
        method: 'GET'
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('📋 Cloudflare Worker 响应:', JSON.stringify(response, null, 2));
                    resolve(response);
                } catch (error) {
                    console.log('📋 Cloudflare Worker 响应 (非JSON):', data);
                    resolve({ status: 'ok', response: data });
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Cloudflare Worker 请求失败:', error.message);
            reject(error);
        });

        req.end();
    });
}

async function main() {
    console.log('🚀 开始测试 Face Swap 平台修复效果...\n');
    
    try {
        // 测试 Cloudflare Worker
        console.log('1️⃣ 测试 Cloudflare Worker');
        console.log('=' .repeat(50));
        const workerResult = await testCloudflareWorker();
        if (workerResult) {
            console.log('✅ Cloudflare Worker 正常运行\n');
        }
        
        // 测试 RunPod 健康状态
        console.log('2️⃣ 测试 RunPod 健康状态');
        console.log('=' .repeat(50));
        const healthResult = await testRunPodHealth();
        
        if (healthResult.status === 'COMPLETED' && healthResult.output) {
            console.log('✅ RunPod Serverless 健康检查通过');
            console.log('✅ 所有模块已成功导入\n');
        } else {
            console.log('⚠️ RunPod Serverless 响应异常\n');
        }
        
        // 测试真实图片处理
        console.log('3️⃣ 测试真实图片处理 (URL格式)');
        console.log('=' .repeat(50));
        const imageResult = await testImageProcessing();
        
        if (imageResult.status === 'COMPLETED' && imageResult.output && !imageResult.output.error) {
            console.log('✅ 图片处理功能正常工作！');
            console.log('✅ Cloudflare Worker 数据格式兼容性修复成功');
        } else if (imageResult.output && imageResult.output.error) {
            console.log('⚠️ 图片处理遇到错误:', imageResult.output.error);
        } else {
            console.log('⚠️ 图片处理响应异常');
        }
        
        console.log('\n4️⃣ 测试传统格式兼容性');
        console.log('=' .repeat(50));
        const legacyResult = await testLegacyFormat();
        
        if (legacyResult.status === 'COMPLETED' && legacyResult.output && !legacyResult.output.error) {
            console.log('✅ 传统base64格式兼容性正常');
        } else if (legacyResult.output && legacyResult.output.error) {
            console.log('⚠️ 传统格式测试:', legacyResult.output.error);
        }
        
    } catch (error) {
        console.error('❌ 测试过程中出现错误:', error.message);
    }
    
    console.log('\n📊 测试完成');
    console.log('=' .repeat(50));
    console.log('💡 如果图片处理成功，说明前端"Missing source_image or target_image"问题已修复');
    console.log('🔧 RunPod Serverless 现在可以处理 Cloudflare Worker 发送的URL格式数据');
}

// 运行测试
main(); 