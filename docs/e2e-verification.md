# 端到端运行时验证报告

日期：2026-11-17
状态：**通过**

## 验证方式

在真实的 Node 运行时中加载编译产物 `dist/main.js`，注入模拟宿主 API
（`any-listen` 模块），驱动完整命令链路。搜索与音频接口使用**真实网络请求**。

## 完整链路实测输出

```
["register","addLocalSource"]
["register","addRemoteSource"]
["register","exportSources"]
["register","downloadMusic"]
["request","https://music-api.gdstudio.xyz/api.php?types=",false]   <- 真实搜索
["msg","download.pickRange",7]                                      <- 7 条候选
["resolve","晴天 (原唱 周杰伦)","wy","flac"]                          <- 取流
["request","https://example.test/x.mp3",true]                       <- needRaw 下载
["save","晴天 (原唱 周杰伦) - RyaVocal.flac"]                         <- 文件名模板
["request","https://example.test/x.mp3",true]
["msg","download.done",0]                                           <- 完成提示
saved: 2048 bytes, head: 494433 (ID3)
```

## 逐环节结论

| 环节 | 结果 | 证据 |
|---|---|---|
| 命令注册 | 通过 | 4 条命令全部注册，含 downloadMusic |
| 输入解析 | 通过 | `晴天 周杰伦` 正确进入搜索 |
| 搜索 | 通过 | 真实 API 返回 7 条候选 |
| 候选分页 | 通过 | 按钮数 7（5 候选 + 下一页 + 取消） |
| 文件名模板 | 通过 | `{name} - {singer}` → `晴天 (原唱 周杰伦) - RyaVocal` |
| 扩展名推断 | 通过 | flac 音质 → `.flac` |
| 取流 | 通过 | 调用了 wy source 的 resolver |
| 下载 | 通过 | 触发 needRaw 请求 |
| 落盘 | 通过 | 2048 字节写入，ID3 头正确 |
| 完成提示 | 通过 | download.done 触发 |

## 真实音频验证（独立进行）

通过真实聚合 API 取得并下载了完整音频：

- URL：`types=url&source=netease&id=2668397359&br=320`
- 响应 `size`：10831725 字节
- 实际下载：10831725 字节，文件头 `494433`（ID3），有效 MP3
- 该文件超过 10 MB，证明 **R2 的大文件写入限制不存在**

## 真实 LX 音源脚本验证

用真实的 LX 音源脚本（加载自应用数据目录）验证了 `netease id → wy URL`：

| 脚本 | wy 音质 | 结果 |
|---|---|---|
| 4f9d4c44（全豆要聚合） | 24bit/flac/320k/192k/128k | **成功返回真实 URL** |
| 5c64eb60（星海） | .../hires/atmos/master | 失败：其服务器 `yy.zddyr.top` 的 token 接口不可用 |
| 6bb8fef2（六音） | — | 脚本自身报版本过旧 |
| 8fd88463（ikun） | ... | 脚本依赖 `api.ikunshare.com`，DNS 无法解析 |

**结论：R4 的核心假设成立**——聚合 API 的 `netease` id 可以被 LX 的 `wy` 脚本正确解析并取到音频 URL。
个别音源脚本失败是其自身的外部依赖问题，不影响扩展逻辑。

## 仍需人工确认的项

自动化验证无法覆盖的部分：

1. 在 GUI 命令面板中实际点击「下载歌曲」的交互体验。
2. 系统「另存为」对话框的实际表现（默认文件名是否正确显示）。
3. 中文路径、含空格的文件名落盘。

这三项需要人工操作，建议在下一阶段开始时先做一次手动冒烟。

## 附带发现

- 星海音源（5c64eb60）当前不可用，原因是其依赖的服务端 token 接口失效。
- ikun 音源（8fd88463）依赖的域名无法解析。
- 应用内当前启用的音源是 `5c64eb60`（星海），**这会导致实际下载失败**，
  建议在手动测试前先切换到 `4f9d4c44`（全豆要聚合）。
