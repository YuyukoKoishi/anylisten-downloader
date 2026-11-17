# Spike R2 结论：大文件写入的传输上限

日期：2026-11-17
结论状态：**静态分析完成，运行时验证待安装后进行**

## 背景

计划 Task 4 要求验证 `writeSaveDialogFile` 传入大文件时是否撞上
preload 侧的 `MAX_NATIVE_CALL_DATA_SIZE = 10485760`（10 MB）。

## 静态分析结果

### 传输路径

```
扩展代码
  → app.writeSaveDialogFile(dir, name, content)      // preload
  → hostContext.hostFuncs.writeSaveBoxFile(...)      // message2call
  → extensionState.remoteFuncs.writeSaveBoxFile(...) // worker → 主进程
  → require_tools.writeFile(path, content)           // fs.promises.writeFile
```

### 上限校验发生在哪里

`hostCallActions`（`extension-preload/src/host/hostActions.ts`）里确实有：

```ts
const dataStr = JSON.stringify(data)
checkLength(dataStr, MAX_NATIVE_CALL_DATA_SIZE)   // 10 MB
```

但该函数只用于 `HostCallActions` 这一条通路（logcat、timeout、utils 编解码等），
**`app` 系列 API 走的是 message2call 的 RPC 通道，不经过 `hostCallActions`**。

### message2call 的行为

`message2call@2.0.3` 的 dist 中**没有使用 `JSON.stringify`**（已 grep 确认）。
worker 侧写入前的 `cloneData` 用的是 `structuredClone`（非 legacy Windows 分支）：

```ts
export const cloneData = <T>(data: T) =>
  data === undefined ? data
  : ((VITE_IS_WINDOWS_LEGACY ? JSON.parse(JSON.stringify(data)) : structuredClone(data)) as T)
```

`structuredClone` 原生支持 `Uint8Array`，因此二进制**应当可以完整跨通道传输**。

### 唯一确认的硬限制

`createCommon` 的 `writeSaveBoxFile` 最终调用 `fs.promises.writeFile`，
该方法本身无大小限制，受磁盘空间约束。

## 推论

- 10 MB 上限**很可能不适用于下载落盘路径**，因为该路径不走 `hostCallActions`。
- 若在 legacy Windows（`VITE_IS_WINDOWS_LEGACY`）下，`cloneData` 会退化为
  `JSON.parse(JSON.stringify(data))`，此时 `Uint8Array` 会被转成
  `{"0":137,"1":80,...}` 形式的普通对象，写入将产生损坏文件。
  当前环境为现代 Windows（AnyListen 0.10.1-beta.4 桌面版），不走该分支。

## 仍需运行时验证的项

1. 实际下载一个 > 10 MB 的 flac，确认落盘成功且文件可播放。
2. 确认落盘字节数与 `types=url` 返回的 `size` 一致。
3. 若失败，记录具体报错文本，并改为「分块写入」或「先写扩展 storage 再提示用户」。

以上三项归入 Task 13 阶段四执行。

## 对实现的当前处置

`download/index.ts` 保持单次 `writeSaveDialogFile` 写入，不做分块。
理由：静态分析未发现该路径的大小限制，过早分块会增加复杂度且可能引入
「多次写入覆盖」的问题（`fs.writeFile` 每次都会截断文件）。
若运行时验证失败，再按结论改造。
