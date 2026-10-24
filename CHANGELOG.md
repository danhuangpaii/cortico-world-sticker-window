## 0.1.1

- 加状态灯「图库」:读取成功显示张数,目录不存在或为空时亮错误/离线。
- 搜索关键词补中文:表情窗户、表情、表情包、桌宠。

## 0.1.0

- 新增 `stickerwindow_list` 与 `stickerwindow_show`：在桌面上单独弹一个表情包气泡，位置由 `where` 决定（鼠标旁 / 四角 / 居中 / 归一化坐标）。
- 新增配置 `worlds.stickerwindow.border`：开时图片套一层聊天气泡（白底、圆角、尾巴），关时只显示图片。
- 窗口用 `Coopanion.exe --pet-host` 启动，不读取也不修改 `desktop-pet` 的任何文件。
