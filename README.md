# Research Intelligence Portal

基于 Astro 的纯静态研究门户，用于公开展示私有 `fangshengshi/Research` 仓库中的 AI4S 与 BCI 周报。上游 Research 仓库保持原结构；同步过程只读检出并复制发布内容。

## 本地运行

```bash
npm install
npm run dev
```

构建验证：

```bash
npm run build
```

从本地 Research 仓库同步：

```bash
RESEARCH_SOURCE=/absolute/path/to/Research npm run sync
```

上游仓库根目录需要包含 `ai4s/` 与 `bci/`（同时兼容大写目录名）。每个目录内可保留原有层级、HTML 和图片；同步器递归复制发布所需的 HTML、样式、图片、字体和 PDF，不改写源文件，也不会把 Markdown、JSON 或脚本等内部材料带入公开仓库。若存在 `latest.html` 则保留；缺少时按文件名日期选择最新报告并生成入口。

## Cloudflare Pages 配置

在 Cloudflare Dashboard → Workers & Pages → Create application → Pages → Import an existing Git repository 中选择 `fangshengshi/Research-Web`：

| 项目 | 值 |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build directory | `dist` |
| Root directory | `/` |
| Node.js version | `24` |

本项目为纯静态输出，不需要 `@astrojs/cloudflare` adapter。`wrangler.jsonc` 同时保留了 Direct Upload / Wrangler 静态资源配置。

## 自动同步

公开仓库中的 `.github/workflows/sync-research.yml` 每周一 UTC 06:15 自动执行，也支持手动触发：

1. 在 GitHub 创建 fine-grained personal access token，仅授权 `fangshengshi/Research` 的 **Contents: Read-only**。
2. 在 `Research-Web` → Settings → Secrets and variables → Actions 新建 secret：`RESEARCH_REPO_TOKEN`。
3. 手动运行一次 **Sync private research**，确认同步提交和 Cloudflare Pages 构建均成功。

工作流会分别检出公开门户与私有 Research，执行只读复制、Astro 构建验证，并仅在报告内容变化时提交。Cloudflare Pages 的 Git 集成随后自动部署该提交。

如需周报提交后立即同步，可在私有仓库增加一个只负责触发 `Research-Web` `repository_dispatch` 的工作流；当前默认采用定时拉取，避免改动私有仓库结构。

## 内容与安全边界

- 发布到 `Research-Web` 的 HTML 与图片将变为公开内容；同步前需确保周报不含未公开信息。
- 报告在 sandboxed iframe 中展示；`public/_headers` 禁止报告脚本、表单与跨站资源，降低原始 HTML 带来的执行和追踪风险。
- 当前 manifest 已包含 `tags`、`date`、`format` 字段，后续可接入 Markdown 渲染、标签搜索与更丰富日期筛选。
- “导出 PDF”使用浏览器打印能力，适合纯静态部署。
