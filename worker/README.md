# Cloudflare Worker 配置

该 Worker 同时提供 Decap CMS 的 GitHub OAuth 回调和文章浏览量 API。

## 创建资源

1. 注册或登录 <https://dash.cloudflare.com/>。
2. 在项目根目录执行 `pnpm exec wrangler login`。
3. 本地调试时复制变量模板：`Copy-Item worker/.dev.vars.example worker/.dev.vars`，再填入真实值。
4. 创建数据库：`pnpm exec wrangler d1 create deep-thought-views`。
5. 把返回的 `database_id` 写入 `worker/wrangler.jsonc`。
6. 应用迁移：`pnpm exec wrangler d1 migrations apply deep-thought-views --remote --config worker/wrangler.jsonc`。

## GitHub OAuth App

在 <https://github.com/settings/developers> 创建 OAuth App：

- Homepage URL：Worker 部署后的 `workers.dev` 地址。
- Authorization callback URL：`https://<worker-address>/callback?provider=github`。

设置 Worker Secret：

```powershell
pnpm exec wrangler secret put GITHUB_OAUTH_ID --config worker/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_OAUTH_SECRET --config worker/wrangler.jsonc
pnpm exec wrangler secret put OAUTH_STATE_SECRET --config worker/wrangler.jsonc
pnpm exec wrangler secret put VIEW_HASH_SECRET --config worker/wrangler.jsonc
```

两个随机密钥建议各使用至少 32 字节随机值。

## 部署与网站配置

执行：

```powershell
pnpm worker:deploy
```

部署成功后：

1. 把 `public/admin/config.yml` 中 `base_url` 的占位地址替换成真实 Worker 地址。
2. 在 GitHub 仓库变量中添加 `PUBLIC_VIEWS_API`，值为同一个 Worker 地址。
3. 可选：查询 GitHub API 的个人资料 ID，并设置 Worker Secret `ALLOWED_GITHUB_ID`，以数字 ID 代替用户名校验。
