/* Le Portée at the desk: a lofi pixel lobby driven by sources.json.
   Small and silent in the corner; click to open it full screen with music.
   Every key in the cubbies is a source in the library (click one to open it),
   the books on the shelf are the Readables, and the Scout walks in with next-issue candidates.
   The other bots work the floor too: the Writer runs drafts to the desk, the Herald hawks this week's issue,
   and faint readers come and go in the armchairs.
   Same technique as Minimishka at Night (~/dashboard/night): 480x270 canvas, seeded RNG, WebAudio lofi. */
(() => {
"use strict";
const W = 480, H = 270;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- dom ----------
const css = `
#lobby{position:fixed;right:18px;bottom:18px;z-index:30;width:256px;aspect-ratio:16/9;padding:0;border:2px solid var(--ink,#262422);
  border-radius:10px;overflow:hidden;background:#120e0d;cursor:zoom-in;box-shadow:4px 4px 0 var(--ink,#262422);transition:transform .15s}
#lobby:hover{transform:translate(-1px,-1px) rotate(-.6deg)}
#lobby canvas{width:100%;height:100%;display:block;image-rendering:pixelated}
#lobby .cap{position:absolute;left:8px;top:7px;font:600 .58rem "Poppins",system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;
  color:#fff;background:#E2482Ecc;padding:3px 8px;border-radius:999px;pointer-events:none}
#lobby .x{position:absolute;right:5px;top:4px;width:22px;height:22px;border:0;border-radius:50%;background:#0008;color:#fff;font:14px/22px system-ui;cursor:pointer;padding:0}
#lobby.inline{position:relative;right:auto;bottom:auto;width:100%;margin:-12px 0 36px}
#lobby-full{position:fixed;inset:0;z-index:50;background:#0b0908;display:grid;place-items:center}
#lobby-full[hidden]{display:none}
#lobby-full canvas{width:min(100vw,calc(100vh*16/9));aspect-ratio:16/9;height:auto;image-rendering:pixelated;display:block}
#lobby-full .hud{position:fixed;left:14px;bottom:12px;right:14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;
  color:#e8dccb;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;opacity:.8;pointer-events:none;text-shadow:0 1px 0 #000}
#lobby-full .hud b{color:#ff8f79;font-weight:normal}
#lobby-full .close{position:fixed;right:14px;top:12px;border:1px solid #5a4a40;background:#1a1412;color:#e8dccb;border-radius:999px;
  font:600 .75rem "Poppins",system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:7px 14px;cursor:pointer}
#lobby-tip{position:fixed;z-index:60;pointer-events:none;max-width:280px;padding:5px 9px;background:#1a1412f2;border:1px solid #5a4a40;color:#f3ead8;
  font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;display:none}
@media (max-width:700px){#lobby:not(.inline){width:168px;right:12px;bottom:12px}}
@media print{#lobby{display:none}}`;
document.head.append(Object.assign(document.createElement("style"), { textContent: css }));

const mini = document.createElement("button");
mini.id = "lobby"; mini.type = "button"; mini.setAttribute("aria-label", "Open the Le Portée lobby, a pixel-art scene of the library, full screen");
const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
const cap = Object.assign(document.createElement("span"), { className: "cap", textContent: "the lobby ▸" });
const hide = Object.assign(document.createElement("span"), { className: "x", textContent: "×", title: "Hide the lobby" });
hide.setAttribute("role", "button"); hide.setAttribute("aria-label", "Hide the lobby");
mini.append(cv, cap, hide);

const full = document.createElement("div"); full.id = "lobby-full"; full.hidden = true;
full.setAttribute("role", "dialog"); full.setAttribute("aria-label", "The Le Portée lobby");
const close = Object.assign(document.createElement("button"), { className: "close", type: "button", textContent: "Back to the library ✕" });
const hud = Object.assign(document.createElement("div"), { className: "hud" });
full.append(close, hud);
const tip = document.createElement("div"); tip.id = "lobby-tip";
document.body.append(full, tip);

let hidden = false;
try { hidden = localStorage.getItem("lobby-hidden") === "1"; } catch (e) {}
const small = matchMedia("(max-width:560px)");
function place() {
  if (hidden) { mini.remove(); return; }
  const sub = document.querySelector(".sub");
  if (small.matches && sub) { mini.classList.add("inline"); sub.after(mini); }
  else { mini.classList.remove("inline"); document.body.append(mini); }
}
small.addEventListener("change", place);
place();

const g = cv.getContext("2d");

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
function disc(cx, cy, r, c) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect((cx - w) | 0, (cy + dy) | 0, 2 * w + 1, 1); }
}
function glow(x, y, r, rgb, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
const F = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",
  G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101110100110101",L:"100100100100111",
  M:"1000111011101011000110001",N:"10011101101110011001",O:"111101101101111",P:"110101110100100",Q:"010101101110011",
  R:"110101110101101",S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",
  W:"1000110001101011101110001",X:"101101010101101",Y:"101101010010010",Z:"111001010100111",
  0:"111101101101111",1:"010110010010111",2:"110001010100111",3:"110001010001110",4:"101101111001001",
  5:"111100110001110",6:"011100111101111",7:"111001010010010",8:"111101111101111",9:"111101111001110",
  "!":"010010010000010",
};
function text(str, x, y, c, s = 1) {
  for (const ch of str.toUpperCase()) {
    const gl = F[ch]; if (!gl) { x += 3 * s; continue; }
    const w = gl.length / 5;
    for (let i = 0; i < gl.length; i++) if (gl[i] === "1") px(x + (i % w) * s, y + Math.floor(i / w) * s, s, s, c);
    x += (w + 1) * s;
  }
}
const textW = (str, s = 1) => [...str.toUpperCase()].reduce((w, ch) => w + ((F[ch] ? F[ch].length / 5 : 2) + 1) * s, -s);

// ---------- palette ----------
const C = {
  wall: "#3b2b26", wallHi: "#46332c", wains: "#2a1e1a", rail: "#5c3f2e", floorA: "#211a17", floorB: "#2b221e",
  wood: "#6b4530", woodHi: "#8a5c3e", woodDk: "#3d2719", gold: "#d9a441", goldDk: "#8a6424", orange: "#E2482E", orangeDk: "#a8321d",
  paper: "#f3ead8", ink: "#262422", skin: "#e0b48c", hair: "#3a2418", glass: "#16202e",
  academia: "#4f9a83", reports: "#6f93c9", tips: "#E2482E", readable: "#d29a4b",
};

// ---------- data ----------
let items = [], keys = [], books = [], visitors = [], fresh = [], latest = "";
const np = document.createElement("span");                                    // now playing, filled in by the music
function load(list) {
  items = list || [];
  latest = items.reduce((m, i) => (i.week || "") > m ? i.week : m, "");
  const order = { academia: 0, reports: 1, tips: 2, readable: 3 };
  keys = items.filter(i => i.kind !== "readable" && i.status !== "next-issue candidate")
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.week || "").localeCompare(b.week || ""));
  books = items.filter(i => i.kind === "readable");
  visitors = items.filter(i => i.status === "next-issue candidate");
  fresh = keys.filter(i => i.week === latest);
  hud.innerHTML = "";
  const l = document.createElement("span");
  l.innerHTML = `<b>LE PORTÉE</b> · night shift · ${keys.length} keys in the cubbies · ${fresh.length} new this week · ${visitors.length} waiting at the door`;
  const r = document.createElement("span"); r.textContent = "click a key, a book or the Herald to open it · M music · Esc close";
  hud.append(l, np, r);
}
if (window.libraryItems) load(window.libraryItems);
document.addEventListener("library:ready", e => load(e.detail));

