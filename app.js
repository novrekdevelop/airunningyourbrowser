// ============================================================================
//  AI Running in Your Browser
//  Zero backend. Zero API keys. All inference happens on-device via WebAssembly
//  using Transformers.js (which wraps ONNX Runtime Web). Models are fetched
//  from the Hugging Face Hub once, cached by the browser, then run offline.
// ============================================================================
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

// Always load models from the Hub (never from a local ./models directory).
env.allowLocalModels = false;

// ---------------------------------------------------------------------------
// Surface silent failures.
// Transformers.js / ONNX Runtime often log async errors to the console without
// throwing into our try/catch, leaving the UI stuck on "Downloading…". These
// handlers turn such errors into a visible status line + console details.
// ---------------------------------------------------------------------------
function onUncaughtIssue(kind, err) {
  const detail = (err && (err.message || err.reason)) || String(err);
  console.error(`[in-browser-ai] ${kind}:`, err);
  // Only override a status that is still mid-loading (avoid stomping "ready/error").
  try {
    if (els.speechStatus.className.includes("loading")) {
      setStatus(
        els.speechStatus,
        `Load failed: ${detail} — open the browser console (F12) for details.`,
        "error"
      );
    }
  } catch { /* els/setStatus may not be defined yet at module parse time */ }
}
window.addEventListener("error", (e) => onUncaughtIssue("uncaught error", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => onUncaughtIssue("unhandled rejection", e.reason));

// ---------------------------------------------------------------------------
// Device preference: "wasm" (default, CPU via WebAssembly) or "webgpu"
// (experimental, faster). Transformers.js accepts "wasm" / "webgpu" on the web
// ("cpu" is only valid on Node). Persisted so the choice survives reloads
// (any stale "cpu" value is normalized to "wasm").
// ---------------------------------------------------------------------------
const DEVICE_KEY = "in-browser-ai.device";
let device = localStorage.getItem(DEVICE_KEY) === "webgpu" ? "webgpu" : "wasm";

function getPipelineOptions(task = null) {
  // Shared extra options handed to every pipeline.
  const opts = { device };
  // q8 (8-bit quantized) keeps models small; it resolves to the "*_quantized.onnx"
  // files and runs on both wasm (CPU) and webgpu. This is the v4 way to set it
  // (the v3 "quantized: true" flag is no longer an option in Transformers.js v4).
  opts.dtype = "q8";
  return opts;
}

// Loads a pipeline with a transparent WebGPU → WebAssembly (CPU) fallback so
// the experimental "WebGPU" toggle can never brick a model for a user.
async function loadPipeline(task, modelId, opts, statusEl) {
  try {
    return await pipeline(task, modelId, opts);
  } catch (err) {
    if (opts.device === "webgpu") {
      console.warn("[in-browser-ai] WebGPU init failed — falling back to WASM:", err);
      opts.device = "wasm";
      if (statusEl) setStatus(statusEl, "WebGPU unavailable for this model — running on CPU instead. ⚠", "loading");
      return await pipeline(task, modelId, opts);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
const MODELS = {
  // automatic-speech-recognition (Whisper) — pick speed vs language support
  speech: {
    // English-only, tiny (~40 MB q8) — fastest
    "whisper-tiny-en": { id: "Xenova/whisper-tiny.en", size: "~40 MB", enOnly: true },
    // Multilingual base (~145 MB) — good balance
    "whisper-base": { id: "Xenova/whisper-base", size: "~145 MB", enOnly: false },
    // Multilingual small (~466 MB) — best accuracy, slower
    "whisper-small": { id: "Xenova/whisper-small", size: "~466 MB", enOnly: false },
  },
  // summarization — fast default, ~75 MB q8
  t5: {
    id: "Xenova/t5-small",
    task: "summarization",
    size: "~75 MB",
  },
  // summarization — higher quality, ~260 MB q8
  distilbart: {
    id: "Xenova/distilbart-cnn-6-6",
    task: "summarization",
    size: "~260 MB",
  },
  // translation — OPUS-MT pair-specific models (verified to exist on the Hub)
  translation: {
    "en-es": "Xenova/opus-mt-en-es",
    "en-fr": "Xenova/opus-mt-en-fr",
    "en-de": "Xenova/opus-mt-en-de",
    "en-it": "Xenova/opus-mt-en-it",
    "es-en": "Xenova/opus-mt-es-en",
    "fr-en": "Xenova/opus-mt-fr-en",
    "de-en": "Xenova/opus-mt-de-en",
    "it-en": "Xenova/opus-mt-it-en",
  },
};

// ---------------------------------------------------------------------------
// Tiny DOM helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

const els = {
  recordBtn: $("#recordBtn"),
  recordTime: $("#recordTime"),
  fileInput: $("#fileInput"),
  timestampsToggle: $("#timestampsToggle"),
  speechModelSelect: $("#speechModelSelect"),
  speechStatus: $("#speechStatus"),
  transcript: $("#transcript"),
  speechProgress: $("#speechProgress"),
  speechProgressFill: $("#speechProgressFill"),
  speechProgressText: $("#speechProgressText"),
  summaryModelSelect: $("#summaryModelSelect"),
  summaryStatus: $("#summaryStatus"),
  inputText: $("#inputText"),
  summaryOut: $("#summaryOut"),
  summarizeBtn: $("#summarizeBtn"),
  loadExample: $("#loadExample"),
  maxLen: $("#maxLen"),
  maxLenLabel: $("#maxLenLabel"),
  summaryProgress: $("#summaryProgress"),
  summaryProgressFill: $("#summaryProgressFill"),
  summaryProgressText: $("#summaryProgressText"),
  srcLang: $("#srcLang"),
  tgtLang: $("#tgtLang"),
  swapLang: $("#swapLang"),
  translateInput: $("#translateInput"),
  translateOut: $("#translateOut"),
  translateBtn: $("#translateBtn"),
  loadTranslateExample: $("#loadTranslateExample"),
  translateStatus: $("#translateStatus"),
  translateProgress: $("#translateProgress"),
  translateProgressFill: $("#translateProgressFill"),
  translateProgressText: $("#translateProgressText"),
  webgpuToggle: $("#webgpuToggle"),
  tabBtns: document.querySelectorAll(".tab-btn"),
  panels: {
    speech: $("#panel-speech"),
    summary: $("#panel-summary"),
    translate: $("#panel-translate"),
  },
};

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------
els.tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    els.tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
    Object.entries(els.panels).forEach(([key, panel]) =>
      panel.classList.toggle("hidden", key !== tab)
    );
  });
});

