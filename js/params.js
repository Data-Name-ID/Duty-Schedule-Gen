import { toPt, formatKeyOf } from "./config.js";
import { clamp } from "./utils.js";
import { FONTS, listFontStylesByFamily } from "./fonts.js";

function num(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return isFinite(v) ? v : fallback;
}
function str(id, fallback = "") {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}
function chk(id) {
  const el = document.getElementById(id);
  return el ? !!el.checked : false;
}
function color(id) {
  const el = document.getElementById(id);
  if (!el) return { r: 0, g: 0, b: 0 };
  const hex = el.value.replace("#", "");
  return {
    r: parseInt(hex.substr(0,2), 16) / 255,
    g: parseInt(hex.substr(2,2), 16) / 255,
    b: parseInt(hex.substr(4,2), 16) / 255,
  };
}
const fsv = id => num(id);
const mmv = id => toPt(num(id));

function readFontPicker(target) {
  const el = document.querySelector(`.fontPicker[data-target="${target}"]`);
  if (!el) return { fontFamily: "", fontStyle: "" };
  const famSel = el.querySelector(".fontFamily");
  const stySel = el.querySelector(".fontStyle");
  return {
    fontFamily: famSel?.value || "",
    fontStyle:  stySel?.value || "",
  };
}
function readAlign(alignTarget) {
  const el = document.querySelector(`.fontAlignStandalone[data-align-target="${alignTarget}"]`);
  if (!el) return "center";
  return el.querySelector(".alignBtn.active")?.dataset.align || "center";
}

export function migrateFontKey(oldKey) {
  if (!oldKey || typeof oldKey !== "string") return { fontFamily: "", fontStyle: "" };
  const f = FONTS[oldKey];
  if (f) return { fontFamily: f.family, fontStyle: f.style };
  return { fontFamily: "", fontStyle: "" };
}

export function readVisualParams() {
  const datePicker      = readFontPicker("date.font");
  const datePickerOther = readFontPicker("date.fontOther");
  const roomPicker      = readFontPicker("room.font");
  const roomPickerOther = readFontPicker("room.fontOther");
  const wdPicker        = readFontPicker("weekday.font");
  const bar1Picker      = readFontPicker("bar.line1Font");
  const bar2Picker      = readFontPicker("bar.line2Font");
  const artPicker       = readFontPicker("art.font");

  const dateAlign = readAlign("date");
  const roomAlign = readAlign("room");
  const wdAlign   = readAlign("weekday");
  const bar1Align = readAlign("bar.line1");
  const bar2Align = readAlign("bar.line2");

  return {
    page: { w: mmv("pPageW"), h: mmv("pPageH") },
    grid: {
      alwaysSix: chk("pAlwaysSix"),
      topMargin: mmv("pTopMargin"), sideMargin: mmv("pSideMargin"),
      colGap: mmv("pColGap"),
      rowGap: mmv("pRowGap"),
    },
    date: {
      h: mmv("pDateH"), size: fsv("pDateSize"),
      tracking: num("pDateTracking"),
      fontFamily: datePicker.fontFamily, fontStyle: datePicker.fontStyle,
      fontFamilyOther: datePickerOther.fontFamily, fontStyleOther: datePickerOther.fontStyle,
      align: dateAlign,
      color: color("pDateColor"), colorOther: color("pDateColorOther"),
      dx: mmv("pDateDX"), dy: mmv("pDateDY"),
    },
    room: {
      h: mmv("pRoomH"), size: fsv("pRoomSize"),
      tracking: num("pRoomTracking"),
      fontFamily: roomPicker.fontFamily, fontStyle: roomPicker.fontStyle,
      fontFamilyOther: roomPickerOther.fontFamily, fontStyleOther: roomPickerOther.fontStyle,
      align: roomAlign,
      color: color("pRoomColor"), colorOther: color("pRoomColorOther"),
      dx: mmv("pRoomDX"), dy: mmv("pRoomDY"),
      template: str("pRoomTemplate"),
      showFloor: chk("pRoomShowFloor") || chk("pRoomShowFloor2"),
    },
    bar: {
      h: mmv("pBarH"), bg: color("pBarBg"),
      line1: str("pBarLine1"),
      line1FontFamily: bar1Picker.fontFamily, line1FontStyle: bar1Picker.fontStyle, line1Align: bar1Align,
      line1Size: fsv("pBarLine1Size"), line1Tracking: num("pBarLine1Tracking"),
      line1Color: color("pBarLine1Color"),
      line2: str("pBarLine2"),
      line2FontFamily: bar2Picker.fontFamily, line2FontStyle: bar2Picker.fontStyle, line2Align: bar2Align,
      line2Size: fsv("pBarLine2Size"), line2Tracking: num("pBarLine2Tracking"),
      line2Color: color("pBarLine2Color"),
      dx: mmv("pBarDX"), dy: mmv("pBarDY"), lineGap: num("pBarLineGap"),
      clip: chk("pBarClip"),
    },
    art: {
      text: "t.me/ARTtemaARTema",
      fontFamily: artPicker.fontFamily, fontStyle: artPicker.fontStyle, align: "left",
      size: fsv("pArtSize"), tracking: num("pArtTracking"),
      h: mmv("pArtH"),
      right: mmv("pArtRight"), top: mmv("pArtTop"),
      padX: mmv("pArtPadX"),
      color: color("pArtColor"),
      opacity: Math.max(0.15, clamp(num("pArtOpacity", 40), 15, 100) / 100),
    },
    weekday: {
      size: fsv("pWdSize"), tracking: num("pWdTracking"),
      fontFamily: wdPicker.fontFamily, fontStyle: wdPicker.fontStyle, align: wdAlign,
      form: str("pWdForm", "short"), case: str("pWdCase", "upper"),
      color: color("pWdColor"),
      padLeft: mmv("pWdPadLeft"), y: mmv("pWdY"),
    },
    line: {
      w: mmv("pLineW"), color: color("pLineColor"),
      dash: str("pLineDash", "solid"),
      top: mmv("pLineTop"), bottom: mmv("pLineBottom"),
      horiz: chk("pLineHoriz"),
      horizW: mmv("pLineHorizW"),
      horizDash: str("pLineHorizDash", "solid"),
      horizPad: mmv("pLineHorizPad"),
    },
    sign: {
      on: chk("pSignOn"),
      dateScale: clamp(num("pSignDateScale", 100), 30, 100),
      pad: mmv("pSignPad"),
      safe: Math.max(0, mmv("pSignSafe")),
      w: mmv("pSignW"),
      dash: str("pSignDash", "solid"),
    },
  };
}

