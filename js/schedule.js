export function parseRooms(str) {
  const rooms = [];
  str.split(",").forEach(part => {
    part = part.trim(); if (!part) return;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = +m[1], b = +m[2];
      if (a <= b) for (let i = a; i <= b; i++) rooms.push(i);
      else        for (let i = a; i >= b; i--) rooms.push(i);
    } else if (/^\d+$/.test(part)) rooms.push(+part);
  });
  return rooms;
}

export function buildFullSchedule(rooms, lastRoom, lastDate, startDate, endDate, order) {
  const schedule = new Map();
  let idx = rooms.indexOf(lastRoom); if (idx === -1) idx = 0;
  const step = order === "backward" ? -1 : 1;
  const norm = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let cursor = norm(lastDate); cursor.setDate(cursor.getDate() + 1);
  if (cursor < startDate) cursor = new Date(startDate);
  while (cursor <= endDate) {
    idx = ((idx + step) % rooms.length + rooms.length) % rooms.length;
    const key = cursor.getFullYear() + "-" +
                String(cursor.getMonth()+1).padStart(2,"0") + "-" +
                String(cursor.getDate()).padStart(2,"0");
    schedule.set(key, rooms[idx]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return schedule;
}

export function formatRoom(room, cfg, allRooms) {
  let num = String(room);

  // showFloor читаем напрямую из DOM (а не из cfg),
  // чтобы и превью, и PDF, и PNG всегда использовали актуальное значение
  const cb1 = document.getElementById("pRoomShowFloor");
  const cb2 = document.getElementById("pRoomShowFloor2");
  const showFloor = (cb1 && cb1.checked) || (cb2 && cb2.checked);

  if (showFloor) {
    const maxLen = String(Math.max(...allRooms)).length;
    num = num.padStart(maxLen, "0");

    // Этаж: приоритет pRoomFloor2 (основные), потом pRoomFloor (доп.), потом 0
    const el1 = document.getElementById("pRoomFloor");
    const el2 = document.getElementById("pRoomFloor2");

    let floorVal = 0;
    if (el2 && el2.value !== "" && el2.value != null) {
      floorVal = parseInt(el2.value, 10) || 0;
    } else if (el1 && el1.value !== "" && el1.value != null) {
      floorVal = parseInt(el1.value, 10) || 0;
    }

    num = String(floorVal) + num;
  }
  return cfg.template.replace(/НОМЕР/g, num);
}

export const MONTHS_RU = ["ЯНВАРЬ","ФЕВРАЛЬ","МАРТ","АПРЕЛЬ","МАЙ","ИЮНЬ",
                          "ИЮЛЬ","АВГУСТ","СЕНТЯБРЬ","ОКТЯБРЬ","НОЯБРЬ","ДЕКАБРЬ"];
export const WEEKDAYS_FULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
export const WEEKDAYS_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export function applyCase(str, mode) {
  if (mode === "upper") return str.toUpperCase();
  if (mode === "lower") return str.toLowerCase();
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
export function getWeekdayLabel(idx, form, caseMode) {
  return applyCase(form === "full" ? WEEKDAYS_FULL[idx] : WEEKDAYS_SHORT[idx], caseMode);
}

export function calcRows(year, month, alwaysSix) {
  if (alwaysSix) return 6;
  const firstDay = new Date(year, month, 1);
  const startCol = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const need = Math.ceil((startCol + daysInMonth) / 7);
  return need <= 5 ? 5 : 6;
}

export function calcRowGap(rows, rowGapBase, cellH) {
  if (rows <= 5) return rowGapBase;
  return Math.max(0, (4 * rowGapBase - cellH) / 5);
}

export function gridHeight(cellH, rowGap) {
  return 5 * cellH + 4 * rowGap;
}

export function barTextX(P, align) {
  if (align === "right") return P.page.w - P.bar.dx;
  if (align === "center") return P.page.w / 2;
  return P.bar.dx;
}

export function barLineY(P) {
  const mid = P.bar.h / 2 + P.bar.dy;
  const gap = P.bar.line1Size * P.bar.lineGap;
  return { y1: mid + gap / 2, y2: mid - gap / 2 };
}

export function signedParams(P) {
  if (!P.sign.on) return P;
  const size = P.date.size * P.sign.dateScale / 100;
  const date = { ...P.date, size, dy: P.date.dy + 0.45 * (P.date.size - size), align: "left", dx: P.sign.pad };
  const room = {
    ...P.room, align: "right", dx: -P.sign.pad,
    dy: P.date.h / 2 + date.dy - P.room.h / 2 + 0.45 * (size - P.room.size),
  };
  const sign = { ...P.sign, lineY: P.date.h - P.room.h / 2 - P.room.dy + 0.35 * P.room.size };
  const base = {
    ...P, date, room, sign,
    line: { ...P.line, horiz: false, opacity: 0.3 },
    grid: { ...P.grid, sideMargin: Math.max(P.grid.sideMargin, P.sign.safe) },
  };
  if (P.weekday.y >= P.page.h - P.grid.topMargin) return base;

  const gridBottom = P.grid.topMargin + gridHeight(P.date.h + P.room.h, P.grid.rowGap);
  const weekdayY = P.page.h - P.grid.topMargin - date.h / 2 + date.dy + 0.45 * size + P.weekday.size;
  const spaceAbove = P.page.h - weekdayY - 0.7 * P.weekday.size;
  const spaceBelow = P.page.h - P.bar.h - gridBottom;
  const margin = (spaceAbove + spaceBelow) / 4;
  const marginTop = Math.max(margin, P.sign.safe + P.sign.pad);
  const shift = marginTop - spaceAbove;
  const align = P.bar.line2Align || "left";
  return {
    ...base,
    grid: {
      ...base.grid,
      topMargin: P.grid.topMargin + shift,
      rowGap: P.grid.rowGap + (spaceAbove + spaceBelow - marginTop - margin) / 4,
    },
    line: { ...base.line, top: P.line.top + shift, bottom: P.page.h - P.bar.h - margin },
    weekday: { ...P.weekday, y: weekdayY - shift },
    art: {
      ...P.art, align, color: P.bar.line1Color,
      x: barTextX(P, align),
      cy: Math.max(P.art.size, barLineY(P).y2 - 0.6 * P.bar.line2Size - 0.6 * P.art.size),
    },
  };
}