// ---------------------------------------------------------------------------
// Status / progress helpers
// ---------------------------------------------------------------------------
function setStatus(el, text, kind = "idle") {
  el.textContent = text;
  el.className = `status ${kind}`;
}

function showProgress(el, fillEl, textEl, percent, text) {
  el.classList.toggle("hidden", percent === null);
  if (percent !== null) {
    fillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (textEl) textEl.textContent = text;
  }
}

// progress_callback signature: { status, file, progress, loaded, total }
const PROG_ELS = {
  speech: ["#speechProgress", "#speechProgressFill", "#speechProgressText", "#speechStatus"],
  summary: ["#summaryProgress", "#summaryProgressFill", "#summaryProgressText", "#summaryStatus"],
  translate: ["#translateProgress", "#translateProgressFill", "#translateProgressText", "#translateStatus"],
};

function onModelProgress(which) {
  return (data) => {
    const [boxId, fillId, textId, statusId] = PROG_ELS[which];
    const box = $(boxId);
    const fill = $(fillId);
    const textEl = $(textId);
    const statusEl = $(statusId);

    switch (data.status) {
      case "initiate":
        showProgress(box, fill, textEl, 0, `Downloading ${data.file || "model"}`);
        setStatus(statusEl, "Downloading model (first run only — then it runs offline)…", "loading");
        break;
      case "download":
      case "progress": {
        const loaded = data.loaded ?? 0;
        const total = data.total ?? 0;
        const filePct = total ? Math.min(100, (loaded / total) * 100) : 0;
        const pct = data.progress != null ? data.progress : filePct;
        const mb = (loaded / 1048576).toFixed(1);
        const pctLabel = data.progress != null ? `${Math.round(data.progress)}%` : `${mb} MB`;
        showProgress(box, fill, textEl, pct, `Downloading ${data.file || "model"} — ${pctLabel}`);
        break;
      }
      case "done":
        showProgress(box, fill, textEl, 100, "Download complete.");
        break;
      case "ready":
        showProgress(box, fill, textEl, null, "");
        setStatus(statusEl, "Model ready — running 100% in your browser.", "ready");
        break;
      default:
        break;
    }
  };
}

