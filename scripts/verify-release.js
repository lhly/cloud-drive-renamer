#!/usr/bin/env node

/**
 * 本地发布验证脚本
 *
 * 功能：模拟 GitHub Actions Release 工作流，验证构建流程
 *
 * 执行步骤：
 * 1. 检查版本号一致性
 * 2. 运行测试套件
 * 3. 运行类型检查
 * 4. 运行代码检查
 * 5. 构建扩展
 * 6. 验证构建产物
 * 7. 创建 ZIP 发布包
 *
 * 使用方式：
 *   node scripts/verify-release.js
 *   npm run verify:release (如果添加到 package.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ESM 环境下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * 执行 shell 命令
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: 'inherit',
      ...options,
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}`);
  }
}

/**
 * 打印成功消息
 */
function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

/**
 * 打印错误消息
 */
function error(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

/**
 * 打印信息消息
 */
function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

/**
 * 打印步骤标题
 */
function step(title) {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}📍 ${title}${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(path.resolve(ROOT_DIR, filePath));
}

/**
 * 读取 JSON 文件
 */
function readJSON(filePath) {
  const fullPath = path.resolve(ROOT_DIR, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 主验证流程
 */
async function verifyRelease() {
  console.log('\n🚀 Starting Release Verification...\n');

  try {
    // ========================================
    // 步骤 1: 检查版本号一致性
    // ========================================
    step('Step 1: Version Consistency Check');

    const packageJson = readJSON('package.json');
    const manifest = readJSON('manifest.json');
    const version = packageJson.version;

    info(`package.json version: ${version}`);
    info(`manifest.json version: ${manifest.version}`);

    if (version !== manifest.version) {
      error('Version mismatch detected!');
      info('Running sync-version script...');
      exec('npm run sync:version');
      success('Versions synchronized');
    } else {
      success(`Versions are consistent: ${version}`);
    }

    // ========================================
    // 步骤 2: 运行测试
    // ========================================
    step('Step 2: Running Tests');

    try {
      exec('npm run test');
      success('All tests passed');
    } catch (err) {
      error('Tests failed');
      throw err;
    }

    // ========================================
    // 步骤 3: 类型检查
    // ========================================
    step('Step 3: Type Checking');

    try {
      exec('npm run typecheck');
      success('Type checking passed');
    } catch (err) {
      error('Type checking failed');
      throw err;
    }

    // ========================================
    // 步骤 4: 代码检查
    // ========================================
    step('Step 4: Linting');

    try {
      exec('npm run lint');
      success('Linting passed');
    } catch (err) {
      error('Linting failed');
      throw err;
    }

    // ========================================
    // 步骤 5: 构建扩展
    // ========================================
    step('Step 5: Building Extension');

    try {
      exec('npm run build');
      success('Build completed');
    } catch (err) {
      error('Build failed');
      throw err;
    }

    // ========================================
    // 步骤 6: 验证构建产物
    // ========================================
    step('Step 6: Verifying Build Artifacts');

    const requiredFiles = [
      'dist/manifest.json',
      'dist/icons/icon16.png',
      'dist/icons/icon48.png',
      'dist/icons/icon128.png',
    ];

    let allFilesPresent = true;
    for (const file of requiredFiles) {
      if (fileExists(file)) {
        info(`✓ ${file}`);
      } else {
        error(`✗ ${file} - Missing`);
        allFilesPresent = false;
      }
    }

    if (!allFilesPresent) {
      throw new Error('Some required files are missing');
    }

    success('All required files present');

    // 统计构建信息
    const distFiles = exec('find dist -type f | wc -l', { stdio: 'pipe' }).trim();
    const distSize = exec('du -sh dist', { stdio: 'pipe' })
      .trim()
      .split(/\s+/)[0];

    info(`Total files: ${distFiles}`);
    info(`Total size: ${distSize}`);

    // ========================================
    // 步骤 7: 创建 ZIP 包
    // ========================================
    step('Step 7: Creating Release ZIP');

    const zipFileName = `cloud-drive-renamer-${version}.zip`;
    const zipPath = path.resolve(ROOT_DIR, zipFileName);

    // 删除旧的 ZIP 文件
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      info('Removed old ZIP file');
    }

    // 创建新的 ZIP 文件
    try {
      exec(`cd dist && zip -r ../${zipFileName} .`);
      success(`Created ${zipFileName}`);

      // 显示 ZIP 文件信息
      const zipSize = exec(`ls -lh ${zipFileName}`, { stdio: 'pipe' })
        .trim()
        .split(/\s+/)[4];
      info(`ZIP size: ${zipSize}`);
    } catch (err) {
      error('Failed to create ZIP file');
      throw err;
    }

    // ========================================
    // 完成
    // ========================================
    console.log('\n' + '='.repeat(50));
    console.log(
      `${colors.green}✨ Release Verification Completed Successfully! ✨${colors.reset}`
    );
    console.log('='.repeat(50) + '\n');

    console.log(`${colors.cyan}📦 Release Package:${colors.reset} ${zipFileName}`);
    console.log(`${colors.cyan}📍 Version:${colors.reset} v${version}`);
    console.log(
      `${colors.cyan}📁 Location:${colors.reset} ${path.relative(process.cwd(), zipPath)}\n`
    );

    console.log(`${colors.yellow}🎉 Next Steps:${colors.reset}`);
    console.log('1. Test the extension manually:');
    console.log('   - Extract the ZIP file');
    console.log('   - Load unpacked extension in Chrome');
    console.log('   - Test on supported cloud drive websites\n');
    console.log('2. If everything works, create a release tag:');
    console.log(`   git tag v${version}`);
    console.log(`   git push origin v${version}\n`);
    console.log('3. GitHub Actions will automatically create the release\n');
  } catch (err) {
    console.log('\n' + '='.repeat(50));
    console.log(`${colors.red}❌ Release Verification Failed${colors.reset}`);
    console.log('='.repeat(50) + '\n');
    console.error(err.message);
    process.exit(1);
  }
}

// 执行验证
verifyRelease();
