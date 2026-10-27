import { TEMPLATES_URL, TEMPLATE_KEYS, toMm } from "./config.js";
import { state } from "./store.js";
import { log, applyAccentFromBar, showToast } from "./utils.js";
import { applyVisualParams, readVisualParams } from "./params.js";
import { adoptImages, preloadImages } from "./images.js";
import { ensureTemplateFonts } from "./fonts.js";
import { render } from "./render-svg.js";
import { renderColorSummary } from "./colors.js";
import { renderFontSummary } from "./font-summary.js";

export function snapshotTemplate() {
  const V = readVisualParams();
  const out = {
    page: { w: toMm(V.page.w), h: toMm(V.page.h) },
    grid: {
      alwaysSix: V.grid.alwaysSix,
      topMargin: toMm(V.grid.topMargin), sideMargin: toMm(V.grid.sideMargin),
      colGap: toMm(V.grid.colGap),
      rowGap: toMm(V.grid.rowGap),
    },
    date: {
      h: toMm(V.date.h), size: V.date.size, tracking: V.date.tracking || 0,
      fontFamily: V.date.fontFamily, fontStyle: V.date.fontStyle,
      fontFamilyOther: V.date.fontFamilyOther, fontStyleOther: V.date.fontStyleOther,
      align: V.date.align,
      color: V.date.color, colorOther: V.date.colorOther,
      dx: toMm(V.date.dx), dy: toMm(V.date.dy),
    },
    room: {
      h: toMm(V.room.h), size: V.room.size, tracking: V.room.tracking || 0,
      fontFamily: V.room.fontFamily, fontStyle: V.room.fontStyle,
      fontFamilyOther: V.room.fontFamilyOther, fontStyleOther: V.room.fontStyleOther,
      align: V.room.align,
      color: V.room.color, colorOther: V.room.colorOther,
      dx: toMm(V.room.dx), dy: toMm(V.room.dy),
      template: V.room.template, showFloor: V.room.showFloor,
    },
    bar: {
      h: toMm(V.bar.h), bg: V.bar.bg,
      line1: V.bar.line1,
      line1FontFamily: V.bar.line1FontFamily, line1FontStyle: V.bar.line1FontStyle, line1Align: V.bar.line1Align,
      line1Size: V.bar.line1Size, line1Tracking: V.bar.line1Tracking,
      line1Color: V.bar.line1Color,
      line2: V.bar.line2,
      line2FontFamily: V.bar.line2FontFamily, line2FontStyle: V.bar.line2FontStyle, line2Align: V.bar.line2Align,
      line2Size: V.bar.line2Size, line2Tracking: V.bar.line2Tracking,
      line2Color: V.bar.line2Color,
      dx: toMm(V.bar.dx), dy: toMm(V.bar.dy), lineGap: V.bar.lineGap, clip: V.bar.clip,
    },
    art: {
      fontFamily: V.art.fontFamily, fontStyle: V.art.fontStyle, align: V.art.align,
      size: V.art.size, tracking: V.art.tracking || 0,
      h: toMm(V.art.h),
      right: toMm(V.art.right), top: toMm(V.art.top), padX: toMm(V.art.padX),
      color: V.art.color, opacity: V.art.opacity,
    },
    weekday: {
      size: V.weekday.size, tracking: V.weekday.tracking || 0,
      fontFamily: V.weekday.fontFamily, fontStyle: V.weekday.fontStyle, align: V.weekday.align,
      form: V.weekday.form, case: V.weekday.case,
      color: V.weekday.color,
      padLeft: toMm(V.weekday.padLeft), y: toMm(V.weekday.y),
    },
    line: {
      w: toMm(V.line.w), color: V.line.color, dash: V.line.dash,
      top: toMm(V.line.top), bottom: toMm(V.line.bottom),
      horiz: V.line.horiz, horizW: toMm(V.line.horizW), horizDash: V.line.horizDash,
      horizPad: toMm(V.line.horizPad),
    },
    sign: {
      on: V.sign.on, dateScale: V.sign.dateScale, pad: toMm(V.sign.pad), safe: toMm(V.sign.safe),
      w: toMm(V.sign.w), dash: V.sign.dash,
    },
    images: state.images.map(im => ({
      id: im.id, name: im.name, file: im.file || null,
      x: im.x, y: im.y, scale: im.scale, baseW: im.baseW,
      opacity: im.opacity, blend: im.blend,
      bright: im.bright, contrast: im.contrast, sat: im.sat, clip: im.clip,
    })),
  };
  const filtered = {};
  TEMPLATE_KEYS.forEach(k => { if (out[k] !== undefined) filtered[k] = out[k]; });
  return filtered;
}

export async function loadTemplatesManifest() {
  const url = TEMPLATES_URL + "index.json";
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error("Не удалось загрузить " + url + " (" + resp.status + ")");
  const data = await resp.json();

  const sel = document.getElementById("tplSelect");
  if (!sel) return;
  sel.innerHTML = '<option value="">— выбрать —</option>';

  for (const t of (data.templates || [])) {
    try {
      const r = await fetch(TEMPLATES_URL + t.file, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const json = await r.json();
      state.savedTemplates[t.id] = { label: t.label, data: json };
      const opt = document.createElement("option");
      opt.value = t.id; opt.textContent = t.label;
      sel.appendChild(opt);
    } catch (e) {
      console.warn("Шаблон не загружен:", t.id, e);
    }
  }
}

export async function applyTemplateById(id) {
  const tpl = state.savedTemplates[id];
  if (!tpl) {
    log("Шаблон не найден: " + id, "err");
    return;
  }
  try {
    await applyTemplateData(tpl.data);
    state.currentTemplateId = id;
    log("Шаблон применён: " + tpl.label, "ok");
  } catch (e) {
    console.error("[applyTemplateById]", tpl.label, e);
    log("Ошибка применения шаблона «" + tpl.label + "»: " + e.message, "err");
    showToast("Ошибка применения шаблона: " + e.message, 4000);
  }
}

export async function applyTemplateFromJson(json) {
  try {
    await applyTemplateData(json);
    log("Шаблон применён из файла", "ok");
  } catch (e) {
    console.error("[applyTemplateFromJson]", e);
    log("Ошибка применения шаблона: " + e.message, "err");
    showToast("Ошибка применения шаблона: " + e.message, 4000);
  }
}

async function applyTemplateData(json) {
  // 1. Визуальные параметры
  applyVisualParams(json);

  // 2. Картинки
  if (Array.isArray(json.images)) {
    const resolved = await preloadImages(json.images);
    adoptImages(resolved);
  }

  // 3. Шрифты
  await ensureTemplateFonts(json);

  // 4. Побочные эффекты
  applyAccentFromBar();
  renderColorSummary();
  renderFontSummary();

  // 5. Рендер превью
  await render();
}

export function downloadTemplateFile() {
  const json = JSON.stringify(snapshotTemplate(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  log("Шаблон сохранён в файл template.json", "ok");
}

export function pickTemplateFile() {
  const input = document.getElementById("tplFileInput");
  if (input) input.click();
}

export async function handleTemplateFileInput(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    await applyTemplateFromJson(json);
  } catch (e) {
    log("Ошибка импорта шаблона: " + e.message, "err");
    showToast("Ошибка импорта шаблона: " + e.message, 4000);
  }
}