function copyText(text) {
  return navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  });
}

// ---------------------------------------------------------------------------
// Speech → Text (Whisper)
// ---------------------------------------------------------------------------
let transcriber = null;
let transcriberId = null;
let mediaRecorder = null;
let recChunks = [];
let recTimer = null;
let recStart = 0;

async function getTranscriber() {
  const key = els.speechModelSelect.value;
  const cfg = MODELS.speech[key];
  if (transcriber && transcriberId === key) return transcriber;
  setStatus(els.speechStatus, `Loading Whisper ${key} (${cfg.size})…`, "loading");
  const opts = getPipelineOptions("automatic-speech-recognition");
  opts.progress_callback = onModelProgress("speech");
  transcriber = await loadPipeline("automatic-speech-recognition", cfg.id, opts, els.speechStatus);
  transcriberId = key;
  setStatus(
    els.speechStatus,
    `Whisper ${key} ready — recording & transcribing stays on-device.`,
    "ready"
  );
  return transcriber;
}

els.speechModelSelect.addEventListener("change", () => {
  // Force a fresh pipeline on the next run if the model changed.
  transcriber = null;
  transcriberId = null;
  const cfg = MODELS.speech[els.speechModelSelect.value];
  setStatus(
    els.speechStatus,
    `${cfg.id} selected${cfg.enOnly ? " (English only)" : " (multilingual, language auto-detected)"} — it will load on the next run.`,
    "idle"
  );
});

async function decodeAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("AudioContext is not supported in this browser.");
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    if (ctx.state !== "closed") ctx.close();
  }
}

async function transcribeBuffer(buffer) {
  const model = await getTranscriber();
  const withTimestamps = els.timestampsToggle.checked;
  const cfg = MODELS.speech[els.speechModelSelect.value];
  const opts = {
    chunk_length_s: 30, // chunk long audio into 30s windows
    stride_length_s: 5, // 5s overlap reduces boundary loss
    return_timestamps: withTimestamps,
  };
  // Only English-only models force the language; multilingual models
  // auto-detect the spoken language from the audio.
  if (cfg.enOnly) opts.language = "english";
  const out = await model(buffer, opts);
  return formatTranscript(out, withTimestamps);
}

