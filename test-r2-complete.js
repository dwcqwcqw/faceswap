#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

const LOCAL_WORKER_URL = 'http://127.0.0.1:8787';
const TEST_IMAGE_PATH = './test-assets/sample-face.jpg';

class R2StorageTest {
    constructor() {
        this.uploadedFiles = [];
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp.split('T')[1].split('.')[0]}] ${message}`);
    }

    async uploadFile() {
        try {
            this.log('开始测试文件上传...');
            
            if (!fs.existsSync(TEST_IMAGE_PATH)) {
                throw new Error(`测试图片不存在: ${TEST_IMAGE_PATH}`);
            }

            const response = await fetch(`${LOCAL_WORKER_URL}/api/upload`, {
                method: 'POST',
                body: fs.createReadStream(TEST_IMAGE_PATH),
                headers: {
                    'Content-Type': 'image/jpeg'
                }
            });

            // 如果上面的方法失败，尝试使用curl
            if (!response.ok) {
                this.log('尝试使用curl方式上传...');
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);
                
                const curlCommand = `curl -X POST "${LOCAL_WORKER_URL}/api/upload" -F "file=@${TEST_IMAGE_PATH}" -H "Accept: application/json"`;
                const { stdout } = await execPromise(curlCommand);
                const result = JSON.parse(stdout);
                
                if (result.success) {
                    this.log(`文件上传成功: ${result.data.fileId}`, 'success');
                    this.uploadedFiles.push(result.data);
                    return result.data;
                } else {
                    throw new Error(`上传失败: ${result.error}`);
                }
            }

            const result = await response.json();
            if (result.success) {
                this.log(`文件上传成功: ${result.data.fileId}`, 'success');
                this.uploadedFiles.push(result.data);
                return result.data;
            } else {
                throw new Error(`上传失败: ${result.error}`);
            }

        } catch (error) {
            this.log(`文件上传失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async downloadFile(fileData) {
        try {
            this.log(`测试文件下载: ${fileData.fileId}`);

            const response = await fetch(`${LOCAL_WORKER_URL}${fileData.url}`);

            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            const contentType = response.headers.get('content-type');
            
            this.log(`文件下载成功: ${contentLength} bytes, ${contentType}`, 'success');
            return true;

        } catch (error) {
            this.log(`文件下载失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testCORS() {
        try {
            this.log('测试CORS配置...');

            const response = await fetch(`${LOCAL_WORKER_URL}/api/upload`, {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3001',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });

            if (response.ok) {
                this.log('CORS配置正确', 'success');
                return true;
            } else {
                throw new Error(`CORS测试失败: ${response.status}`);
            }

        } catch (error) {
            this.log(`CORS测试失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testR2Storage() {
        try {
            this.log('🚀 开始R2存储完整测试...');

            // 1. 测试CORS
            await this.testCORS();

            // 2. 测试文件上传
            const fileData = await this.uploadFile();

            // 3. 测试文件下载
            await this.downloadFile(fileData);

            // 4. 测试多个文件上传
            this.log('测试多文件上传...');
            const fileData2 = await this.uploadFile();
            await this.downloadFile(fileData2);

            this.log('🎉 所有R2存储测试通过！', 'success');
            this.log(`成功上传 ${this.uploadedFiles.length} 个文件`);
            
            // 显示上传的文件信息
            this.uploadedFiles.forEach((file, index) => {
                this.log(`文件 ${index + 1}: ${file.fileId} (${file.fileName}, ${file.size} bytes)`);
            });

        } catch (error) {
            this.log(`测试失败: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// 主函数
async function main() {
    const tester = new R2StorageTest();
    await tester.testR2Storage();
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = R2StorageTest; 