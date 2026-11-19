let state = {
  sourceType: "kick",
  uploadedFilePath: null,
  durationPreset: "30-60",
  layout: "split",
  clipCount: 6,
  pollTimer: null
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadGlobalConfig();
  await loadClipsGallery();
});

function switchSourceTab(type) {
  state.sourceType = type;
  const kickBtn = document.getElementById("tabKickBtn");
  const localBtn = document.getElementById("tabLocalBtn");
  const kickBox = document.getElementById("kickSourceBox");
  const localBox = document.getElementById("localSourceBox");

  if (type === "kick") {
    kickBtn.className = "py-2.5 rounded-lg text-xs font-bold bg-[#53fc18] text-black transition";
    localBtn.className = "py-2.5 rounded-lg text-xs font-bold text-gray-400 transition";
    kickBox.classList.remove("hidden");
    localBox.classList.add("hidden");
  } else {
    localBtn.className = "py-2.5 rounded-lg text-xs font-bold bg-[#53fc18] text-black transition";
    kickBtn.className = "py-2.5 rounded-lg text-xs font-bold text-gray-400 transition";
    localBox.classList.remove("hidden");
    kickBox.classList.add("hidden");
  }
}

function handleLocalFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("selectedFileName").textContent = file.name;
  const progressBox = document.getElementById("uploadProgressBox");
  const progressBar = document.getElementById("uploadProgressBar");
  const percentText = document.getElementById("uploadPercentText");

  progressBox.classList.remove("hidden");
  progressBar.style.width = "0%";
  percentText.textContent = "0%";

  const formData = new FormData();
  formData.append("video", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload", true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = pct + "%";
      percentText.textContent = pct + "%";
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      const res = JSON.parse(xhr.responseText);
      if (res.ok) {
        state.uploadedFilePath = res.file_path;
        percentText.textContent = "¡Subido!";
      }
    } else {
      alert("Error al subir el video local.");
    }
  };

  xhr.send(formData);
}

function selectDuration(preset) {
  state.durationPreset = preset;
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    if (btn.dataset.preset === preset) {
      btn.className = "preset-btn py-3 rounded-xl border border-[#53fc18] bg-[#53fc18]/15 text-xs font-bold text-[#53fc18]";
    } else {
      btn.className = "preset-btn py-3 rounded-xl border border-white/10 bg-[#07090d] text-xs font-bold text-white";
    }
  });
}

function selectLayout(layout) {
  state.layout = layout;
  document.querySelectorAll(".layout-btn").forEach((btn) => {
    if (btn.dataset.layout === layout) {
      btn.className = "layout-btn p-3 rounded-xl border border-[#53fc18] bg-[#53fc18]/15 text-left text-[#53fc18]";
    } else {
      btn.className = "layout-btn p-3 rounded-xl border border-white/10 bg-[#07090d] text-left text-white";
    }
  });
}

function changeClipCount(delta) {
  state.clipCount = Math.max(1, Math.min(20, state.clipCount + delta));
  document.getElementById("clipCountVal").textContent = state.clipCount;
}

async function startGeneration() {
  const payload = {
    source_type: state.sourceType,
    url: document.getElementById("kickUrlInput").value.trim(),
    chunk_start: document.getElementById("chunkStartInput").value.trim() || null,
    chunk_end: document.getElementById("chunkEndInput").value.trim() || null,
    file_path: state.uploadedFilePath,
    duration_preset: state.durationPreset,
    clip_count: state.clipCount,
    layout: state.layout,
    hook_2s: document.getElementById("optHook2s").checked,
    blur_bg: document.getElementById("optBlurBg").checked,
    progress_bar: document.getElementById("optProgressBar").checked,
    chat_overlay: document.getElementById("optChatOverlay").checked,
    stinger_1s: document.getElementById("optStinger").checked,
    watermark_text: document.getElementById("wmTextInput").value.trim(),
    watermark_opacity: Number(document.getElementById("wmOpacitySlider").value) / 100,
    watermark_position: document.getElementById("wmPosSelect").value
  };

  if (payload.source_type === "kick" && !payload.url) {
    alert("Pega primero una URL de Kick.");
    return;
  }
  if (payload.source_type === "local" && !payload.file_path) {
    alert("Selecciona y sube un archivo MP4 o MKV primero.");
    return;
  }

  const btn = document.getElementById("generateBtn");
  btn.disabled = true;
  btn.classList.add("opacity-60");

  const statusCard = document.getElementById("jobStatusCard");
  statusCard.classList.remove("hidden");

  const res = await fetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (data.ok) {
    pollJob(data.job_id);
  }
}