function formatTranscript(out, withTimestamps) {
  if (withTimestamps && Array.isArray(out.chunks) && out.chunks.length) {
    return out.chunks
      .map((c) => {
        const [s, e] = Array.isArray(c.timestamp) ? c.timestamp : [0, 0];
        return `[${fmtClock(s)} → ${fmtClock(e)}] ${(c.text || "").trim()}`;
      })
      .join("\n");
  }
  const text = (out.text || "").trim();
  return text || "(no speech detected — try speaking closer to the mic)";
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function handleAudioBlob(blob, label) {
  els.recordBtn.disabled = true;
  try {
    setStatus(els.speechStatus, `Decoding "${label}"…`, "loading");
    const buffer = await decodeAudio(blob);
    setStatus(els.speechStatus, "Reading your audio with Whisper…", "loading");
    const text = await transcribeBuffer(buffer);
    els.transcript.value = text;
    setStatus(els.speechStatus, "Done. Transcription was produced 100% on-device.", "ready");
  } catch (err) {
    console.error(err);
    setStatus(els.speechStatus, `Error: ${err.message}`, "error");
  } finally {
    els.recordBtn.disabled = false;
  }
}

// --- Mic recording ----------------------------------------------------------
els.recordBtn.addEventListener("click", async () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    return;
  }
  try {
    await getTranscriber();
  } catch (err) {
    console.error(err);
    setStatus(els.speechStatus, `Could not load Whisper: ${err.message}`, "error");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error(err);
    setStatus(els.speechStatus, "Microphone unavailable or permission denied. You can still upload an audio file.", "error");
    return;
  }

  recChunks = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
  mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    clearRecTimer();
    els.recordBtn.textContent = "🛑 Stop recording";
    els.recordBtn.classList.remove("recording");
    els.recordTime.hidden = true;
    if (recChunks.length) {
      const blob = new Blob(recChunks, { type: mime || "audio/webm" });
      await handleAudioBlob(blob, "your recording");
    }
  };
  mediaRecorder.start();
  recStart = performance.now();
  els.recordBtn.textContent = "🔴 Recording… (click to stop)";
  els.recordBtn.classList.add("recording");
  els.recordTime.hidden = false;
  startRecTimer();
});

function startRecTimer() {
  const tick = () => {
    const sec = Math.floor((performance.now() - recStart) / 1000);
    els.recordTime.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  };
  tick();
  recTimer = setInterval(tick, 1000);
}
function clearRecTimer() {
  if (recTimer) clearInterval(recTimer);
  recTimer = null;
}

// --- File upload ------------------------------------------------------------
els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  els.fileInput.value = ""; // allow re-selecting the same file
  await handleAudioBlob(file, file.name);
});

// ---------------------------------------------------------------------------
// Summarization (T5 / BART)
// ---------------------------------------------------------------------------
let summarizer = null;
let summarizerId = null;

async function getSummarizer() {
  const key = els.summaryModelSelect.value;
  const cfg = MODELS[key];
  if (summarizer && summarizerId === key) return summarizer;
  setStatus(els.summaryStatus, `Loading ${cfg.id} (${cfg.size})…`, "loading");
  const opts = getPipelineOptions();
  opts.progress_callback = onModelProgress("summary");
  summarizer = await loadPipeline(cfg.task, cfg.id, opts, els.summaryStatus);
  summarizerId = key;
  setStatus(els.summaryStatus, `${cfg.id} ready — summarization runs on-device.`, "ready");
  return summarizer;
}

els.summaryModelSelect.addEventListener("change", () => {
  // Force a fresh pipeline on the next Summarize click.
  summarizer = null;
  summarizerId = null;
  setStatus(els.summaryStatus, "Model changed — it will load on the next run.", "idle");
});

els.maxLen.addEventListener("input", () => {
  els.maxLenLabel.textContent = `${els.maxLen.value} words`;
});

els.summarizeBtn.addEventListener("click", async () => {
  const text = els.inputText.value.trim();
  if (!text) {
    setStatus(els.summaryStatus, "Paste some text first, or load the example article.", "error");
    return;
  }
  els.summarizeBtn.disabled = true;
  const inlineBox = $("#summaryProgressInline");
  const inlineFill = $("#summaryProgressInlineFill");
  try {
    const model = await getSummarizer();
    setStatus(els.summaryStatus, "Generating summary…", "loading");
    showProgress(inlineBox, inlineFill, null, 0, "");
    let lastPct = 0;
    const result = await model(text, {
      max_length: Number(els.maxLen.value),
      min_length: Math.min(Number(els.maxLen.value), 30),
      do_sample: false,
      progress_callback: (data) => {
        if (typeof data.progress === "number") {
          lastPct = Math.max(lastPct, data.progress);
          showProgress(inlineBox, inlineFill, null, lastPct, "");
        }
      },
    });
    const summary = result?.[0]?.summary_text ?? String(result);
    els.summaryOut.value = summary.trim();
    setStatus(els.summaryStatus, "Done. Summary generated 100% on-device.", "ready");
  } catch (err) {
    console.error(err);
    setStatus(els.summaryStatus, `Error: ${err.message}`, "error");
  } finally {
    showProgress(inlineBox, inlineFill, null, null, "");
    els.summarizeBtn.disabled = false;
  }
});

