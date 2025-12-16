# 截图调整脚本快速使用

## 🚀 快速开始（3步）

### 方法 1：使用 npm 命令（推荐）

```bash
# 1. 将截图放到 screenshots/ 目录
mkdir -p screenshots
cp your-images/* screenshots/

# 2. 运行 npm 命令处理
npm run resize:screenshots

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
npm run resize:screenshots

# 小尺寸截图 (640x400)
npm run resize:screenshots-small

# Logo (300x300)
npm run resize:logo

# 小促销图 (440x280)
npm run resize:promo-small

# 大促销图 (1400x560)
npm run resize:promo-large

# 一次生成所有尺寸
npm run resize:all
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
npm run resize:logo -- --background=white

# 顶部对齐
npm run resize:screenshots -- --position=top

# 自定义背景色
npm run resize:screenshots -- --background=#F5F5F5

# 组合选项
npm run resize:logo -- --background=white --position=center
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

项目已配置以下便捷命令：

| 命令 | 说明 | 输出目录 |
|------|------|----------|
| `npm run resize:screenshots` | 商店截图 (1280x800) | `screenshots/store/` |
| `npm run resize:screenshots-small` | 小尺寸截图 (640x400) | `screenshots/small/` |
| `npm run resize:logo` | Logo (300x300) | `screenshots/logo/` |
| `npm run resize:promo-small` | 小促销图 (440x280) | `screenshots/promo-small/` |
| `npm run resize:promo-large` | 大促销图 (1400x560) | `screenshots/promo-large/` |
| `npm run resize:all` | 生成所有尺寸 | 所有子目录 |

### 高级用法示例

```bash
# 生成白色背景的 Logo
npm run resize:logo -- --background=white

# 生成顶部对齐的商店截图
npm run resize:screenshots -- --position=top

# 一次性生成所有格式（推荐用于发布前）
npm run resize:all
```
