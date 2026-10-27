import { state } from "./store.js";
import { readParams } from "./params.js";
import {
  MONTHS_RU, getWeekdayLabel,
  parseRooms, buildFullSchedule, formatRoom,
  calcRows, calcRowGap, barLineY,
} from "./schedule.js";
import { FONTS, getFontBytes } from "./fonts.js";
import {
  processImage, getImageDimensions, dataUrlToUint8Array, log, clearLog, buildFileName,
  showThanks,
} from "./utils.js";
import { progressStart, progressSet, progressDone, overlayShow, overlayHide } from "./progress.js";
import { LINE_DASHES } from "./config.js";

function keyOf(family, style) {
  if (!family) return null;
  const entry = Object.entries(FONTS).find(
    ([, f]) => !f.alias && f.family === family && f.style === style
  );
  if (entry) return entry[0];
  const first = Object.entries(FONTS).find(([, f]) => !f.alias && f.family === family);
  return first ? first[0] : null;
}
function pdfDash(dashKey, thickness) {
  const d = LINE_DASHES[dashKey];
  if (!d || !d.dash) return undefined;
  return d.dash.map(v => v * Math.max(thickness, 0.3));
}
function baselineFromMiddle(font, middleY, size) {
  if (!font) return middleY;
  const f = font.embedder.font;
  const xHeight = f.unitsPerEm ? f.xHeight / f.unitsPerEm : f.XHeight / 1000;
  return middleY - size * xHeight / 2;
}
function drawRule(page, x1, y1, x2, y2, color, thickness, dash, opacity = 1) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end:   { x: x2, y: y2 },
    thickness,
    color: PDFLib.rgb(color.r, color.g, color.b),
    opacity,
    dashArray: pdfDash(dash, thickness),
  });
}

