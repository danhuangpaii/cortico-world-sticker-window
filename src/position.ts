/** 位置:预设名字或归一化坐标,页面据此把气泡放到屏幕上。 */
export type WhereMode =
  | 'cursor'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'center'
  | 'top-left'
  | 'top-right';

export interface Where {
  mode: WhereMode;
  /** 归一化坐标,0–1;给了就优先于 mode。 */
  x?: number;
  y?: number;
}

const MODES: readonly WhereMode[] = [
  'cursor',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'center',
  'top-left',
  'top-right',
];

export function isWhereMode(value: string): value is WhereMode {
  return (MODES as readonly string[]).includes(value);
}

/** 解析工具参数:字符串预设、`{ x, y }` 归一化坐标,或什么都不给(默认 cursor)。 */
export function parseWhere(raw: unknown): Where {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const x = typeof rec.x === 'number' && Number.isFinite(rec.x) ? rec.x : undefined;
    const y = typeof rec.y === 'number' && Number.isFinite(rec.y) ? rec.y : undefined;
    if (x !== undefined && y !== undefined) {
      return { mode: 'center', x: clamp01(x), y: clamp01(y) };
    }
  }
  if (typeof raw === 'string' && isWhereMode(raw.trim())) return { mode: raw.trim() as WhereMode };
  return { mode: 'bottom-center' };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface CursorPoint {
  x: number;
  y: number;
}

export interface BubbleBox {
  width: number;
  height: number;
}

export interface ScreenBox {
  width: number;
  height: number;
}

/** 归一化坐标或预设 → 左上角像素位置,夹在屏幕内。纯函数,便于测试。 */
export function placeBubble(
  where: Where,
  screen: ScreenBox,
  bubble: BubbleBox,
  cursor: CursorPoint | null,
): { left: number; top: number; tail: 'bottom' | 'left' } {
  const margin = 12;
  // 桌宠站在屏幕底边、约 200px 高;底部预设要抬到它头顶以上,否则会盖住它。
  const petClearance = 190;
  const maxLeft = Math.max(margin, screen.width - bubble.width - margin);
  const maxTop = Math.max(margin, screen.height - bubble.height - margin);
  const bottomTop = Math.max(margin, Math.min(screen.height - bubble.height - petClearance, maxTop));
  const clamp = (v: number, max: number): number => Math.min(Math.max(v, margin), max);

  if (where.x !== undefined && where.y !== undefined) {
    return {
      left: clamp(where.x * screen.width, maxLeft),
      top: clamp(where.y * screen.height, maxTop),
      tail: 'bottom',
    };
  }

  switch (where.mode) {
    case 'cursor': {
      const c = cursor ?? { x: screen.width / 2, y: screen.height / 2 };
      return {
        left: clamp(c.x + 18, maxLeft),
        top: clamp(c.y - bubble.height - 8, maxTop),
        tail: 'left',
      };
    }
    case 'bottom-left':
      return { left: margin, top: bottomTop, tail: 'bottom' };
    case 'bottom-center':
      return { left: clamp((screen.width - bubble.width) / 2, maxLeft), top: bottomTop, tail: 'bottom' };
    case 'bottom-right':
      return { left: maxLeft, top: bottomTop, tail: 'bottom' };
    case 'center':
      return {
        left: clamp((screen.width - bubble.width) / 2, maxLeft),
        top: clamp((screen.height - bubble.height) / 2, maxTop),
        tail: 'bottom',
      };
    case 'top-left':
      return { left: margin, top: margin, tail: 'bottom' };
    case 'top-right':
      return { left: maxLeft, top: margin, tail: 'bottom' };
    default:
      return { left: margin, top: maxTop, tail: 'bottom' };
  }
}
