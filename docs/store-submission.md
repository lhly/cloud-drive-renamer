# 扩展商店送审

发布标签、等待 **Release** 工作流成功后，到仓库 **Actions → Extension Stores → Run workflow**。分支选 `main`，填写 Release 标签（如 `v2.0.3`）、目标商店（`both` / `chrome` / `edge`），然后选择：

- **`submit`**：下载一次 GitHub Release 上的 `cloud-drive-renamer-<版本号>.zip`，校验根目录 `manifest.json` 的版本号，并将原包交给所选商店。此模式只接受高于 `v2.0.2` 的版本。
- **`status`（默认）**：只查状态，不下载 ZIP，也不发上传或送审请求。Edge 需要填写之前工作流摘要里的 **Edge 提交审核操作 ID**（不是上传操作 ID）；查询旧版 Chrome 只需对应标签。

送审前检查后台没有需要保留的手工草稿。**送 Edge** 时还要确认 Partner Center 没有正在审核的版本或未处理的草稿，并勾选 `edge_clear`。Edge 的 API 直接更新当前草稿，无法先列出现有草稿。可选的 `edge_notes` 会发给审核员；不要填写账号、密码或密钥。

## 哪个状态代表已经送审

| 商店   | 到哪里看                          | 如何判断                                                                                                                                                                           |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome | Actions 运行摘要                  | 将目标版本与线上版本分开显示。目标版 `PENDING_REVIEW` 是待审；`STAGED` 是已通过、待你在 Chrome 后台发布；只有目标版显示 `PUBLISHED` 才是公开上架。工作流用 `STAGED_PUBLISH` 送审。 |
| Edge   | Actions 运行摘要 → Partner Center | API 操作 `Succeeded` 表示**已创建送审单**。查看 Partner Center 的对应版本确定 `In review` 或 `Live`；API 没有提供最终认证状态，也没有与 Chrome 相同的“审核通过后暂存”选项。        |

两家任务独立运行。一家失败时先看该任务摘要，不要重跑另一家。请求超时或状态未确认时，先用 `status` 或开发者后台查原提交，不要直接再次 `submit`。已有相同 Chrome 版本在审、待发布或已上线时，工作流不重复写入。新版本的 Edge 认证备注请在首次正式送审后顺手看一眼，确认 Partner Center 已收到。

## 一次性配置

在 GitHub 仓库 **Settings → Environments** 创建 `chrome-store` 和 `edge-store`，部署分支都只允许 `main`。如设必需审批人，保证实际有人能批（只有一位维护者时不要禁止自己审批）。下表的 Variables 和 Secrets 都放在**对应环境**，不要把密钥发到聊天或写进仓库。

### Chrome：绑定服务账号，用 OIDC 换短期令牌

1. 在 [Google Cloud](https://console.cloud.google.com/) 为发布流程选择项目，启用 **Chrome Web Store API**，并确认 IAM、Cloud Resource Manager、IAM Service Account Credentials、Security Token Service 这几个 API 已启用。创建专用服务账号，**不用下载 JSON 私钥**。
2. 在 [Chrome 开发者后台](https://chrome.google.com/webstore/devconsole/) 的 **Account** 中添加该服务账号邮箱；在 **Publisher → Settings** 复制 **Publisher ID**，它不是扩展 ID。若发布者已有绑定，先确认其用途，不要直接替换。Google 每个发布者只能绑定一个服务账号。
3. 按 [Google 的 GitHub Actions 配置指南](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) 建立 Workload Identity Pool 和 GitHub OIDC Provider。Issuer 是 `https://token.actions.githubusercontent.com`，属性映射填写 `google.subject=assertion.sub` 和以下四项。Audience 保留默认值。

   ```text
   attribute.repository_id=assertion.repository_id
   attribute.ref=assertion.ref
   attribute.workflow_ref=assertion.workflow_ref
   attribute.environment=assertion.environment
   ```

   Provider 的属性条件直接用这段（`1117325395` 是本仓库的数字 ID）：

   ```text
   assertion.repository_id == '1117325395' &&
   assertion.ref == 'refs/heads/main' &&
   assertion.workflow_ref == 'lhly/cloud-drive-renamer/.github/workflows/store-submit.yml@refs/heads/main' &&
   assertion.environment == 'chrome-store'
   ```

   在该服务账号上，把 **Workload Identity User**（`roles/iam.workloadIdentityUser`）授予此池的仓库主体：

   ```text
   principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/attribute.repository_id/1117325395
   ```

4. 在 GitHub 的 `chrome-store` 环境添加三个 **Variables**：

   | 名称                     | 值                                                                                                                |
   | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
   | `CHROME_WIF_PROVIDER`    | Provider 资源全名：`projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID` |
   | `CHROME_SERVICE_ACCOUNT` | 第 1 步服务账号的邮箱                                                                                             |
   | `CHROME_PUBLISHER_ID`    | Chrome 后台的 Publisher ID                                                                                        |

### Edge：生成 Publish API 凭据

1. 在 [Partner Center](https://partner.microsoft.com/dashboard) 的 **Microsoft Edge → Publish API** 启用 [v1.1 API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api?tabs=v1-1)，创建 **Client ID** 和 **API Key**，记下 Key 的到期日。
2. 打开现有扩展的 **Extension overview → Extension identity**，复制 **Product ID**（GUID，不是公开商店的 CRX ID）。
3. 在 GitHub 的 `edge-store` 环境把 `EDGE_CLIENT_ID` 和 `EDGE_PRODUCT_ID` 添加为 **Variables**，把 `EDGE_API_KEY` 添加为 **Secret**。

配置后，可先选 `chrome` / `status` 查询 `v2.0.2`，只验证凭据和条目归属。Edge 没有不依赖操作 ID 的状态接口；现有手工提交仍到 Partner Center 看。首次真实送审请选下一个已发布的新版本。

## 本地模拟

```sh
pnpm exec vitest run tests/release/store-release.test.js
```

测试生成临时 ZIP，使用假凭据、假商店响应；不读真实商店凭据，不发商店请求。
