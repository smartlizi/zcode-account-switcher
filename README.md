# ZCode 账号无感切换工具（zcode-account-switcher）

一个**可视化**的 ZCode 账号切换工具，提供**桌面版（Electron 图形界面）**和 **CLI 命令行版**两种形态，**一键切换 ZCode 客户端的登录账号**，免去每次重新走 OAuth + 验证码登录的繁琐流程。

> 完全独立运行，**不修改、不依赖** `zai-2api` 项目和 ZCode 客户端本体，只读写 ZCode 自己的登录态数据目录。

## 适用场景

- 经常在多个 ZCode 账号之间切换。
- 不想重复进行 OAuth 登录和验证码验证。
- 希望用桌面图形界面管理多个本地账号快照。
- 希望保留 CLI 能力用于脚本化或快速排查。

---

## 桌面版（推荐 · 图形界面）

1、下载整个包后，双击 `启动桌面版.bat` 即可，首次会自动安装依赖并构建界面，之后直接启动。

<img width="396" height="402" alt="1c99b54906ffc7fe2746bdb262d0817e" src="https://github.com/user-attachments/assets/7a4fbe69-dbe7-48ce-805b-97ef8c0262e6" />

2、点击右上角添加账号，会弹出浏览器窗口

<img width="2592" height="1706" alt="image" src="https://github.com/user-attachments/assets/959e26a3-a8a2-4a5d-8525-0b93ef9d2346" />

3、在弹出的浏览器中输入完毕账号信息，登录以后，就无须操作了，软件自行获取账号信息

<img width="2997" height="1242" alt="bf0b9f0e45315aafa8d6d48d29b04536" src="https://github.com/user-attachments/assets/7fffdf6a-ec40-47d8-98c9-1eb76ddb6dad" />

4、等待系统获取完账号信息以后，列表会出现这样一条数据

<img width="1899" height="1250" alt="bc06e94e286224aa6c9c624fcfff2984" src="https://github.com/user-attachments/assets/48953c59-3f50-4e3d-8332-4ee4074c1ad9" />


---

## 原理

ZCode 客户端的登录态全部由这两个文件承载（Windows）：

| 文件 | 内容 |
|------|------|
| `%USERPROFILE%\.zcode\v2\credentials.json` | `enc:v1:...` 加密的 OAuth token（`oauth:zai:access_token` / `zcodejwttoken` / `oauth:zai:user_info`） |
| `%USERPROFILE%\.zcode\v2\config.json` | 每个 provider 段里的 `apiKey`（明文 JWT，base64 payload 含 `user_id`） |

这两份文件合起来 = **一份完整登录态**。工具做的事：

1. **capture**：把当前这两份文件整体存成一个「账号快照」
2. **use**：关闭 ZCode → 备份当前登录态到 `.last` → 用快照**原子替换**这两份文件 → 重启 ZCode
3. 账号身份（指纹）从 `config.json` 里启用 provider 的 `apiKey` JWT 解出 `user_id`，去重 + 命名

切换本质是「换登录态文件 + 重启」，所以叫**无感切换**——不用再扫码、不再碰验证码。

---

## CLI 版（命令行 · 备用）

只需 Node.js ≥ 18，**零依赖**（不用 `npm install`）。

```cmd
cd zcode-account-switcher
node src/cli.js status
node src/cli.js quota
```

根目录也提供了 npm 转发脚本：

```cmd
npm run status
npm run quota
npm run build
npm run desktop
```

可选：建一个快捷别名（在 PowerShell `$PROFILE` 里加）：
```powershell
function zcas { node "<项目路径>\zcode-account-switcher\src\cli.js" @args }
```
之后即可 `zcas status` / `zcas use 1`。

---

## 使用流程

### 第一次：为每个账号各做一次 capture

ZCode 每登录一个账号后，在**该账号已登录**的状态下执行一次：

```cmd
node src/cli.js capture --name "主账号"
```

然后退出 ZCode → 用另一个账号登录 → 再 capture：

```cmd
node src/cli.js capture --name "小号A"
```

重复直到所有账号都存好。

### 日常切换

```cmd
:: 看当前账号 + 列表
node src/cli.js status

:: 切到序号 2 的账号（自动关闭并重启 ZCode）
node src/cli.js use 2

:: 或用 id（支持前缀，如 a869）
node src/cli.js use a869
```

### 万一切换出问题

```cmd
:: 回滚到切换前的登录态（用 .last 备份）
node src/cli.js rollback
```

---

## 命令一览

