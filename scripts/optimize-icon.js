#!/usr/bin/env node

/**
 * SVG Icon Optimizer
 * 移除空白画布,让图标元素充满整个显示区域
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const iconPath = path.join(__dirname, '../public/icons/icon.svg');

console.log('🔍 读取 SVG 文件...');
const svgContent = fs.readFileSync(iconPath, 'utf-8');

console.log('📐 分析路径坐标...');

// 提取所有路径的 d 属性
const pathRegex = /<path[^>]*d="([^"]*)"/g;
let match;
const paths = [];

while ((match = pathRegex.exec(svgContent)) !== null) {
  paths.push(match[1]);
}

console.log(`   找到 ${paths.length} 个路径元素`);

// 解析坐标，提取所有数字
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;

paths.forEach(pathData => {
  // 提取所有数字（包括负数和小数）
  const coords = pathData.match(/-?\d+\.?\d*/g);
  
  if (coords) {
    for (let i = 0; i < coords.length - 1; i += 2) {
      const x = parseFloat(coords[i]);
      const y = parseFloat(coords[i + 1]);
      
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
});

console.log(`\n📊 边界框计算结果:`);
console.log(`   X 范围: ${minX.toFixed(1)} ~ ${maxX.toFixed(1)}`);
console.log(`   Y 范围: ${minY.toFixed(1)} ~ ${maxY.toFixed(1)}`);

const contentWidth = maxX - minX;
const contentHeight = maxY - minY;

console.log(`   内容尺寸: ${contentWidth.toFixed(1)} × ${contentHeight.toFixed(1)}`);
console.log(`   原始画布: 800 × 800`);
console.log(`   内容占比: ${(contentWidth / 800 * 100).toFixed(1)}% × ${(contentHeight / 800 * 100).toFixed(1)}%`);

// 添加 5% 的内边距
const padding = Math.max(contentWidth, contentHeight) * 0.05;
const paddedMinX = minX - padding;
const paddedMinY = minY - padding;
const paddedWidth = contentWidth + padding * 2;
const paddedHeight = contentHeight + padding * 2;

// 确保是正方形（取最大值）
const size = Math.max(paddedWidth, paddedHeight);
const centerX = minX + contentWidth / 2;
const centerY = minY + contentHeight / 2;
const finalMinX = centerX - size / 2;
const finalMinY = centerY - size / 2;

console.log(`\n✨ 优化后参数:`);
console.log(`   viewBox: "${finalMinX.toFixed(1)} ${finalMinY.toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}"`);
console.log(`   内边距: ${padding.toFixed(1)} 单位 (5%)`);
console.log(`   保持比例: 1:1 (正方形)`);

// 替换 viewBox
const newViewBox = `viewBox="${finalMinX.toFixed(1)} ${finalMinY.toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}"`;
const optimizedSvg = svgContent.replace(/viewBox="[^"]*"/, newViewBox);

// 备份原文件
const backupPath = iconPath.replace('.svg', '.backup.svg');
fs.writeFileSync(backupPath, svgContent);
console.log(`\n💾 已备份原文件: ${path.basename(backupPath)}`);

// 写入优化后的文件
fs.writeFileSync(iconPath, optimizedSvg);
console.log(`✅ 已保存优化后的文件: ${path.basename(iconPath)}`);

console.log(`\n🎉 优化完成！`);
console.log(`\n预期效果:`);
console.log(`  - 图标元素将充满整个显示区域`);
console.log(`  - 在浏览器扩展栏中显示更大、更清晰`);
console.log(`  - 内容填充率从 ~40% 提升到 ~90%`);
console.log(`\n如需恢复原文件，请运行:`);
console.log(`  cp ${backupPath} ${iconPath}`);
