# 商店上架资源（1.0.1）

本目录**不会**打进发布 zip，仅供开发者提交 Edge / Chrome / Firefox 商店时使用。

## 文档

| 文件 | 用途 |
|---|---|
| [EDGE_SUBMIT.md](EDGE_SUBMIT.md) | Microsoft Edge Add-ons 填写文案与审核备注 |
| [CHROME_SUBMIT.md](CHROME_SUBMIT.md) | Chrome Web Store 简要对照 |
| [FIREFOX_SUBMIT.md](FIREFOX_SUBMIT.md) | Firefox Add-ons 描述与权限 |
| [GITHUB_PAGES.md](GITHUB_PAGES.md) | 隐私政策 / FAQ 的 Pages 部署 |
| [SCREENSHOTS.md](SCREENSHOTS.md) | 截图尺寸与拍摄说明 |

## 已生成图标

运行 `python store/_format_store_assets.py icons` 后可用：

- `store-icon-128.png` — Chrome 商店图标
- `logo-300.png` — Edge 商店图标

## 截图（待补充）

1. 按 `SCREENSHOTS.md` 在真机截取 `source-capture-single.png`、`source-capture-list.png`
2. 运行：
   ```powershell
   python store/_format_store_assets.py single
   python store/_format_store_assets.py list
   ```

## 公开页面备份

与 `docs/` 同步，便于本地 diff：

- `privacy.html` ↔ `docs/index.html`
- `faq.html` ↔ `docs/faq.html`
