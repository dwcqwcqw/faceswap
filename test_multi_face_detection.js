#!/usr/bin/env node

/**
 * 测试多人脸检测功能
 * Test Multi-Face Detection Functionality
 */

const fs = require('fs');
const path = require('path');

// API配置
const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev/api';

async function testMultiFaceDetection() {
    console.log('🚀 开始测试多人脸检测功能...\n');

    try {
        // 1. 创建一个简单的测试图片 (多色块，模拟多人场景)
        console.log('📸 创建测试图片...');
        
        // 使用 Canvas API 或 创建一个简单的彩色图片用于测试
        const testImageData = createTestMultiPersonImage();
        
        // 2. 上传测试图片
        console.log('📤 上传测试图片...');
        const uploadResponse = await uploadTestImage(testImageData);
        
        if (!uploadResponse.success) {
            throw new Error(`上传失败: ${uploadResponse.error}`);
        }
        
        console.log(`✅ 图片上传成功: ${uploadResponse.data.fileId}`);
        
        // 3. 检测人脸
        console.log('🔍 检测人脸...');
        const detectResponse = await detectFaces(uploadResponse.data.fileId);
        
        console.log('🔍 检测响应数据:', JSON.stringify(detectResponse, null, 2));
        
        if (!detectResponse.success) {
            throw new Error(`人脸检测失败: ${detectResponse.error}`);
        }
        
        const faces = detectResponse.data;
        console.log('✅ 人脸检测完成:');
        console.log(`   总人脸数: ${faces?.total_faces || 0}`);
        
        if (faces?.faces && faces.faces.length > 0) {
            faces.faces.forEach((face, index) => {
                console.log(`   人脸 ${index + 1}:`);
                console.log(`     位置: (${face.x}, ${face.y})`);
                console.log(`     大小: ${face.width} x ${face.height}`);
                console.log(`     置信度: ${(face.confidence * 100).toFixed(1)}%`);
            });
        } else {
            console.log('   ⚠️ 未检测到人脸（这是正常的，因为是测试图片）');
        }
        
        console.log('\n🎉 多人脸检测功能测试完成！');
        
        return {
            success: true,
            fileId: uploadResponse.data.fileId,
            detectedFaces: faces.total_faces,
            faces: faces.faces
        };
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return { success: false, error: error.message };
    }
}

function createTestMultiPersonImage() {
    // 创建一个简单的SVG图片，包含多个色块来模拟多人场景
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f0f0f0"/>
  <text x="200" y="150" font-family="Arial" font-size="16" text-anchor="middle" fill="#333">
    Multi-Person Test Image
  </text>
  <text x="200" y="180" font-family="Arial" font-size="12" text-anchor="middle" fill="#666">
    用于测试多人脸检测功能
  </text>
  <circle cx="100" cy="100" r="30" fill="#ffcccc" stroke="#ff6666" stroke-width="2"/>
  <circle cx="300" cy="100" r="30" fill="#ccffcc" stroke="#66ff66" stroke-width="2"/>
  <circle cx="200" cy="220" r="30" fill="#ccccff" stroke="#6666ff" stroke-width="2"/>
</svg>`;
    
    return Buffer.from(svgContent);
}

async function uploadTestImage(imageData) {
    try {
        const FormData = (await import('form-data')).default;
        const fetch = (await import('node-fetch')).default;
        
        const formData = new FormData();
        formData.append('file', imageData, {
            filename: 'test-multi-person.svg',
            contentType: 'image/svg+xml'
        });
        
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        return await response.json();
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function detectFaces(fileId) {
    try {
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(`${API_BASE_URL}/detect-faces`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileId })
        });
        
        return await response.json();
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 如果是直接运行这个脚本
if (require.main === module) {
    testMultiFaceDetection().then(result => {
        console.log('\n📋 测试结果:', JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { testMultiFaceDetection }; 