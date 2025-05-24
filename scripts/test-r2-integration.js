#!/usr/bin/env node

/**
 * R2 Integration Test Script
 * 测试Cloudflare R2文件上传、处理和下载功能
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// 配置
const WORKER_URL = process.env.WORKER_URL || 'https://faceswap-api.your-subdomain.workers.dev';
const TEST_IMAGE_PATH = './test-assets/sample-face.jpg';

class R2IntegrationTest {
    constructor(workerUrl) {
        this.workerUrl = workerUrl;
        this.testResults = [];
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async uploadTestFile() {
        try {
            this.log('开始测试文件上传...');
            
            if (!fs.existsSync(TEST_IMAGE_PATH)) {
                throw new Error(`测试图片不存在: ${TEST_IMAGE_PATH}`);
            }

            const formData = new FormData();
            formData.append('file', fs.createReadStream(TEST_IMAGE_PATH));

            const response = await fetch(`${this.workerUrl}/api/upload`, {
                method: 'POST',
                body: formData,
                headers: formData.getHeaders()
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(`上传失败: ${result.error}`);
            }

            this.log(`文件上传成功: ${result.data.fileId}`, 'success');
            return result.data.fileId;

        } catch (error) {
            this.log(`文件上传失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testFaceDetection(fileId) {
        try {
            this.log('开始测试人脸检测...');

            const response = await fetch(`${this.workerUrl}/api/detect-faces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fileId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(`人脸检测失败: ${result.error}`);
            }

            this.log(`人脸检测成功: 检测到 ${result.data.faces_detected} 张人脸`, 'success');
            return result.data;

        } catch (error) {
            this.log(`人脸检测失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testImageProcessing(sourceFileId, targetFileId) {
        try {
            this.log('开始测试图片换脸处理...');

            const response = await fetch(`${this.workerUrl}/api/process/single-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_file: sourceFileId,
                    target_file: targetFileId,
                    options: {
                        quality: 'high'
                    }
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(`处理失败: ${result.error}`);
            }

            this.log(`处理任务已创建: ${result.data.jobId}`, 'success');
            return result.data.jobId;

        } catch (error) {
            this.log(`处理失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async checkJobStatus(jobId, maxRetries = 30) {
        try {
            this.log(`检查任务状态: ${jobId}`);

            for (let i = 0; i < maxRetries; i++) {
                const response = await fetch(`${this.workerUrl}/api/status/${jobId}`);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`状态查询失败: ${result.error}`);
                }

                this.log(`任务状态: ${result.data.status} (${result.data.progress}%)`);

                if (result.data.status === 'completed') {
                    this.log(`任务完成！结果URL: ${result.data.result_url}`, 'success');
                    return result.data;
                } else if (result.data.status === 'failed') {
                    throw new Error(`任务失败: ${result.data.error_message}`);
                }

                // 等待5秒后重试
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            throw new Error('任务超时');

        } catch (error) {
            this.log(`状态检查失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testFileDownload(fileId) {
        try {
            this.log(`测试文件下载: ${fileId}`);

            const response = await fetch(`${this.workerUrl}/api/download/${fileId}`);

            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            this.log(`文件下载成功: ${contentLength} bytes`, 'success');
            return true;

        } catch (error) {
            this.log(`文件下载失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async runFullTest() {
        try {
            this.log('🚀 开始R2集成测试...');

            // 1. 上传测试文件
            const sourceFileId = await this.uploadTestFile();
            const targetFileId = await this.uploadTestFile(); // 使用同一张图片作为源和目标

            // 2. 测试人脸检测
            await this.testFaceDetection(sourceFileId);

            // 3. 测试图片处理
            const jobId = await this.testImageProcessing(sourceFileId, targetFileId);

            // 4. 检查任务状态
            const jobResult = await this.checkJobStatus(jobId);

            // 5. 测试结果下载
            if (jobResult.result_url) {
                const resultFileId = jobResult.result_url.split('/').pop();
                await this.testFileDownload(resultFileId);
            }

            // 6. 测试上传文件下载
            await this.testFileDownload(sourceFileId);

            this.log('🎉 所有测试通过！', 'success');

        } catch (error) {
            this.log(`测试失败: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// 主函数
async function main() {
    const tester = new R2IntegrationTest(WORKER_URL);
    await tester.runFullTest();
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = R2IntegrationTest; 