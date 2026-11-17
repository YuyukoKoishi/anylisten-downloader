# 已知问题与待优化项

日期：2026-11-17

## 已修复

### 1. 保存窗口错误地退化为文件夹选择器

**现象**：下载时弹出的是「选择文件夹」窗口，且路径框里自动填了
`歌名 - 歌手`，确认后提示「所选文件夹不存在」。

**根因**：调用 `showSaveDialog` 时传了 `canSelectFolder: true`。
宿主实现（`desktop/src/renderer/winMain/main.ts`）在该分支下改用
`dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`，
此时 `defaultFileName` 被当作 `defaultPath`，即「要进入的目录」，
而该目录并不存在。

此外 `writeSaveBoxFile(dir, name, content)` 的第一参数在 `saveDirs` 缓存中
查的是**目录**，拿到完整文件路径会查不到。

**修复**：去掉 `canSelectFolder`，改用真正的「另存为」文件窗口。
该模式返回完整文件路径，写入时 `name` 传空串，worker 会直接用该路径落盘。
完成提示显示的是**实际保存的文件名**（用户可能在对话框里改名）。

验证输出：

```
["saveDialog","canSelectFolder=false","晴天 (原唱 周杰伦) - RyaVocal.flac"]
dirArg : D:/.../晴天 - Jay.mp3   <- 完整文件路径
nameArg: ""                       <- 空串
```

---

## 待优化（非优先级）

### 2. 下载窗口弹出偏慢

**实测耗时分布**（从命令触发开始计时，单次下载）：

---

## 封面/歌词嵌入的真实可用性（R11 实测）

日期：2026-11-18

对应用内已安装的 LX 音源脚本逐个实测 `pic` 与 `lyric` 动作（id=2668397359）：

| 脚本 | pic | lyric | 说明 |
|---|---|---|---|
| `4f9d4c44` 全豆要聚合 | `action not support` | `action not support` | **唯一能取到音频 URL 的脚本，却不提供封面/歌词** |
| `5c64eb60` 星海 | `null` | `null` | 声明了动作但当前服务端失效 |
| `6bb8fef2` 六音 | 加载失败 | 加载失败 | 脚本自身版本过旧 |
| `8fd88463` ikun | 异常 | 异常 | 依赖域名 DNS 不可解析 |

### 结论

代码链路已完整实现并测试通过，但**当前环境的音源脚本实际取不到封面和歌词**。
用户会看到「未找到封面，已跳过」与「未找到歌词，已跳过」的提示，音频正常下载。

这不是扩展缺陷，而是音源脚本能力不足。要真正看到嵌入效果，需要换用同时支持
`musicUrl` / `pic` / `lyric` 且服务端可用的音源脚本，或等待现有脚本恢复。

### 已验证的部分

- 元数据写入本身正确：对真实 10.8 MB MP3 注入封面与歌词后，文件增长 2102 字节，
  末尾 64 KB 音频字节完全一致。
- 300 KB 上限、跳过提示、降级保存等分支均有测试覆盖。

### 手动验收建议

用 ffprobe 检查生成文件是否含内嵌元数据：

```bash
ffprobe -show_format -show_streams tagged.mp3 2>&1 | grep -i -E 'APIC|USLT|lyrics|cover'
```
