import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolCallContext } from 'cortico/core/types.ts';
import { dryMountWorld, fakeWorldContext } from 'cortico/extensions/dry-mount.ts';
import { STICKERWINDOW } from '../src/definition.ts';
import { parseWhere, placeBubble } from '../src/position.ts';
import { bubbleHtml, resolveSticker } from '../src/window.ts';
import { FakeHost } from './helpers/fake-host.ts';

/** 1×1 的 PNG;测试只要求文件头像真的图。 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let dir: string;
let sourceDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stickerwindow-'));
  sourceDir = join(dir, 'emoji');
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, 'a.png'), PNG);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const call = {} as ToolCallContext;

function makeWorld() {
  const ctx = fakeWorldContext(STICKERWINDOW, { scratchDir: dir });
  ctx.persist({ sourceDir, border: true });
  return { ctx, world: STICKERWINDOW.create(ctx) };
}

describe('Sticker Window World', () => {
  it('干装载不报失败:装载器会接受它', async () => {
    const report = await dryMountWorld(STICKERWINDOW, { scratchDir: dir });
    expect(report.failures).toEqual([]);
  });

  it('parseWhere 认预设名与归一化坐标', () => {
    expect(parseWhere(undefined).mode).toBe('bottom-center');
    expect(parseWhere('bottom-right').mode).toBe('bottom-right');
    expect(parseWhere({ x: 0.2, y: 0.8 })).toMatchObject({ x: 0.2, y: 0.8 });
    expect(parseWhere({ x: 2, y: -1 })).toMatchObject({ x: 1, y: 0 });
    expect(parseWhere('nonsense').mode).toBe('bottom-center');
  });

  it('placeBubble 把气泡夹在屏幕内', () => {
    const pos = placeBubble({ mode: 'bottom-right' }, { width: 1920, height: 1080 }, { width: 180, height: 170 }, null);
    expect(pos.left).toBe(1920 - 180 - 12);
    // 底部预设要抬到桌宠头顶以上,不然会盖住它
    expect(pos.top).toBe(1080 - 170 - 190);
    expect(pos.tail).toBe('bottom');
  });

  it('placeBubble 的 cursor 模式贴着鼠标右上', () => {
    const pos = placeBubble({ mode: 'cursor' }, { width: 1920, height: 1080 }, { width: 180, height: 170 }, { x: 900, y: 800 });
    expect(pos.left).toBe(918);
    expect(pos.top).toBe(800 - 170 - 8);
    expect(pos.tail).toBe('left');
  });

  it('stickerwindow_list 列出目录里的图', async () => {
    const { world } = makeWorld();
    const list = world.tools().find((t) => t.name === 'stickerwindow_list')!;
    expect(String(await list.handler({}, call))).toContain('a.png');
  });

  it('stickerwindow_show 拒绝空文件名、目录外名字与超大图', async () => {
    const { ctx, world } = makeWorld();
    const show = world.tools().find((t) => t.name === 'stickerwindow_show')!;
    expect(String(await show.handler({}, call))).toContain('file 不能为空');
    expect(String(await show.handler({ file: '../a.png' }, call))).toContain('找不到');
    ctx.persist({ maxBytes: 10 });
    expect(String(await show.handler({ file: 'a.png' }, call))).toContain('超过上限');
  });

  it('resolveSticker 拒绝目录外与非图片', () => {
    expect(resolveSticker(sourceDir, '../a.png')).toBeNull();
    expect(resolveSticker(sourceDir, 'a.txt')).toBeNull();
    expect(resolveSticker(sourceDir, 'a.png')).toContain('a.png');
  });

  it('bubbleHtml 带图、带位置,边框开关改变样式', () => {
    const withBorder = bubbleHtml({
      dataUrl: 'data:image/png;base64,AAA',
      where: { mode: 'bottom-right' },
      cursor: null,
      border: true,
      durationSec: 6,
      maxWidth: 180,
    });
    expect(withBorder).toContain('data:image/png;base64,AAA');
    expect(withBorder).toContain('bottom-right');
    expect(withBorder).toContain('::after');

    const plain = bubbleHtml({
      dataUrl: 'data:image/png;base64,AAA',
      where: { mode: 'center' },
      cursor: null,
      border: false,
      durationSec: 6,
      maxWidth: 180,
    });
    expect(plain).not.toContain('::after');
    expect(plain).toContain('transparent');
  });

  it('挂载与停止不抛错,不推事件', async () => {
    const { world } = makeWorld();
    const host = new FakeHost();
    await world.start(host);
    await world.stop();
    expect(host.events).toEqual([]);
  });
});