export function readWorkParams() {
  return {
    scale: num("pScale", 1),
    monthFrom: str("tMonthFrom"),
    monthTo: str("tMonthTo"),
    rooms: str("tRooms"),
    lastRoom: parseInt(str("tLastRoom"), 10) || 1,
    lastDate: str("tLastDate"),
    order: str("tOrder", "forward"),
    previewMonth: str("tPreviewMonth"),
  };
}

export function readParams() {
  return { ...readVisualParams(), work: readWorkParams() };
}

function setNum(id, v) { const el = document.getElementById(id); if (el && v != null && isFinite(v)) el.value = v; }
function setStr(id, v) { const el = document.getElementById(id); if (el && v != null) el.value = v; }
function setChk(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }
function setCol(id, c) {
  if (!c) return;
  const hex = "#" + [c.r,c.g,c.b].map(x => Math.round(x*255).toString(16).padStart(2,"0")).join("");
  const el = document.getElementById(id); if (el) el.value = hex;
}

export function writeFontPicker(target, family, style) {
  const el = document.querySelector(`.fontPicker[data-target="${target}"]`);
  if (!el) return;
  const famSel = el.querySelector(".fontFamily");
  const stySel = el.querySelector(".fontStyle");
  if (!famSel || !stySel) return;

  if (!family) {
    const first = Object.entries(FONTS).find(([, f]) => !f.alias);
    family = first ? first[1].family : "";
  }
  fillFamilySelect(famSel, family);
  fillStyleSelect(stySel, famSel.value, style);
}

function writeAlign(alignTarget, align) {
  const el = document.querySelector(`.fontAlignStandalone[data-align-target="${alignTarget}"]`);
  if (!el) return;
  const a = align || "center";
  el.querySelectorAll(".alignBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.align === a);
  });
}

function fillFamilySelect(sel, preferred) {
  if (!sel) return;
  const families = [];
  const seen = new Set();
  Object.values(FONTS).forEach(f => {
    if (f.alias) return;
    if (!seen.has(f.family)) { seen.add(f.family); families.push(f.family); }
  });
  sel.innerHTML = "";
  families.forEach(fam => {
    const opt = document.createElement("option");
    opt.value = fam; opt.textContent = fam;
    sel.appendChild(opt);
  });
  if (preferred && families.includes(preferred)) sel.value = preferred;
  else if (families.includes(sel.value)) { /* оставляем */ }
  else if (families.length) sel.value = families[0];
}

function fillStyleSelect(sel, family, preferredStyle) {
  if (!sel) return;
  const styles = listFontStylesByFamily(family);
  sel.innerHTML = "";
  styles.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.label; opt.textContent = s.label;
    sel.appendChild(opt);
  });
  if (preferredStyle && styles.some(s => s.label === preferredStyle)) sel.value = preferredStyle;
  else if (styles.length) sel.value = styles[0].label;
}

