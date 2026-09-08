# 抖音下载助手

Microsoft Edge / Chrome 浏览器扩展（Manifest V3）。在抖音网页版保存**当前这一条**视频，仅供个人学习使用。

- 版本：1.0.0
- 反馈邮箱：hangdudu0@agent.qq.com
- 仓库：https://github.com/snowflake-hangdudu/douyin-downloader

## 当前范围

- 支持单个视频页：`/video/{id}`、分享页、推荐流里点开后带 `modal_id` 的播放
- 右下角悬浮面板：标题 / 作者 / 清晰度 / 下载进度
- 输出 MP4；可单独保存封面
- 公共弹窗、公告、合作、评分入口沿用 `shared-download-kit`

**本版不做：** 用户页批量、合集、直播、图文笔记。

## 帮助与隐私

| 页面 | 链接 |
|------|------|
| 常见问题 | https://snowflake-hangdudu.github.io/douyin-downloader/faq.html |
| 隐私政策 | https://snowflake-hangdudu.github.io/douyin-downloader/ |

仓库推送后，在 GitHub → Settings → Pages 选 `main` 分支的 `/docs`，这两页就会上线。商店审核和面板底栏都走这两个地址。

## 本地加载

1. `chrome://extensions` 或 `edge://extensions`
2. 开启「开发者模式」
3. 「加载 unpacked」→ 选择本目录
4. 打开一条抖音视频后按 F5

## 本地检查

```bash
node --check lib/aweme-parse.js
node --check content/page-agent.js
node --check content/content.js
node --check background.js
node test/aweme-parse.test.mjs
```

## 打包

```bash
python scripts/pack.py
```
