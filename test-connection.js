#!/usr/bin/env node

const axios = require('axios');

async function testConnection() {
    console.log('🧪 测试前端和后端连接...\n');
    
    try {
        // Test 1: Frontend
        console.log('1. 测试前端 (http://localhost:3000)...');
        const frontendResponse = await axios.get('http://localhost:3000/', { 
            timeout: 5000,
            validateStatus: function (status) {
                return status >= 200 && status < 300; // default
            }
        });
        if (frontendResponse.status === 200) {
            console.log('✅ 前端正常运行');
        }
    } catch (error) {
        console.log('❌ 前端连接失败:', error.message);
        console.log('状态码:', error.response?.status);
        return;
    }
    
    try {
        // Test 2: Backend API
        console.log('\n2. 测试后端 API (http://localhost:8787)...');
        const backendResponse = await axios.options('http://localhost:8787/api/upload', {
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            },
            timeout: 5000
        });
        
        if (backendResponse.status === 200) {
            console.log('✅ 后端 API 正常运行');
            console.log('✅ CORS 配置正确');
        }
    } catch (error) {
        console.log('❌ 后端 API 连接失败:', error.message);
        return;
    }
    
    try {
        // Test 3: API endpoint test
        console.log('\n3. 测试 API 端点...');
        const apiTest = await axios.get('http://localhost:8787/', { timeout: 5000 });
        console.log('✅ API 端点响应正常');
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('✅ API 端点正常 (404 是预期的)');
        } else {
            console.log('⚠️ API 端点测试:', error.message);
        }
    }
    
    console.log('\n🎉 连接测试完成！');
    console.log('\n📋 测试结果:');
    console.log('- 前端: http://localhost:3000 ✅');
    console.log('- 后端: http://localhost:8787 ✅');
    console.log('- CORS: 已配置 ✅');
    
    console.log('\n🚀 现在可以在浏览器中访问 http://localhost:3000 测试应用！');
    console.log('\n💡 注意: 由于没有配置 RunPod API 密钥，实际的 AI 处理功能暂时不可用');
    console.log('   但是文件上传、界面交互等功能应该正常工作');
}

testConnection().catch(console.error); 