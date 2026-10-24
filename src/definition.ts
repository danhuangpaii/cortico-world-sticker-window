import { describeTools, type WorldDefinition } from 'cortico/world.ts';
import { STICKERWINDOW_DEFAULTS, type StickerWindowConfigSection } from './config.ts';
import { STICKERWINDOW_TOOL_DECLS, StickerWindowWorld } from './world.ts';

export const STICKERWINDOW: WorldDefinition<StickerWindowConfigSection> = {
  id: 'stickerwindow',
  label: '表情窗户',
  defaults: () => ({ ...STICKERWINDOW_DEFAULTS }),
  create: (ctx) =>
    new StickerWindowWorld({
      cfg: ctx.cfg,
      timezone: ctx.timezone,
      dataDir: ctx.dataDir,
    }),
  describe: {
    tools: describeTools(STICKERWINDOW_TOOL_DECLS, {
      stickwindow_list: {
        zh: '列出表情包目录里可用的图。',
        en: 'Lists the stickers available in the source directory.',
      },
      stickerwindow_show: {
        zh: '在桌面上单独弹一个表情包气泡,位置可选。',
        en: 'Shows a sticker in its own bubble on the desktop, at a chosen position.',
      },
    }),
    events: [],
  },
};
