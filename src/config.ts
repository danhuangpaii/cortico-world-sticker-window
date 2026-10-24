import type { ConfigGroup } from 'cortico/core/types.ts';

/** config.json 的 worlds.stickerwindow 段。 */
export interface StickerWindowConfigSection {
  enabled: boolean;
  /** 表情包来源目录;留空用部署 dataDir 下的 emoji。 */
  sourceDir: string;
  /** 给图片套一层聊天气泡式的边框与尾巴。 */
  border: boolean;
  /** 气泡停留秒数。 */
  durationSec: number;
  /** 图片最大宽度,像素。 */
  maxWidth: number;
  /** 单张图的字节上限。 */
  maxBytes: number;
}

export const STICKERWINDOW_DEFAULTS: StickerWindowConfigSection = {
  enabled: false,
  sourceDir: '',
  border: true,
  durationSec: 6,
  maxWidth: 180,
  maxBytes: 8 * 1024 * 1024,
};

export const STICKERWINDOW_CONFIG_GROUP: ConfigGroup = {
  id: 'world:stickerwindow',
  owner: 'world:stickerwindow',
  schema: {
    type: 'object',
    title: '表情窗户',
    description: '在桌面上单独弹一个表情包气泡,位置由 bot 决定。',
    properties: {
      'worlds.stickerwindow.sourceDir': {
        type: 'string',
        title: '表情包来源目录',
        description: '留空用部署 dataDir 下的 emoji。',
        'x-path': { kind: 'directory' },
        'x-hot': true,
      },
      'worlds.stickerwindow.border': {
        type: 'boolean',
        title: '气泡边框',
        description: '开:图片套一层聊天气泡(白底、圆角、尾巴)。关:只显示图片本身。',
        'x-hot': true,
      },
      'worlds.stickerwindow.durationSec': {
        type: 'number',
        title: '停留秒数',
        minimum: 1,
        maximum: 60,
        'x-hot': true,
      },
      'worlds.stickerwindow.maxWidth': {
        type: 'integer',
        title: '气泡最大宽度',
        minimum: 80,
        maximum: 600,
        description: '像素;高度按图片比例,上限 2.2 倍宽度。',
        'x-hot': true,
      },
      'worlds.stickerwindow.maxBytes': {
        type: 'integer',
        title: '单张图上限',
        minimum: 100000,
        description: '字节;超过就拒绝。',
        'x-hot': true,
      },
    },
  },
};
