/** 表情窗户:在桌面上单独弹一个表情包气泡,位置由 bot 决定。 */
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolDef, World, WorldWebUiDecl, WorldHost } from 'cortico/core/types.ts';
import { STICKERWINDOW_CONFIG_GROUP, type StickerWindowConfigSection } from './config.ts';
import { parseWhere, type CursorPoint, type Where } from './position.ts';
import { listStickers, resolveSticker, showBubbleWindow, toDataUrl, type WindowHandle } from './window.ts';

const ENV_PROMPT_FILE = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));

export interface StickerWindowWorldOptions {
  cfg: StickerWindowConfigSection;
  timezone: string;
  dataDir: string;
}

export const STICKERWINDOW_TOOL_DECLS: ReadonlyArray<Omit<ToolDef, 'handler'>> = [
  {
    name: 'stickerwindow_list',
    description: '列出表情包目录里可用的图,按修改时间从新到旧。给 stickwindow_show 的 file 用。',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', description: '最多列几张,1 到 50,默认 20。' },
      },
      required: [],
    },
  },
  {
    name: 'stickerwindow_show',
    description:
      '在桌面上单独弹一个表情包气泡(不是桌宠的说话气泡)。位置由 where 决定,几秒后自己消失。',
    tags: ['act'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        file: { type: 'string', description: '表情包文件名,取自 stickwindow_list。' },
        where: {
          type: 'object',
          description:
            '放哪里:不填是屏幕底部正中(桌宠常在底边走)。也可给 cursor(鼠标旁)、bottom-left、bottom-right、center、top-left、top-right,或 { x, y } 归一化坐标(0–1)。',
          additionalProperties: false,
          properties: {
            mode: { type: 'string', description: '预设名,如 cursor、bottom-right。' },
            x: { type: 'number', description: '归一化横坐标,0 最左、1 最右。' },
            y: { type: 'number', description: '归一化纵坐标,0 最上、1 最下。' },
          },
        },
      },
      required: ['file'],
    },
  },
];

export class StickerWindowWorld implements World {
  readonly id = 'stickerwindow';

  private host: WorldHost | null = null;
  private current: WindowHandle | null = null;

  constructor(private readonly opts: StickerWindowWorldOptions) {}

  envPromptVars(): Record<string, string> {
    const sourceDir = this.sourceDir();
    return {
      'stickerwindow.sourceDir': sourceDir,
      'stickerwindow.count': String(listStickers(sourceDir, 200).length),
      'stickerwindow.border': this.opts.cfg.border ? '开' : '关',
    };
  }

  tools(): ToolDef[] {
    return [this.listTool(), this.showTool()];
  }

  webUi(): WorldWebUiDecl {
    return {
      config: [STICKERWINDOW_CONFIG_GROUP],
      promptDocs: [
        {
          key: 'worlds.stickerwindow.envPrompt',
          title: '表情窗户 · 环境提示词',
          description: '这一段进 system 前缀,说明什么时候单独弹表情、放在哪。',
          path: ENV_PROMPT_FILE,
          role: 'envPrompt',
          vars: [
            { name: 'stickerwindow.sourceDir', description: '表情包来源目录,此刻的值。' },
            { name: 'stickerwindow.count', description: '目录里现有多少张图。' },
            { name: 'stickerwindow.border', description: '气泡边框是否开启。' },
          ],
        },
      ],
    };
  }

  async start(host: WorldHost): Promise<void> {
    this.host = host;
    host.log.info('stickerwindow started', { sourceDir: this.sourceDir() });
  }

  async stop(): Promise<void> {
    this.current?.close();
    this.current = null;
    this.host = null;
  }

  private sourceDir(): string {
    const configured = this.opts.cfg.sourceDir.trim();
    return configured || join(this.opts.dataDir, 'emoji');
  }

  private listTool(): ToolDef {
    return {
      ...STICKERWINDOW_TOOL_DECLS[0],
      handler: async (args) => {
        const limit =
          typeof args.limit === 'number' && Number.isFinite(args.limit)
            ? Math.min(50, Math.max(1, Math.round(args.limit)))
            : 20;
        const dir = this.sourceDir();
        if (!existsSync(dir)) return `表情包目录不存在:${dir}`;
        const stickers = listStickers(dir, limit);
        if (!stickers.length) return `表情包目录是空的:${dir}`;
        return `${dir} 里最近 ${stickers.length} 张:\n${stickers
          .map((s) => `- ${s.file}  (${Math.round(s.size / 1024)}KB)`)
          .join('\n')}`;
      },
    };
  }

  private showTool(): ToolDef {
    return {
      ...STICKERWINDOW_TOOL_DECLS[1],
      handler: async (args) => {
        const name = typeof args.file === 'string' ? args.file : '';
        if (!name.trim()) return 'file 不能为空:给一个表情包文件名。';
        const source = resolveSticker(this.sourceDir(), name);
        if (!source) {
          return `找不到「${name}」,或者它不是表情包目录里的图片。用 stickwindow_list 看可用的文件名。`;
        }
        const size = statSync(source).size;
        if (size > this.opts.cfg.maxBytes) {
          return `「${name}」有 ${Math.round(size / 1024)}KB,超过上限 ${Math.round(this.opts.cfg.maxBytes / 1024)}KB。`;
        }

        const dataUrl = toDataUrl(source);
        const where = parseWhere(args.where);
        const cursor: CursorPoint | null = where.mode === 'cursor' ? cursorPoint() : null;

        this.current?.close();
        try {
          this.current = await showBubbleWindow({
            dataUrl,
            where,
            cursor,
            border: this.opts.cfg.border,
            durationSec: this.opts.cfg.durationSec,
            maxWidth: this.opts.cfg.maxWidth,
            profileDir: join(this.opts.dataDir, 'sticker-window'),
            execPath: process.execPath,
          });
        } catch (err) {
          return `气泡没能弹出来:${(err as Error).message}`;
        }

        const place = describeWhere(where);
        this.host?.log.info('stickerwindow shown', { file: name, where: place, size });
        return `弹出了「${name}」,放在${place},约 ${this.opts.cfg.durationSec} 秒后消失。`;
      },
    };
  }
}

/** 位置说人话,回执里告诉对方图放哪了。 */
export function describeWhere(where: Where): string {
  if (where.x !== undefined && where.y !== undefined) {
    return `屏幕横向 ${Math.round(where.x * 100)}%、纵向 ${Math.round(where.y * 100)}% 处`;
  }
  switch (where.mode) {
    case 'cursor':
      return '鼠标旁边';
    case 'bottom-left':
      return '左下角';
    case 'bottom-center':
      return '底部正中';
    case 'bottom-right':
      return '右下角';
    case 'center':
      return '屏幕正中';
    case 'top-left':
      return '左上角';
    case 'top-right':
      return '右上角';
    default:
      return '屏幕底部';
  }
}

/** 鼠标在屏幕上的位置;拿不到时返回 null(页面会退回屏幕中间)。 */
function cursorPoint(): CursorPoint | null {  try {
    const ps = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; $p=[System.Windows.Forms.Cursor]::Position; "$($p.X) $($p.Y)"'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    );
    const [x, y] = (ps.stdout ?? '').trim().split(/\s+/).map((n) => Number(n));
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}
