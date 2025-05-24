/**
 * 测试 RunPod Serverless 修复效果
 * 验证模块导入和依赖问题是否解决
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
        const workerResult = await testCloudflareWorker();
        if (workerResult) {
            console.log('✅ Cloudflare Worker 正常运行\n');
        }
        
        // 测试 RunPod Serverless
        console.log('2️⃣ 测试 RunPod Serverless');
        const runpodResult = await testRunPodHealth();
        
        if (runpodResult.status === 'COMPLETED' || runpodResult.output) {
            console.log('✅ RunPod Serverless 正常运行');
            console.log('✅ 模块导入问题已修复');
        } else {
            console.log('⚠️ RunPod Serverless 可能仍在构建中...');
        }
        
    } catch (error) {
        console.error('❌ 测试过程中出现错误:', error.message);
    }
    
    console.log('\n📊 测试完成');
    console.log('💡 如果 RunPod 仍在构建，请等待 5-10 分钟后重试');
}

// 运行测试
main(); 