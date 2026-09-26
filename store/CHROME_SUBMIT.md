# Chrome Web Store 上架填写参考（1.0.2）

## 打包

```powershell
cd D:\插件\下载类\douyin-downloader
python scripts/pack.py
```

上传：`douyin-downloader-chrome.zip`

## 必填链接

| 项 | URL |
|---|---|
| Privacy policy | https://snowflake-hangdudu.github.io/douyin-downloader/ |
| Official URL（可选） | 同上 |

## 单一用途说明（Single purpose）

与 Edge 相同，见 `EDGE_SUBMIT.md` → Single purpose 段落。

## 权限说明

Chrome 逐项填写时可参考 `EDGE_SUBMIT.md` 中 Host permission justification。

## 商店描述

与 Edge 相同，见 `EDGE_SUBMIT.md` → 商店描述。

## 截图与图标

| 资源 | 文件 |
|---|---|
| 商店图标 128×128 | `store/store-icon-128.png` |
| 截图 1280×800 | `store/screenshot-1280x800.png` |
| 列表模式截图 | `store/screenshot-list-1280x800.png` |
| 小型宣传图 440×280 | `store/tile-440x280.png` |
| 顶部宣传图 1400×560 | `store/marquee-1400x560.png` |

生成方法见 `SCREENSHOTS.md`。

## 审核备注

Chrome 若要求测试说明，粘贴 `EDGE_SUBMIT.md` 底部英文 **Notes for certification** 全文。

## 数据使用

- 不收集用户数据
- 不使用远程代码（配置站仅静态 JSON）
