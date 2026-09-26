# 商店图片资源

所有截图应来自真实抖音网页版与扩展 **1.0.2** 面板，不含生成式替换或虚构界面。建议准备 **单视频** 与 **列表下载** 各一张。

## 目标文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| `store-icon-128.png` | 128×128 | Chrome Web Store 图标 |
| `logo-300.png` | 300×300 | Microsoft Edge Add-ons 图标 |
| `screenshot-1280x800.png` | 1280×800 | 主截图（建议：单视频面板） |
| `screenshot-list-1280x800.png` | 1280×800 | 列表下载面板（合集 + 缩略图） |
| `screenshot-panel-1280x800.png` | 1280×800 | 面板特写 |
| `screenshot-640x400.png` | 640×400 | 备用截图 |
| `tile-440x280.png` | 440×280 | Chrome 小型宣传图 |
| `marquee-1400x560.png` | 1400×560 | Chrome 顶部宣传图 |

## 拍摄建议

### 单视频模式

1. 打开测试链接（搜索页弹窗或 `/video/` 页）
2. 播放几秒，右下角打开面板
3. 确保封面、标题、1080P/720P/540P、预计大小可见
4. 窗口宽度约 1400px，面板不被裁切

### 列表下载模式

1. 打开合集测试链接，播放并点开右侧「合集」标签
2. 面板切「列表下载」→「刷新列表」
3. 确保列表缩略图、勾选框、全选、刷新/下载按钮可见
4. 可勾选 1～2 集展示批量场景（不必真下载）

## 测试链接

见项目根目录 `测试链接.txt`：

- 单视频：`modal_id=7319527000799022388`
- 合集列表：`modal_id=7634880373175913755`

## 生成素材

1. 将原始截图保存为 `store/source-capture-single.png` 或 `store/source-capture-list.png`
2. 运行：

```powershell
cd D:\插件\下载类\douyin-downloader
python store/_format_store_assets.py single
python store/_format_store_assets.py list
python store/_format_store_assets.py icons
```

脚本会输出 1280×800 等标准尺寸，并从 `icons/icon128.png` 生成商店图标。
