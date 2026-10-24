# cortico-world-sticker-window

Owner: `src/definition.ts`

在桌面上单独弹一个表情包气泡。位置由 bot 决定（跟鼠标、四角、居中，或归一化坐标），
可选聊天气泡式的边框。不读取、不修改 `desktop-pet` 的任何文件。

| 文件 | 内容 |
|---|---|
| `src/definition.ts` | `WorldDefinition`:id、label、默认配置、`create()`、`describe` |
| `src/config.ts` | 配置段（来源目录、边框开关、停留时长、最大宽度、大小上限） |
| `src/position.ts` | `where` 解析与像素位置计算（纯函数） |
| `src/window.ts` | 图片读取、气泡页面生成、本地服务、`Coopanion.exe --pet-host` 窗口 |
| `src/world.ts` | 两个工具与 `webUi()` 声明 |
| `src/ENV_PROMPT.md` | 环境提示词：位置怎么选、什么时候别弹 |
| `tests/` | 干装载、位置解析、夹边、工具拒绝、页面生成、边框开关 |

## 两个工具

| 工具 | 做什么 |
|---|---|
| `stickerwindow_list` | 列出表情包目录里的图 |
| `stickerwindow_show` | 弹一个气泡，`where` 决定位置，几秒后消失 |

`where` 取值：`cursor`（默认，鼠标旁）、`bottom-left` / `bottom-center` / `bottom-right`、
`center`、`top-left` / `top-right`，或 `{ "x": 0.2, "y": 0.8 }` 归一化坐标。

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `worlds.stickerwindow.sourceDir` | 空 | 表情包目录；留空用 `dataDir/emoji` |
| `worlds.stickerwindow.border` | `true` | 开：图片套聊天气泡（白底、圆角、尾巴）；关：只有图 |
| `worlds.stickerwindow.durationSec` | 6 | 停留秒数 |
| `worlds.stickerwindow.maxWidth` | 180 | 图片最大宽度，像素；高度按比例，上限 2.2 倍 |
| `worlds.stickerwindow.maxBytes` | 8 MB | 单张图字节上限 |

## 运行方式

每次弹图：

1. 起一个本地 HTTP 服务，返回「透明页 + 内联图片」
2. `spawn(process.execPath, ['--pet-host', '--pet-url=…', '--parent-pid=…', '--user-data-dir=…'])`
3. 页面按 `where` 定位、播放弹出动画、到点淡出并关窗

实测（180×170 的气泡，12 秒）：新增 4 个 Coopanion 进程，内存峰值约 570 MB，CPU 约 3%。
不弹的时候没有额外进程。

## 边界

- 不读 `desktop-pet` 的代码、DOM 或状态；只用 Coopanion 的 `--pet-host` 启动模式
- 只读来源目录，不改文件
- 文件名收敛在来源目录内，拒绝 `../`、绝对路径与非图片扩展名
- 窗口是进程级的，同一时刻只保留一个；新弹一个会先关掉旧的
