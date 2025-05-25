#!/usr/bin/env node

/**
 * 使用真实图片格式测试人脸检测
 * Test face detection with real image format
 */

const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

// API配置
const API_BASE_URL = 'https://faceswap-api.faceswap.workers.dev/api';

async function testWithRealImage() {
    console.log('🧪 开始测试真实图片格式的人脸检测...\n');

    try {
        // 1. 创建一个真正的 PNG 图片 (100x100 像素，彩色)
        console.log('📸 创建真实的 PNG 图片...');
        const testImageBuffer = createRealPngImage();
        
        // 2. 上传测试图片
        console.log('📤 上传测试图片到 API...');
        const uploadResponse = await uploadTestImage(testImageBuffer);
        
        if (!uploadResponse.success) {
            throw new Error(`上传失败: ${uploadResponse.error || 'Unknown error'}`);
        }
        
        console.log(`✅ 图片上传成功: ${uploadResponse.data.fileId}`);
        
        // 3. 验证下载
        console.log('🔗 验证下载链接...');
        const downloadUrl = `${API_BASE_URL}/download/${uploadResponse.data.fileId}`;
        console.log(`   下载链接: ${downloadUrl}`);
        
        // 4. 测试人脸检测 API
        console.log('🔍 调用人脸检测 API...');
        const detectResponse = await callDetectFacesAPI(uploadResponse.data.fileId);
        
        console.log('📋 人脸检测 API 响应:');
        console.log(JSON.stringify(detectResponse, null, 2));
        
        // 5. 分析结果
        if (detectResponse.success) {
            console.log('\n✅ 人脸检测 API 调用成功');
            
            if (detectResponse.data) {
                const faceData = detectResponse.data;
                console.log(`📊 检测结果:`);
                console.log(`   - 总人脸数: ${faceData.total_faces || 0}`);
                console.log(`   - 检测到的人脸: ${faceData.faces ? faceData.faces.length : 0}`);
                
                if (faceData.faces && faceData.faces.length > 0) {
                    faceData.faces.forEach((face, index) => {
                        console.log(`   - 人脸 ${index + 1}:`);
                        console.log(`     位置: (${face.x}, ${face.y})`);
                        console.log(`     大小: ${face.width} × ${face.height}`);
                        console.log(`     置信度: ${(face.confidence * 100).toFixed(1)}%`);
                        console.log(`     预览图: ${face.preview ? '已生成' : '未生成'}`);
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
            error: detectResponse.error,
            downloadUrl: downloadUrl
        };
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

function createRealPngImage() {
    // 创建一个真正的 PNG 图片 - 100x100 像素，RGB 格式
    const width = 100;
    const height = 100;
    
    // PNG 文件结构
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk (Image Header)
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);     // Width
    ihdrData.writeUInt32BE(height, 4);    // Height
    ihdrData.writeUInt8(8, 8);            // Bit depth
    ihdrData.writeUInt8(2, 9);            // Color type (RGB)
    ihdrData.writeUInt8(0, 10);           // Compression method
    ihdrData.writeUInt8(0, 11);           // Filter method
    ihdrData.writeUInt8(0, 12);           // Interlace method
    
    const ihdrCrc = calculateCRC32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
    const ihdrChunk = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x0D]), // Length
        Buffer.from('IHDR'),                   // Type
        ihdrData,                              // Data
        ihdrCrc                                // CRC
    ]);
    
    // 创建简单的图像数据 (渐变色)
    const imageData = [];
    for (let y = 0; y < height; y++) {
        imageData.push(0); // Filter type (None)
        for (let x = 0; x < width; x++) {
            // RGB 渐变
            const r = Math.floor((x / width) * 255);
            const g = Math.floor((y / height) * 255);
            const b = Math.floor(((x + y) / (width + height)) * 255);
            imageData.push(r, g, b);
        }
    }
    
    // 压缩图像数据 (简单的 zlib 压缩)
    const imageBuffer = Buffer.from(imageData);
    const compressedData = compressZlib(imageBuffer);
    
    // IDAT chunk (Image Data)
    const idatCrc = calculateCRC32(Buffer.concat([Buffer.from('IDAT'), compressedData]));
    const idatChunk = Buffer.concat([
        Buffer.alloc(4), // Length (will be filled)
        Buffer.from('IDAT'),
        compressedData,
        idatCrc
    ]);
    idatChunk.writeUInt32BE(compressedData.length, 0);
    
    // IEND chunk (Image End)
    const iendCrc = calculateCRC32(Buffer.from('IEND'));
    const iendChunk = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length
        Buffer.from('IEND'),                   // Type
        iendCrc                                // CRC
    ]);
    
    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

function calculateCRC32(data) {
    // 简化的 CRC32 实现
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 1) {
                crc = (crc >>> 1) ^ 0xEDB88320;
            } else {
                crc >>>= 1;
            }
        }
    }
    const result = Buffer.alloc(4);
    result.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, 0);
    return result;
}

function compressZlib(data) {
    // 非常简单的 zlib 格式 (无压缩)
    const header = Buffer.from([0x78, 0x01]); // zlib header
    const content = Buffer.concat([
        Buffer.from([0x01]), // BFINAL=1, BTYPE=00 (no compression)
        Buffer.alloc(4), // LEN and NLEN (will be filled)
        data
    ]);
    
    // 填充长度字段
    content.writeUInt16LE(data.length, 1);
    content.writeUInt16LE(~data.length & 0xFFFF, 3);
    
    // 计算 Adler-32 校验和
    const adler32 = calculateAdler32(data);
    
    return Buffer.concat([header, content, adler32]);
}

function calculateAdler32(data) {
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) {
        a = (a + data[i]) % 65521;
        b = (b + a) % 65521;
    }
    const result = Buffer.alloc(4);
    result.writeUInt32BE((b << 16) | a, 0);
    return result;
}

async function uploadTestImage(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: 'test-real-image.png',
            contentType: 'image/png'
        });
        
        console.log(`📤 上传图片大小: ${imageBuffer.length} bytes`);
        
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
    testWithRealImage().then(result => {
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
        
        console.log('\n📝 建议下一步测试:');
        console.log('   1. 使用前端界面测试: http://localhost:3002/multi-image');
        console.log('   2. 上传包含真实人脸的图片进行测试');
        console.log('   3. 验证检测到的人脸预览图是否正确显示');
        
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { testWithRealImage }; 