// ---------- scene ----------
const rnd = mulberry32(20261011);
const skyline = Array.from({ length: 14 }, (_, i) => ({ x: 26 + i * 7, h: 18 + Math.floor(rnd() * 46), w: 6 + Math.floor(rnd() * 4) }));
const lit = Array.from({ length: 70 }, () => [Math.floor(rnd() * 90), Math.floor(rnd() * 50), rnd()]);
const rain = Array.from({ length: 60 }, () => [rnd() * 96, rnd() * 120, .6 + rnd() * .8]);
const spines = Array.from({ length: 40 }, () => ({ w: 3 + Math.floor(rnd() * 3), h: 18 + Math.floor(rnd() * 8),
  c: ["#5b6f5a", "#7a4a3a", "#3f4c6b", "#8a7350", "#5a3d55", "#2f5d50", "#6b5a40"][Math.floor(rnd() * 7)] }));
const motes = Array.from({ length: 18 }, () => [150 + rnd() * 180, 20 + rnd() * 130, rnd() * 6.28]);

let hits = [];
const CUB = { x: 176, y: 48, cols: 16, rows: 8, s: 9 };
const DOOR = 432, DESK_Y = 158;

function drawRoom(t) {
  px(0, 0, W, 200, C.wall);
  for (let x = 0; x < W; x += 24) px(x, 10, 1, 140, C.wallHi);                 // wallpaper stripes
  px(0, 0, W, 8, C.woodDk); px(0, 8, W, 2, C.rail);                           // cornice
  px(0, 150, W, 50, C.wains); px(0, 150, W, 3, C.rail);
  for (let x = 6; x < W; x += 40) { px(x, 158, 32, 36, "#251a17"); px(x + 1, 159, 30, 34, C.wains); }
  for (let y = 200, r = 0; y < H; y += 10, r++)                               // tiled floor
    for (let x = -(r % 2) * 10; x < W; x += 20) px(x, y, 10, 10, (x / 10 + r) % 2 ? C.floorA : C.floorB);
  px(150, 214, 190, 56, "#5a1f17"); px(154, 218, 182, 48, "#7a2a1d");        // runner rug
  for (let x = 160; x < 330; x += 12) px(x, 240, 6, 2, C.goldDk);
}

function drawWindow(t, hour) {
  const x = 24, y = 34, w = 96, h = 116;
  const day = hour >= 7 && hour < 19;
  const top = day ? "#41587a" : "#0d1424", bot = day ? "#8a7f88" : "#2a2238";
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  if (!day) { for (let i = 0; i < 16; i++) px(x + (i * 37) % w, y + (i * 13) % 40, 1, 1, "#cfd3e6"); }
  for (const b of skyline) {
    px(b.x, y + h - b.h, b.w, b.h, day ? "#2d3446" : "#0a0c14");
  }
  for (const [lx, ly, p] of lit) {
    const bx = x + 2 + lx, by = y + h - 4 - ly;
    const on = Math.sin(t / 9000 + p * 40) > -.2 && p > .3;
    if (on && by > y + 10) { const b = skyline.find(s => bx >= s.x && bx < s.x + s.w && by >= y + h - s.h); if (b) px(bx, by, 1, 1, day ? "#6a6a70" : "#f2c46b"); }
  }
  // rain on glass
  if (!REDUCED) for (const d of rain) {
    const ry = (d[1] + t * .09 * d[2]) % h;
    px(x + d[0], y + ry, 1, 3, "#9fb4d466");
  }
  // lightning, rarely
  const flash = !REDUCED && (Math.floor(t / 1000) % 47 === 0) && (t % 1000 < 120);
  if (flash) px(x, y, w, h, "#e8eeff55");
  // frame + mullions
  px(x - 3, y - 3, w + 6, 3, C.wood); px(x - 3, y + h, w + 6, 4, C.woodHi); px(x - 3, y, 3, h, C.wood); px(x + w, y, 3, h, C.wood);
  px(x + w / 2 - 1, y, 2, h, C.wood); px(x, y + h / 2 - 1, w, 2, C.wood);
  // curtains
  for (let i = 0; i < 10; i++) { px(x - 10 + (i % 2), y - 6 + i * 13, 10, 13, i % 2 ? C.orangeDk : "#8c2a18"); px(x + w + 1 - (i % 2), y - 6 + i * 13, 10, 13, i % 2 ? C.orangeDk : "#8c2a18"); }
  px(x - 14, y - 9, w + 28, 4, C.gold);
}

function drawSign(t) {
  const s = "LE PORTEE", w = textW(s, 2), x = Math.round(240 - w / 2);
  px(x - 8, 14, w + 16, 22, C.woodDk); px(x - 7, 15, w + 14, 20, "#2a1b14");
  const pulse = REDUCED ? 1 : .85 + .15 * Math.sin(t / 700);
  glow(240, 25, 60, "226,72,46", .18 * pulse);
  text(s, x, 18, C.orange, 2);
  const ax = x + textW("LE PORT", 2) + 4;
  px(ax + 1, 16, 2, 1, C.orange); px(ax + 2, 15, 2, 1, C.orange);              // the accent on the É
  const r = "RECEPTION", rw = textW(r);
  text(r, Math.round(240 - rw / 2), 30, C.gold);
}

function drawCubbies(t) {
  const { x, y, cols, rows, s } = CUB;
  px(x - 4, y - 4, cols * s + 8, rows * s + 8, C.woodDk);
  px(x - 3, y - 3, cols * s + 6, rows * s + 6, C.wood);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = x + c * s, cy = y + r * s;
    px(cx, cy, s - 1, s - 1, "#1c120d");
    px(cx, cy + s - 2, s - 1, 1, C.woodHi);
    const i = r * cols + c, it = keys[i];
    if (!it) continue;
    const col = C[it.kind] || C.tips, fresh = it.week === latest;
    px(cx + 3, cy + 1, 1, 2, C.gold);                                          // key ring
    px(cx + 2, cy + 3, 3, 3, col);                                             // tag
    if (fresh) {
      const a = REDUCED ? .5 : .35 + .3 * Math.sin(t / 400 + i);
      glow(cx + 3.5, cy + 4, 7, "255,190,90", a);
    }
    hits.push({ x: cx, y: cy, w: s - 1, h: s - 1, it, label: () => `${it.title}${fresh ? "  · new this week" : ""}` });
  }
}

function drawClock(now) {
  const cx = 338, cy = 62;
  disc(cx, cy, 11, C.gold); disc(cx, cy, 9, C.paper);
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; px(cx + Math.sin(a) * 7.5, cy - Math.cos(a) * 7.5, 1, 1, C.ink); }
  const hh = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * 6.283, mm = now.getMinutes() / 60 * 6.283;
  for (let k = 0; k < 5; k++) px(cx + Math.sin(hh) * k, cy - Math.cos(hh) * k, 1, 1, C.ink);
  for (let k = 0; k < 8; k++) px(cx + Math.sin(mm) * k, cy - Math.cos(mm) * k, 1, 1, C.orangeDk);
}

function drawShelf(t) {
  const x = 352, y = 56, w = 62, shelves = 4, sh = 34;
  px(x - 3, y - 3, w + 6, shelves * sh + 6, C.woodDk);
  let si = 0;
  for (let s = 0; s < shelves; s++) {
    const by = y + s * sh;
    px(x, by, w, sh - 3, "#1c120d"); px(x - 3, by + sh - 3, w + 6, 3, C.wood);
    let bx = x + 2;
    if (s === 1) for (const b of books) {                                     // the Readables, front and centre
      const bw = 6, bh = 26;
      px(bx, by + sh - 3 - bh, bw, bh, C.readable); px(bx, by + sh - 3 - bh + 4, bw, 2, C.gold); px(bx + 1, by + sh - 3 - bh + 9, bw - 2, 8, "#8a5a1e");
      hits.push({ x: bx, y: by + sh - 3 - bh, w: bw, h: bh, it: b, label: () => "Book: " + b.title });
      bx += bw + 1;
    }
    while (bx < x + w - 6) {
      const sp = spines[si++ % spines.length];
      px(bx, by + sh - 3 - sp.h, sp.w, sp.h, sp.c); px(bx, by + sh - 3 - sp.h + 3, sp.w, 1, "#0003");
      bx += sp.w + (sp.w > 4 ? 1 : 0);
    }
  }
  // cat asleep on top of the shelf, tail flicking
  const cx = 384, cy = y - 8;
  px(cx, cy + 2, 12, 5, "#1a1614"); px(cx + 9, cy, 5, 4, "#1a1614"); px(cx + 9, cy - 1, 1, 1, "#1a1614"); px(cx + 13, cy - 1, 1, 1, "#1a1614");
  const flick = REDUCED ? 0 : Math.floor(t / 600) % 6 === 0 ? 1 : 0;
  px(cx - 3, cy + 5 - flick, 4, 1, "#1a1614");
  if (!REDUCED && Math.floor(t / 2400) % 3 === 0) text("Z", cx + 15, cy - 8 - (t / 400) % 4, "#cfd3e688");
}

