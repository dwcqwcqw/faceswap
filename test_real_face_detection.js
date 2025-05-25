#!/usr/bin/env node

/**
 * 真实图片人脸检测测试
 * Real Image Face Detection Test
 */

const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

// API配置
const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev/api';

async function testRealFaceDetection() {
    console.log('🧪 开始测试真实图片人脸检测...\n');

    try {
        // 1. 创建一个更真实的图片 (简单的 JPEG 格式)
        console.log('📸 创建测试图片...');
        const testImageBuffer = createSimpleJpegImage();
        
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
            success: detectResponse.success,
            uploaded: !!uploadResponse.success,
            detected: !!detectResponse.success,
            faces: detectResponse.data?.faces?.length || 0,
            error: detectResponse.error
        };
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

function createSimpleJpegImage() {
    // 创建一个最简单的 JPEG 图片头部
    // 这是一个最小的 JPEG 文件结构
    const jpegData = Buffer.from([
        0xFF, 0xD8,  // SOI (Start of Image)
        0xFF, 0xE0,  // APP0
        0x00, 0x10,  // Length
        0x4A, 0x46, 0x49, 0x46, 0x00,  // "JFIF\0"
        0x01, 0x01,  // Version
        0x01,        // Units
        0x00, 0x48,  // X density
        0x00, 0x48,  // Y density
        0x00, 0x00,  // Thumbnail width/height
        0xFF, 0xDB,  // DQT
        0x00, 0x43,  // Length
        0x00,        // Table ID
        // Quantization table (64 bytes)
        0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
        0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14,
        0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13,
        0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A,
        0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22,
        0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C,
        0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39,
        0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
        0xFF, 0xC0,  // SOF0
        0x00, 0x11,  // Length
        0x08,        // Precision
        0x00, 0x01,  // Height (1 pixel)
        0x00, 0x01,  // Width (1 pixel)
        0x03,        // Components
        0x01, 0x11, 0x00,  // Component 1
        0x02, 0x11, 0x01,  // Component 2
        0x03, 0x11, 0x01,  // Component 3
        0xFF, 0xDA,  // SOS
        0x00, 0x0C,  // Length
        0x03,        // Components
        0x01, 0x00,  // Component 1
        0x02, 0x11,  // Component 2
        0x03, 0x11,  // Component 3
        0x00, 0x3F, 0x00,  // Spectral selection
        0xFF, 0xD9   // EOI (End of Image)
    ]);
    
    return jpegData;
}

async function uploadTestImage(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: 'test-image.jpg',
            contentType: 'image/jpeg'
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
    testRealFaceDetection().then(result => {
        console.log('\n🏁 测试完成');
        console.log('📋 最终结果:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ 人脸检测 API 功能正常');
        } else {
            console.log('❌ 人脸检测 API 存在问题');
            if (result.error) {
                console.log(`   错误详情: ${result.error}`);
            }
        }
        
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { testRealFaceDetection }; 