| 命令 | 作用 |
|------|------|
| `status` | 查看当前登录账号 + 已保存账号列表（默认命令） |
| `list` | 列出所有已保存账号 |
| `quota` | 查询当前账号额度（总量、已用、剩余、分项） |
| `capture [--name 名称] [--note 备注] [--overwrite]` | 把当前登录态存为快照（同名已存在时加 `--overwrite` 覆盖） |
| `use <id\|序号> [--no-restart] [--force]` | 切换账号（默认自动重启 ZCode；`--no-restart` 只换文件不启动） |
| `delete <id\|序号>` | 删除某个账号快照 |
| `rename <id\|序号> <新名称>` | 重命名 |
| `rollback [--no-restart]` | 回滚到切换前（`.last`） |
| `kill` / `launch` | 手动关闭 / 启动 ZCode |

`<id|序号>` 既支持列表里的序号（`1`/`2`/`3`），也支持账号短 id，还支持 id 前缀（如 `a869` 匹配 `a869314f`）。

---

## 安全机制

- **切换前必须关闭 ZCode**：运行中改登录态文件不可靠（客户端会回写覆盖）。工具默认 `--force` 自动 kill；不加则拒绝切换并提示。
- **自动备份**：每次 `use` 前先把当前两份文件备份到 `.last/`，随时可 `rollback`。
- **原子写入**：先写 `.tmp` 再 rename，避免半写状态损坏登录态。
- **写入失败自愈**：替换阶段若出错，自动用 `.last` 恢复，不会留下损坏状态。
- **指纹去重**：同一账号重复 `capture` 会提示已存在（加 `--overwrite` 才覆盖）。

---

## 目录结构

```
zcode-account-switcher/
├── src/                          # 后端核心（CLI + 桌面版共用，纯 CommonJS，零依赖）
│   ├── paths.js                  # 路径常量（v2 目录、ZCode.exe 定位）
│   ├── fingerprint.js            # JWT 解码取 user_id 作为账号指纹
│   ├── manager.js                # 快照增删查改（list/capture/use/delete/rename）
│   ├── switcher.js               # 进程检测 / 备份 / 原子替换 / 回滚
│   └── cli.js                    # CLI 命令路由（UTF-8 输出修复）
├── desktop/                      # Electron 桌面应用
│   ├── main.js                   # 主进程：建窗口 + IPC + 日志
│   ├── preload.js                # contextBridge 安全桥接
│   ├── index.html                # Vite 入口（开发用）
│   ├── vite.config.js            # React 构建配置
│   ├── assets/icon.png           # 应用图标
│   └── renderer/                 # React 前端（App + 4 组件 + 暗色主题）
├── accounts/                     # 账号快照（<id>.meta.json + <id>.snap.json，自动生成，勿提交）
├── .last/                        # 上次切换前的登录态（回滚用，自动生成，勿提交）
├── 启动桌面版.bat                 # 双击启动桌面应用（生产模式）
├── 启动桌面版-开发模式.bat         # 开发模式（vite 热更新）
├── package.json
└── README.md
```

---

## 发布前安全提醒

公开发布或上传 GitHub 前，请再次确认仓库中不包含以下内容：

- `accounts/`、`.last/`、`browser_profile/` 等本地账号和登录态目录。
- `.har`、`.log`、token、cookie、session 等敏感文件。
- `node_modules/`、构建产物、临时分析脚本等本地开发文件。

---

## 常见问题

**Q: 切换后 ZCode 里还显示旧账号？**
A: 确认切换时 ZCode 已被关闭并重启（`status` 显示「运行中」的话，`use` 会自动 kill+launch）。若用 `--no-restart`，需手动重启 ZCode 才生效。

**Q: `status` 显示「无法识别当前登录账号」？**
A: 说明当前 `config.json` 里没有带明文 JWT apiKey 的 provider（可能全是 `enc:` 加密或未登录）。此时仍可切换（用快照里的整份文件），只是指纹会落到弱哈希兜底，建议每个账号在「明文 apiKey provider 启用」时做 capture。

**Q: 账号快照里的 token 会过期吗？**
A: 会。`access_token` 有有效期。但 ZCode 客户端启动后会用 refresh 机制自动续期，所以快照主要保存的是「登录身份」，续期由客户端负责。若某账号长时间不用导致 refresh 也失效，重新登录一次再 `capture --overwrite` 即可。

**Q: 换电脑了怎么办？**
A: 把 `accounts/` 整个目录拷过去即可（前提是新机器也装了 ZCode 且 `.zcode/v2` 路径一致）。

---

## 友链

- [LINUX DO 社区](https://linux.do/)