export async function exportPdf() {
  clearLog();
  progressStart();
  overlayShow("Готовим PDF…", "Загрузка шрифтов");
  try {
    const P = readParams();
    const rooms = parseRooms(P.work.rooms);
    if (!rooms.length) { log("Нет комнат", "err"); return; }

    const { monthFrom, monthTo, lastRoom, lastDate, order } = P.work;
    const [fromY, fromM] = monthFrom.split("-").map(Number);
    const [toY, toM]     = monthTo.split("-").map(Number);
    const fromIdx = fromY * 12 + (fromM - 1);
    const toIdx   = toY   * 12 + (toM   - 1);
    if (fromIdx > toIdx) { log("Месяц «с» больше, чем месяц «по»", "err"); return; }

    const { PDFDocument, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const fontCache = {};
    async function getFont(key) {
      if (!key) return null;
      if (fontCache[key]) return fontCache[key];
      const f = FONTS[key];
      if (!f) throw new Error("Шрифт не найден: " + key);
      let font;
      if (f.builtin) {
        if (key === "helvetica") font = await doc.embedFont("Helvetica");
        else if (key === "times") font = await doc.embedFont("Times-Roman");
        else if (key === "courier") font = await doc.embedFont("Courier");
        else font = await doc.embedFont("Helvetica");
      } else {
        font = await doc.embedFont(await getFontBytes(key), { subset: true });
      }
      fontCache[key] = font;
      return font;
    }

    const keyDate       = keyOf(P.date.fontFamily, P.date.fontStyle);
    const keyDateOther  = keyOf(P.date.fontFamilyOther || P.date.fontFamily, P.date.fontStyleOther || P.date.fontStyle);
    const keyRoom       = keyOf(P.room.fontFamily, P.room.fontStyle);
    const keyRoomOther  = keyOf(P.room.fontFamilyOther || P.room.fontFamily, P.room.fontStyleOther || P.room.fontStyle);
    const keyWd         = keyOf(P.weekday.fontFamily, P.weekday.fontStyle);
    const keyBar1       = keyOf(P.bar.line1FontFamily, P.bar.line1FontStyle);
    const keyBar2       = keyOf(P.bar.line2FontFamily, P.bar.line2FontStyle);
    const keyArt        = keyOf(P.art.fontFamily, P.art.fontStyle);

    const fontDate       = await getFont(keyDate);
    const fontDateOther  = await getFont(keyDateOther) || fontDate;
    const fontRoom       = await getFont(keyRoom);
    const fontRoomOther  = await getFont(keyRoomOther) || fontRoom;
    const fontWd         = await getFont(keyWd) || fontDate;
    const fontBarLine1   = await getFont(keyBar1) || fontDate;
    const fontBarLine2   = await getFont(keyBar2) || fontDate;
    const fontArt        = await getFont(keyArt) || fontDate;
    progressSet(20);

    const PAGE_W = P.page.w, PAGE_H = P.page.h;
    const COLS = 7;
    const totalGapW = P.grid.colGap * (COLS - 1);
    const CELL_W = (PAGE_W - P.grid.sideMargin * 2 - totalGapW) / COLS;
    const GRID_TOP = PAGE_H - P.grid.topMargin;
    const CELL_H = P.date.h + P.room.h;

    const barH = P.bar.h;
    const artH = P.art.h;
    const artTop = P.art.top;
    const artRight = P.art.right;

    const schedStart = new Date(fromY, fromM - 3, 1);
    const schedEnd   = new Date(toY, toM + 2, 0);
    const schedule = buildFullSchedule(
      rooms, lastRoom, new Date(lastDate + "T00:00:00"),
      schedStart, schedEnd, order
    );

    const pdfImages = [];
    for (const im of state.images) {
      if (!im.dataUrl) continue;
      const dataUrl = await processImage(im.dataUrl, im.bright, im.contrast, im.sat);
      const pngBytes = dataUrlToUint8Array(dataUrl);
      const img = await doc.embedPng(pngBytes);
      const dim = await getImageDimensions(im.dataUrl);
      pdfImages.push({ cfg: im, img, dim });
    }

    const totalPages = toIdx - fromIdx + 1;
    let pageDone = 0;

    function textWidth(font, text, size, tracking) {
      if (!font) return 0;
      const cs = (Number(tracking) || 0) / 1000 * size;
      return font.widthOfTextAtSize(text, size) + cs * Math.max(0, text.length - 1);
    }
    function drawAligned(page, font, text, size, tracking, color, xLeft, xRight, y, align, opacity = 1) {
      if (!font) return;
      const w = textWidth(font, text, size, tracking);
      let x = xLeft;
      if (align === "center") x = (xLeft + xRight) / 2 - w / 2;
      else if (align === "right") x = xRight - w;
      const cs = (Number(tracking) || 0) / 1000 * size;
      page.drawText(text, { x, y, size, font, color, opacity, characterSpacing: cs });
    }

    for (let idx = fromIdx; idx <= toIdx; idx++) {
      const year  = Math.floor(idx / 12);
      const month = idx % 12;

      const startCol = (new Date(year, month, 1).getDay() + 6) % 7;
      const ROWS = calcRows(year, month, P.grid.alwaysSix);
      const rowGap = calcRowGap(ROWS, P.grid.rowGap, CELL_H);
      const gridStart = new Date(year, month, 1 - startCol);

      const page = doc.addPage([PAGE_W, PAGE_H]);
      page.drawRectangle({
        x: 0, y: 0, width: PAGE_W, height: barH,
        color: rgb(P.bar.bg.r, P.bar.bg.g, P.bar.bg.b),
      });

      const { pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } = PDFLib;
      const doClip = P.bar.clip;
      for (const { cfg, img, dim } of pdfImages) {
        if (doClip && cfg.clip) {
          page.pushOperators(
            pushGraphicsState(),
            moveTo(0, 0), lineTo(PAGE_W, 0),
            lineTo(PAGE_W, barH), lineTo(0, barH),
            closePath(), clip(), endPath()
          );
        }
        const w = cfg.baseW * cfg.scale;
        const h = w * (dim.h / dim.w);
        page.drawImage(img, { x: cfg.x - w/2, y: cfg.y - h/2, width: w, height: h, opacity: cfg.opacity });
        if (doClip && cfg.clip) page.pushOperators(popGraphicsState());
      }

      const { y1, y2 } = barLineY(P);
      const barLeft = P.bar.dx, barRight = PAGE_W - P.bar.dx;
      drawAligned(page, fontBarLine1, P.bar.line1, P.bar.line1Size, P.bar.line1Tracking,
        rgb(P.bar.line1Color.r, P.bar.line1Color.g, P.bar.line1Color.b),
        barLeft, barRight, baselineFromMiddle(fontBarLine1, y1, P.bar.line1Size), P.bar.line1Align);
      const line2Text = P.bar.line2.replace(/МЕСЯЦ/g, MONTHS_RU[month]).replace(/ГОД/g, String(year));
      drawAligned(page, fontBarLine2, line2Text, P.bar.line2Size, P.bar.line2Tracking,
        rgb(P.bar.line2Color.r, P.bar.line2Color.g, P.bar.line2Color.b),
        barLeft, barRight, baselineFromMiddle(fontBarLine2, y2, P.bar.line2Size), P.bar.line2Align);

      for (let i = 0; i < ROWS * COLS; i++) {
        const cellDate = new Date(gridStart); cellDate.setDate(gridStart.getDate() + i);
        const r = Math.floor(i / COLS), c = i % COLS;
        const isCurrent = cellDate.getMonth() === month;
        const x0 = P.grid.sideMargin + c * (CELL_W + P.grid.colGap);
        const yTopDate = GRID_TOP - r * (CELL_H + rowGap);
        const yTopRoom = yTopDate - P.date.h;

        const dateStr = String(cellDate.getDate());
        const dateAlign  = P.date.align || "center";
        const dateFont   = isCurrent ? fontDate : fontDateOther;
        const dateColor  = isCurrent ? P.date.color : P.date.colorOther;
        const dateY      = baselineFromMiddle(dateFont, yTopDate - P.date.h/2 + P.date.dy, P.date.size);
        drawAligned(page, dateFont, dateStr, P.date.size, P.date.tracking,
          rgb(dateColor.r, dateColor.g, dateColor.b),
          x0 + P.date.dx, x0 + CELL_W + P.date.dx, dateY, dateAlign);

        const key = cellDate.getFullYear() + "-" +
                    String(cellDate.getMonth()+1).padStart(2,"0") + "-" +
                    String(cellDate.getDate()).padStart(2,"0");
        const room = schedule.get(key);
        if (room !== undefined) {
          const roomStr = formatRoom(room, P.room, rooms);
          const roomFont   = isCurrent ? fontRoom : fontRoomOther;
          const roomAlign  = P.room.align || "center";
          const roomColor  = isCurrent ? P.room.color : P.room.colorOther;
          const roomY      = baselineFromMiddle(roomFont, yTopRoom + P.room.h/2 + P.room.dy, P.room.size);
          if (P.sign.on && isCurrent) {
            const ySign = yTopDate - P.sign.lineY;
            drawRule(page, x0 + P.sign.pad, ySign, x0 + CELL_W - P.sign.pad, ySign, P.line.color, P.sign.w, P.sign.dash);
          }
          drawAligned(page, roomFont, roomStr, P.room.size, P.room.tracking,
            rgb(roomColor.r, roomColor.g, roomColor.b),
            x0 + P.room.dx, x0 + CELL_W + P.room.dx, roomY, roomAlign);
        }
      }

      for (let c = 0; c < COLS; c++) {
        const x0 = P.grid.sideMargin + c * (CELL_W + P.grid.colGap);
        const label = getWeekdayLabel(c, P.weekday.form, P.weekday.case);
        const wdAlign = P.weekday.align || "left";
        const wdLeft = wdAlign === "left" ? x0 + P.weekday.padLeft : x0;
        const wdRight = wdAlign === "right" ? x0 + CELL_W - P.weekday.padLeft : x0 + CELL_W;
        drawAligned(page, fontWd, label, P.weekday.size, P.weekday.tracking,
          rgb(P.weekday.color.r, P.weekday.color.g, P.weekday.color.b),
          wdLeft, wdRight, P.weekday.y, wdAlign);
      }

      for (let c = 1; c < COLS; c++) {
        const xLine = P.grid.sideMargin + c * (CELL_W + P.grid.colGap) - P.grid.colGap / 2;
        drawRule(page, xLine, PAGE_H - P.line.bottom, xLine, PAGE_H - P.line.top, P.line.color, P.line.w, P.line.dash, P.line.opacity);
      }

      if (P.line.horiz) {
        for (let r = 1; r < ROWS; r++) {
          const yMid = GRID_TOP - r * CELL_H - (r - 1) * rowGap - rowGap / 2;
          drawRule(page, P.grid.sideMargin + P.line.horizPad, yMid, PAGE_W - P.grid.sideMargin - P.line.horizPad, yMid, P.line.color, P.line.horizW, P.line.horizDash);
        }
      }

      if (fontArt) {
        const artSize = P.art.size;
        const artW = textWidth(fontArt, P.art.text, artSize, P.art.tracking) + P.art.padX * 2;
        const artTextX = P.art.x ?? PAGE_W - artW - artRight + P.art.padX;
        const artCy = P.art.cy ?? PAGE_H - artTop - artH / 2;
        drawAligned(page, fontArt, P.art.text, artSize, P.art.tracking,
          rgb(P.art.color.r, P.art.color.g, P.art.color.b),
          artTextX, artTextX, baselineFromMiddle(fontArt, artCy, artSize), P.art.align, P.art.opacity);
      }

      pageDone++;
      progressSet(20 + (pageDone / totalPages) * 75);
      overlayShow("Готовим PDF…", `${MONTHS_RU[month]} ${year} (${pageDone} из ${totalPages})`);
      log(`Страница ${MONTHS_RU[month]} ${year}`);
    }

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFileName(P.work.rooms, P.work.monthFrom, P.work.monthTo, "pdf");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    log("PDF сохранён", "ok");
    overlayShow("Готово", "PDF сохранён");
    setTimeout(overlayHide, 600);
    showThanks();
  } catch (e) {
    console.error(e);
    overlayHide();
    log("Ошибка PDF: " + e.message, "err");
  } finally {
    progressDone();
  }
}