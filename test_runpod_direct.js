#!/usr/bin/env node

/**
 * 直接测试 RunPod API 响应格式
 * Direct RunPod API Response Format Test
 */

const fetch = require('node-fetch');

// RunPod 配置
const RUNPOD_ENDPOINT_ID = 'sbta9w9yx2cc1e';
const RUNPOD_API_KEY = 'KA5TZMQGZUDUZJXFFQ3V40Z2XJP79O21LPHH5WAE'; // 请确保这是正确的 API key

async function testRunPodDirectly() {
    console.log('🔧 直接测试 RunPod API...\n');

    try {
        // 1. 健康检查
        console.log('🏥 测试健康检查...');
        const healthResponse = await callRunPodAPI({
            input: {
                type: 'health_check'
            }
        });
        
        console.log('健康检查响应:', JSON.stringify(healthResponse, null, 2));
        console.log('');

        // 2. 测试人脸检测
        console.log('🔍 测试人脸检测...');
        const faceDetectionResponse = await callRunPodAPI({
            input: {
                process_type: 'detect-faces',
                image_file: 'https://faceswap-api.faceswap.workers.dev/api/download/test-file'
            }
        });
        
        console.log('人脸检测响应:', JSON.stringify(faceDetectionResponse, null, 2));
        console.log('');

        // 3. 分析响应格式
        console.log('📊 分析响应格式:');
        console.log('- 健康检查是否有 output:', !!healthResponse.output);
        console.log('- 人脸检测是否有 output:', !!faceDetectionResponse.output);
        console.log('- 健康检查是否有 status:', !!healthResponse.status);
        console.log('- 人脸检测是否有 status:', !!faceDetectionResponse.status);

        if (healthResponse.id || faceDetectionResponse.id) {
            console.log('\n⚠️ 检测到异步响应，需要轮询结果');
            
            // 如果返回 id，说明是异步处理，需要轮询
            if (faceDetectionResponse.id) {
                console.log('🔄 轮询人脸检测结果...');
                const pollResult = await pollRunPodResult(faceDetectionResponse.id);
                console.log('轮询结果:', JSON.stringify(pollResult, null, 2));
            }
        }

        return {
            success: true,
            healthCheck: healthResponse,
            faceDetection: faceDetectionResponse
        };

    } catch (error) {
        console.error('❌ RunPod 直接测试失败:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

async function callRunPodAPI(payload) {
    try {
        const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RUNPOD_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result;

    } catch (error) {
        throw new Error(`RunPod API call failed: ${error.message}`);
    }
}

async function pollRunPodResult(jobId, maxAttempts = 10) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`   轮询尝试 ${attempt}/${maxAttempts}...`);
            
            const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${RUNPOD_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.status === 'COMPLETED') {
                console.log('✅ 任务完成');
                return result;
            } else if (result.status === 'FAILED') {
                console.log('❌ 任务失败');
                return result;
            } else {
                console.log(`   状态: ${result.status}`);
                // 等待2秒后重试
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            console.log(`   轮询失败: ${error.message}`);
            if (attempt === maxAttempts) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    throw new Error('轮询超时');
}

// 如果是直接运行这个脚本
if (require.main === module) {
    testRunPodDirectly().then(result => {
        console.log('\n🏁 RunPod 直接测试完成');
        console.log('📋 最终结果:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ RunPod API 连接正常');
        } else {
            console.log('❌ RunPod API 存在问题');
        }
        
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { testRunPodDirectly }; 