const SAMPLE_ARTICLE = `The past few years have seen a remarkable shift in how artificial intelligence is delivered to end users. For a long time, the prevailing approach was to treat AI as a cloud service: your browser or phone would send text, images, or audio to a distant server, where a large model processed the input and returned a result. This model works, but it carries real costs. Every request travels over the network, which can add latency and unpredictability, and every prompt is an external call that has privacy implications. Users must trust a third party with whatever they type, say, or photograph.

A different path has quietly matured: running AI directly inside the browser. Modern compilers can translate trained neural networks into WebAssembly, a low-level bytecode that every major browser can execute at near-native speed. Language models, speech recognizers, and image classifiers are being converted into this portable format with tools such as ONNX Runtime Web, allowing a single web page to load a model, run inference on the user's own CPU, and return results without a single network round trip for the computation itself.

This browser-native approach changes the economics and the experience of AI. Because there is no backend, there is no per-request fee and no rate limit, so using the model costs nothing beyond the electricity of the user's own device. Because the data never leaves the machine, it is private by construction, which is especially valuable for sensitive material like medical notes, legal drafts, or personal voice memos. And because there is no server to provision and no token to configure, the whole thing becomes frictionless: a link is enough, and anyone can try it with a single click.

There are trade-offs, of course. Models must be small enough to fit in a browser's memory and fast enough to run on a laptop or phone, which usually means using distilled or quantized weights that are a fraction of the size of the largest cloud models. The first visit downloads the weights, so an initial wait is unavoidable. Still, for a fast-growing set of tasks, the combination of privacy, zero cost, and instant shareability makes in-browser AI an increasingly compelling choice.`;

els.loadExample.addEventListener("click", () => {
  els.inputText.value = SAMPLE_ARTICLE;
  setStatus(els.summaryStatus, "Example loaded. Click “Summarize” to run it on-device.", "ready");
});

// ---------------------------------------------------------------------------
// Copy / clear buttons
// ---------------------------------------------------------------------------
$("#copySpeech").addEventListener("click", () => els.transcript.value && copyText(els.transcript.value));
$("#clearSpeech").addEventListener("click", () => { els.transcript.value = ""; });
$("#copySummary").addEventListener("click", () => els.summaryOut.value && copyText(els.summaryOut.value));
$("#copyTranslate").addEventListener("click", () => els.translateOut.value && copyText(els.translateOut.value));

// ---------------------------------------------------------------------------
// WebGPU toggle (experimental; falls back to CPU if a model can't run)
// ---------------------------------------------------------------------------
els.webgpuToggle.checked = device === "webgpu";
els.webgpuToggle.addEventListener("change", () => {
  device = els.webgpuToggle.checked ? "webgpu" : "wasm";
  localStorage.setItem(DEVICE_KEY, device);
  // Invalidate cached pipelines so they reload on the new device.
  transcriber = null; transcriberId = null;
  summarizer = null; summarizerId = null;
  translator = null; translatorId = null;
  const note = device === "webgpu"
    ? "WebGPU enabled — models will try to run on your graphics card (falls back to CPU if unsupported)."
    : "WebGPU disabled — models will run on your CPU.";
  setStatus(els.speechStatus, note, "idle");
  setStatus(els.summaryStatus, note, "idle");
  setStatus(els.translateStatus, note, "idle");
  console.log(`[in-browser-ai] device → ${device}`);
});