function drawPlant() {
  px(138, 170, 12, 14, "#8a4a2a"); px(137, 168, 14, 3, "#a65c34");
  const leaves = [[143, 150, 2, 18], [138, 154, 2, 14], [148, 155, 2, 13], [134, 158, 4, 2], [149, 157, 5, 2], [141, 148, 4, 2], [145, 152, 4, 2]];
  for (const [x, y, w, h] of leaves) px(x, y, w, h, "#3f6b3a");
}

function drawCart() {
  const x = 52, y = 172;
  px(x, y + 26, 54, 3, C.gold); px(x + 2, y - 10, 2, 38, C.gold); px(x + 50, y - 10, 2, 38, C.gold); px(x + 2, y - 12, 50, 2, C.gold);
  px(x + 8, y + 6, 22, 20, "#6b2f22"); px(x + 8, y + 6, 22, 2, "#8a3e2c"); px(x + 17, y + 3, 4, 3, C.goldDk);
  px(x + 31, y + 12, 16, 14, "#2f4a5a"); px(x + 31, y + 12, 16, 2, "#3f6070");
  px(x + 12, y - 2, 14, 8, "#a8874f");
  disc(x + 6, y + 31, 3, "#111"); disc(x + 48, y + 31, 3, "#111");
}

function drawDoor(t, open) {
  const x = DOOR, y = 72, w = 40, h = 128;
  px(x - 4, y - 4, w + 8, h + 4, C.woodDk);
  px(x, y, w, h, "#0c1018");
  for (const d of rain) if (!REDUCED) px(x + (d[0] % w), y + (d[1] * 1.1 + t * .1 * d[2]) % h, 1, 3, "#9fb4d433");
  const ow = Math.round(w * (1 - open * .75));
  px(x, y, ow, h, "#1d2a38aa"); px(x, y, ow, 2, C.gold); px(x + ow - 2, y, 2, h, C.gold); px(x, y + h - 2, ow, 2, C.gold);
  px(x + ow - 8, y + 64, 6, 2, C.gold);
  text("IN", x + 14, y - 14, C.gold);
}

function drawLamp(t) {
  const x = 168;
  px(x, 152, 12, 3, C.ink); px(x + 5, 138, 2, 14, C.ink); px(x + 2, 134, 8, 2, C.ink);
  px(x - 2, 128, 14, 7, C.orange); px(x - 1, 127, 12, 1, C.orangeDk);
  const flick = REDUCED ? 1 : .92 + .08 * Math.sin(t / 130) * Math.sin(t / 470);
  glow(x + 5, 140, 70, "255,170,90", .22 * flick);
  glow(x + 5, 152, 26, "255,200,120", .3 * flick);
}

function drawPendant(t) {
  glow(240, 70, 130, "255,190,110", .1);
  if (!REDUCED) for (const m of motes) {
    const mx = m[0] + Math.sin(t / 3000 + m[2]) * 6, my = m[1] + Math.sin(t / 4100 + m[2] * 2) * 4;
    if (Math.hypot(mx - 240, my - 60) < 110) px(mx, my, 1, 1, "#ffe6b055");
  }
}

// ---------- Le Portée ----------
const ME = { act: "write", until: 0, look: 0, stamped: 0 };
function drawPortee(t) {
  const x = 230, y = 118, blink = Math.floor(t / 170) % 23 === 0;
  // chair back
  px(x - 4, y + 14, 26, 30, "#2a1b14");
  // torso: orange porter jacket, gold buttons, white collar
  px(x, y + 18, 18, 22, C.orange); px(x, y + 18, 18, 2, C.orangeDk);
  px(x + 6, y + 18, 6, 3, C.paper); px(x + 8, y + 23, 2, 2, C.gold); px(x + 8, y + 28, 2, 2, C.gold); px(x + 8, y + 33, 2, 2, C.gold);
  px(x - 1, y + 20, 2, 8, C.gold); px(x + 17, y + 20, 2, 8, C.gold);           // epaulettes
  // head
  px(x + 4, y + 6, 10, 11, C.skin); px(x + 7, y + 17, 4, 2, C.skin);
  px(x + 3, y + 4, 12, 4, C.hair); px(x + 3, y + 6, 2, 6, C.hair); px(x + 13, y + 6, 2, 5, C.hair);
  px(x + 14, y + 9, 3, 4, C.hair);                                            // bun
  // pillbox cap with gold band
  px(x + 4, y - 1, 10, 5, C.orange); px(x + 4, y + 2, 10, 1, C.gold); px(x + 8, y - 2, 2, 1, C.gold);
  // face: eyes follow the visitor, glasses
  const ex = ME.look;
  if (!blink) { px(x + 6 + ex, y + 10, 1, 1, C.ink); px(x + 11 + ex, y + 10, 1, 1, C.ink); }
  else { px(x + 6, y + 10, 2, 1, "#a07a5c"); px(x + 10, y + 10, 2, 1, "#a07a5c"); }
  px(x + 5, y + 9, 4, 1, "#3a302a"); px(x + 10, y + 9, 4, 1, "#3a302a"); px(x + 9, y + 9, 1, 1, "#3a302a");
  px(x + 8, y + 14, 3, 1, "#a0604c");
  // arms + hands, by action
  if (ME.act === "stamp") {
    const k = clamp((ME.until - t) / 700, 0, 1), up = k > .5 ? (1 - k) * 2 : k * 2;
    const hy = DESK_Y - 4 - Math.round(up * 14);
    px(x + 17, y + 24, 4, 10, C.orange); px(x + 20, hy, 4, DESK_Y - hy - 2, C.orange);
    px(x + 19, hy - 7, 6, 5, C.woodDk); px(x + 20, hy - 2, 4, 2, C.orangeDk);   // the stamp
  } else if (ME.act === "wave") {
    const wv = Math.floor(t / 180) % 2;
    px(x + 17, y + 10 + wv, 4, 14, C.orange); px(x + 18, y + 7 + wv, 3, 3, C.skin);
  } else {
    const wx = REDUCED ? 0 : Math.round(Math.sin(t / 260) * 2 + Math.sin(t / 97));
    px(x + 15, y + 30, 5, 8, C.orange); px(x + 18 + wx, DESK_Y - 4, 4, 3, C.skin);
    px(x + 22 + wx, DESK_Y - 9, 1, 6, C.gold);                                 // pencil
  }
  px(x - 3, y + 30, 5, 8, C.orange); px(x - 3, DESK_Y - 4, 4, 3, C.skin);
  hits.push({ x: x - 3, y: y - 2, w: 24, h: 40, it: null, label: () => "Le Portée, the editor, on the night shift" });
}

