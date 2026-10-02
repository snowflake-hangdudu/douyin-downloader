# 抖音视频下载助手 - douyin

Microsoft Edge / Chrome 扩展（Manifest V3），保存当前浏览器可访问的视频、封面与合集列表。版本 1.0.3。

- 仓库：https://github.com/snowflake-hangdudu/douyin-downloader
- 验收：[docs/validation-2026-09-14.md](docs/validation-2026-09-14.md)

## 功能

- 识别 `/video/{id}`、分享页，以及精选/推荐中带 `modal_id` 的视频。
- 合集：作品含合集时显示「单视频 / 列表下载」Tab（样式对齐 B 站下载助手）；可勾选多集后依次保存 MP4。若列表不全，请先打开页面右侧「合集」标签。
- 清晰度仅展示页面实际提供且高于 360P 的档位；若页面只提供低清片源，则保留低清兜底；同档位优先兼容性较好的 H.264。
- 浏览器直接保存 MP4 到默认下载目录；默认使用视频标题命名，可在「设置」中选择主题并自定义文件名模板。
- 显示实际接收字节、暂停/继续、取消；网络中断自动尝试备用地址。
- 仅浏览器报告完成后显示保存成功；磁盘满、用户取消、安全拦截不会自动重试。
- 单独下载封面，按地址所指格式使用 jpg/png/webp/avif 后缀。
- 打开浏览器下载记录入口。
- 页面切换不会把正在下载的作品标题和历史记录改成下一条。
- 公告、合作、设置与反馈入口位于页面面板；常见问题和隐私政策入口位于扩展弹窗。

暂停后是否可续传取决于服务器和浏览器。

浏览器接管的下载可在关闭/刷新页面后继续。刷新后的面板不会接管上次页面的任务卡；请到浏览器下载记录管理。面板历史仅记录页面保持打开期间确认完成的任务，浏览器下载记录是完整记录。

本版不支持用户页批量、直播、图文笔记，也不绕过登录、付费或私密限制。

## 本地加载 / 更新

1. 打开 `edge://extensions`（Chrome 使用 `chrome://extensions`）。
2. 已加载本目录时，点击「抖音视频下载助手 - douyin」的重新加载；首次开发加载选择本目录。
3. 回到抖音视频页按 F5，打开右下角面板，确认版本为 **1.0.3**。
4. 选择清晰度并下载；以浏览器完成状态和实际文件为准。

## 开发验证

```powershell
npm.cmd ci --ignore-scripts
npm.cmd test
node --check background.js
node --check content/content.js
node --check content/page-agent.js
git diff --check
```

jsdom 仅用于测试，不进入扩展运行时。测试覆盖解析、后台消息、下载生命周期与面板交互。测试替身不能代替真实 Edge/CDN 验收，见 [验证记录](docs/validation-2026-09-14.md)。

## 发布打包

```powershell
python scripts/pack.py          # douyin-downloader-chrome.zip（Edge / Chrome）
python scripts/pack_firefox.py  # douyin-downloader-firefox.xpi
```

打包会自动关闭调试区。商店填写文案、截图规范见 `store/` 目录。

## 帮助

- [常见问题](https://snowflake-hangdudu.github.io/douyin-downloader/faq.html)
- [隐私政策](https://snowflake-hangdudu.github.io/douyin-downloader/)
- 反馈：hangdudu0@agent.qq.com

GitHub Pages 托管说明见 [store/GITHUB_PAGES.md](store/GITHUB_PAGES.md)。推送 `docs/` 后商店链接即可生效。
