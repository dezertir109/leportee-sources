/* Le Portée at the desk: a lofi pixel lobby driven by sources.json.
   Small and silent in the corner; click to open it full screen with music.
   Every key in the cubbies is a source in the library (click one to open it),
   the books on the shelf are the Readables, and the Scout walks in with next-issue candidates.
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
let items = [], keys = [], books = [], visitors = [], latest = "";
function load(list) {
  items = list || [];
  latest = items.reduce((m, i) => (i.week || "") > m ? i.week : m, "");
  const order = { academia: 0, reports: 1, tips: 2, readable: 3 };
  keys = items.filter(i => i.kind !== "readable" && i.status !== "next-issue candidate")
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.week || "").localeCompare(b.week || ""));
  books = items.filter(i => i.kind === "readable");
  visitors = items.filter(i => i.status === "next-issue candidate");
  hud.innerHTML = "";
  const l = document.createElement("span");
  const fresh = keys.filter(i => i.week === latest).length;
  l.innerHTML = `<b>LE PORTÉE</b> · night shift · ${keys.length} keys in the cubbies · ${fresh} new this week · ${visitors.length} waiting at the door`;
  const r = document.createElement("span"); r.textContent = "click a key or a book to open it · M music · Esc close";
  hud.append(l, r);
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

// ---------- the Scout ----------
let scout = null, ringAt = -1e9, nextVisit = 4000, visitIx = 0;
function drawScout(t) {
  if (!scout) return 0;
  const s = scout, k = 2, y = 236;
  const x = Math.round(s.x), step = s.walking && Math.floor(t / 200) % 2;
  const P = (dx, dy, w, h, c) => px(x + dx * k, y + dy * k, w * k, h * k, c);
  if (step) { P(0, -2, 1, 2, "#1c1a24"); P(4, -2, 1, 2, "#1c1a24"); } else { P(1, -2, 1, 2, "#1c1a24"); P(3, -2, 1, 2, "#1c1a24"); }
  P(0, -7, 5, 5, "#3f5f52");                       // green field coat
  P(s.dir > 0 ? -1 : 4, -6, 2, 3, "#8a6a40");      // satchel
  P(1, -10, 3, 3, C.skin);
  P(0, -11, 5, 1, "#2a2a2a"); P(1, -12, 3, 1, "#2a2a2a");   // flat cap
  if (s.carry) P(s.dir > 0 ? 4 : -1, -6, 2, 2, C.paper);
  hits.push({ x: x - 2, y: y - 26, w: 14, h: 28, it: s.it, label: () => "The Scout, with a next-issue candidate: " + s.it.title });
  return 1;
}
function updateScout(t, dt) {
  if (!scout) {
    if (t > nextVisit && visitors.length && !REDUCED) {
      const it = visitors[visitIx++ % visitors.length];
      scout = { x: DOOR + 14, dir: -1, walking: true, phase: "in", it, carry: true, wait: 0 };
    }
    return 0;
  }
  const s = scout;
  if (s.phase === "in") { s.x -= dt * .028; if (s.x <= 300) { s.walking = false; s.phase = "desk"; s.wait = t + 3600; ring(t); } }
  else if (s.phase === "desk") {
    if (t > s.wait - 2400 && s.carry) { s.carry = false; ME.act = "stamp"; ME.until = t + 700; ME.stamped = t; sfx("stamp"); }
    if (t > s.wait) { s.phase = "out"; s.dir = 1; s.walking = true; ME.act = "wave"; ME.until = t + 1200; }
  } else if (s.phase === "out") { s.x += dt * .028; if (s.x > DOOR + 16) { scout = null; nextVisit = t + 14000 + Math.random() * 12000; } }
  ME.look = scout ? (scout.x > 250 ? 1 : 0) : 0;
  const dx = scout ? Math.abs(scout.x - DOOR - 14) : 99;
  return clamp(1 - dx / 30, 0, 1);
}
function ring(t) { ringAt = t; sfx("bell"); ME.act = "wave"; ME.until = t + 900; }

// ---------- frame ----------
let last = 0, running = false, isFull = false, raf = 0, stillDrawn = false;
function frame(now) {
  raf = 0;
  const dt = Math.min(now - last, 100);
  if (!isFull && now - last < 1000 / 15) { schedule(); return; }        // the corner widget runs at 15 fps
  last = now;
  hits = [];
  if (ME.act !== "write" && now > ME.until) ME.act = "write";
  if (!scout && !REDUCED && now > ME.until + 9000 && Math.random() < .002) { ME.act = "stamp"; ME.until = now + 700; ME.stamped = now; sfx("stamp"); }
  const date = new Date(), hour = date.getHours() + date.getMinutes() / 60;
  const open = updateScout(now, dt);
  drawRoom(now); drawWindow(now, hour); drawCart(); drawDoor(now, open); drawSign(now);
  drawCubbies(now); drawClock(date); drawShelf(now); drawPendant(now);
  drawPortee(now); drawDesk(now); drawLamp(now); drawPlant(); drawScout(now);
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
  cv.style.cursor = h ? "pointer" : "default";
  if (!h) { tip.style.display = "none"; return; }
  tip.textContent = h.label(); tip.style.display = "block";
  tip.style.left = Math.min(e.clientX + 14, innerWidth - 300) + "px"; tip.style.top = (e.clientY + 16) + "px";
});
cv.addEventListener("mouseleave", () => tip.style.display = "none");
cv.addEventListener("click", e => {
  if (!isFull) return;
  const h = at(e); if (!h) return;
  e.stopPropagation(); closeFull(false);
  if (window.libraryReveal) window.libraryReveal(h.it.id);
});

// ---------- music: a slower, warmer cousin of the night-scene loop ----------
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const DEG = { I: [0, 4, 7, 11, 14], ii: [2, 5, 9, 12], iii: [4, 7, 11, 14], IV: [5, 9, 12, 16], V: [7, 11, 14, 17], vi: [9, 12, 16, 19] };
const PROGS = [["I", "vi", "ii", "V"], ["IV", "iii", "ii", "I"], ["ii", "V", "I", "IV"], ["vi", "IV", "I", "V"]];
const music = {
  ctx: null, on: false, wanted: false,
  start() {
    if (!this.wanted) return;
    if (this.ctx) { this.ctx.resume(); this.on = true; return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = this.ctx = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    const tone = ac.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3600;
    this.out = ac.createGain(); this.out.gain.value = .75; this.out.connect(tone); tone.connect(comp); comp.connect(ac.destination);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.keys = ac.createGain(); const klp = ac.createBiquadFilter(), trem = ac.createGain(); klp.frequency.value = 1700; trem.gain.value = .85;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 3.6; lg.gain.value = .12; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
    this.keys.connect(klp); klp.connect(trem); trem.connect(this.out);
    this.delay = ac.createDelay(2); const fb = ac.createGain(); fb.gain.value = .3; this.delay.delayTime.value = .42;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.out);
    // vinyl + rain beds
    const cb = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), cd = cb.getChannelData(0); let br = 0;
    for (let i = 0; i < cd.length; i++) { br = (br + (Math.random() * 2 - 1) * .02) * .995; cd[i] = br * .4 + (Math.random() < .0005 ? (Math.random() * 2 - 1) * .8 : 0); }
    const loop = (buf, type, f, gain) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gg = ac.createGain();
      s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; gg.gain.value = gain; s.connect(fl); fl.connect(gg); gg.connect(this.out); s.start(); };
    loop(cb, "highpass", 700, .12); loop(nb, "bandpass", 1000, .05);
    const r = mulberry32(new Date().getDate() * 31 + new Date().getHours());
    this.p = { key: [57, 58, 60, 62, 63][Math.floor(r() * 5)] - 12, prog: PROGS[Math.floor(r() * PROGS.length)] };
    this.step = 0; this.bar = 0; this.bpm = 70; this.next = ac.currentTime + .1;
    this.timer = setInterval(() => this.tick(), 25); this.on = true;
  },
  stop() { if (this.ctx) this.ctx.suspend(); this.on = false; },
  tick() {
    const ac = this.ctx; if (!this.on) return;
    while (this.next < ac.currentTime + .12) {
      const dur = 60 / this.bpm / 4, t = this.next + (this.step % 2 ? dur * .2 : 0);
      this.play(this.step, t, dur); this.next += dur;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  },
  play(s, t, dur) {
    const p = this.p, ch = DEG[p.prog[this.bar % 4]], brk = this.bar % 16 >= 14;
    if (!brk && (s === 0 || s === 10)) this.kick(t);
    if (!brk && (s === 4 || s === 12)) this.hit(t, "bandpass", 1600, .22, .05);
    if (s % 2 === 0 && Math.random() > .15) this.hit(t, "highpass", 7500, s % 4 ? .03 : .05, .012);
    if (s === 0) ch.forEach((o, i) => this.ep(p.key + 12 + o, t + i * .014, dur * 14, .5));
    if (s === 0) this.bass(p.key - 12 + ch[0], t, dur * 8);
    if (s === 10) this.bass(p.key - 12 + ch[0] + 7, t, dur * 4);
    if ([3, 7, 11, 14].includes(s) && Math.random() < .22) this.bell(p.key + 24 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)], t, .35);
  },
  osc(type, f, t, dst) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dst); o.start(t); return o; },
  ep(m, t, dur, v) {
    const e = this.ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(v * .12, t + .01);
    e.gain.setTargetAtTime(v * .05, t + .02, .5); e.gain.setTargetAtTime(0, t + dur, .3); e.connect(this.keys);
    [this.osc("sine", mtof(m), t, e), this.osc("triangle", mtof(m) * 1.003, t, e)].forEach(o => o.stop(t + dur + 1.5));
  },
  bass(m, t, dur) {
    const e = this.ctx.createGain(), lp = this.ctx.createBiquadFilter(); lp.frequency.value = 400;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.28, t + .02); e.gain.setTargetAtTime(0, t + dur * .8, .15);
    e.connect(lp); lp.connect(this.out); this.osc("sine", mtof(m), t, e).stop(t + dur + 1);
  },
  bell(m, t, v) {
    const e = this.ctx.createGain(); e.gain.setValueAtTime(v * .07, t); e.gain.setTargetAtTime(0, t, .4);
    e.connect(this.out); e.connect(this.delay); this.osc("sine", mtof(m), t, e).stop(t + 2.5);
  },
  kick(t) {
    const o = this.ctx.createOscillator(), e = this.ctx.createGain();
    o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    e.gain.setValueAtTime(.75, t); e.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(e); e.connect(this.out); o.start(t); o.stop(t + .4);
  },
  hit(t, type, f, v, decay) {
    const s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), e = this.ctx.createGain();
    s.buffer = this.noise; fl.type = type; fl.frequency.value = f; e.gain.setValueAtTime(v, t); e.gain.setTargetAtTime(0, t, decay);
    s.connect(fl); fl.connect(e); e.connect(this.out); s.start(t, Math.random() * 1.5); s.stop(t + decay * 8);
  },
};
// one-shot effects, only when the scene is open with sound
function sfx(kind) {
  if (!isFull || !music.on) return;
  const t = music.ctx.currentTime;
  if (kind === "bell") { [2093, 2637].forEach((f, i) => { const e = music.ctx.createGain(); e.gain.setValueAtTime(.09, t + i * .02); e.gain.setTargetAtTime(0, t + i * .02, .5); e.connect(music.out); music.osc("sine", f, t + i * .02, e).stop(t + 2); }); }
  if (kind === "stamp") { music.kick(t); music.hit(t, "lowpass", 900, .3, .03); }
}

// ---------- go ----------
if (location.hash === "#lobby") { // deep link: open straight away (music waits for a click, browsers require one)
  isFull = true; full.hidden = false; full.prepend(cv); document.body.style.overflow = "hidden"; music.wanted = true;
  full.addEventListener("click", () => music.start(), { once: true });
}
sync();
})();