function drawDesk(t) {
  const x = 150, w = 184;
  px(x - 2, DESK_Y - 2, w + 4, 6, C.woodHi); px(x - 2, DESK_Y - 2, w + 4, 1, "#a8774f");
  px(x, DESK_Y + 4, w, 54, C.wood);
  for (let k = 0; k < 6; k++) { px(x + 6 + k * 30, DESK_Y + 12, 24, 38, C.woodDk); px(x + 7 + k * 30, DESK_Y + 13, 22, 36, "#5a3a28"); }
  px(x, DESK_Y + 6, w, 3, C.orange);
  // ledger: one page per item in the latest issue
  const n = clamp(keys.filter(i => i.week === latest).length, 1, 8);
  for (let k = 0; k < n; k++) px(258 + (k % 2), DESK_Y - 3 - k, 18, 1, k % 2 ? C.paper : "#e2d6bd");
  px(206, DESK_Y - 3, 16, 2, C.paper); px(208, DESK_Y - 4, 12, 1, "#ddd");     // the page being written
  if (ME.stamped && t - ME.stamped < 6000) { px(211, DESK_Y - 4, 4, 1, C.orange); }
  // bell
  const ring = t - ringAt < 400;
  px(300, DESK_Y - 3, 10, 2, C.ink); disc(305, DESK_Y - 6, 4, ring ? "#ffe08a" : C.gold); px(304, DESK_Y - 12, 2, 2, C.gold);
  if (ring) { px(298, DESK_Y - 13, 1, 2, "#ffe08a"); px(312, DESK_Y - 13, 1, 2, "#ffe08a"); }
}

// ---------- the floor staff: the Scout, the Writer and the Herald ----------
// Each one walks a lane from where it comes in to a spot, does its thing, and walks back out.
// Sprites are drawn on a 2x grid, (0,0) at the feet; flipped when walking left.
let ringAt = -1e9;
const cast = { scout: null, writer: null, herald: null };
const due = { scout: 4000, writer: 11000, herald: 22000 };
const GAP = { scout: [14000, 12000], writer: [26000, 20000], herald: [34000, 26000] };
let visitIx = 0, heraldIx = 0;

function legs(P, w, t, c) {
  const step = w.walking && Math.floor(t / (w.speed > .035 ? 130 : 200)) % 2;
  if (step) { P(0, -2, 1, 2, c); P(4, -2, 1, 2, c); } else { P(1, -2, 1, 2, c); P(3, -2, 1, 2, c); }
}
const SPRITES = {
  scout(P, w, t) {
    legs(P, w, t, "#1c1a24");
    P(0, -7, 5, 5, "#3f5f52");                       // green field coat
    P(-1, -6, 2, 3, "#8a6a40");                      // satchel
    P(1, -10, 3, 3, C.skin);
    P(0, -11, 5, 1, "#2a2a2a"); P(1, -12, 3, 1, "#2a2a2a");   // flat cap
    if (w.carry) P(4, -6, 2, 2, C.paper);
  },
  writer(P, w, t) {                                  // a bellhop at a run, arms full of drafts
    legs(P, w, t, "#1c1a24");
    P(0, -7, 5, 5, "#2f4a6a"); P(2, -6, 1, 1, C.gold); P(2, -4, 1, 1, C.gold);
    P(1, -10, 3, 3, C.skin); P(1, -12, 3, 2, C.orange); P(1, -11, 3, 1, C.gold);
    if (w.carry) {
      const bob = w.walking && Math.floor(t / 130) % 2 ? 1 : 0;
      P(4, -9 + bob, 3, 4, C.paper); P(4, -8 + bob, 3, 1, "#cfc3a8"); P(4, -6 + bob, 3, 1, "#cfc3a8");
    }
  },
  herald(P, w, t) {                                  // a newsboy with a satchel of this week's issue
    const shout = w.phase === "stay", up = shout && Math.floor(t / 420) % 2 ? 1 : 0;
    legs(P, w, t, "#2a2018");
    P(0, -4, 5, 2, "#5a4a3a");                       // knickerbockers
    P(0, -7, 5, 3, "#e8dccb"); P(1, -7, 1, 3, "#5a3a28"); P(3, -7, 1, 3, "#5a3a28");   // shirt, braces
    P(-1, -6, 2, 3, "#c9b48a"); P(-1, -6, 2, 1, C.paper);   // paper satchel
    P(1, -10, 3, 3, C.skin);
    P(0, -11, 5, 1, "#6b5a40"); P(1, -12, 3, 1, "#6b5a40"); P(5, -11, 1, 1, "#6b5a40");   // newsboy cap
    if (shout) { P(4, -11 - up, 1, 4, "#e8dccb"); P(4, -14 - up, 3, 3, C.paper); P(5, -13 - up, 1, 1, C.ink); }
  },
};
const LABELS = {
  scout: w => "The Scout, with a next-issue candidate: " + w.it.title,
  writer: () => "The Writer, running drafts for the next issue to the desk",
  herald: w => "The Herald, calling out this week's issue: " + w.it.title,
};

function walker(who, from, to, lane, speed, stay, it) {
  return { who, x: from, from, to, y: lane, speed, stay, it, dir: Math.sign(to - from), walking: true, phase: "in", carry: true, until: 0 };
}
function stepWalker(w, t, dt) {
  if (w.phase === "in") {
    w.x += w.dir * dt * w.speed;
    if ((w.to - w.x) * w.dir <= 0) { w.x = w.to; w.walking = false; w.phase = "stay"; w.until = t + w.stay; arrive(w, t); }
  } else if (w.phase === "stay") {
    if (w.who === "scout" && t > w.until - 2400 && w.carry) { w.carry = false; stamp(t); }
    if (w.who === "writer" && t > w.until - 1600 && w.carry) { w.carry = false; stamp(t); }
    if (t > w.until) { w.phase = "out"; w.dir = -w.dir; w.walking = true; if (w.who === "scout") { ME.act = "wave"; ME.until = t + 1200; } }
  } else {
    w.x += w.dir * dt * w.speed;
    if ((w.x - w.from) * w.dir >= 0) return false;
  }
  return true;
}
function arrive(w, t) { if (w.who === "scout") ring(t); }
function stamp(t) { ME.act = "stamp"; ME.until = t + 700; ME.stamped = t; sfx("stamp"); }
function ring(t) { ringAt = t; sfx("bell"); ME.act = "wave"; ME.until = t + 900; }
const atDoor = () => cast.scout || cast.herald;

function updateCast(t, dt) {
  if (!REDUCED) {
    if (!atDoor() && t > due.scout && visitors.length)
      cast.scout = walker("scout", DOOR + 14, 300, 236, .028, 3600, visitors[visitIx++ % visitors.length]);
    else if (!atDoor() && t > due.herald && fresh.length)
      cast.herald = walker("herald", DOOR + 14, 372, 250, .03, 6500, fresh[heraldIx++ % fresh.length]);
    if (!cast.writer && t > due.writer) cast.writer = walker("writer", -14, 194, 226, .05, 2600, null);
  }
  for (const k in cast) if (cast[k] && !stepWalker(cast[k], t, dt)) { cast[k] = null; due[k] = t + GAP[k][0] + Math.random() * GAP[k][1]; }
  ME.look = cast.writer && cast.writer.phase !== "out" && cast.writer.x > 120 ? -1 : cast.scout ? (cast.scout.x > 250 ? 1 : 0) : 0;
  let open = 0;
  for (const w of [cast.scout, cast.herald]) if (w) open = Math.max(open, clamp(1 - Math.abs(w.x - DOOR - 14) / 30, 0, 1));
  return open;
}
function drawCast(t) {
  for (const w of Object.values(cast).filter(Boolean).sort((a, b) => a.y - b.y)) {
    const k = 2, x = Math.round(w.x), y = w.y, flip = w.dir < 0;
    const P = (dx, dy, ww, h, c) => px(flip ? x + (5 - dx - ww) * k : x + dx * k, y + dy * k, ww * k, h * k, c);
    g.fillStyle = "#0006"; g.fillRect(x - 2, y - 1, 14, 2);                     // a soft shadow under the feet
    SPRITES[w.who](P, w, t);
    if (w.who === "herald" && w.phase === "stay") {                           // the call, in a speech bubble
      const s = Math.floor(t / 1600) % 2 ? "EXTRA!" : "NEW ISSUE", bw = textW(s) + 6, bx = clamp(Math.round(x + 5 - bw / 2), 4, W - bw - 4), by = y - 40;
      px(bx, by, bw, 9, C.paper); px(bx, by + 9, bw, 1, "#b8ab90"); px(x + 4, by + 9, 2, 2, C.paper);
      text(s, bx + 3, by + 2, C.ink);
    }
    hits.push({ x: x - 2, y: y - 26, w: 14, h: 28, it: w.it, label: () => LABELS[w.who](w) });
  }
}

