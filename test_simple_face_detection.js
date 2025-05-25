#!/usr/bin/env node

/**
 * 简单的人脸检测 API 测试
 * Simple Face Detection API Test
 */

const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

// API配置
const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev/api';

async function testFaceDetectionAPI() {
    console.log('🧪 开始测试人脸检测 API...\n');

    try {
        // 1. 创建一个最简单的图片文件用于测试
        console.log('📸 创建测试图片...');
        const testImageBuffer = createSimpleImageFile();
        
        // 2. 上传测试图片
        console.log('📤 上传测试图片到 API...');
        const uploadResponse = await uploadTestImage(testImageBuffer);
        
        if (!uploadResponse.success) {
            throw new Error(`上传失败: ${uploadResponse.error || 'Unknown error'}`);
        }
        
        console.log(`✅ 图片上传成功: ${uploadResponse.data.fileId}`);
        
        // 3. 测试人脸检测 API
        console.log('🔍 调用人脸检测 API...');
        const detectResponse = await callDetectFacesAPI(uploadResponse.data.fileId);
        
        console.log('📋 人脸检测 API 响应:');
        console.log(JSON.stringify(detectResponse, null, 2));
        
        // 4. 分析结果
        if (detectResponse.success) {
            console.log('\n✅ 人脸检测 API 调用成功');
            
            if (detectResponse.data) {
                const faceData = detectResponse.data;
                console.log(`📊 检测结果:`);
                console.log(`   - 总人脸数: ${faceData.total_faces || 0}`);
                console.log(`   - 检测到的人脸: ${faceData.faces ? faceData.faces.length : 0}`);
                
                if (faceData.faces && faceData.faces.length > 0) {
                    faceData.faces.forEach((face, index) => {
                        console.log(`   - 人脸 ${index + 1}: 位置(${face.x}, ${face.y}), 大小(${face.width}x${face.height}), 置信度: ${(face.confidence * 100).toFixed(1)}%`);
                    });
                } else {
                    console.log('   ⚠️ 未检测到人脸（正常，测试图片不包含真实人脸）');
                }
            } else {
                console.log('   ⚠️ 响应中缺少 data 字段');
            }
        } else {
            console.log(`❌ 人脸检测 API 失败: ${detectResponse.error}`);
        }
        
        return {
            success: true,
            uploaded: !!uploadResponse.success,
            detected: !!detectResponse.success,
            faces: detectResponse.data?.faces?.length || 0
        };
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

function createSimpleImageFile() {
    // 创建一个最简单的 PNG 图片 - 一个红色正方形
    // 这是一个1x1像素的红色PNG图片的base64数据
    const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFF, // compressed data
        0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE5, 
        0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, // IEND chunk
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    return pngData;
}

async function uploadTestImage(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: 'test-image.png',
            contentType: 'image/png'
        });
        
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        return { 
            success: false, 
            error: `Upload failed: ${error.message}` 
        };
    }
}

async function callDetectFacesAPI(fileId) {
    try {
        const response = await fetch(`${API_BASE_URL}/detect-faces`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileId })
        });
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        return { 
            success: false, 
            error: `Detection API failed: ${error.message}` 
        };
    }
}

// 如果是直接运行这个脚本
if (require.main === module) {
    testFaceDetectionAPI().then(result => {
        console.log('\n🏁 测试完成');
        console.log('📋 最终结果:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ 人脸检测 API 功能正常');
        } else {
            console.log('❌ 人脸检测 API 存在问题');
        }
        
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { testFaceDetectionAPI }; 