# 🚀 CI/CD 快速入门

> **新增功能**: 项目现已配置完整的自动化发布系统！

## ⚡ 3 步发布新版本

```bash
# 1️⃣ 更新版本号
npm version patch   # 修复: 0.1.0 → 0.1.1
npm version minor   # 新功能: 0.1.0 → 0.2.0
npm version major   # 重大更新: 0.1.0 → 1.0.0

# 2️⃣ 推送标签到 GitHub
git push origin main
git push origin --tags

# 3️⃣ 等待自动发布完成（约 3-5 分钟）
# ✅ 完成！访问 GitHub Releases 页面下载
```

## 🧪 发布前本地验证

```bash
# 运行完整的发布验证流程
pnpm run verify:release

# 包含：测试 + 类型检查 + 代码检查 + 构建 + 打包
```

## 📚 详细文档

- **[RELEASE.md](../RELEASE.md)** - 完整的发布流程指南
- **[.github/workflows/README.md](./workflows/README.md)** - 工作流配置说明

## 🎯 自动化功能

- ✅ 自动运行测试和质量检查
- ✅ 自动构建 Chrome 扩展
- ✅ 自动创建 GitHub Release
- ✅ 自动生成变更日志
- ✅ 自动打包 ZIP 文件供下载

## 🔄 开发工作流

```bash
# 创建新分支
git checkout -b feature/my-feature

# 提交代码
git commit -m "feat: add new feature"
git push origin feature/my-feature

# 创建 Pull Request
# → CI 自动运行，验证代码质量 ✅
```

---

**需要帮助？** 查看 [RELEASE.md](../RELEASE.md) 获取详细指南和故障排查。
