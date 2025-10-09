/* frontend/js/app.js
   DermAI — Skin Disease Assistant
   Task: Upload → Predict → Display → History → Gemini → Report + Camera + Circular Confidence
*/

const BACKEND = "https://derm-ai-t3f7.onrender.com";

let latestPrediction = null;
let latestImageName = null;
let latestDescription = "";
let latestTreatment = "";
let latestReferences = [];

/*********************
 * UI helpers
 *********************/
function createStyleAndSpinner() {
  const css = `
  #processingOverlay {
    position: fixed; inset: 0; display: none;
    align-items:center; justify-content:center;
    background: rgba(12, 27, 41, 0.45);
    z-index: 9999;
  }
  .spinner {
    width: 68px; height: 68px; border-radius: 50%;
    border: 6px solid rgba(255,255,255,0.12);
    border-top-color: rgba(255,255,255,0.9);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .toast {
    position: fixed; right: 20px; top: 24px;
    padding: 10px 14px; border-radius: 8px;
    color: white; font-weight: 600; z-index: 10000;
  }
  .toast.info { background: linear-gradient(90deg,#1565c0,#42a5f5); }
  .toast.error { background: linear-gradient(90deg,#c62828,#ef5350); }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "processingOverlay";
  overlay.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(overlay);
}

function showProcessing(show = true) {
  const ov = document.getElementById("processingOverlay");
  if (ov) ov.style.display = show ? "flex" : "none";
}

function showToast(message, type = "info", ms = 3500) {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/*********************
 * History
 *********************/
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("derm_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry) {
  const h = loadHistory();
  h.push(entry);
  if (h.length > 50) h.splice(0, h.length - 50);
  localStorage.setItem("derm_history", JSON.stringify(h));
  renderHistory();
}

function renderHistory() {
  const listEl = document.getElementById("historyList");
  if (!listEl) return;
  listEl.innerHTML = "";
  const hist = loadHistory().slice().reverse();
  hist.forEach((item) => {
    const li = document.createElement("div");
    li.style.display = "flex";
    li.style.gap = "12px";
    li.style.marginBottom = "10px";
    const img = document.createElement("img");
    img.src = item.imageDataUrl;
    img.width = 64;
    img.height = 64;
    img.style.borderRadius = "8px";
    const meta = document.createElement("div");
    meta.innerHTML = `
      <div style="font-weight:700">${
        item.predictions[0]?.disease || "Unknown"
      }</div>
      <div style="color:#555;font-size:12px">${new Date(
        item.t
      ).toLocaleString()}</div>
    `;
    li.appendChild(img);
    li.appendChild(meta);
    listEl.appendChild(li);
  });
}

/*********************
 * DOM & Event Listeners
 *********************/
document.addEventListener("DOMContentLoaded", () => {
  createStyleAndSpinner();
  renderHistory();

  const uploadBox = document.querySelector(".upload-box");
  const uploadBtn = document.querySelector("#uploadBtn");
  const clearBtn = document.querySelector("#clearBtn");
  const cameraBtn = document.querySelector("#cameraBtn");
  const fetchGeminiBtn = document.getElementById("fetchGeminiBtn");
  const downloadReportBtn = document.getElementById("downloadReportBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  // Sidebar buttons
  const historyBtn = document.getElementById("historyBtn");
  const dashboardBtn = document.getElementById("dashboardBtn");

  // Cards
  const uploadCard = document.getElementById("uploadCard");
  const predictionsCard = document.getElementById("predictionsCard");
  const reportCard = document.getElementById("reportCard");
  const historyCard = document.getElementById("historyCard");

  /********** Sidebar Navigation **********/
  if (dashboardBtn) {
    dashboardBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Show Dashboard components
      ["uploadCard", "predictionsCard", "geminiCard", "reportCard"].forEach(
        (id) => document.getElementById(id)?.classList.remove("hidden")
      );

      // Hide History
      document.getElementById("historyCard")?.classList.add("hidden");
    });
  }

  if (historyBtn) {
    historyBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Show only History
      document.getElementById("historyCard")?.classList.remove("hidden");

      // Hide Dashboard components
      ["uploadCard", "predictionsCard", "geminiCard", "reportCard"].forEach(
        (id) => document.getElementById(id)?.classList.add("hidden")
      );

      // Hide the "Medical Information" button if visible
      document.getElementById("fetchGeminiBtn")?.classList.add("hidden");

      renderHistory();
    });
  }

  /********** Clear History **********/
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      localStorage.removeItem("derm_history");
      renderHistory();
      showToast("History cleared", "info");
    });
  }

  /********** Upload & Camera Buttons **********/
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "file";
  hiddenInput.accept = "image/*";
  hiddenInput.style.display = "none";
  document.body.appendChild(hiddenInput);

  [uploadBox, uploadBtn].forEach((el) =>
    el.addEventListener("click", () => hiddenInput.click())
  );

  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      // Remove uploaded image preview
      document.querySelector("#uploadCard .preview-area")?.remove();

      // Hide all main cards
      [predictionsCard, reportCard, historyCard].forEach((card) =>
        card?.classList.add("hidden")
      );

      // Clear medical information fields
      document.getElementById("diseaseDescription").textContent = "";
      document.getElementById("diseaseTreatment").textContent = "";
      document.getElementById("diseaseReferences").innerHTML = "";

      // Clear global variables
      window.latestPrediction = null;
      window.latestImageName = null;
      window.latestDescription = "";
      window.latestTreatment = "";
      window.latestReferences = [];

      showToast("Cleared successfully", "info");
    });

  if (cameraBtn) cameraBtn.addEventListener("click", openCamera);

  hiddenInput.addEventListener("change", async (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    showPreview(dataUrl);
    await uploadAndPredict(file, dataUrl);
    hiddenInput.value = "";
  });

  /********** Gemini + Download **********/
  if (fetchGeminiBtn) fetchGeminiBtn.addEventListener("click", fetchGeminiInfo);
  if (downloadReportBtn)
    downloadReportBtn.addEventListener("click", downloadReport);
});

/*********************
 * Camera capture
 *********************/
async function openCamera() {
  try {
    const video = document.createElement("video");
    video.autoplay = true;
    video.style.display = "none";
    document.body.appendChild(video);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    await new Promise((res) => (video.onloadedmetadata = res));

    // Capture a frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Stop camera
    stream.getTracks().forEach((t) => t.stop());
    video.remove();

    const dataUrl = canvas.toDataURL("image/png");
    showPreview(dataUrl);

    // Convert dataURL to File object
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "camera_capture.png", { type: "image/png" });

    await uploadAndPredict(file, dataUrl);
  } catch (err) {
    console.error(err);
    showToast("Camera capture failed", "error");
  }
}

/*********************
 * Core functions
 *********************/
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function showPreview(dataUrl) {
  const card = document.getElementById("uploadCard");
  card.querySelector(".preview-area")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "preview-area";
  wrap.innerHTML = `<img src="${dataUrl}" style="max-width:250px;border-radius:12px;">`;
  card.appendChild(wrap);
}

async function uploadAndPredict(file, dataUrl) {
  try {
    showProcessing(true);
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${BACKEND}/api/predict/`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json();

    if (json.error) {
      showToast(json.error, "error");
      return;
    }

    const top = {
      disease: json.disease || "Unknown",
      confidence: json.confidence || 0,
    };

    renderPrediction(top);
    saveHistoryEntry({
      t: Date.now(),
      imageDataUrl: dataUrl,
      predictions: [top],
    });

    window.latestPrediction = top.disease;
    window.latestImageName = file.name.replace(/\.[^/.]+$/, "");

    ["predictionsCard", "reportCard", "geminiCard"].forEach((id) =>
      document.getElementById(id)?.classList.remove("hidden")
    );

    document.getElementById("historyCard")?.classList.add("hidden");

    await fetchGeminiInfo();
  } catch (err) {
    console.error(err);
    showToast("Prediction failed", "error");
  } finally {
    showProcessing(false);
  }
}

