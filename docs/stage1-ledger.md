# 第一阶段执行记录

日期：2026-11-17
执行方式：inline（本会话内直接执行）

## 完成状态

| 任务 | 状态 | 说明 |
|---|---|---|
| Task 1 fork、改名、签名构建 | 完成 | id / name / version / target_engine 已改，签名构建通过 |
| Task 2 测试脚手架 | 完成 | pnpm test = node --test tests/*.test.ts |
| Task 3 Spike R4 | 完成（结论有变更） | 见 docs/spike-r4.md |
| Task 4 Spike R2 | 完成（静态分析） | 见 docs/spike-r2.md |
| Task 5 parseQuery | 完成 | 3 个测试 |
| Task 6 fileName | 完成 | 5 个测试（含 formatSize） |
| Task 7 quality | 完成 | 2 个测试 |
| Task 8 search | 完成 | 5 个测试 |
| Task 9 candidates | 完成 | 6 个测试 |
| Task 10 toMusicInfo | 完成 | 4 个测试 |
| Task 11 设置项与 i18n | 完成 | 7 设置项 / 4 命令 / 68 i18n 键 |
| Task 12 下载主流程接线 | 完成（未含运行时验证） | 见下方遗留 |

测试总数：32，全部通过。

## 裁决记录

**Ruling 1：searchSource 缩减为仅 netease**
- 依据：实测聚合 API 只接受 source=netease 与 source=joox；LX 只支持 kw/kg/tx/wy/mg；交集仅 netease→wy。joox 无 LX 对应平台。
- 代价：用户无法选择其他平台搜索。若日后 API 恢复其他平台，只需在 config.ts 的 enum / enumName 加回条目，映射逻辑已在 toMusicInfo 中保留完整五条。

**Ruling 2：不实现分块写入**
- 依据：writeSaveDialogFile 走 message2call RPC，不经 hostCallActions 的 10 MB 校验；cloneData 用 structuredClone，原生支持 Uint8Array。
- 代价：若运行时发现大文件写入失败，需要改造 download/index.ts 的写入段。

**Ruling 3：新增 getMusicUrlWithQuality 而非改动 getMusicUrl**
- 依据：getMusicUrl 被 onlineResource 的播放链路使用，改动会波及播放行为。
- 代价：两个函数有约 15 行重复逻辑，属可接受的隔离成本。

## 遗留（Task 13 阶段需完成）

1. **运行时端到端验证**：本次执行环境无法在 GUI 内点击命令面板，因此「搜索 → 选候选 → 取流 → 落盘」链路尚未在真实应用内跑通。已完成的部分：manifest 通过宿主解析规则的全项校验、签名验证通过、32 个单测通过。
2. **大于 10 MB 的 flac 落盘**验证（R2 遗留）。
3. netease id 作为 LX wy 的 musicId 是否被音源脚本接受（R4 遗留）。

## 环境操作说明

为静态验证安装流程，曾临时写入 extensions.json 与安装目录，**均已还原/删除**：
- extensions.json 已从备份恢复，条目数与原始一致（3 条）。
- extension/ext/lx-api-source-downloader_0.1.0 已删除。
- 原 lx-api-source-loader_0.1.7 未受任何影响。

## 构建方式

```bash
cd any-listen-extension-lx-api-source-downloader
PRI_KEY="$(cat ../.keys/private.txt)" PUB_KEY="$(cat ../.keys/public.txt)" pnpm build
```

产物：build/lx-api-source-downloader_v0.1.0.alix（约 190 KB）
签名密钥：D:/File/ALdownloader/.keys/（已在 .gitignore 中排除）
