import { state } from "./store.js";
import { readParams } from "./params.js";
import {
  MONTHS_RU, getWeekdayLabel,
  parseRooms, buildFullSchedule, formatRoom,
  calcRows, calcRowGap, signedParams, signLayout,
} from "./schedule.js";
import { labelOf } from "./fonts.js";
import { processImage, getImageDimensions, log, clearLog, clamp } from "./utils.js";
import { LINE_DASHES } from "./config.js";

function rgbCss(c) {
  return `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
}
function svgBlendMode(name) {
  if (name === "invert") return "normal";
  return ["multiply","screen","overlay","darken","lighten"].includes(name) ? name : "normal";
}
function cssFamilyLocal(family, style) {
  const label = labelOf(family, style);
  if (label === "Helvetica") return "Helvetica, Arial, sans-serif";
  if (label === "Times New Roman") return "'Times New Roman', Times, serif";
  if (label === "Courier New") return "'Courier New', Courier, monospace";
  return `'${label}', Arial, sans-serif`;
}
function anchorFor(align) {
  if (align === "left") return "start";
  if (align === "right") return "end";
  return "middle";
}
function textXFor(align, cellLeft, cellW, dx) {
  if (align === "left")  return cellLeft + dx;
  if (align === "right") return cellLeft + cellW + dx;
  return cellLeft + cellW / 2 + dx;
}
function letterSpacingEm(tracking) {
  return (Number(tracking) || 0) / 1000;
}
function dashAttr(dashKey) {
  const d = LINE_DASHES[dashKey];
  if (!d || !d.dash) return "";
  return `stroke-dasharray="${d.dash.join(",")}"`;
}

export function buildSvgForMonth(rawP, year, month, scale, processedImages) {
  const P = signedParams(rawP);
  console.log("[buildSvg] START", { year, month, scale });

  const PAGE_W = P.page.w, PAGE_H = P.page.h;
  console.log("[buildSvg] PAGE_W =", PAGE_W, "PAGE_H =", PAGE_H);
  if (!isFinite(PAGE_W) || !isFinite(PAGE_H) || PAGE_W <= 0 || PAGE_H <= 0) {
    throw new Error("Некорректный размер страницы: " + PAGE_W + "×" + PAGE_H);
  }

  const COLS = 7;
  const CELL_H = P.date.h + P.room.h;
  const totalGapW = P.grid.colGap * (COLS - 1);
  const CELL_W = (PAGE_W - P.grid.sideMargin * 2 - totalGapW) / COLS;
  const GRID_TOP = PAGE_H - P.grid.topMargin;
  console.log("[buildSvg] CELL_W =", CELL_W, "CELL_H =", CELL_H, "GRID_TOP =", GRID_TOP);
  if (!isFinite(CELL_W) || !isFinite(CELL_H)) {
    throw new Error("Некорректные размеры ячейки: CELL_W=" + CELL_W + ", CELL_H=" + CELL_H);
  }

  const firstDay = new Date(year, month, 1);
  const startCol = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startCol);

  const ROWS = calcRows(year, month, P.grid.alwaysSix);
  const rowGap = calcRowGap(ROWS, P.grid.rowGap, CELL_H);
  console.log("[buildSvg] ROWS =", ROWS, "rowGap =", rowGap);

  const rooms = parseRooms(P.work.rooms);
  console.log("[buildSvg] rooms =", rooms);
  if (!rooms.length) throw new Error("Нет комнат");

  console.log("[buildSvg] lastRoom =", P.work.lastRoom, "lastDate =", P.work.lastDate, "order =", P.work.order);
  const lastDateObj = new Date(P.work.lastDate + "T00:00:00");
  if (isNaN(lastDateObj.getTime())) {
    console.warn("[buildSvg] lastDate невалидная:", P.work.lastDate);
  }

  const schedule = buildFullSchedule(
    rooms, P.work.lastRoom,
    lastDateObj,
    new Date(year, month - 2, 1),
    new Date(year, month + 3, 0),
    P.work.order
  );
  console.log("[buildSvg] schedule.size =", schedule.size);

  const svgW = PAGE_W * scale, svgH = PAGE_H * scale;
  const X = x => x * scale;
  const Y = y => (PAGE_H - y) * scale;

  const barH = P.bar.h;
  const artH = P.art.h;
  const artTop = P.art.top;
  const artRight = P.art.right;
  const artPadX = P.art.padX;
  const wdY = P.weekday.y;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`);
  parts.push(`<defs>
    <clipPath id="barClip"><rect x="0" y="${Y(barH)}" width="${svgW}" height="${barH*scale}"/></clipPath>
    <filter id="invertFilter"><feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/></filter>
  </defs>`);
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff"/>`);
  parts.push(`<rect x="0" y="${Y(barH)}" width="${svgW}" height="${barH*scale}" fill="${rgbCss(P.bar.bg)}"/>`);

  for (const im of processedImages) {
    const w = im.baseW * im.scale;
    const h = w * (im._dim.h / im._dim.w);
    const clipAttr = (P.bar.clip && im.clip) ? `clip-path="url(#barClip)"` : "";
    const filterAttr = im.blend === "invert" ? `filter="url(#invertFilter)"` : "";
    parts.push(`<g ${clipAttr} style="mix-blend-mode:${svgBlendMode(im.blend)}">`);
    parts.push(`<image class="draggable" data-img="${im.id}" opacity="${im.opacity}" ${filterAttr} x="${X(im.x - w/2)}" y="${Y(im.y + h/2)}" width="${w*scale}" height="${h*scale}" xlink:href="${im._dataUrl}" preserveAspectRatio="none" style="cursor:move"/>`);
    parts.push(`</g>`);
  }

  const lineGapPx = P.bar.line1Size * P.bar.lineGap;
  const midY = barH / 2 + P.bar.dy;
  const y1 = midY + lineGapPx / 2;
  const y2 = midY - lineGapPx / 2;

  const barLeft = P.bar.dx, barRight = PAGE_W - P.bar.dx;
  const bar1X = P.bar.line1Align === "right" ? barRight
              : P.bar.line1Align === "center" ? (barLeft + barRight) / 2
              : barLeft;
  const bar2X = P.bar.line2Align === "right" ? barRight
              : P.bar.line2Align === "center" ? (barLeft + barRight) / 2
              : barLeft;

  parts.push(`<text x="${X(bar1X)}" y="${Y(y1)}" font-family="${cssFamilyLocal(P.bar.line1FontFamily, P.bar.line1FontStyle)}" font-size="${P.bar.line1Size*scale}" font-weight="600" fill="${rgbCss(P.bar.line1Color)}" letter-spacing="${letterSpacingEm(P.bar.line1Tracking)}em" text-anchor="${anchorFor(P.bar.line1Align)}" dominant-baseline="middle">${P.bar.line1}</text>`);
  const line2Text = P.bar.line2.replace(/МЕСЯЦ/g, MONTHS_RU[month]).replace(/ГОД/g, year);
  parts.push(`<text x="${X(bar2X)}" y="${Y(y2)}" font-family="${cssFamilyLocal(P.bar.line2FontFamily, P.bar.line2FontStyle)}" font-size="${P.bar.line2Size*scale}" font-weight="600" fill="${rgbCss(P.bar.line2Color)}" letter-spacing="${letterSpacingEm(P.bar.line2Tracking)}em" text-anchor="${anchorFor(P.bar.line2Align)}" dominant-baseline="middle">${line2Text}</text>`);

  for (let i = 0; i < ROWS * COLS; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const r = Math.floor(i / COLS), c = i % COLS;
    const isCurrent = cellDate.getMonth() === month;
    const x0 = P.grid.sideMargin + c * (CELL_W + P.grid.colGap);
    const yTopDate = GRID_TOP - r * (CELL_H + rowGap);
    const yTopRoom = yTopDate - P.date.h;

    const dateStr = String(cellDate.getDate());
    const dateFamily = isCurrent ? P.date.fontFamily : (P.date.fontFamilyOther || P.date.fontFamily);
    const dateStyle  = isCurrent ? P.date.fontStyle  : (P.date.fontStyleOther  || P.date.fontStyle);
    const dateAlign  = P.date.align || "center";
    const dateColor  = isCurrent ? P.date.color : P.date.colorOther;
    const dateX = textXFor(dateAlign, x0, CELL_W, P.date.dx);
    const dateY = yTopDate - P.date.h / 2 + P.date.dy;
    parts.push(`<text x="${X(dateX)}" y="${Y(dateY)}" font-family="${cssFamilyLocal(dateFamily, dateStyle)}" font-size="${P.date.size*scale}" font-weight="${isCurrent ? 500 : 300}" fill="${rgbCss(dateColor)}" letter-spacing="${letterSpacingEm(P.date.tracking)}em" text-anchor="${anchorFor(dateAlign)}" dominant-baseline="middle">${dateStr}</text>`);

    const key = cellDate.getFullYear() + "-" +
                String(cellDate.getMonth()+1).padStart(2,"0") + "-" +
                String(cellDate.getDate()).padStart(2,"0");
    const room = schedule.get(key);
    if (room !== undefined) {
      const roomStr = formatRoom(room, P.room, rooms);
      const roomFamily = isCurrent ? P.room.fontFamily : (P.room.fontFamilyOther || P.room.fontFamily);
      const roomStyle  = isCurrent ? P.room.fontStyle  : (P.room.fontStyleOther  || P.room.fontStyle);
      const roomColor  = isCurrent ? P.room.color : P.room.colorOther;
      let roomY = yTopRoom + P.room.h / 2 + P.room.dy;
      let roomAlign = P.room.align || "center";
      let roomX = textXFor(roomAlign, x0, CELL_W, P.room.dx);
      if (P.sign.on) {
        const sign = signLayout(P, x0, CELL_W);
        if (isCurrent) {
          const ySign = roomY - P.room.size * 0.35;
          parts.push(`<line x1="${X(sign.x1)}" y1="${Y(ySign)}" x2="${X(sign.x2)}" y2="${Y(ySign)}" stroke="${rgbCss(P.line.color)}" stroke-width="${P.sign.w * scale}" ${dashAttr(P.sign.dash)}/>`);
        }
        roomAlign = "right";
        roomX = sign.roomX;
        roomY = dateY + 0.45 * (P.date.size - P.room.size);
      }
      parts.push(`<text x="${X(roomX)}" y="${Y(roomY)}" font-family="${cssFamilyLocal(roomFamily, roomStyle)}" font-size="${P.room.size*scale}" font-weight="${isCurrent ? 600 : 300}" fill="${rgbCss(roomColor)}" letter-spacing="${letterSpacingEm(P.room.tracking)}em" text-anchor="${anchorFor(roomAlign)}" dominant-baseline="middle">${roomStr}</text>`);
    }
  }

  for (let c = 0; c < COLS; c++) {
    const x0 = P.grid.sideMargin + c * (CELL_W + P.grid.colGap);
    const wdAlign = P.weekday.align || "left";
    const wdX = wdAlign === "right" ? x0 + CELL_W - P.weekday.padLeft
              : wdAlign === "center" ? x0 + CELL_W / 2
              : x0 + P.weekday.padLeft;
    const label = getWeekdayLabel(c, P.weekday.form, P.weekday.case);
    parts.push(`<text x="${X(wdX)}" y="${Y(wdY)}" font-family="${cssFamilyLocal(P.weekday.fontFamily, P.weekday.fontStyle)}" font-size="${P.weekday.size*scale}" font-weight="400" fill="${rgbCss(P.weekday.color)}" letter-spacing="${letterSpacingEm(P.weekday.tracking)}em" text-anchor="${anchorFor(wdAlign)}">${label}</text>`);
  }

  for (let c = 1; c < COLS; c++) {
    const xLine = P.grid.sideMargin + c * (CELL_W + P.grid.colGap) - P.grid.colGap / 2;
    parts.push(`<line x1="${X(xLine)}" y1="${Y(PAGE_H - P.line.top)}" x2="${X(xLine)}" y2="${Y(PAGE_H - P.line.bottom)}" stroke="${rgbCss(P.line.color)}" stroke-opacity="${P.line.opacity ?? 1}" stroke-width="${P.line.w * scale}" ${dashAttr(P.line.dash)}/>`);
  }

  if (P.line.horiz) {
    for (let r = 1; r < ROWS; r++) {
      const yMid = GRID_TOP - r * CELL_H - (r - 1) * rowGap - rowGap / 2;
      parts.push(`<line x1="${X(P.grid.sideMargin + P.line.horizPad)}" y1="${Y(yMid)}" x2="${X(PAGE_W - P.grid.sideMargin - P.line.horizPad)}" y2="${Y(yMid)}" stroke="${rgbCss(P.line.color)}" stroke-width="${P.line.horizW * scale}" ${dashAttr(P.line.horizDash)}/>`);
    }
  }

  const artSize = P.art.size;
  const artTextW = artSize * (0.55 + letterSpacingEm(P.art.tracking)) * P.art.text.length;
  const artW = artTextW + artPadX * 2;
  const artX = PAGE_W - artW - artRight;
  const artY = PAGE_H - artH - artTop;
  const artTextX = P.art.x ?? artX + artPadX;
  const artAnchor = anchorFor(P.art.x == null ? "left" : P.art.align);
  parts.push(`<text x="${X(artTextX)}" y="${Y(artY + artH/2)}" font-family="${cssFamilyLocal(P.art.fontFamily, P.art.fontStyle)}" font-size="${artSize*scale}" font-weight="600" fill="${rgbCss(P.art.color)}" letter-spacing="${letterSpacingEm(P.art.tracking)}em" opacity="${P.art.opacity}" text-anchor="${artAnchor}" dominant-baseline="middle">${P.art.text}</text>`);

  parts.push(`</svg>`);
  const result = parts.join("");
  console.log("[buildSvg] END, длина SVG =", result.length);
  return result;
}