/*********************
 * Render Prediction + Circular Confidence
 *********************/
function renderPrediction(p) {
  const card = document.getElementById("predictionsCard");
  card.innerHTML = `
    <div class="prediction-card">
      <div class="disease-name">${p.disease || "Unknown"}</div>
      <svg class="circle-progress" width="120" height="120">
        <circle cx="60" cy="60" r="54" stroke="#eee" stroke-width="12" fill="none"/>
        <circle cx="60" cy="60" r="54" stroke="${getConfidenceColor(
          p.confidence
        )}" stroke-width="12" fill="none" stroke-dasharray="339.292" stroke-dashoffset="339.292"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="1.2rem" fill="white">0%</text>
      </svg>
    </div>
  `;

  animateConfidence(p.confidence);
}

function getConfidenceColor(conf) {
  if (conf >= 0.75) return "#4caf50";
  if (conf >= 0.5) return "#ffeb3b";
  return "#f44336";
}

function animateConfidence(conf) {
  const svg = document.querySelector(
    ".prediction-card .circle-progress circle:nth-child(2)"
  );
  const text = document.querySelector(".prediction-card .circle-progress text");
  if (!svg || !text) return;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = circumference;
  const targetOffset = circumference * (1 - conf);

  let current = 0;
  const interval = setInterval(() => {
    if (current >= conf) {
      clearInterval(interval);
      return;
    }
    current += 0.01;
    const newOffset = circumference * (1 - current);
    svg.setAttribute("stroke-dashoffset", newOffset);
    text.textContent = `${Math.floor(current * 100)}%`;
  }, 12);
}

