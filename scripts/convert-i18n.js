/**
 * 将 Chrome Extension messages.json 格式转换为纯 JSON 翻译文件
 *
 * 输入: _locales/{locale}/messages.json (Chrome Extension 格式)
 * 输出: src/locales/{locale}.json (简化格式)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../_locales');
const OUTPUT_DIR = path.join(__dirname, '../src/locales');

const SUPPORTED_LANGUAGES = ['zh_CN', 'zh_TW', 'en'];

console.log('🔄 Starting i18n conversion...\n');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('✅ Created output directory:', OUTPUT_DIR);
}

let totalKeys = 0;
const conversionResults = [];

for (const locale of SUPPORTED_LANGUAGES) {
  const inputFile = path.join(LOCALES_DIR, locale, 'messages.json');
  const outputFile = path.join(OUTPUT_DIR, `${locale}.json`);

  try {
    console.log(`📖 Processing ${locale}...`);

    // 读取 Chrome Extension 格式的 messages.json
    const messagesData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

    // 转换为简化格式 { key: message }
    const translations = {};
    let keyCount = 0;

    for (const [key, value] of Object.entries(messagesData)) {
      if (value && typeof value === 'object' && value.message) {
        translations[key] = value.message;
        keyCount++;
      }
    }

    totalKeys = keyCount; // 所有语言应该有相同数量的键

    // 写入输出文件（美化格式）
    fs.writeFileSync(
      outputFile,
      JSON.stringify(translations, null, 2),
      'utf-8'
    );

    conversionResults.push({
      locale,
      keyCount,
      outputFile,
      success: true,
    });

    console.log(`  ✅ Converted ${keyCount} keys`);
    console.log(`  📄 Output: ${path.relative(process.cwd(), outputFile)}`);
  } catch (error) {
    console.error(`  ❌ Failed to convert ${locale}:`, error.message);
    conversionResults.push({
      locale,
      success: false,
      error: error.message,
    });
  }
}

console.log('\n📊 Conversion Summary:');
console.log('─'.repeat(50));
for (const result of conversionResults) {
  if (result.success) {
    console.log(`✅ ${result.locale}: ${result.keyCount} keys`);
  } else {
    console.log(`❌ ${result.locale}: ${result.error}`);
  }
}
console.log('─'.repeat(50));
console.log(`\n✨ Conversion completed! Total keys: ${totalKeys}`);
