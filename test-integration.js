#!/usr/bin/env node

/**
 * 🧪 Face Swap API 集成测试
 * 测试 前端 → Cloudflare Worker → RunPod Serverless 完整流程
 */

const API_BASE = 'https://faceswap-api.faceswap.workers.dev';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || 'your-runpod-api-key';
const RUNPOD_ENDPOINT_ID = 'sbta9w9yx2cc1e';

// 测试函数
async function runTests() {
    console.log('🚀 开始 Face Swap API 集成测试...\n');
    
    // 测试 1: 基础连接测试
    console.log('1️⃣ 测试基础 API 连接...');
    try {
        const response = await fetch(`${API_BASE}/api/detect-faces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_file: 'test' })
        });
        
        const result = await response.json();
        console.log('✅ API 响应:', result);
        
        if (result.error && result.error.includes('No file ID')) {
            console.log('✅ Cloudflare Worker 正常工作!\n');
        } else {
            console.log('⚠️ 意外响应，但 API 可达\n');
        }
    } catch (error) {
        console.log('❌ API 连接失败:', error.message);
        return false;
    }

    // 测试 2: RunPod 连接测试
    console.log('2️⃣ 测试 RunPod Serverless 连接...');
    
    if (RUNPOD_API_KEY === 'your-runpod-api-key') {
        console.log('⚠️ 跳过 RunPod 测试 - 请设置环境变量 RUNPOD_API_KEY');
        console.log('💡 运行: export RUNPOD_API_KEY=your-actual-key');
    } else {
        try {
            // 直接测试 RunPod API
            const runpodResponse = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RUNPOD_API_KEY}`
                },
                body: JSON.stringify({
                    input: {
                        action: 'test_connection'
                    }
                })
            });

            if (runpodResponse.ok) {
                const runpodResult = await runpodResponse.json();
                console.log('✅ RunPod 连接成功:', runpodResult);
            } else {
                console.log('⚠️ RunPod 响应状态:', runpodResponse.status);
                const errorText = await runpodResponse.text();
                console.log('RunPod 错误详情:', errorText);
            }
        } catch (error) {
            console.log('❌ RunPod 连接失败:', error.message);
        }
    }

    // 测试 3: 前端连接测试
    console.log('\n3️⃣ 测试前端服务器连接...');
    try {
        const frontendResponse = await fetch('http://localhost:3003');
        if (frontendResponse.ok) {
            console.log('✅ 前端服务器 (localhost:3003) 正常运行!');
        } else {
            console.log('⚠️ 前端服务器响应状态:', frontendResponse.status);
        }
    } catch (error) {
        console.log('❌ 前端服务器未启动或不可达');
        console.log('💡 请运行: cd web/frontend && npm run dev');
    }

    console.log('\n🎉 集成测试完成!');
    
    console.log('\n📋 下一步操作:');
    console.log('1. 访问前端: http://localhost:3003');
    console.log('2. 上传测试图片进行换脸');
    console.log('3. 查看处理结果');
    console.log(`\n🔗 API 端点: ${API_BASE}`);
    console.log(`🎯 RunPod Endpoint: ${RUNPOD_ENDPOINT_ID}`);
}

// 运行测试
runTests().catch(console.error); 