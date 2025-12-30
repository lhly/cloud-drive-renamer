# 截图调整脚本快速使用

## 🚀 快速开始（3步）

### 方法 1：使用 npm 命令（推荐）

```bash
# 1. 将截图放到 screenshots/ 目录
mkdir -p screenshots
cp your-images/* screenshots/

# 2. 运行 npm 命令处理（商店截图 1280x800）
npm run resize screenshot

# 3. 获取结果
ls screenshots/store/
```

### 方法 2：直接运行脚本

```bash
# 1. 将截图放到 screenshots/ 目录
mkdir -p screenshots
cp your-images/* screenshots/

# 2. 运行脚本处理
node scripts/resize-screenshots.js screenshot

# 3. 获取结果
ls screenshots/store/
```

## 📁 目录结构

处理后会自动生成如下结构：

```
screenshots/
├── your-image.png          # 原始文件
├── store/                 # 商店截图 (1280x800)
│   └── your-image.png
├── logo/                  # Logo (300x300)
├── promo-small/           # 小促销图 (440x280)
└── promo-large/           # 大促销图 (1400x560)
```

## 📖 常用命令

### npm 命令（推荐）

```bash
# 商店截图 (1280x800)
npm run resize screenshot

# 小尺寸截图 (640x400)
npm run resize screenshot-small

# Logo (300x300)
npm run resize logo

# 小促销图 (440x280)
npm run resize small-promo

# 大促销图 (1400x560)
npm run resize large-promo

# 一次生成所有尺寸（示例）
for preset in screenshot screenshot-small logo small-promo large-promo; do
  npm run resize $preset
done
```

### 直接运行脚本

```bash
# 商店截图 (1280x800)
node scripts/resize-screenshots.js screenshot

# Logo (300x300)
node scripts/resize-screenshots.js logo

# 小促销图 (440x280)
node scripts/resize-screenshots.js small-promo

# 大促销图 (1400x560)
node scripts/resize-screenshots.js large-promo

# 小尺寸截图 (640x400)
node scripts/resize-screenshots.js screenshot-small
```

## 🎨 高级选项

### 使用 npm 命令（参数传递）

```bash
# 白色背景
npm run resize logo -- --background=white

# 顶部对齐
npm run resize screenshot -- --position=top

# 自定义背景色
npm run resize screenshot -- --background=#F5F5F5

# 组合选项
npm run resize logo -- --background=white --position=center
```

### 直接运行脚本

```bash
# 白色背景
node scripts/resize-screenshots.js logo --background=white

# 顶部对齐
node scripts/resize-screenshots.js screenshot --position=top

# 自定义背景色
node scripts/resize-screenshots.js screenshot --background=#F5F5F5
```

## 📚 完整文档

查看 `docs/RESIZE_SCREENSHOTS_GUIDE.md` 获取完整使用指南。

## ✨ 可用的 npm 命令

项目已配置统一的 `npm run resize` 命令（通过参数选择预设）：

| 命令 | 说明 | 输出目录 |
|------|------|----------|
| `npm run resize screenshot` | 商店截图 (1280x800) | `screenshots/store/` |
| `npm run resize screenshot-small` | 小尺寸截图 (640x400) | `screenshots/small/` |
| `npm run resize logo` | Logo (300x300) | `screenshots/logo/` |
| `npm run resize small-promo` | 小促销图 (440x280) | `screenshots/promo-small/` |
| `npm run resize large-promo` | 大促销图 (1400x560) | `screenshots/promo-large/` |

### 高级用法示例

```bash
# 生成白色背景的 Logo
npm run resize logo -- --background=white

# 生成顶部对齐的商店截图
npm run resize screenshot -- --position=top
```
