# Microsoft Edge Add-ons 上架填写参考（1.0.2）

## 提交前检查

- 项目根目录运行 `python scripts/pack.py`，上传 **`douyin-downloader-chrome.zip`**；不要提交源码目录。
- Firefox 另用 `python scripts/pack_firefox.py` 生成 xpi。
- 上传前确认 `manifest.json` 版本为 **`1.0.2`**。
- 隐私政策：https://snowflake-hangdudu.github.io/douyin-downloader/
- 常见问题：https://snowflake-hangdudu.github.io/douyin-downloader/faq.html
- 商店截图见 `store/SCREENSHOTS.md`（需先拍真机图并运行 `_format_store_assets.py`）。

## Properties（属性）

| 项 | 填写 |
|---|---|
| Category | **Productivity**（生产力）。没有则选 **Tools** / 工具 |
| Website | `https://snowflake-hangdudu.github.io/douyin-downloader/` |
| Support contact detail | `hangdudu0@agent.qq.com` |
| Mature content | **不要勾选** |

## Privacy（隐私）

- Remote code：选 **No, I am not using remote code**
- Data collection：全部 **不勾选**
- Certifications：Privacy / Single purpose / Data usage 三项 **全部勾选**
- Privacy Policy URL：`https://snowflake-hangdudu.github.io/douyin-downloader/`

## Single purpose

```text
抖音视频下载助手帮助用户在抖音网页版，将当前已经加载、且用户有权保存的公开视频与封面保存到本地，供个人学习使用。支持单条视频与合集列表下载；仅在用户主动点击时工作；不绕过登录、付费、私密限制或 DRM，不收集用户数据。
```

## 权限说明

**activeTab**：识别用户当前打开的抖音视频页或弹窗播放页。

**downloads**：通过浏览器下载管理器保存用户主动选择的 MP4 与封面文件。

**storage**：仅在本地保存公告缓存、下载偏好与评分状态，不上传用户数据。

**declarativeNetRequest**：为封面等资源补充页面同源 Referer，避免防盗链导致图片失败。

**Host permission justification**（整段粘贴）

```text
douyin.com / iesdouyin.com：仅在视频页或弹窗播放页读取已经加载的标题、作者、清晰度、合集列表与封面，用于展示下载面板。
douyinvod.com、douyinpic.com、byteimg.com 等 CDN：在用户主动点击下载后，保存当前页面已暴露、可公开访问的视频或封面文件。
124.222.62.190:8081：仅 GET 一份公开 JSON，用于公告、合作说明和评分开关；不执行远程脚本。
不访问用户账号、私信或其他网站。
```

**Remote code justification**（选 No 后若仍要填）

```text
不使用远程代码。所有脚本都打在扩展包内。配置站只返回静态 JSON 文本，不加载、不执行外部 JS 或 Wasm，也不使用 eval。
```

## 商店描述

```text
抖音视频下载助手可在抖音网页版保存当前已经加载的公开视频、封面与合集列表。

主要功能：
• 单视频：识别标题、封面与常用清晰度（1080P / 720P / 540P），保存 MP4
• 合集列表：切换「列表下载」，勾选多集后依次保存；列表含缩略图
• 右下角悬浮面板：下载进度可暂停、继续或取消
• 单独下载封面；打开浏览器下载记录
• 完全免费，不收集、不上传任何用户数据

使用方法：打开抖音单个视频或搜索页点开一条视频，点击右下角悬浮按钮，选择清晰度后保存。合集需先打开页面右侧「合集」标签，再在面板刷新列表。

仅供个人学习。请仅保存自己拥有版权或已获授权的内容，并遵守平台规则。
反馈邮箱：hangdudu0@agent.qq.com
```

## Store listings 搜索词（逐条 Add，最多 7 条）

```
抖音下载
抖音视频下载
douyin
视频下载
合集下载
保存视频
MP4
```

## 图片

优先上传 `screenshot-1280x800.png`（单视频）与 `screenshot-list-1280x800.png`（列表下载）；图标使用 `logo-300.png`。完整列表见 `SCREENSHOTS.md`。

## 提交页（Submit）

- Does a tester need credentials…：选 **No**
- Notes for certification：粘贴下面英文全文

## 审核备注（英文）

```text
No account, password, or China phone number is required. Please test on public Douyin web video pages in a desktop browser.

Sample public pages (refresh once after install):
1) Single video (search modal):
   https://www.douyin.com/search/%E4%B8%9C%E4%BA%AC%E7%88%B1%E6%83%85%E6%95%85%E4%BA%8B%E5%85%A8%E5%89%A7%E8%A7%A3%E8%AF%B4?modal_id=7319527000799022388&type=general
2) Collection list (open the "合集" tab on the right, then use List Download in the panel):
   https://www.douyin.com/search/%E4%B8%9C%E4%BA%AC%E7%88%B1%E6%83%85%E6%95%85%E4%BA%8B%E5%85%A8%E5%89%A7%E8%A7%A3%E8%AF%B4?modal_id=7634880373175913755&type=general

How to test — single video:
1. Install the extension and refresh the page (F5).
2. Primary UI: floating button at the bottom-right (not the toolbar popup).
3. Play a few seconds, open the panel, pick 1080P or 720P, click download.
4. Expected: browser saves an MP4 to the default download folder; cover thumbnail matches the page.

How to test — collection list:
1. On sample page 2, play the video and click the "合集" tab on the right sidebar.
2. Open the panel → switch to "列表下载" → click "刷新列表".
3. Select 1–2 episodes and click "下载已选视频".
4. Expected: sequential MP4 downloads; list rows show thumbnails.

Limits: only media already loaded and publicly reachable. Does not unlock paid, private, login-gated, or live streams. No remote code, analytics, or user-data collection.

Privacy: https://snowflake-hangdudu.github.io/douyin-downloader/
FAQ: https://snowflake-hangdudu.github.io/douyin-downloader/faq.html
Contact: hangdudu0@agent.qq.com
```