function pollJob(jobId) {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (!data.ok) return;

    const job = data.job;
    document.getElementById("jobStepText").textContent = job.step;
    document.getElementById("jobPercentText").textContent = job.progress + "%";
    document.getElementById("jobProgressBar").style.width = job.progress + "%";

    if (job.status === "completed" || job.status === "error") {
      clearInterval(state.pollTimer);
      const btn = document.getElementById("generateBtn");
      btn.disabled = false;
      btn.classList.remove("opacity-60");
      await loadClipsGallery();
    }
  }, 1500);
}

async function loadClipsGallery() {
  const res = await fetch("/api/clips");
  const data = await res.json();
  const gallery = document.getElementById("clipsGallery");
  const clips = data.clips || [];

  document.getElementById("clipsCounter").textContent = clips.length;

  if (!clips.length) {
    gallery.innerHTML = `
      <div class="bg-[#0e1117] border border-white/10 rounded-2xl p-6 text-center text-xs text-gray-400">
        No hay clips activos todavía.
      </div>`;
    return;
  }

  gallery.innerHTML = clips.map((clip) => `
    <article class="bg-[#0e1117] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
      <div class="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full bg-[#53fc18]/20 text-[#53fc18] text-xs font-black">
            🔥 ${clip.viral_score}/100
          </span>
          <span class="text-[11px] text-gray-400">${clip.emotion_tag} • ${clip.duration}s</span>
        </div>
        <button onclick="openPhonePreview('${clip.relative_url}', '${escapeHtml(clip.title)}', '${escapeHtml(clip.hashtags)}')"
          class="px-2.5 py-1 rounded-xl bg-white/10 text-[11px] font-bold text-[#00f5d4]">
          📱 Mockup
        </button>
      </div>

      <div class="bg-black flex justify-center">
        <video src="${clip.relative_url}" class="w-full max-h-[520px] aspect-[9/16] object-contain" controls playsinline preload="metadata"></video>
      </div>

      <div class="p-4 space-y-3">
        <div>
          <h3 class="text-sm font-extrabold text-white leading-snug">${escapeHtml(clip.title)}</h3>
          <p class="text-[11px] text-[#00f5d4] mt-1">${escapeHtml(clip.hashtags)}</p>
        </div>

        <div class="grid grid-cols-4 gap-2 pt-1">
          <a href="${clip.relative_url}" download="${clip.filename}"
            class="py-2.5 rounded-xl bg-[#53fc18] text-black font-extrabold text-xs text-center active:scale-95">
            ⬇️ Bajar
          </a>
          <button onclick='openManualEditor(${JSON.stringify(clip)})'
            class="py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs active:scale-95">
            ✂️ Editar
          </button>
          <button onclick="rerollClip('${clip.id}')"
            class="py-2.5 rounded-xl bg-white/10 text-[#00f5d4] font-bold text-xs active:scale-95">
            🎲 Reroll
          </button>
          <button onclick="trashClip('${clip.id}')"
            class="py-2.5 rounded-xl bg-red-500/20 text-red-300 font-bold text-xs active:scale-95">
            🗑️ Borrar
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

async function trashClip(clipId) {
  await fetch(`/api/clips/${clipId}/trash`, { method: "POST" });
  await loadClipsGallery();
}

async function rerollClip(clipId) {
  const res = await fetch(`/api/clips/${clipId}/reroll`, { method: "POST" });
  const data = await res.json();
  if (data.ok) await loadClipsGallery();
}

function openPhonePreview(url, title, hashtags) {
  const modal = document.getElementById("previewModal");
  const player = document.getElementById("mockupVideoPlayer");
  player.src = url;
  document.getElementById("mockupTitle").textContent = title;
  document.getElementById("mockupHashtags").textContent = hashtags;
  modal.classList.remove("hidden");
  player.play().catch(() => {});
}

function closePhonePreview() {
  const modal = document.getElementById("previewModal");
  const player = document.getElementById("mockupVideoPlayer");
  player.pause();
  player.src = "";
  modal.classList.add("hidden");
}

function openManualEditor(clip) {
  document.getElementById("editClipId").value = clip.id;
  document.getElementById("editStart").value = clip.start;
  document.getElementById("editEnd").value = clip.end;
  document.getElementById("editLayout").value = clip.layout;
  document.getElementById("editWmPos").value = clip.watermark_position;
  document.getElementById("editWmText").value = clip.watermark_text;
  openSheet("editorSheet");
}

async function saveManualEdit() {
  const clipId = document.getElementById("editClipId").value;
  const payload = {
    start: parseFloat(document.getElementById("editStart").value),
    end: parseFloat(document.getElementById("editEnd").value),
    layout: document.getElementById("editLayout").value,
    watermark_position: document.getElementById("editWmPos").value,
    watermark_text: document.getElementById("editWmText").value
  };

  const res = await fetch(`/api/clips/${clipId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.ok) {
    closeSheet("editorSheet");
    await loadClipsGallery();
  } else {
    alert(data.error || "Error editando clip");
  }
}

function downloadAllZip() {
  window.location.href = "/api/export/zip";
}

function openSheet(id) {
  const backdrop = document.getElementById(id === "settingsSheet" ? "settingsBackdrop" : "editorBackdrop");
  const sheet = document.getElementById(id);
  backdrop.classList.remove("hidden");
  requestAnimationFrame(() => {
    sheet.classList.remove("closed");
    sheet.classList.add("open");
  });
}

function closeSheet(id) {
  const backdrop = document.getElementById(id === "settingsSheet" ? "settingsBackdrop" : "editorBackdrop");
  const sheet = document.getElementById(id);
  sheet.classList.remove("open");
  sheet.classList.add("closed");
  setTimeout(() => backdrop.classList.add("hidden"), 280);
}

async function loadGlobalConfig() {
  const res = await fetch("/api/config");
  const cfg = await res.json();

  document.getElementById("cfgOutputDir").value = cfg.output_dir || "";
  document.getElementById("cfgWhisperModel").value = cfg.whisper_model || "base";
  document.getElementById("cfgSubFont").value = cfg.subtitle_font || "Arial Black";
  document.getElementById("cfgSubPos").value = cfg.subtitle_position || "bottom";
  document.getElementById("cfgSubPrimary").value = cfg.subtitle_primary_color || "#FFFFFF";
  document.getElementById("cfgSubHighlight").value = cfg.subtitle_highlight_color || "#EFFF00";
  document.getElementById("cfgWmText").value = cfg.watermark_text || "@fokuzrd";
  document.getElementById("cfgWmPos").value = cfg.watermark_position || "top-right";
  document.getElementById("cfgDurPreset").value = cfg.duration_preset || "30-60";
  document.getElementById("cfgDefaultLayout").value = cfg.default_layout || "split";
  document.getElementById("cfgLufs").value = cfg.target_lufs ?? -14;
  document.getElementById("cfgAntiFiller").checked = Boolean(cfg.anti_filler);
  document.getElementById("cfgHashtags").value = cfg.global_hashtags || "";
  document.getElementById("cfgSensitivity").value = cfg.ai_sensitivity ?? 65;
  document.getElementById("cfgSensLabel").textContent = (cfg.ai_sensitivity ?? 65) + "%";
  document.getElementById("cfgOled").checked = Boolean(cfg.oled_dark_mode);

  document.getElementById("wmTextInput").value = cfg.watermark_text || "@fokuzrd";
  document.getElementById("wmPosSelect").value = cfg.watermark_position || "top-right";
  selectDuration(cfg.duration_preset || "30-60");
  selectLayout(cfg.default_layout || "split");
}

async function saveGlobalConfig() {
  const payload = {
    output_dir: document.getElementById("cfgOutputDir").value.trim(),
    whisper_model: document.getElementById("cfgWhisperModel").value,
    subtitle_font: document.getElementById("cfgSubFont").value,
    subtitle_position: document.getElementById("cfgSubPos").value,
    subtitle_primary_color: document.getElementById("cfgSubPrimary").value,
    subtitle_highlight_color: document.getElementById("cfgSubHighlight").value,
    watermark_text: document.getElementById("cfgWmText").value.trim(),
    watermark_position: document.getElementById("cfgWmPos").value,
    duration_preset: document.getElementById("cfgDurPreset").value,
    default_layout: document.getElementById("cfgDefaultLayout").value,
    target_lufs: parseFloat(document.getElementById("cfgLufs").value),
    anti_filler: document.getElementById("cfgAntiFiller").checked,
    global_hashtags: document.getElementById("cfgHashtags").value.trim(),
    ai_sensitivity: parseInt(document.getElementById("cfgSensitivity").value, 10),
    oled_dark_mode: document.getElementById("cfgOled").checked
  };

  await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  document.body.style.backgroundColor = payload.oled_dark_mode ? "#000000" : "#0b0e14";
  closeSheet("settingsSheet");
}

async function clearTempCache() {
  const res = await fetch("/api/cache/clear", { method: "POST" });
  const data = await res.json();
  alert(`Caché limpia (${data.deleted_items} archivos eliminados).`);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

