# GitHub Actions 工作流说明

本目录包含项目的 CI/CD 自动化工作流配置。

## 📋 工作流列表

### 1. `ci.yml` - 持续集成 (Continuous Integration)

**触发条件**：
- Pull Request 创建或更新
- 推送到 `main` 分支

**功能**：
- ✅ 运行测试套件（带覆盖率报告）
- ✅ TypeScript 类型检查
- ✅ ESLint 代码检查
- ✅ 验证构建成功

**用途**：确保所有代码变更通过质量检查，在合并前发现问题。

---

### 2. `release.yml` - 自动发布 (Automated Release)

**触发条件**：
- 推送符合 `v*.*.*` 格式的 Git 标签（如 `v0.1.0`）

**功能**：
- ✅ 运行完整的测试和质量检查
- ✅ 构建 Chrome 扩展
- ✅ 打包 ZIP 发布文件
- ✅ 生成变更日志
- ✅ 创建 GitHub Release

**用途**：自动化发布流程，生成可安装的扩展包。

---

## 🚀 使用方式

### 开发流程

```bash
# 1. 创建新分支
git checkout -b feature/my-feature

# 2. 提交代码
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature

# 3. 创建 Pull Request
# → CI 工作流自动运行，验证代码质量

# 4. 合并到 main
# → CI 工作流再次运行，确保 main 分支健康
```

### 发布新版本

```bash
# 1. 更新版本号
npm version patch  # 或 minor、major

# 2. 推送标签
git push origin main
git push origin --tags

# 3. 自动发布
# → Release 工作流自动运行
# → 生成 GitHub Release
# → 附加可安装的 ZIP 文件
```

---

## 📊 工作流状态

查看工作流执行状态：
- 访问仓库的 **Actions** 标签页
- 查看最近的工作流运行记录
- 点击具体运行查看详细日志

---

## 🔧 配置说明

### Node.js 版本

所有工作流使用 **Node.js 20**（LTS 版本）

如需更改，修改各工作流文件中的：
```yaml
env:
  NODE_VERSION: '20'
```

### 缓存策略

启用了 npm 缓存以加速构建：
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

### 并发控制

CI 工作流启用了并发控制，自动取消旧的运行：
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## 🛠️ 故障排查

### CI 失败

1. **查看日志**：点击失败的工作流查看详细错误
2. **本地重现**：按照相同步骤本地执行
   ```bash
   npm ci
   npm run test:coverage
   npm run typecheck
   npm run lint
   npm run build
   ```
3. **修复问题**：根据错误信息修复代码
4. **重新推送**：推送修复后会自动重新运行

### Release 失败

1. **检查标签格式**：必须是 `v*.*.*` 格式（如 `v0.1.0`）
2. **检查权限**：确保 GitHub Token 有 `contents: write` 权限
3. **查看日志**：检查构建、测试或打包步骤是否失败

---

## 📝 最佳实践

1. **频繁推送**：小步快跑，每次提交都经过 CI 验证
2. **遵循语义化版本**：使用 `npm version` 管理版本号
3. **编写测试**：提高测试覆盖率，保证代码质量
4. **及时修复**：CI 失败立即修复，不要累积问题

---

## 🔗 相关资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [发布流程指南](../RELEASE.md)
- [项目 README](../README.md)