// Заполнить .fontPicker из пары (fontFamily, fontStyle).
// Если пришёл старый ключ — конвертируем.
function applyFontBlock(prefix, obj, oldKeys, defaultFamily, defaultStyle, defaultAlign, alignTarget) {
  if (!obj) return;
  // Собираем данные: поддержка обоих форматов
  let fFam, fSty, fFamO, fStyO;
  if (obj[oldKeys.family] || obj[oldKeys.familyOther]) {
    const m1 = migrateFontKey(obj[oldKeys.family]);
    const m2 = migrateFontKey(obj[oldKeys.familyOther]);
    fFam  = m1.fontFamily; fSty  = m1.fontStyle;
    fFamO = m2.fontFamily; fStyO = m2.fontStyle;
  } else {
    fFam  = obj.fontFamily; fSty  = obj.fontStyle;
    fFamO = obj.fontFamilyOther; fStyO = obj.fontStyleOther;
  }
  // Если оба пусты — берём дефолт из текущих селектов.
  if (!fFam)  fFam  = defaultFamily;
  if (!fSty)  fSty  = defaultStyle;
  if (!fFamO) fFamO = fFam;
  if (!fStyO) fStyO = fSty;

  writeFontPicker(`${prefix}.font`, fFam, fSty);
  writeFontPicker(`${prefix}.fontOther`, fFamO, fStyO);
  if (alignTarget) writeAlign(alignTarget, obj.align || obj.alignOther || defaultAlign);
}

