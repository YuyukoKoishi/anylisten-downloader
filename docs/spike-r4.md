# Spike R4 结论：聚合 API 的平台支持能力

日期：2026-11-17
结论状态：**已推翻计划中的五平台假设，需按本文件调整**

## 背景

计划 Task 3 要求验证「聚合 API 返回的 id 能否驱动 LX 音源脚本取到 URL」。
由于扩展内调试命令需要安装到 AnyListen 并手动操作，本 spike 改为**直接探测 API 侧能力**，
先确认 API 究竟支持哪些平台 —— 这是整条链路的前置条件。

## 探测方法

对 `https://music-api.gdstudio.xyz/api.php?types=search` 逐个传入候选 source 名，
重复多次以区分「Cloudflare 限流（503）」和「平台不支持（JSON 拒绝）」。

被探测的 source 名（共 35 个）：
netease, tencent, kugou, kuwo, migu, joox, baidu, ximalaya, qobuz, tidal, deezer,
youtube, ytmusic, spotify, apple, pel, gdstudio, suno, kuwomusic, qqmusic,
neteasecloud, music163, neteasecloudmusic, wyy, qq, tx, kw, 等。

## 结果

| source | 结果 | 判定 |
|---|---|---|
| `netease` | 返回正常 JSON 数组 | **支持** |
| `joox` | 返回正常 JSON 数组 | **支持** |
| `tencent` | `{"detail":"Value of `source` is not supported."}` | 不支持 |
| `kugou` | 同上 | 不支持 |
| `kuwo` | 同上 | 不支持 |
| `migu` | 同上 | 不支持 |
| 其余 29 个 | 同上 | 不支持 |

「不支持」是**确定性响应**，多次重试结果一致，与 Cloudflare 的 503 有本质区别。
503 是瞬时限流，等待后重试即可恢复。

## 对方案的影响（关键）

LX 音源脚本只支持 5 个平台：`kw`(酷我) / `kg`(酷狗) / `tx`(QQ) / `wy`(网易云) / `mg`(咪咕)。
聚合 API 只支持 `netease` 和 `joox`。

两者交集只有 **`netease` → `wy`** 一条路。

`joox` 虽然 API 支持，但 LX 侧没有对应平台，取不到 URL，**不可用**。

## 裁决

1. 扩展设置项 `searchSource` 的可选项从 5 个缩减为 **仅 `netease`**。
   保留 `selection` 类型，方便日后 API 恢复其他平台时直接扩充。
2. `toMusicInfo` 的映射表保留完整五条（netease→wy / tencent→tx / kugou→kg /
   kuwo→kw / migu→mg），因为映射逻辑本身是对的，只是当前 API 送不进后四者。
3. 文档与 PRD 中「五平台」的表述需要同步修正。

## 待办（Task 13 阶段验证）

- 用真实 `netease` id 在应用内跑通完整链路：搜索 → 选中 → `getMusicUrl` 取流 → 落盘。
- 确认 `netease` 的 `id` 能直接作为 LX `wy` 的 `musicId` 使用（这是本 spike 尚未覆盖的部分，
  因为需要 LX 运行时环境）。
- 若 `wy` 取流失败，退路是让用户改用 LX 侧其他平台的搜索（但那需要自建搜索，工作量大）。

## 附带发现

- `types=url` 端点可用，返回 `{url, br, size}`，可用于补全文件大小信息。
- 该端点对无版权曲目返回空串（`url: ""`），需要判空处理。
- `types=search` 不返回时长与码率，PRD FR-4 中「不展示时长」的判断成立。
