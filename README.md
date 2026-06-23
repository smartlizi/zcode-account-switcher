# ZCode 账号无感切换工具（zcode-account-switcher）

一个**可视化**的 ZCode 账号切换工具，提供**桌面版（Electron 图形界面）**和 **CLI 命令行版**两种形态，**一键切换 ZCode 客户端的登录账号**，免去每次重新走 OAuth + 验证码登录的繁琐流程。

## 适用场景

- 经常在多个 ZCode 账号之间切换。
- 不想重复进行 OAuth 登录和验证码验证。
- 希望用桌面图形界面管理多个本地账号快照。
- 希望保留 CLI 能力用于脚本化或快速排查。

---

## 📦 下载安装（推荐）

前往 [Releases 页面](https://github.com/smartlizi/zcode-account-switcher/releases/latest) 下载对应系统的安装包：

| 系统 | 文件名 | 说明 |
|------|--------|------|
| **Windows** | `ZCode.Account.Switcher.Setup.x.x.x.exe` | NSIS 安装程序（推荐） |
| **Windows** | `ZCode.Account.Switcher.exe` | 便携版（无需安装，双击直接运行） |
| **macOS** | `ZCode.Account.Switcher-x.x.x.dmg` | DMG 安装包 |
| **Linux** | `ZCode.Account.Switcher-x.x.x.AppImage` | AppImage（chmod +x 后运行） |

> **Windows 安装提示**：安装时若弹出「无法关闭 ZCode」提示，请手动关闭 ZCode 客户端后点「重试」即可继续安装。

---

## 桌面版使用说明

### 1. 安装并启动应用

下载对应系统的安装包安装后，从桌面或开始菜单打开「ZCode Account Switcher」。

### 2. 添加账号

点击右上角**「添加账号」**按钮，系统浏览器会自动打开 Z.ai 登录页面。

<img width="2592" height="1706" alt="添加账号" src="https://github.com/user-attachments/assets/959e26a3-a8a2-4a5d-8525-0b93ef9d2346" />

### 3. 在浏览器中登录

在弹出的浏览器窗口中完成账号登录，无需在应用内做任何操作，软件会自动检测并获取账号信息。

<img width="2997" height="1242" alt="浏览器登录" src="https://github.com/user-attachments/assets/7fffdf6a-ec40-47d8-98c9-1eb76ddb6dad" />

### 4. 账号添加成功

登录完成后，账号列表中会出现新账号，点击即可一键切换。

<img width="1899" height="1250" alt="账号列表" src="https://github.com/user-attachments/assets/48953c59-3f50-4e3d-8332-4ee4074c1ad9" />

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

## 🌐 多语言支持 (Bilingual Support)

ZCode Account Switcher 内置 **中文** 和 **English** 两种语言，可随时切换。
The app comes with built-in **Chinese** and **English** language support — switch at any time.

### 桌面版 (Desktop App)
点击顶栏的 🌐 图标即可在中文和英文之间切换，界面文字、按钮、提示信息会立即更新。
Click the 🌐 icon in the top toolbar to toggle between Chinese and English. All UI text, buttons, and tooltips update instantly.

### CLI 版 (Command Line)
在命令末尾加 `--lang en` 即可输出英文，加 `--lang zh` 切换回中文。默认自动检测系统语言。
Append `--lang en` to any command for English output, or `--lang zh` for Chinese. Auto-detects from system locale.

```cmd
:: English output
node src/cli.js status --lang en
node src/cli.js quota --lang en

:: Chinese output (default)
node src/cli.js status --lang zh
```

也可以用环境变量 `LANG=en` 全局设置：
Or set the `LANG=en` environment variable globally:

```cmd
set LANG=en
node src/cli.js status
```

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
│   ├── oauth.js                  # OAuth 凭据写盘 + 账号快照
│   ├── oauthCli.js               # CLI OAuth 登录流程（ZaiAuthFlow）
│   ├── quota.js                  # 额度查询（billing API）
│   ├── zcodeCrypto.js            # enc:v1 加解密（机器绑定密钥）
│   ├── accountHealth.js          # 账号快照健康检查
│   └── cli.js                    # CLI 命令路由（UTF-8 输出修复）
├── desktop/                      # Electron 桌面应用
│   ├── main.js                   # 主进程：建窗口 + IPC + 日志
│   ├── preload.js                # contextBridge 安全桥接
│   ├── vite.config.js            # React 构建配置
│   ├── assets/icon.png           # 应用图标
│   ├── package.json              # Electron 依赖 + electron-builder 配置
│   └── renderer/                 # React 前端（App + 组件 + 暗色主题）
├── .github/workflows/
│   └── release.yml               # GitHub Actions：push tag → 三端自动打包发布
├── accounts/                     # 账号快照（自动生成，勿提交）
├── .last/                        # 上次切换前的登录态（回滚用，自动生成，勿提交）
├── package.json
└── README.md
```

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

**Q: Windows 安装时提示"无法关闭 ZCode"？**
A: 这是正常行为，安装程序检测到 ZCode 正在运行。手动关闭 ZCode 后点「重试」即可继续安装。

**Q: 下载了 `.exe` 便携版但无法"安装"？**
A: 便携版无需安装，双击直接运行即可，不会写入注册表或创建快捷方式。

---

⚠️ 免责声明

本项目仅供学习研究和个人使用，严禁用于商业用途或对外提供服务。

使用本项目产生的一切后果（包括但不限于账号封禁、法律风险）由使用者自行承担。

本项目不存储、不收集任何用户数据。

如有侵权，请联系删除。

请遵守 Z.AI / 智谱 的服务条款，合理使用，避免对官方服务造成压力。

此项目是纯粹研究交流学习性质！

## 友链

- [LINUX DO 社区](https://linux.do/)
