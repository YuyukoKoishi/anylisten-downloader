# LX Music API Source Downloader

AnyListen 扩展：加载 LX Music 自定义源脚本，并按歌名搜索下载歌曲。

本扩展 fork 自 [any-listen-extension-lx-api-source-loader](https://github.com/any-listen/any-listen-extension-lx-api-source-loader)，
保留其全部音源加载能力，并增加「按歌名搜索 → 选择候选 → 下载」功能。
扩展 id 为 `lx-api-source-downloader`，可与原扩展同时安装。

## 安装

1. 打开 AnyListen → 扩展管理 → 本地安装
2. 选择构建产物 `build/lx-api-source-downloader_v0.1.0.alix`
3. 启用扩展，并**重启应用**

## 使用前准备

必须先启用至少一个 LX 音源脚本（在扩展设置页的「自定义源」中导入并勾选）。
没有可用音源脚本时，命令会提示「未启用音源脚本」。

## 下载歌曲

1. 打开命令面板（扩展命令入口）
2. 搜索并执行「扩展：下载歌曲」
3. 输入 `歌名 - 歌手`（例如 `晴天 - 周杰伦`），只有歌名也可以
4. 在弹出的候选列表中点选目标歌曲（每页 5 条，可翻页）
5. 在系统「另存为」对话框中选择保存位置

## 设置项

| 设置 | 说明 |
|---|---|
| 搜索 API 地址 | 用于搜索候选的聚合接口，默认 `https://music-api.gdstudio.xyz/api.php` |
| 搜索音源平台 | 搜索使用的平台（当前仅支持网易云） |
| 下载音质 | 请求音质，支持 `128K` / `320K` / `FLAC` / `FLAC 24bit` |
| 文件名模板 | 默认 `{name} - {singer}`，支持 `{name}` `{singer}` `{album}` `{quality}` `{source}` |

**注意**：实际取得的音质由音源脚本决定，可能低于请求值。
完成提示中显示的是**实际**音质。

## 已知限制

- 不支持「右键歌曲 → 下载」：宿主扩展系统没有 UI 注入点，只能通过命令面板触发。
- 搜索目前仅支持网易云：聚合 API 只接受 `source=netease` 与 `source=joox`，
  而 LX 音源脚本支持 `kw/kg/tx/wy/mg`，两者交集只有 `netease → wy`。
- 不支持批量下载、断点续传。
- 候选列表为原生对话框按钮形式，不是富文本列表。

## 开发

```bash
pnpm install
pnpm test                 # 运行单元测试
PRI_KEY="..." PUB_KEY="..." pnpm build   # 构建签名产物
```

构建需要签名密钥，详见 `docs/HANDOFF.md`。

## License

Apache License 2.0
