import { state } from "./store.js";
import { render } from "./render-svg.js";
import { exportPdf } from "./render-pdf.js";
import {
  loadTemplatesManifest, applyTemplateById, applyTemplateFromJson, snapshotTemplate,
  downloadTemplateFile, pickTemplateFile, handleTemplateFileInput,
} from "./templates.js";
import { updatePanelDeps } from "./params.js";
import { PAGE_FORMATS, toMm } from "./config.js";
import { applyAccentFromBar, clamp, log, showToast } from "./utils.js";

export function initUI() {
  applyAccentFromBar();
  updatePanelDeps();

  // --- Верхние кнопки (могут отсутствовать в HTML) ---
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", () => render());

  const btnAuto = document.getElementById("btnAuto");
  if (btnAuto) {
    btnAuto.addEventListener("click", e => {
      state.autoUpdate = !state.autoUpdate;
      e.target.textContent = "Авто: " + (state.autoUpdate ? "ВКЛ" : "ВЫКЛ");
    });
  }

  const btnPdf = document.getElementById("btnPdf");
  if (btnPdf) btnPdf.addEventListener("click", () => exportPdf());

  // --- Шаблоны ---
  const tplSelect = document.getElementById("tplSelect");
  if (tplSelect) {
    tplSelect.addEventListener("change", async e => {
      const id = e.target.value;
      if (!id) return;
      try {
        await applyTemplateById(id);
        const opt = e.target.querySelector('option[value=""]');
        if (opt) opt.hidden = true;
      } catch (err) {
        log("Ошибка шаблона: " + err.message, "err");
      }
    });
  }

  const btnTplApply = document.getElementById("btnTplApply");
  if (btnTplApply) {
    btnTplApply.addEventListener("click", async () => {
      const txt = document.getElementById("tplPaste").value.trim();
      if (!txt) return;
      try {
        const P = JSON.parse(txt);
        applyTemplateFromJson(P);
        document.getElementById("tplPaste").value = "";
        log("Шаблон из JSON применён");
        render();
      } catch (e) {
        log("Ошибка JSON: " + e.message, "err");
      }
    });
  }

  // --- Формат листа ---
  const pPageFormat = document.getElementById("pPageFormat");
  if (pPageFormat) {
    pPageFormat.addEventListener("change", e => {
      const v = e.target.value;
      if (v === "custom") return;
      const f = PAGE_FORMATS[v]; if (!f) return;
      document.getElementById("pPageW").value = f.w;
      document.getElementById("pPageH").value = f.h;
      render();
    });
  }

  // --- Изменения на панели ---
  const panel = document.getElementById("panel");
  if (panel) {
    const isControlElement = (el) =>
      el && (el.id === "tplSelect" || el.id === "tplPaste" || el.id === "btnTplApply");

    panel.addEventListener("input", e => {
      if (isControlElement(e.target)) return;
      if (e.target && e.target.id === "pBarBg") applyAccentFromBar();
      if (e.target && e.target.id === "pArtOpacity") {
        const v = clamp(e.target.value, 15, 100);
        e.target.value = v;
        const lbl = document.getElementById("pArtOpacityVal");
        if (lbl) lbl.textContent = Math.round(v) + "%";
      }
      if (state.autoUpdate) render();
    });
    panel.addEventListener("change", e => {
      if (isControlElement(e.target)) return;
      if (e.target && e.target.id === "pBarBg") applyAccentFromBar();
      updatePanelDeps();
      if (state.autoUpdate) render();
    });
  }

  // --- Синхронизация дублирующихся полей «Отображать этаж» ---
  const showFloor1 = document.getElementById("pRoomShowFloor");
  const showFloor2 = document.getElementById("pRoomShowFloor2");
  if (showFloor1 && showFloor2) {
    if (showFloor1.checked !== showFloor2.checked) {
      const unified = showFloor1.checked || showFloor2.checked;
      showFloor1.checked = unified;
      showFloor2.checked = unified;
    }
    showFloor1.addEventListener("change", () => {
      showFloor2.checked = showFloor1.checked;
      if (state.autoUpdate) render();
    });
    showFloor2.addEventListener("change", () => {
      showFloor1.checked = showFloor2.checked;
      if (state.autoUpdate) render();
    });
  }

  // --- Синхронизация дублирующихся полей «Этаж» ---
  const floor1 = document.getElementById("pRoomFloor");
  const floor2 = document.getElementById("pRoomFloor2");
  if (floor1 && floor2) {
    if (floor1.value !== floor2.value) {
      const unified = (parseInt(floor2.value, 10) || 0) || (parseInt(floor1.value, 10) || 0);
      floor1.value = unified;
      floor2.value = unified;
    }
    floor1.addEventListener("input", () => {
      floor2.value = floor1.value;
      if (state.autoUpdate) render();
    });
    floor2.addEventListener("input", () => {
      floor1.value = floor2.value;
      if (state.autoUpdate) render();
    });
  }

  // --- Кнопки шаблонов (сохранение/импорт) ---
  const btnTplSave = document.getElementById("btnTplSave");
  if (btnTplSave) {
    btnTplSave.addEventListener("click", () => downloadTemplateFile());
  }

  const btnTplLoad = document.getElementById("btnTplLoad");
  const tplFileInput = document.getElementById("tplFileInput");
  if (btnTplLoad && tplFileInput) {
    btnTplLoad.addEventListener("click", () => pickTemplateFile());
    tplFileInput.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      await handleTemplateFileInput(file);
      e.target.value = "";
    });
  }

  // --- Кнопка PNG и диалог ---
  const btnPng = document.getElementById("btnPng");
  const pngDialog = document.getElementById("pngDialog");
  const pngCancel = document.getElementById("pngCancel");
  const pngOk = document.getElementById("pngOk");

  if (btnPng && pngDialog) {
    btnPng.addEventListener("click", () => pngDialog.classList.add("active"));
  }
  if (pngCancel && pngDialog) {
    pngCancel.addEventListener("click", () => pngDialog.classList.remove("active"));
  }
  if (pngOk && pngDialog) {
    pngOk.addEventListener("click", async () => {
      const quality = parseInt(document.getElementById("pngScale").value, 10) || 2;
      const mode = document.getElementById("pngMode").value || "files";
      pngDialog.classList.remove("active");
      const { exportPng } = await import("./render-png.js");
      await exportPng(quality, mode);
    });
  }

  // --- Кнопки переключения месяца превью ---
  const btnPrev = document.getElementById("btnPrevMonth");
  const btnNext = document.getElementById("btnNextMonth");
  if (btnPrev) btnPrev.addEventListener("click", () => shiftPreviewMonth(-1));
  if (btnNext) btnNext.addEventListener("click", () => shiftPreviewMonth(+1));

  // --- Плашка благодарности ---
  const thanksClose = document.getElementById("thanksClose");
  const thanksDialog = document.getElementById("thanksDialog");
  if (thanksClose && thanksDialog) {
    thanksClose.addEventListener("click", () => thanksDialog.classList.remove("active"));
  }

  // --- Копирование телефона ---
  document.querySelectorAll(".copyPhone").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      const phone = el.dataset.phone || el.textContent.trim();
      navigator.clipboard.writeText(phone).then(
        () => showToast("Скопировано: " + phone),
        () => showToast("Не удалось скопировать")
      );
    });
  });

  // --- Горячая клавиша: Ctrl/Cmd+Shift+C — копировать шаблон в буфер ---
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const json = JSON.stringify(snapshotTemplate(), null, 2);
      navigator.clipboard.writeText(json).then(
        () => log("Шаблон скопирован (" + Math.round(json.length/1024) + " КБ)"),
        () => log("Не удалось скопировать", "err")
      );
    }
  });
}

function shiftPreviewMonth(delta) {
  const el = document.getElementById("tPreviewMonth");
  if (!el) return;
  const cur = el.value;
  if (!cur) return;
  const [y, m] = cur.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  el.value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  render();
}