// ---------- the readers: faint silhouettes who come and go in the armchairs ----------
const SIL = "#0d0908";
const readers = [
  { x: 8, y: 266, kind: "paper" }, { x: 92, y: 270, kind: "phone" }, { x: 404, y: 270, kind: "paper" },
].map((r, i) => Object.assign(r, { here: i !== 1, a: i !== 1 ? 1 : 0, next: 30000 + i * 21000, turn: 0, nextTurn: 6000 + i * 4000 }));
function updateReaders(t, dt) {
  for (const r of readers) {
    r.a = clamp(r.a + (r.here ? 1 : -1) * dt / 1800, 0, 1);
    if (REDUCED) continue;
    if (t > r.next) {
      if (!r.here || readers.filter(o => o.here).length > 1) r.here = !r.here;
      r.next = t + (r.here ? 50000 + Math.random() * 70000 : 15000 + Math.random() * 30000);
    }
    if (r.here && t > r.nextTurn) { r.turn = t + 320; r.nextTurn = t + 7000 + Math.random() * 9000; }
  }
}
function drawReaders(t) {
  // a little side table with a lamp between the two left chairs
  px(60, 238, 22, 3, C.woodHi); px(62, 241, 2, 27, C.woodDk); px(76, 241, 2, 27, C.woodDk);
  px(68, 226, 2, 12, C.goldDk); px(63, 218, 12, 8, "#c98a4a"); px(64, 217, 10, 1, "#e0a868");
  const fl = REDUCED ? 1 : .94 + .06 * Math.sin(t / 210);
  glow(69, 228, 46, "255,180,100", .2 * fl);
  for (const r of readers) {
    const x = r.x, yb = r.y;
    px(x + 2, yb - 40, 30, 26, "#3d1a14"); px(x + 4, yb - 42, 26, 2, "#3d1a14"); // chair back
    for (let k = 0; k < 3; k++) px(x + 9 + k * 8, yb - 33, 1, 1, "#5c2a1c");      // buttons in the velvet
    if (r.a > .01) {
      g.save(); g.globalAlpha = r.a * .92;
      disc(x + 17, yb - 34, 5, SIL); px(x + 8, yb - 30, 18, 15, SIL);            // head and shoulders, no face
      if (r.kind === "paper") {
        const turning = t < r.turn, pw = turning ? 12 : 22, p0 = x + 17 - pw / 2;
        px(p0, yb - 30, pw, 14, "#b9aa8c"); px(x + 17, yb - 30, 1, 14, "#8f8268");
        for (let k = 0; k < 5; k++) { px(p0 + 2, yb - 27 + k * 2, pw / 2 - 4, 1, "#8f826877"); if (!turning) px(x + 19, yb - 27 + k * 2, pw / 2 - 4, 1, "#8f826877"); }
        px(p0 - 1, yb - 24, 2, 3, SIL); px(p0 + pw - 1, yb - 24, 2, 3, SIL);
        glow(x + 17, yb - 23, 16, "255,190,120", .12 * r.a);
      } else {
        px(x + 15, yb - 22, 5, 3, "#cfe6ff"); px(x + 13, yb - 21, 2, 3, SIL); px(x + 20, yb - 21, 2, 3, SIL);
        const scroll = REDUCED ? 1 : .8 + .2 * Math.sin(t / 900);
        glow(x + 17, yb - 27, 14, "150,195,255", .28 * r.a * scroll);
      }
      g.restore();
    }
    px(x + 2, yb - 16, 30, 8, "#5a2519"); px(x + 2, yb - 16, 30, 1, "#73321f");  // seat
    px(x - 2, yb - 26, 7, 22, "#4a1e16"); px(x + 29, yb - 26, 7, 22, "#4a1e16"); // arms
    px(x - 2, yb - 26, 7, 1, "#6a2c1d"); px(x + 29, yb - 26, 7, 1, "#6a2c1d");
    px(x, yb - 4, 2, 4, C.woodDk); px(x + 32, yb - 4, 2, 4, C.woodDk);
    hits.push({ x: x - 2, y: yb - 42, w: 38, h: 42, it: null, label: () => r.a > .5 ? "A reader, somewhere, with this week's issue. Could be you." : "An empty armchair, kept warm for the next reader" });
  }
}

// ---------- frame ----------
let last = 0, running = false, isFull = false, raf = 0, stillDrawn = false;
function frame(now) {
  raf = 0;
  const dt = Math.min(now - last, 100);
  if (!isFull && now - last < 1000 / 15) { schedule(); return; }        // the corner widget runs at 15 fps
  last = now;
  hits = [];
  if (ME.act !== "write" && now > ME.until) ME.act = "write";
  if (!cast.scout && !cast.writer && !REDUCED && now > ME.until + 9000 && Math.random() < .002) stamp(now);
  const date = new Date(), hour = date.getHours() + date.getMinutes() / 60;
  const open = updateCast(now, dt);
  updateReaders(now, dt);
  drawRoom(now); drawWindow(now, hour); drawCart(); drawDoor(now, open); drawSign(now);
  drawCubbies(now); drawClock(date); drawShelf(now); drawPendant(now);
  drawPortee(now); drawDesk(now); drawLamp(now); drawPlant(); drawCast(now); drawReaders(now);
  // vignette
  const v = g.createRadialGradient(240, 135, 120, 240, 135, 300);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = v; g.fillRect(0, 0, W, H);
  stillDrawn = true;
  schedule();
}
function schedule() {
  if (raf || !running) return;
  if (REDUCED) { setTimeout(() => { if (running) raf = requestAnimationFrame(frame); }, 2000); raf = -1; return; }
  raf = requestAnimationFrame(frame);
}
function setRunning(on) {
  if (on === running) return;
  running = on;
  if (on) { raf = 0; schedule(); }
}
// The corner widget only animates while it is on screen and the tab is visible.
let onScreen = true;
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; sync(); }).observe(mini);
document.addEventListener("visibilitychange", sync);
function sync() { setRunning(!document.hidden && (isFull || (onScreen && !hidden))); if (document.hidden) music.stop(); else if (isFull && music.wanted) music.start(); }

// ---------- open / close ----------
function openFull() {
  isFull = true; full.hidden = false; full.prepend(cv); document.body.style.overflow = "hidden";
  music.wanted = true; music.start(); close.focus(); sync();
  if (location.hash !== "#lobby") history.pushState(null, "", "#lobby");
}
function closeFull(back = true) {
  if (!isFull) return;
  isFull = false; full.hidden = true; mini.prepend(cv); document.body.style.overflow = ""; tip.style.display = "none";
  music.wanted = false; music.stop(); sync();
  if (back && location.hash === "#lobby") history.back();
}
mini.addEventListener("click", e => {
  if (e.target === hide) { e.stopPropagation(); hidden = true; try { localStorage.setItem("lobby-hidden", "1"); } catch (_) {} mini.remove(); sync(); return; }
  openFull();
});
close.onclick = () => closeFull();
addEventListener("keydown", e => {
  if (!isFull) return;
  if (e.key === "Escape") closeFull();
  if (e.key === "m" || e.key === "M") { music.wanted = !music.on; music.wanted ? music.start() : music.stop(); }
});
addEventListener("popstate", () => { if (location.hash === "#lobby") { if (!isFull) openFull(); } else closeFull(false); });