/*********************
 * Gemini integration
 *********************/
async function fetchGeminiInfo() {
  const topPred = window.latestPrediction;
  if (!topPred) {
    showToast("No prediction to fetch info for", "info");
    return;
  }
  try {
    showProcessing(true);
    const res = await fetch(`${BACKEND}/api/gemini/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disease: topPred }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    document.getElementById("diseaseDescription").textContent =
      json.description || "No description available";
    document.getElementById("diseaseTreatment").textContent =
      json.treatment || "No treatment information available";

    const refsEl = document.getElementById("diseaseReferences");
    refsEl.innerHTML = "";
    if (json.references && json.references.length > 0) {
      json.references.forEach((ref) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = ref;
        a.textContent = ref;
        a.target = "_blank";
        li.appendChild(a);
        refsEl.appendChild(li);
      });
    } else refsEl.innerHTML = "<li>No references available</li>";

    window.latestDescription = json.description || "";
    window.latestTreatment = json.treatment || "";
    window.latestReferences = json.references || [];
  } catch (err) {
    console.error("Gemini fetch failed:", err);
    showToast("Gemini fetch failed", "error");
  } finally {
    showProcessing(false);
  }
}

/*********************
 * Report download
 *********************/
async function downloadReport() {
  const predictedClass = window.latestPrediction || "Unknown";
  const imageName = window.latestImageName || "uploaded_image";
  const confidence =
    document.querySelector(".prediction-card text")?.textContent || "N/A";

  const description =
    document.getElementById("diseaseDescription").innerText ||
    "No description available";
  const treatment =
    document.getElementById("diseaseTreatment").innerText ||
    "No treatment information available";
  const references = Array.from(
    document.querySelectorAll("#diseaseReferences li a")
  ).map((a) => a.href);

  try {
    const res = await fetch(`${BACKEND}/api/report/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        predicted_class: predictedClass,
        confidence: confidence,
        image_name: imageName,
        description: description,
        treatment: treatment,
        references: references,
      }),
    });

    if (!res.ok) throw new Error("Failed to generate report");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${imageName}_report.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    showToast("Report download failed", "error");
  }
}