import { previewLoader } from "./progress.js";

export async function render() {
  previewLoader(true);
  clearLog();
  try {
    const P = readParams();
    const { previewMonth, monthFrom } = P.work;
    const src = previewMonth || monthFrom;
    if (!src) return;
    state.currentPreviewMonth = src;

    const [y, m] = src.split("-").map(Number);
    const previewY = y;
    const previewM = m - 1;

    const rooms = parseRooms(P.work.rooms);
    if (!rooms.length) { log("Нет комнат", "err"); return; }

    const processedImages = [];
    for (const im of state.images) {
      if (!im.dataUrl) continue;
      const dataUrl = await processImage(im.dataUrl, im.bright, im.contrast, im.sat);
      const dim = await getImageDimensions(im.dataUrl);
      processedImages.push({ ...im, _dataUrl: dataUrl, _dim: dim });
    }

    const svgStr = buildSvgForMonth(P, previewY, previewM, P.work.scale, processedImages);
    document.getElementById("preview").innerHTML = svgStr;
    state.lastRenderedSvg = svgStr;
    setupDragAndDrop();
    setupWheelZoom();
  } catch (e) {
    console.error(e);
    log("Ошибка рендера: " + e.message, "err");
  } finally {
    previewLoader(false);
  }
}


function setupDragAndDrop() {
  const svg = document.querySelector("#preview svg"); if (!svg) return;
  svg.querySelectorAll("image.draggable").forEach(node => {
    node.addEventListener("mousedown", e => {
      e.preventDefault();
      const id = node.getAttribute("data-img");
      const img = state.images.find(i => i.id === id); if (!img) return;
      const P = readParams();
      const startX = e.clientX, startY = e.clientY;
      const startImgX = img.x, startImgY = img.y;
      function onMove(ev) {
        img.x = startImgX + (ev.clientX - startX) / P.work.scale / 2.834645669;
        img.y = startImgY - (ev.clientY - startY) / P.work.scale / 2.834645669;
        if (state.autoUpdate) render();
        document.querySelectorAll("#imagesList .imgCard").forEach(c => {
          const nameInput = c.querySelector('[data-act="name"]');
          if (nameInput && nameInput.value === img.name) {
            c.querySelector('[data-act="x"]').value = img.x.toFixed(1);
            c.querySelector('[data-act="y"]').value = img.y.toFixed(1);
          }
        });
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

function setupWheelZoom() {
  const wrap = document.getElementById("previewWrap");
  wrap.onwheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const cur = parseFloat(document.getElementById("pScale")?.value || "1");
    const next = Math.max(0.1, Math.min(5, cur + (e.deltaY > 0 ? -0.05 : 0.05)));
    const el = document.getElementById("pScale");
    if (el) el.value = next.toFixed(2);
    render();
  };
  if (!wrap._pinchBound) {
    wrap._pinchBound = true;
    let startDist = 0, startScale = 1;
    wrap.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 2) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist = Math.hypot(dx, dy);
      startScale = parseFloat(document.getElementById("pScale")?.value || "1");
    }, { passive: true });
    wrap.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (startDist <= 0) return;
      const next = Math.max(0.1, Math.min(5, startScale * (dist / startDist)));
      const el = document.getElementById("pScale");
      if (el) el.value = next.toFixed(2);
      render();
    }, { passive: false });
  }
}