export function applyVisualParams(P) {
  // --- page ---
  if (P.page) { setNum("pPageW", P.page.w); setNum("pPageH", P.page.h); syncPageFormatSelect(); }

  // --- grid ---
  if (P.grid) {
    if (P.grid.alwaysSix != null) setChk("pAlwaysSix", P.grid.alwaysSix);
    else if (P.grid.rows != null) setChk("pAlwaysSix", P.grid.rows === 6);

    setNum("pTopMargin", P.grid.topMargin);
    setNum("pSideMargin", P.grid.sideMargin);
    setNum("pColGap", P.grid.colGap);

    if (P.grid.rowGap != null) setNum("pRowGap", P.grid.rowGap);
    else if (P.grid.rowGap5 != null) setNum("pRowGap", P.grid.rowGap5);
  }

  // --- date ---
  if (P.date) {
    setNum("pDateH", P.date.h); setNum("pDateSize", P.date.size);
    setNum("pDateTracking", P.date.tracking || 0);
    setNum("pDateDX", P.date.dx); setNum("pDateDY", P.date.dy);
    setCol("pDateColor", P.date.color); setCol("pDateColorOther", P.date.colorOther);
    applyFontBlock("date", P.date, { family: "font", familyOther: "fontOther" }, "Gilroy", "Regular", "center", "date");
  }

  // --- room ---
  if (P.room) {
    setNum("pRoomH", P.room.h); setNum("pRoomSize", P.room.size);
    setNum("pRoomTracking", P.room.tracking || 0);
    setNum("pRoomDX", P.room.dx); setNum("pRoomDY", P.room.dy);
    setStr("pRoomTemplate", P.room.template);
    setChk("pRoomShowFloor",  P.room.showFloor);
    setChk("pRoomShowFloor2", P.room.showFloor);
    setCol("pRoomColor", P.room.color); setCol("pRoomColorOther", P.room.colorOther);
    applyFontBlock("room", P.room, { family: "font", familyOther: "fontOther" }, "Montserrat", "Regular", "center", "room");
  }

  // --- bar ---
  if (P.bar) {
    setNum("pBarH", P.bar.h);
    setStr("pBarLine1", P.bar.line1);
    setNum("pBarLine1Size", P.bar.line1Size);
    setNum("pBarLine1Tracking", P.bar.line1Tracking || 0);
    setCol("pBarLine1Color", P.bar.line1Color);
    setStr("pBarLine2", P.bar.line2);
    setNum("pBarLine2Size", P.bar.line2Size);
    setNum("pBarLine2Tracking", P.bar.line2Tracking || 0);
    setCol("pBarLine2Color", P.bar.line2Color);
    setNum("pBarDX", P.bar.dx); setNum("pBarDY", P.bar.dy); setNum("pBarLineGap", P.bar.lineGap);
    setChk("pBarClip", P.bar.clip);
    setCol("pBarBg", P.bar.bg);

    const l1Old = P.bar.line1Font, l2Old = P.bar.line2Font;
    const l1Fam = P.bar.line1FontFamily, l1Sty = P.bar.line1FontStyle;
    const l2Fam = P.bar.line2FontFamily, l2Sty = P.bar.line2FontStyle;

    if (l1Old) {
      const m = migrateFontKey(l1Old);
      writeFontPicker("bar.line1Font", m.fontFamily, m.fontStyle);
    } else if (l1Fam) {
      writeFontPicker("bar.line1Font", l1Fam, l1Sty);
    } else {
      writeFontPicker("bar.line1Font", "Gilroy", "Light");
    }
    if (l2Old) {
      const m = migrateFontKey(l2Old);
      writeFontPicker("bar.line2Font", m.fontFamily, m.fontStyle);
    } else if (l2Fam) {
      writeFontPicker("bar.line2Font", l2Fam, l2Sty);
    } else {
      writeFontPicker("bar.line2Font", "Gilroy", "SemiBold");
    }
    writeAlign("bar.line1", P.bar.line1Align || "left");
    writeAlign("bar.line2", P.bar.line2Align || "left");
  }

  // --- art ---
  if (P.art) {
    setNum("pArtSize", P.art.size);
    setNum("pArtTracking", P.art.tracking || 0);
    setNum("pArtH", P.art.h);
    setNum("pArtRight", P.art.right); setNum("pArtTop", P.art.top);
    setNum("pArtPadX", P.art.padX);
    setCol("pArtColor", P.art.color);

    const o = Number(P.art.opacity);
    const opPct = Math.max(15, clamp(isFinite(o) ? (o > 1 ? o : o * 100) : 40, 15, 100));
    setNum("pArtOpacity", opPct);

    if (P.art.font) {
      const m = migrateFontKey(P.art.font);
      writeFontPicker("art.font", m.fontFamily, m.fontStyle);
    } else {
      writeFontPicker("art.font", P.art.fontFamily, P.art.fontStyle);
    }
  }

  // --- weekday ---
  if (P.weekday) {
    setNum("pWdSize", P.weekday.size);
    setNum("pWdTracking", P.weekday.tracking || 0);
    setStr("pWdForm", P.weekday.form); setStr("pWdCase", P.weekday.case);
    setCol("pWdColor", P.weekday.color);
    setNum("pWdPadLeft", P.weekday.padLeft); setNum("pWdY", P.weekday.y);
    if (P.weekday.font) {
      const m = migrateFontKey(P.weekday.font);
      writeFontPicker("weekday.font", m.fontFamily, m.fontStyle);
    } else {
      writeFontPicker("weekday.font", P.weekday.fontFamily, P.weekday.fontStyle);
    }
    writeAlign("weekday", P.weekday.align || "left");
  }

  // --- line ---
  if (P.line) {
    setNum("pLineW", P.line.w); setCol("pLineColor", P.line.color);
    setStr("pLineDash", P.line.dash || "solid");
    setNum("pLineTop", P.line.top); setNum("pLineBottom", P.line.bottom);
    setChk("pLineHoriz", P.line.horiz);
    setNum("pLineHorizW", P.line.horizW);
    setStr("pLineHorizDash", P.line.horizDash || "solid");
    setNum("pLineHorizPad", P.line.horizPad);
  }

  setChk("pSignOn", P.sign?.on);
  if (P.sign) {
    setNum("pSignDateScale", P.sign.dateScale);
    setNum("pSignPad", P.sign.pad);
    setNum("pSignSafe", P.sign.safe);
    setNum("pSignW", P.sign.w);
    setStr("pSignDash", P.sign.dash || "solid");
  }

  const ao = document.getElementById("pArtOpacity");
  const aol = document.getElementById("pArtOpacityVal");
  if (ao && aol) {
    ao.value = Math.max(15, clamp(ao.value, 15, 100));
    aol.textContent = Math.round(Number(ao.value)) + "%";
  }

  updatePanelDeps();
}

function toggleDeps(chkId, depsSelector) {
  const chkEl = document.getElementById(chkId);
  const deps = document.querySelector(depsSelector);
  if (!chkEl || !deps) return;
  deps.classList.toggle("disabled", !chkEl.checked);
}

export function updatePanelDeps() {
  toggleDeps("pLineHoriz", ".horizDeps");
  toggleDeps("pSignOn", ".signDeps");
}

export function syncPageFormatSelect() {
  const w = parseFloat(document.getElementById("pPageW")?.value ?? 0);
  const h = parseFloat(document.getElementById("pPageH")?.value ?? 0);
  const key = formatKeyOf(w, h);
  const sel = document.getElementById("pPageFormat");
  if (sel) sel.value = key;
}

export function initFontPickers() {
  document.querySelectorAll(".fontPicker").forEach(el => {
    const famSel = el.querySelector(".fontFamily");
    const stySel = el.querySelector(".fontStyle");
    fillFamilySelect(famSel, undefined);
    fillStyleSelect(stySel, famSel?.value, null);
  });
  writeAlign("date", "center");
  writeAlign("room", "center");
  writeAlign("weekday", "left");
  writeAlign("bar.line1", "left");
  writeAlign("bar.line2", "left");
  updatePanelDeps();
}
