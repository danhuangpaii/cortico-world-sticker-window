/** 窗口:一段本地服务 + 一个 `Coopanion.exe --pet-host` 透明窗口,显示完自己关。 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { extname, join, resolve, sep } from 'node:path';
import type { CursorPoint, Where } from './position.ts';

const IMAGE_MIMES: Record<string, string> = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** 目录里的图片,按修改时间从新到旧。 */
export function listStickers(dir: string, limit = 20): Array<{ file: string; size: number; mtimeMs: number }> {
  if (!existsSync(dir)) return [];
  const out: Array<{ file: string; size: number; mtimeMs: number }> = [];
  for (const name of readdirSync(dir)) {
    if (!IMAGE_MIMES[extname(name).toLowerCase()]) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (!st.isFile()) continue;
    out.push({ file: name, size: st.size, mtimeMs: st.mtimeMs });
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out.slice(0, Math.max(1, limit));
}

/** 把名字收敛到目录内;越界、非图片或不存在都返回 null。 */
export function resolveSticker(dir: string, name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (/[\\/]/.test(trimmed) || trimmed.includes('\0') || trimmed.startsWith('.')) return null;
  if (!IMAGE_MIMES[extname(trimmed).toLowerCase()]) return null;
  const path = resolve(dir, trimmed);
  if (!path.startsWith(resolve(dir) + sep)) return null;
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  return path;
}

export function toDataUrl(path: string): string {
  const mime = IMAGE_MIMES[extname(path).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

export interface ShowInput {
  dataUrl: string;
  where: Where;
  cursor: CursorPoint | null;
  border: boolean;
  durationSec: number;
  maxWidth: number;
  profileDir: string;
  execPath: string;
}

export interface WindowHandle {
  close(): void;
}

/** 生成气泡页面:位置在页面里算(它有 innerWidth/innerHeight)。 */
export function bubbleHtml(
  input: Pick<ShowInput, 'dataUrl' | 'where' | 'cursor' | 'border' | 'durationSec' | 'maxWidth'>,
): string {
  const where = JSON.stringify(input.where);
  const cursor = JSON.stringify(input.cursor);
  const pad = input.border ? '6px' : '0';
  const radius = input.border ? '14px' : '10px';
  const bg = input.border ? 'rgba(255,255,255,.97)' : 'transparent';
  const shadow = input.border
    ? '0 8px 22px rgba(0,0,0,.20),0 1px 4px rgba(0,0,0,.10)'
    : '0 6px 18px rgba(0,0,0,.22)';
  const tail = input.border
    ? `.bubble::after{content:'';position:absolute;left:50%;bottom:-4px;width:9px;height:9px;background:${bg};transform:translateX(-50%) rotate(45deg);border-radius:2px}`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif}
#b{position:absolute;left:0;top:0;box-sizing:border-box;will-change:transform;
  padding:${pad};border-radius:${radius};background:${bg};box-shadow:${shadow};
  animation:pop .34s cubic-bezier(.34,1.56,.64,1);transform-origin:bottom center}
${tail}
#b img{display:block;width:100%;height:100%;object-fit:contain;border-radius:${input.border ? '9px' : '10px'};user-select:none}
@keyframes pop{from{transform:scale(.72);opacity:0}to{transform:scale(1);opacity:1}}
</style></head><body><div id="b"><img alt="" src="${input.dataUrl}"></div>
<script>
const MAXW=${input.maxWidth}, where=${where}, cursor=${cursor};
const b=document.getElementById('b'), img=b.querySelector('img');
function place(){
  const bw=b.offsetWidth||MAXW, bh=b.offsetHeight||MAXW;
  const m=12, maxL=Math.max(m,innerWidth-bw-m), maxT=Math.max(m,innerHeight-bh-m);
  const cl=(v,hi)=>Math.min(Math.max(v,m),hi);
  let left=m, top=maxT;
  if(where.x!==undefined&&where.y!==undefined){left=cl(where.x*innerWidth,maxL);top=cl(where.y*innerHeight,maxT);}
  else if(where.mode==='cursor'&&cursor){left=cl(cursor.x+18,maxL);top=cl(cursor.y-bh-8,maxT);}
  else if(where.mode==='bottom-left'){left=m;top=cl(innerHeight-bh-190,maxT);}
  else if(where.mode==='bottom-center'){left=cl((innerWidth-bw)/2,maxL);top=cl(innerHeight-bh-190,maxT);}
  else if(where.mode==='bottom-right'){left=maxL;top=cl(innerHeight-bh-190,maxT);}
  else if(where.mode==='center'){left=cl((innerWidth-bw)/2,maxL);top=cl((innerHeight-bh)/2,maxT);}
  else if(where.mode==='top-left'){left=m;top=m;}
  else if(where.mode==='top-right'){left=maxL;top=m;}
  b.style.left=left+'px'; b.style.top=top+'px';
}
img.addEventListener('load',()=>{
  const ratio=img.naturalWidth/img.naturalHeight;
  const w=Math.min(MAXW,img.naturalWidth||MAXW);
  const h=Math.min(Math.round(w/Math.max(ratio,0.01)),Math.round(MAXW*2.2));
  b.style.width=w+'px'; b.style.height=h+'px';
  place();
});
place();
setTimeout(()=>{document.body.style.transition='opacity .35s';document.body.style.opacity='0';},${Math.max(1, input.durationSec - 0.5) * 1000});
setTimeout(()=>window.close(),${input.durationSec * 1000});
</script></body></html>`;
}

/** 起服务、起窗口;到时间自己关。 */
export async function showBubbleWindow(input: ShowInput): Promise<WindowHandle> {
  mkdirSync(input.profileDir, { recursive: true });
  const html = bubbleHtml(input);
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/`;

  const env = { ...process.env };
  // 继承来的 ELECTRON_RUN_AS_NODE 会让 Coopanion.exe 按 Node 跑,--pet-host 会被当成 bad option。
  delete env.ELECTRON_RUN_AS_NODE;
  const child: ChildProcess = spawn(
    input.execPath,
    ['--pet-host', `--pet-url=${url}`, `--parent-pid=${process.pid}`, `--user-data-dir=${input.profileDir}`],
    { env, stdio: 'ignore', windowsHide: false },
  );

  const timer = setTimeout(() => {
    try { child.kill(); } catch { /* already gone */ }
    server.close();
  }, input.durationSec * 1000 + 2000);

  let closed = false;
  return {
    close: () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      try { child.kill(); } catch { /* already gone */ }
      server.close();
    },
  };
}
