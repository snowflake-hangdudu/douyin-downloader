# 1.0.0 功能验收记录（2026-09-14）

## 自动化测试

```powershell
npm.cmd test
```

结果：**31/31 通过**（解析、后台消息、下载生命周期、面板交互、合集列表、封面逻辑）。

## 已完成功能

| 模块 | 状态 |
|---|---|
| 单视频识别（/video/、modal_id、搜索弹窗） | 通过 |
| 清晰度 1080P / 720P / 540P | 通过 |
| 封面展示与下载（卡片匹配优先） | 通过 |
| 合集「列表下载」Tab | 通过 |
| 列表缩略图 + 勾选批量下载 | 通过 |
| 暂停 / 继续 / 取消 | 通过 |
| 浏览器下载记录入口 | 通过 |
| 公告 / 合作 / FAQ / 隐私链接 | 通过 |

## 测试链接

见 `测试链接.txt`：

- 单视频：`modal_id=7319527000799022388`
- 合集列表：`modal_id=7634880373175913755`

## 发布资源

| 资源 | 路径 |
|---|---|
| Chrome / Edge zip | `douyin-downloader-chrome.zip`（`python scripts/pack.py`） |
| Firefox xpi | `douyin-downloader-firefox.xpi`（`python scripts/pack_firefox.py`） |
| 隐私政策 Pages | https://snowflake-hangdudu.github.io/douyin-downloader/ |
| FAQ Pages | https://snowflake-hangdudu.github.io/douyin-downloader/faq.html |
| 商店填写 | `store/EDGE_SUBMIT.md` 等 |
| 商店截图 | `store/SCREENSHOTS.md`（待拍真机图） |

## 待人工验收（商店提交前）

1. Edge / Chrome 加载 zip，确认版本 **1.0.0**，调试区已关闭。
2. 单视频：样本页下载 MP4，核对封面、播放与文件名。
3. 合集：刷新列表 31 集、缩略图、勾选 2 集串行下载。
4. 拍截图并运行 `python store/_format_store_assets.py`，上传商店。
5. push `docs/` 后确认 GitHub Pages 可访问。
