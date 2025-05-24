#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const LOCAL_WORKER_URL = 'http://127.0.0.1:8787';
const TEST_IMAGE_PATH = './test-assets/sample-face.jpg';

class SimpleR2Test {
    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp.split('T')[1].split('.')[0]}] ${message}`);
    }

    async testUpload() {
        try {
            this.log('测试文件上传...');
            
            const curlCommand = `curl -s -X POST "${LOCAL_WORKER_URL}/api/upload" -F "file=@${TEST_IMAGE_PATH}" -H "Accept: application/json"`;
            const { stdout } = await execPromise(curlCommand);
            const result = JSON.parse(stdout);
            
            if (result.success) {
                this.log(`文件上传成功: ${result.data.fileId}`, 'success');
                this.log(`文件名: ${result.data.fileName}, 大小: ${result.data.size} bytes`);
                return result.data;
            } else {
                throw new Error(`上传失败: ${result.error}`);
            }

        } catch (error) {
            this.log(`文件上传失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testDownload(fileData) {
        try {
            this.log(`测试文件下载: ${fileData.fileId}`);
            
            const curlCommand = `curl -s -I "${LOCAL_WORKER_URL}${fileData.url}"`;
            const { stdout } = await execPromise(curlCommand);
            
            if (stdout.includes('HTTP/1.1 200 OK')) {
                this.log('文件下载成功', 'success');
                
                // 提取内容信息
                const contentLength = stdout.match(/Content-Length: (\d+)/)?.[1];
                const contentType = stdout.match(/Content-Type: ([^\r\n]+)/)?.[1];
                
                if (contentLength) {
                    this.log(`文件大小: ${contentLength} bytes`);
                }
                if (contentType) {
                    this.log(`文件类型: ${contentType}`);
                }
                
                return true;
            } else {
                throw new Error('下载失败');
            }

        } catch (error) {
            this.log(`文件下载失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async testCORS() {
        try {
            this.log('测试CORS配置...');
            
            const curlCommand = `curl -s -I -X OPTIONS "${LOCAL_WORKER_URL}/api/upload" -H "Origin: http://localhost:3001" -H "Access-Control-Request-Method: POST"`;
            const { stdout } = await execPromise(curlCommand);
            
            if (stdout.includes('HTTP/1.1 200 OK') && stdout.includes('Access-Control-Allow-Origin')) {
                this.log('CORS配置正确', 'success');
                return true;
            } else {
                throw new Error('CORS配置错误');
            }

        } catch (error) {
            this.log(`CORS测试失败: ${error.message}`, 'error');
            throw error;
        }
    }

    async runAllTests() {
        try {
            this.log('🚀 开始R2存储测试...');

            // 1. 测试CORS
            await this.testCORS();

            // 2. 测试文件上传
            const fileData1 = await this.testUpload();

            // 3. 测试文件下载
            await this.testDownload(fileData1);

            // 4. 测试第二次上传
            this.log('测试第二次文件上传...');
            const fileData2 = await this.testUpload();
            await this.testDownload(fileData2);

            this.log('🎉 所有R2存储测试通过！', 'success');
            this.log(`测试完成，上传了2个文件:`);
            this.log(`- 文件1: ${fileData1.fileId}`);
            this.log(`- 文件2: ${fileData2.fileId}`);

        } catch (error) {
            this.log(`测试失败: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// 主函数
async function main() {
    const tester = new SimpleR2Test();
    await tester.runAllTests();
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = SimpleR2Test; 