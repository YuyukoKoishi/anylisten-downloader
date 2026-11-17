# 交接说明

## 产物

- 构建产物：`build/lx-api-source-downloader_v0.1.0.alix`
- 扩展显示名称：**LX音源兼容**
- 扩展 id：`lx-api-source-downloader`
- 目标引擎：`1.4.0`（宿主 AnyListen `0.10.1-beta.4`）

## 签名密钥

构建必须提供 RSA 密钥，否则 `extension-kit` 打包阶段会抛
`Missing private key or public key`。

密钥位置：`D:/File/ALdownloader/.keys/`
- `private.txt`：PKCS8 私钥（去掉 PEM 头尾）
- `public.txt`：SPKI 公钥（去掉 PEM 头尾）

**该目录已在 `.gitignore` 中排除，不得提交到版本库。**

如密钥丢失，可重新生成一对（已安装的旧版本将无法验证新构建，需卸载重装）：

```js
import crypto from 'node:crypto'
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
```

## 重新构建

```bash
cd any-listen-extension-lx-api-source-downloader
pnpm install
pnpm test
PRI_KEY="$(cat ../.keys/private.txt)" PUB_KEY="$(cat ../.keys/public.txt)" pnpm build
```

## 代码结构

```text
src/main/download/
  types.ts          纯类型
  parseQuery.ts     输入拆分（纯函数）
  fileName.ts       文件名模板 / 非法字符 / 扩展名 / 体积格式化（纯函数）
  quality.ts        音质标签映射（纯函数）
  search.ts         搜索 + 重试（fetcher 注入，纯函数）
  candidates.ts     排序 / 分页 / 按钮文案（纯函数）
  toMusicInfo.ts    候选 → 宿主 MusicInfoOnline（纯函数）
  index.ts          宿主接线：命令注册、对话框循环、下载落盘
```

纯函数模块**不 import 任何宿主 API**，因此可直接用 `node --test` 测试。
`src/main/shared/hostAPI.ts` 顶层执行 `require('any-listen')`，
任何引入它的模块都无法在测试环境加载 —— 这是分层的原因。

## 验证状态

| 项 | 状态 |
|---|---|
| 单元测试 | 40 个全部通过 |
| 端到端链路 | 通过（见 `docs/e2e-verification.md`） |
| 真实音频下载 | 通过（10.8 MB，ID3 头正确） |
| GUI 手动冒烟 | **未做**，需人工在应用内点一次 |

## 已知风险

1. **音源脚本可用性**是最大变量。实测当前应用内启用的「星海音乐源」因
   其服务端 token 接口失效而不可用；「全豆要聚合音源」可用。
   建议使用前先在扩展设置中确认哪个脚本能正常取流。
2. 聚合 API 只支持 `netease`，若该平台接口变动，下载功能会整体失效。
   API 地址可在设置中修改。
3. 双扩展（原版 + 本版）同时声明 `musicUrl` 资源，宿主选择 provider 的顺序
   未验证。**若播放行为异常，处置为禁用原插件、保留本扩展**——已确认优先保下载功能。

## 文档索引

- `docs/spike-r4.md`：聚合 API 平台支持能力实测
- `docs/spike-r2.md`：大文件写入限制的实证结论
- `docs/stage1-ledger.md`：第一阶段执行记录与裁决
- `docs/e2e-verification.md`：端到端验证报告
