export const BASE_URL = window.APP_BASE_URL || "";
export const FONTS_URL     = BASE_URL + "fonts/";
export const IMAGES_URL    = BASE_URL + "Images/";
export const TEMPLATES_URL = BASE_URL + "templates/";

export const MM = 2.834645669;
export const toPt = mm => mm * MM;
export const toMm = pt => pt / MM;

export const PAGE_FORMATS = {
  "A4-l": { w: 297, h: 210 },
  "A4-p": { w: 210, h: 297 },
  "A3-l": { w: 420, h: 297 },
  "A3-p": { w: 297, h: 420 },
  "A5-l": { w: 210, h: 148 },
  "A5-p": { w: 148, h: 210 },
};

export function formatKeyOf(w, h) {
  for (const [key, f] of Object.entries(PAGE_FORMATS)) {
    if (Math.abs(f.w - w) < 0.1 && Math.abs(f.h - h) < 0.1) return key;
  }
  return "custom";
}

export const TEMPLATE_KEYS = [
  "page", "grid", "date", "room", "bar", "art", "weekday", "line", "sign", "images"
];

export const LINE_DASHES = {
  solid:      { dash: null,                    label: "Сплошная" },
  dashed:     { dash: [3, 2],                  label: "Пунктир" },
  dotted:     { dash: [0.5, 1.5],              label: "Точки" },
  dashdot:    { dash: [3, 1.5, 0.5, 1.5],      label: "Штрих-точка" },
  dashdotdot: { dash: [3, 1.5, 0.5, 1.5, 0.5, 1.5], label: "Штрих-две точки" },
};

// Список изображений в папке /Images/ — задаётся в index.json (см. Images/index.json).
export async function loadImagesManifest() {
  try {
    const r = await fetch(IMAGES_URL + "index.json", { cache: "no-cache" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.images) ? data.images : [];
  } catch {
    return [];
  }
}