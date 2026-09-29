# 深度思考

t08 的技术、学习与思考记录。网站使用 Astro、Decap CMS、Three.js WebGPU/TSL、Pagefind 与 GitHub Pages 构建。

完整设计见 [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md)。

## 本地开发

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm dev
```

生产构建：

```powershell
pnpm build
pnpm preview
```

## 内容

- `src/content/posts/`：公开文章。
- `src/content/archive/`：旧知识归档，不生成公开页面。
- `public/uploads/`：图片和附件。
- `/admin/`：Decap CMS 内容后台。

## 3D 小老虎

- `assets/tiger/tiger.blend`：可直接在 Blender 中继续编辑的源文件。
- `public/models/tiger.glb`：网站实际加载的模型。
- `scripts/generate-tiger.py`：从零生成模型、合并静态网格、渲染预览并导出 GLB。

重新生成：

```powershell
blender --background --python scripts/generate-tiger.py
```

## 发布

推送到 `master` 后，GitHub Actions 会校验并部署到 GitHub Pages。首次上线前需要在仓库的 **Settings → Pages** 中把 Source 设置为 **GitHub Actions**。

在线后台与浏览量还需要完成 [worker/README.md](./worker/README.md) 中的 Cloudflare 配置。