// ---------------------------------------------------------------------------
// Service worker — offline + installable (PWA)
// ---------------------------------------------------------------------------
(function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      console.log("[in-browser-ai] Service worker registered:", reg.scope);
    }).catch((err) => {
      console.error("[in-browser-ai] Service worker not registered:", err);
    });
  });
})();
// ---------------------------------------------------------------------------
// Translation (OPUS-MT)
// ---------------------------------------------------------------------------
let translator = null;
let translatorId = null;

const LANG_NAMES = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
};

function translationKey() {
  return `${els.srcLang.value}-${els.tgtLang.value}`;
}

async function getTranslator() {
  const key = translationKey();
  const [s, t] = key.split("-");
  if (s === t) throw new Error("Source and target languages must be different.");
  if (translator && translatorId === key) return translator;
  const modelId = MODELS.translation[key];
  if (!modelId) throw new Error(`No offline model is available for ${LANG_NAMES[s] || s} → ${LANG_NAMES[t] || t}.`);
  setStatus(els.translateStatus, `Loading OPUS-MT ${s} → ${t} (~300 MB, first run only)…`, "loading");
  const opts = getPipelineOptions();
  opts.progress_callback = onModelProgress("translate");
  translator = await loadPipeline("translation", modelId, opts, els.translateStatus);
  translatorId = key;
  setStatus(els.translateStatus, `OPUS-MT ${s} → ${t} ready — translation runs on-device.`, "ready");
  return translator;
}

els.swapLang.addEventListener("click", () => {
  const tmp = els.srcLang.value;
  els.srcLang.value = els.tgtLang.value;
  els.tgtLang.value = tmp;
  translator = null;
  translatorId = null;
  els.translateOut.value = "";
});

const TRANSLATE_SAMPLE = `Modern web browsers are now powerful enough to run neural networks directly on your device. By compiling models to WebAssembly, a single web page can load a language model, run inference on the user's own computer, and return a result without ever sending the data to a server. This approach is free, private, and works offline after the first download.`;

els.loadTranslateExample.addEventListener("click", () => {
  els.translateInput.value = TRANSLATE_SAMPLE;
  setStatus(els.translateStatus, "Example loaded. Choose a target language and hit “Translate” — it runs 100% on-device.", "ready");
});

els.translateBtn.addEventListener("click", async () => {
  const text = els.translateInput.value.trim();
  if (!text) {
    setStatus(els.translateStatus, "Type or paste some text to translate first.", "error");
    return;
  }
  els.translateBtn.disabled = true;
  try {
    const model = await getTranslator();
    const [s, t] = translationKey().split("-");
    setStatus(els.translateStatus, "Translating on-device…", "loading");
    showProgress(els.translateProgress, els.translateProgressFill, els.translateProgressText, 0, "…");
    let lastPct = 0;
    const result = await model(text, {
      src_lang: s,
      tgt_lang: t,
      do_sample: false,
      progress_callback: (data) => {
        if (typeof data.progress === "number") {
          lastPct = Math.max(lastPct, data.progress);
          showProgress(els.translateProgress, els.translateProgressFill, els.translateProgressText, lastPct, "");
        }
      },
    });
    const translation = result?.[0]?.translation_text ?? String(result);
    els.translateOut.value = translation.trim();
    setStatus(els.translateStatus, `Done. Translated to ${LANG_NAMES[t] || t} 100% on-device.`, "ready");
  } catch (err) {
    console.error(err);
    setStatus(els.translateStatus, `Error: ${err.message}`, "error");
  } finally {
    showProgress(els.translateProgress, els.translateProgressFill, els.translateProgressText, null, "");
    els.translateBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Boot-time checks
// ---------------------------------------------------------------------------
if (!window.isSecureContext) {
  setStatus(els.speechStatus, "⚠️ This page is not a secure context — the microphone may be blocked. Open it via http://localhost (or https).", "error");
}
if (!navigator.mediaDevices?.getUserMedia) {
  setStatus(els.speechStatus, "This browser has no getUserMedia support — you can still upload an audio file.", "error");
}

console.log("[in-browser-ai] Ready. All inference will run on-device via WebAssembly.");

