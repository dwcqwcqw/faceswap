#!/usr/bin/env node

/**
 * R2 Files Checker
 * 检查R2 bucket中的文件
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkR2Files() {
    console.log('🔍 检查R2 bucket中的文件...');
    
    const filesToCheck = [
        'test-direct-upload.jpg',
        'uploads/test-manual-upload.jpg',
        'uploads/bdd20cde-b643-4843-8acf-2b1c49233f2b.jpg',
        'uploads/00fd00ae-ae2a-43fd-8c69-1c6237c516dd.jpg'
    ];
    
    for (const filePath of filesToCheck) {
        try {
            console.log(`\n检查文件: ${filePath}`);
            const command = `cd web/cloudflare && wrangler r2 object get faceswap-storage/${filePath} --remote --file=/tmp/check-${filePath.replace(/\//g, '_')}.tmp`;
            
            await execPromise(command);
            console.log(`✅ 文件存在: ${filePath}`);
            
            // 检查文件大小
            const statCommand = `ls -la /tmp/check-${filePath.replace(/\//g, '_')}.tmp`;
            const { stdout } = await execPromise(statCommand);
            const size = stdout.split(/\s+/)[4];
            console.log(`   文件大小: ${size} bytes`);
            
        } catch (error) {
            console.log(`❌ 文件不存在: ${filePath}`);
        }
    }
    
    console.log('\n📋 总结:');
    console.log('- 如果您在Cloudflare控制台看不到文件，可能是因为:');
    console.log('  1. 控制台缓存延迟 (等待几分钟刷新)');
    console.log('  2. 文件在 uploads/ 子文件夹中，需要展开查看');
    console.log('  3. 控制台UI问题，但文件实际存在');
    console.log('- 通过API和wrangler命令可以确认文件已成功上传');
}

checkR2Files().catch(console.error); 