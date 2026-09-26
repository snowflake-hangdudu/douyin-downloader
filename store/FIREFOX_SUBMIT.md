# Firefox 上架填写参考（1.0.2）

## 打包

```powershell
cd D:\插件\下载类\douyin-downloader
python scripts/pack_firefox.py
```

生成：`douyin-downloader-firefox.xpi`

## 入口

- 开发者后台：https://addons.mozilla.org/developers/

## 描述页

**名称**：从包内读取（抖音视频下载助手 - douyin）

**概述（Summary，≤250 字）**

```text
在抖音网页版保存已加载的公开视频、封面与合集列表。支持单视频与批量列表下载，不收集用户数据。
```

**描述（Description）**

```text
在抖音网页版保存当前已经加载的公开视频、封面与合集列表。

## 主要功能
- 单视频：识别封面、标题与 1080P / 720P / 540P，保存 MP4
- 合集：「列表下载」勾选多集依次保存，列表含缩略图
- 下载可暂停、继续或取消；可单独保存封面
- 完全免费，不收集用户数据

## 使用方法
1. 打开抖音单个视频或搜索页点开一条视频
2. 点击页面右下角悬浮按钮（非工具栏弹窗）
3. 选择清晰度后保存；合集需先打开页面「合集」标签再刷新列表

## 限制
不支持用户页批量、直播、图文笔记；不绕过登录、付费或私密限制。

反馈：hangdudu0@agent.qq.com
隐私政策：https://snowflake-hangdudu.github.io/douyin-downloader/
常见问题：https://snowflake-hangdudu.github.io/douyin-downloader/faq.html
```

## 隐私与权限

- Data collection：**None**
- 隐私政策 URL：https://snowflake-hangdudu.github.io/douyin-downloader/

## 测试说明（Notes to reviewer）

粘贴 `EDGE_SUBMIT.md` 底部英文 **Notes for certification** 全文。

## 图标与截图

- 图标：128×128（可用 `store/store-icon-128.png`）
- 截图：至少 1 张 1280×800，建议含列表下载面板
