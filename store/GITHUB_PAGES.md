# GitHub Pages 托管隐私政策与 FAQ

Edge / Chrome 商店要求填写 **Privacy Policy URL**，用 GitHub Pages 免费托管 `docs/` 目录。

## 仓库与地址

- 仓库：`https://github.com/snowflake-hangdudu/douyin-downloader`
- 隐私政策：`https://snowflake-hangdudu.github.io/douyin-downloader/`
- 常见问题：`https://snowflake-hangdudu.github.io/douyin-downloader/faq.html`

扩展内面板底栏、popup、README 均指向上述 Pages URL，**不会**打进发布 zip。

## 开启 Pages

1. 打开仓库 **Settings** → **Pages**
2. Source：**Deploy from a branch**
3. Branch：**main** → 文件夹 **/docs** → **Save**
4. 等待 1～3 分钟，浏览器打开隐私政策链接验证

## 更新流程

1. 修改 `docs/index.html`、`docs/faq.html`
2. 同步备份到 `store/privacy.html`、`store/faq.html`（便于本地对照）
3. `git add docs/ store/privacy.html store/faq.html`
4. `git commit -m "Update privacy policy and FAQ"`
5. `git push`

Pages 会自动重新部署。

## 本地备份

| GitHub Pages 源文件 | store 备份 |
|---|---|
| `docs/index.html` | `store/privacy.html` |
| `docs/faq.html` | `store/faq.html` |

## 不想公开源码？

可另建仅含 `docs/` 的小仓库专门托管隐私页，再把商店 URL 指向该 Pages 地址。