// ---------- hover + click on things in the scene ----------
function at(e) {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  return hits.find(h => x >= h.x - 1 && x <= h.x + h.w + 1 && y >= h.y - 1 && y <= h.y + h.h + 1);
}
cv.addEventListener("mousemove", e => {
  if (!isFull) return;
  const h = at(e);
  cv.style.cursor = h && h.it ? "pointer" : "default";
  if (!h) { tip.style.display = "none"; return; }
  tip.textContent = h.label(); tip.style.display = "block";
  tip.style.left = Math.min(e.clientX + 14, innerWidth - 300) + "px"; tip.style.top = (e.clientY + 16) + "px";
});
cv.addEventListener("mouseleave", () => tip.style.display = "none");
cv.addEventListener("click", e => {
  if (!isFull) return;
  const h = at(e); if (!h || !h.it) return;
  e.stopPropagation(); closeFull(false);
  if (window.libraryReveal) window.libraryReveal(h.it.id);
});

// ---------- music: hotel-lobby lofi, composed live in the browser ----------
// No samples and no AI model (the same call Lofi Cities makes): rule-based jazz harmony with rootless voicings and
// smooth voice leading, an FM electric piano, a plucked upright-ish bass, brushed drums with swing and loose timing,
// a vibraphone motif, then a tape stage (soft saturation, wow and flutter, a tone that opens in the intro), a generated
// plate reverb, vinyl, rain, distant lobby chatter and the odd lift chime, tuned to the track's key.
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const VOICE = { maj9: [4, 7, 11, 14], "69": [4, 7, 9, 14], m9: [3, 7, 10, 14], "13": [4, 9, 10, 14], "7b9": [4, 7, 10, 13], m7b5: [3, 6, 10, 12] };
// one entry per bar: [semitones above the key, quality]; two chords split the bar
const A_PROGS = [
  [[[2, "m9"]], [[7, "13"]], [[0, "maj9"]], [[0, "69"]]],
  [[[0, "maj9"]], [[9, "m9"]], [[2, "m9"]], [[7, "13"], [7, "7b9"]]],
  [[[5, "maj9"]], [[4, "m9"]], [[2, "m9"], [7, "13"]], [[0, "maj9"]]],
  [[[0, "maj9"]], [[5, "maj9"]], [[5, "m9"], [10, "13"]], [[0, "69"]]],
];
const B_PROGS = [
  [[[4, "m7b5"], [9, "7b9"]], [[2, "m9"]], [[2, "m9"], [7, "13"]], [[0, "maj9"]]],
  [[[5, "maj9"]], [[5, "m9"], [10, "13"]], [[4, "m9"], [9, "7b9"]], [[2, "m9"], [7, "13"]]],
  [[[9, "m9"]], [[2, "13"]], [[2, "m9"]], [[7, "13"]]],
];
const COMP = [[[0, 15, .8]], [[0, 5, .85], [6, 9, .6]], [[0, 10, .8], [14, 2, .5]], [[0, 3, .75], [6, 3, .5], [10, 6, .65]]];   // [16th, length, velocity]
const PENTA = [0, 2, 4, 7, 9];
const KEYS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const TITLES = ["Night porter", "Late check-in", "Room service", "Rain on the awning", "Key 214", "Last guest in",
  "The front desk", "Lift to the fifth", "Lost umbrella", "Velvet armchair", "Do not disturb", "Wake-up call"];
