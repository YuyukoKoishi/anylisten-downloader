# Spike R2 结论：大文件写入的传输上限

日期：2026-11-17
结论状态：**已实证，10 MB 上限不适用于下载落盘路径**

## 背景

计划 Task 4 要求验证 `writeSaveDialogFile` 传入大文件时是否撞上
preload 侧的 `MAX_NATIVE_CALL_DATA_SIZE = 10485760`（10 MB）。

## 实证结果

### 1. 真实音频样本

通过聚合 API 取得 `netease` id=2668397359 的 320k 音频：

- 响应 `size` 字段：10831725 字节（10.33 MB，**超过 10 MB 上限**）
- 实际下载：10831725 字节，文件头为 `ID3`，是有效 MP3

这说明「10 MB 上限会导致大文件下载失败」这一假设需要验证，而不是默认成立。

### 2. message2call 二进制传输测试

用 `message2call@2.0.3` 构造真实的双向 RPC，传递 10831725 字节的 `Uint8Array`：

```
constructor: Uint8Array
isView: true
length: 10831725 MATCH: true byte255: 255
```

**结论：Uint8Array 跨 message2call 传输完全无损**，类型、长度、字节内容均正确。

### 3. 上限校验的作用域

`hostCallActions`（`extension-preload/src/host/hostActions.ts`）里的
`checkLength(dataStr, MAX_NATIVE_CALL_DATA_SIZE)` 只作用于 `HostCallActions` 通路
（logcat、timeout、utils 编解码）。`app` 系列 API 走 message2call RPC，**不经过该校验**。

`cloneData` 使用 `structuredClone`（非 legacy Windows 分支），原生支持 `Uint8Array`。

## 结论

下载落盘路径上的 10 MB 限制**不存在**。当前实现保持单次
`writeSaveDialogFile(dir, fileName, raw)` 写入，不做分块。

## 一个测试过程中的陷阱（记录备查）

初次测试时我在 `sendMessage` 中加了 `JSON.parse(JSON.stringify(d))`，
导致 `Uint8Array` 被序列化成 `{"0":137,"1":80,...}` 的普通对象，
写入将产生损坏文件。

**这是测试代码的错误，不是宿主的行为**。真实宿主路径中，
preload→worker 方向的 `hostCall` 直接传递参数，不做 JSON 序列化；
只有 worker→preload 的回调方向才用 `JSON.stringify`（且不用于文件内容传输）。

因此：**不要**在 `writeSaveDialogFile` 调用链上手动做 JSON 序列化。

## 仍需在 GUI 内确认的项

- 实际点击命令面板完成一次下载，确认文件落盘且可播放。
- 以上三项（URL 可取、二进制可传、上限不存在）已分别实证，
  但三者串起来的完整链路仍需一次真实操作确认。