const FORM = [["intro", 4], ["A", 8], ["B", 8], ["A", 8], ["break", 4], ["B", 8], ["outro", 4]];   // about two and a half minutes
const music = {
  ctx: null, on: false, wanted: false, track: 0,
  start() {
    if (!this.wanted) return;
    if (this.ctx) { this.ctx.resume(); this.on = true; return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.build(new AC());
    this.timer = setInterval(() => this.tick(this.ctx.currentTime), 25); this.on = true;
  },
  stop() { if (this.ctx) this.ctx.suspend(); this.on = false; },
  build(ac) {
    this.ctx = ac;
    const sr = ac.sampleRate;
    // master: gentle glue compression, then a limiter so nothing ever clips
    const glue = ac.createDynamicsCompressor(); glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = .02; glue.release.value = .3;
    const limit = ac.createDynamicsCompressor(); limit.threshold.value = -4; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = .003; limit.release.value = .15;
    const master = ac.createGain(); master.gain.value = .75;
    glue.connect(master); master.connect(limit); limit.connect(ac.destination);
    // tape: soft saturation, wow and flutter on a short wandering delay, a tone that rolls off the top
    this.in = ac.createGain();
    const sat = ac.createWaveShaper(), curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
    sat.curve = curve; sat.oversample = "2x";
    const wow = ac.createDelay(.1); wow.delayTime.value = .012;
    this.lfo(.42, .0011, wow.delayTime); this.lfo(6.1, .00009, wow.delayTime);
    this.tone = ac.createBiquadFilter(); this.tone.type = "lowpass"; this.tone.Q.value = .5; this.tone.frequency.value = 900;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 32;
    this.in.connect(sat); sat.connect(wow); wow.connect(this.tone); this.tone.connect(hp); hp.connect(glue);
    // a plate reverb from a generated impulse, and a darkening dotted-eighth echo
    this.rev = ac.createConvolver(); this.rev.buffer = this.plate(2.8);
    const revOut = ac.createGain(); revOut.gain.value = .38; this.rev.connect(revOut); revOut.connect(this.in);
    this.echo = ac.createDelay(2); const efb = ac.createGain(), elp = ac.createBiquadFilter();
    efb.gain.value = .3; elp.type = "lowpass"; elp.frequency.value = 2200;
    this.echo.connect(elp); elp.connect(efb); efb.connect(this.echo); elp.connect(this.in);
    const pan = (node, v) => { if (!ac.createStereoPanner) return node; const p = ac.createStereoPanner(); p.pan.value = v; node.connect(p); return p; };
    const bus = (gain, rev, echo, side = 0, dst = this.in) => {
      const gn = ac.createGain(); gn.gain.value = gain; const out = side ? pan(gn, side) : gn;
      out.connect(dst);
      if (rev) { const s = ac.createGain(); s.gain.value = rev; out.connect(s); s.connect(this.rev); }
      if (echo) { const s = ac.createGain(); s.gain.value = echo; out.connect(s); s.connect(this.echo); }
      return gn;
    };
    // electric piano: autopan tremolo, a soft top, plenty of plate
    this.ep = ac.createGain(); const epLp = ac.createBiquadFilter(), epHp = ac.createBiquadFilter(), epMud = ac.createBiquadFilter();
    epLp.type = "lowpass"; epLp.frequency.value = 5500; epHp.type = "highpass"; epHp.frequency.value = 170;
    epMud.type = "peaking"; epMud.frequency.value = 330; epMud.Q.value = 1; epMud.gain.value = -4;
    this.ep.connect(epHp); epHp.connect(epMud); epMud.connect(epLp);
    let epOut = epLp;
    if (ac.createStereoPanner) { epOut = ac.createStereoPanner(); this.lfo(4.4, .3, epOut.pan); epLp.connect(epOut); }
    epOut.connect(this.in); const es = ac.createGain(); es.gain.value = .45; epOut.connect(es); es.connect(this.rev);
    this.bassBus = bus(1, .03, 0);
    this.drums = bus(.85, .12, 0, .12);
    this.lead = bus(.8, .5, .3, .22);
    this.chime = bus(.7, .9, .15, -.3);
    // noise: white for drums and chatter, brown-ish for rain
    this.white = ac.createBuffer(1, sr * 2, sr);
    const wd = this.white.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    // beds after the tape: vinyl (four turns at 33 1/3), rain on the glass, distant chatter
    const vin = ac.createBuffer(1, Math.floor(sr * 7.2), sr), vd = vin.getChannelData(0); let pop = 0;
    for (let i = 0; i < vd.length; i++) {
      if (Math.random() < 5 / sr) pop = .3 + Math.random() * .6;
      vd[i] = (Math.random() * 2 - 1) * (.012 + pop); pop *= .9;
    }
    const bed = (buf, filters, gain) => {
      const s = ac.createBufferSource(), gn = ac.createGain(); s.buffer = buf; s.loop = true; gn.gain.value = gain;
      let n = s; for (const [type, f] of filters) { const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; n.connect(fl); n = fl; }
      n.connect(gn); gn.connect(glue); s.start(0, Math.random() * 2); return gn;
    };
    bed(vin, [["highpass", 1100]], .06);
    const rain = bed(this.white, [["lowpass", 1800], ["highpass", 450]], .014); this.lfo(.05, .005, rain.gain);
    const chatter = ac.createGain(), clp = ac.createBiquadFilter(); clp.type = "lowpass"; clp.frequency.value = 1600;
    chatter.connect(clp); clp.connect(glue); const cs = ac.createGain(); cs.gain.value = .7; clp.connect(cs); cs.connect(this.rev);
    this.voices = [.5, .35, .25].map((lvl, i) => {
      const src = ac.createBufferSource(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), amp = ac.createGain();
      src.buffer = this.white; src.loop = true; f1.type = f2.type = "bandpass"; f1.Q.value = 5; f2.Q.value = 7; amp.gain.value = 0;
      src.connect(f1); src.connect(f2); f1.connect(amp); f2.connect(amp); pan(amp, [-.6, .5, -.1][i]).connect(chatter);
      src.start(0, Math.random() * 2);
      return { f1, f2, amp, lvl, talk: 0, next: Math.random() * 6 };
    });
    this.liftAt = 0;
    this.newTrack();
    this.next = ac.currentTime + .15;
  },
  lfo(f, depth, param) {
    const o = this.ctx.createOscillator(), d = this.ctx.createGain(); o.frequency.value = f; d.gain.value = depth;
    o.connect(d); d.connect(param); o.start(); return o;
  },
  plate(sec) {
    const ac = this.ctx, n = Math.floor(ac.sampleRate * sec), pre = Math.floor(ac.sampleRate * .018), buf = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = pre; i < n; i++) {
        const k = (i - pre) / (n - pre);
        lp += (Math.random() * 2 - 1 - lp) * (.8 - .72 * k);                  // the tail darkens as it fades
        d[i] = lp * Math.exp(-k * 6.5);
      }
    }
    return buf;
  },
  newTrack() {
    const r = mulberry32((new Date().getDate() * 97 + new Date().getHours()) * 31 + this.track++);
    const pick = a => a[Math.floor(r() * a.length)];
    const key = Math.floor(r() * 12), motif = [];
    let d = 5 + Math.floor(r() * 3);
    for (const s of [0, 3, 6, 10, 16, 19, 22, 26]) if (r() < .6) { d = clamp(d + pick([-2, -1, -1, 0, 1, 1, 2]), 2, 10); motif.push([s, d, pick([2, 3, 4, 6])]); }
    if (!motif.length) motif.push([0, 5, 4]);
    this.p = { key, bpm: 68 + Math.floor(r() * 12), swing: .56 + r() * .06, tone: 5800 + r() * 2400,
      A: pick(A_PROGS), B: pick(B_PROGS), compA: pick(COMP), compB: pick(COMP), motif, title: `${pick(TITLES)} in ${KEYS[key]}` };
    this.echo.delayTime.value = 60 / this.p.bpm * .75;
    this.sec = 0; this.secBar = 0; this.step = 0; this.prevV = null;
    np.textContent = `♪ ${this.p.title} · ${this.p.bpm} bpm`;
  },
  tick(now) {
    if (!this.on) return;
    while (this.next < now + .15) {
      const p = this.p, dur = 60 / p.bpm / 4;
      this.play(this.step, this.next + (this.step % 2 ? dur * (p.swing - .5) * 2 : 0), dur);
      this.next += dur;
      if (++this.step === 16) {
        this.step = 0;
        if (++this.secBar >= FORM[this.sec][1]) { this.secBar = 0; if (++this.sec >= FORM.length) this.newTrack(); }
      }
    }
    this.ambience(now);
  },
  play(s, t, dur) {
    const p = this.p, [sec, bars] = FORM[this.sec], b = this.secBar;
    const prog = sec === "B" || sec === "break" ? p.B : p.A, bar = prog[b % 4], ch = bar[s < 8 || bar.length === 1 ? 0 : 1];
    const drums = sec === "A" || sec === "B", fill = drums && b === bars - 1;
    const hum = () => (Math.random() - .5) * .012, vel = v => v * (.85 + Math.random() * .3);
    if (s === 0 && b === 0) this.sweep(sec, t, dur * 16 * bars);
    // electric piano comping, voice-led
    const soft = drums ? 1 : .75;
    for (const [cs, len, v] of bar.length > 1 ? [[0, 7, .8], [8, 7, .72]] : sec === "B" ? p.compB : p.compA) if (cs === s) {
      const vc = this.voice(48 + p.key + ch[0], ch[1]);
      vc.forEach((m, i) => this.epNote(m, t + i * .011 + hum(), dur * len, vel(v) * soft));
    }
    // bass: root on the one, fifth on three, sometimes a chromatic step into the next chord
    if (sec !== "intro" || b >= 2) {
      const bn = 36 + (p.key + ch[0]) % 12;
      if (s === 0) this.bassNote(bn, t + hum(), dur * (bar.length > 1 ? 7 : 6), vel(.95));
      else if (s === 8 && bar.length > 1) this.bassNote(bn, t + hum(), dur * 6, vel(.9));
      else if (s === 8 && sec !== "break") this.bassNote(bn + 7 > 47 ? bn - 5 : bn + 7, t + hum(), dur * 5, vel(.75));
      else if (s === 14 && sec !== "outro" && Math.random() < .5) {
        const nx = 36 + (p.key + prog[(b + 1) % 4][0][0]) % 12;
        this.bassNote(nx + (Math.random() < .5 ? 1 : -1), t + hum(), dur * 1.6, vel(.6));
      }
    }
    // brushed drums, snare laid back a hair, a little fill at the end of each section
    if (drums) {
      if (s === 0 || (s === 10 && Math.random() < .7) || (s === 7 && Math.random() < .2)) this.kick(t + hum(), vel(s === 0 ? .9 : .6));
      if (s === 4 || s === 12) this.snare(t + .014 + hum(), vel(.85));
      else if (fill && s >= 13) this.snare(t + hum(), vel(.3 + (s - 13) * .12));
      else if (Math.random() < .08) this.brush(t + hum(), vel(.25));
      if (s % 2 === 0) this.hat(t + hum(), vel(s % 4 ? .45 : .7), s === 14 && Math.random() < .3);
    } else if (sec === "break" && s % 4 === 2) this.hat(t, vel(.3), false);
    // vibraphone motif: answered a step higher, turned upside down in B, rests at the end of each eight
    if ((sec === "B" || sec === "break" || (sec === "A" && this.sec === 3)) && b % 8 < 6) {
      const pos = (b % 2) * 16 + s;
      for (const [ms, d0, len] of p.motif) if (ms === pos && !(sec === "break" && Math.random() < .5)) {
        const d = (sec === "A" ? d0 : 12 - d0) + (b % 4 >= 2 ? (sec === "A" ? 1 : -1) : 0);
        this.vibe(p.key + 60 + Math.floor(d / 5) * 12 + PENTA[d % 5], t + hum(), dur * len, vel(.8));
      }
    }
  },
  sweep(sec, t, len) {
    const f = this.tone.frequency, top = this.p.tone;
    f.cancelScheduledValues(t); f.setValueAtTime(sec === "intro" ? 900 : this.toneAt || 900, t);
    if (sec === "intro") f.exponentialRampToValueAtTime(top, t + len);
    else if (sec === "outro") f.exponentialRampToValueAtTime(1500, t + len);
    else if (sec === "break") { f.exponentialRampToValueAtTime(2600, t + len * .5); f.exponentialRampToValueAtTime(top, t + len); }
    else f.exponentialRampToValueAtTime(top, t + .5);
    this.toneAt = sec === "outro" ? 1500 : top;
  },
  voice(root, q) {
    const base = VOICE[q].map(i => root + i);
    let best = null, bd = 1e9;
    for (let inv = 0; inv < 4; inv++) for (const oct of [-12, 0, 12]) {
      const v = base.map((n, i) => n + oct + (i < inv ? 12 : 0)).sort((a, b) => a - b);
      if (v[0] < 50 || v[3] > 77) continue;
      const d = this.prevV ? v.reduce((s, n, i) => s + Math.abs(n - this.prevV[i]), 0) : Math.abs(v[0] - 57) * 4;
      if (d < bd) { bd = d; best = v; }
    }
    return this.prevV = best || base;
  },
  epNote(m, t, dur, v) {                       // FM electric piano: a bright bark that mellows, plus the tine's tick
    const ac = this.ctx, f = mtof(m), car = ac.createOscillator(), mod = ac.createOscillator(), tine = ac.createOscillator();
    const mi = ac.createGain(), ti = ac.createGain(), amp = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f; tine.frequency.value = f * 14; car.detune.value = (Math.random() - .5) * 6;
    mi.gain.setValueAtTime(f * (.6 + 1.2 * v), t); mi.gain.exponentialRampToValueAtTime(f * .08, t + 1.4);
    ti.gain.setValueAtTime(f * 1.4 * v, t); ti.gain.exponentialRampToValueAtTime(.01, t + .06);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(v * .13, t + .005);
    amp.gain.setTargetAtTime(v * .047, t + .02, .7); amp.gain.setTargetAtTime(0, t + dur, .22);
    mod.connect(mi); mi.connect(car.frequency); tine.connect(ti); ti.connect(car.frequency); car.connect(amp); amp.connect(this.ep);
    for (const o of [car, mod, tine]) { o.start(t); o.stop(t + dur + 1.6); }
  },
  bassNote(m, t, dur, v) {                     // sine + triangle through a filter that closes after the pluck
    const ac = this.ctx, f = mtof(m), lp = ac.createBiquadFilter(), amp = ac.createGain(), o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
    o1.frequency.value = f; o2.type = "triangle"; o2.frequency.value = f; g2.gain.value = .8;
    lp.type = "lowpass"; lp.Q.value = 1.5; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(320, t + .22);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(.072 * v, t + .01);
    amp.gain.setTargetAtTime(.042 * v, t + .02, .3); amp.gain.setTargetAtTime(0, t + dur, .07);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(amp); amp.connect(this.bassBus);
    for (const o of [o1, o2]) { o.start(t); o.stop(t + dur + .6); }
  },
  vibe(m, t, dur, v) {                         // FM vibraphone, 1:4
    const ac = this.ctx, f = mtof(m), car = ac.createOscillator(), mod = ac.createOscillator(), mi = ac.createGain(), amp = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * 4;
    mi.gain.setValueAtTime(f * 1.1, t); mi.gain.exponentialRampToValueAtTime(f * .02, t + .35);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(.14 * v, t + .004); amp.gain.setTargetAtTime(0, t + .01, .45 + dur * .3);
    mod.connect(mi); mi.connect(car.frequency); car.connect(amp); amp.connect(this.lead);
    for (const o of [car, mod]) { o.start(t); o.stop(t + 3.5); }
  },
  bell(m, t, v) {                              // struck bell, inharmonic 1:3.5, for the desk bell and the lift
    const ac = this.ctx, f = mtof(m), car = ac.createOscillator(), mod = ac.createOscillator(), mi = ac.createGain(), amp = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mi.gain.setValueAtTime(f * 1.6, t); mi.gain.exponentialRampToValueAtTime(f * .1, t + 1.5);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(v, t + .003); amp.gain.setTargetAtTime(0, t + .01, .9);
    mod.connect(mi); mi.connect(car.frequency); car.connect(amp); amp.connect(this.chime);
    for (const o of [car, mod]) { o.start(t); o.stop(t + 5); }
  },
  noise(t, type, f, q, v, attack, decay, dst) {
    const ac = this.ctx, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), e = ac.createGain();
    s.buffer = this.white; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(v, t + attack); e.gain.setTargetAtTime(0, t + attack, decay);
    s.connect(fl); fl.connect(e); e.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + attack + decay * 7);
  },
  kick(t, v) {
    const ac = this.ctx, o = ac.createOscillator(), e = ac.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(52, t + .1);
    e.gain.setValueAtTime(.0001, t); e.gain.exponentialRampToValueAtTime(.38 * v, t + .004); e.gain.exponentialRampToValueAtTime(.001, t + .42);
    o.connect(e); e.connect(this.drums); o.start(t); o.stop(t + .45);
    this.noise(t, "lowpass", 2500, .7, .08 * v, .001, .006, this.drums);
  },
  snare(t, v) {                                // rim, a short body, and the brush
    const ac = this.ctx, o = ac.createOscillator(), e = ac.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(220, t + .05);
    e.gain.setValueAtTime(.12 * v, t); e.gain.exponentialRampToValueAtTime(.001, t + .12); o.connect(e); e.connect(this.drums); o.start(t); o.stop(t + .14);
    this.noise(t, "bandpass", 2600, 1.4, .1 * v, .001, .018, this.drums);
    this.brush(t, v);
  },
  brush(t, v) { this.noise(t, "bandpass", 3400, .5, .24 * v, .012, .07, this.drums); },
  hat(t, v, open) { this.noise(t, "highpass", 7400, .8, .1 * v, .001, open ? .14 : .022, this.drums); },
  ambience(now) {
    const p = this.p;
    if (now > this.liftAt) {                   // the lift arrives now and then: two notes in the track's key
      if (this.liftAt) { this.bell(76 + p.key, now + .05, .05); this.bell(72 + p.key, now + .6, .05); }
      this.liftAt = now + 70 + Math.random() * 90;
    }
    for (const v of this.voices) {             // distant chatter: noise "syllables" through moving formants
      if (now < v.next) continue;
      if (v.talk <= 0) { v.talk = 4 + Math.floor(Math.random() * 14); v.next = now + 3 + Math.random() * 9; continue; }
      const len = .07 + Math.random() * .16, t = now + .05;
      v.f1.frequency.setTargetAtTime(350 + Math.random() * 500, t, .03);
      v.f2.frequency.setTargetAtTime(1000 + Math.random() * 1400, t, .03);
      v.amp.gain.setTargetAtTime(v.lvl * (.4 + Math.random() * .6), t, .025); v.amp.gain.setTargetAtTime(0, t + len, .05);
      v.next = now + len + .04 + Math.random() * .12; v.talk--;
    }
  },
};
// one-shot effects, only when the scene is open with sound, in the key of whatever is playing
function sfx(kind) {
  if (!isFull || !music.on) return;
  const t = music.ctx.currentTime;
  if (kind === "bell") music.bell(84 + music.p.key, t, .08);
  if (kind === "stamp") { music.kick(t, .5); music.noise(t, "lowpass", 900, .7, .25, .001, .03, music.drums); }
}

// ---------- go ----------
if (location.hash === "#lobby") { // deep link: open straight away (music waits for a click, browsers require one)
  isFull = true; full.hidden = false; full.prepend(cv); document.body.style.overflow = "hidden"; music.wanted = true;
  full.addEventListener("click", () => music.start(), { once: true });
}
sync();
})();
