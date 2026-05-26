const state = {
  data: null,
  activeLayer: "velocity",
  dateIndex: 0,
  coherenceThreshold: 0.3,
  selectedPixel: null,
};

const els = {
  projectForm: document.querySelector("#project-form"),
  projectPath: document.querySelector("#project-path"),
  status: document.querySelector("#status"),
  datasetFile: document.querySelector("#dataset-file"),
  gridDetails: document.querySelector("#grid-details"),
  boundsDetails: document.querySelector("#bounds-details"),
  layerButtons: document.querySelectorAll(".layer-button"),
  datePanel: document.querySelector("#date-panel"),
  dateSlider: document.querySelector("#date-slider"),
  dateValue: document.querySelector("#date-value"),
  filterPanel: document.querySelector("#filter-panel"),
  coherenceSlider: document.querySelector("#coherence-slider"),
  coherenceValue: document.querySelector("#coherence-value"),
  filterBadge: document.querySelector("#active-filter-badge"),
  legendTitle: document.querySelector("#legend-title"),
  legendBar: document.querySelector("#legend-bar"),
  legendMin: document.querySelector("#legend-min"),
  legendMid: document.querySelector("#legend-mid"),
  legendMax: document.querySelector("#legend-max"),
  legendCopy: document.querySelector("#legend-copy"),
  activeLayerTitle: document.querySelector("#active-layer-title"),
  activeLayerCopy: document.querySelector("#active-layer-copy"),
  mapCanvas: document.querySelector("#map-canvas"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  lonRange: document.querySelector("#lon-range"),
  latRange: document.querySelector("#lat-range"),
  pixelLat: document.querySelector("#pixel-lat"),
  pixelLon: document.querySelector("#pixel-lon"),
  pixelVelocity: document.querySelector("#pixel-velocity"),
  pixelCoherence: document.querySelector("#pixel-coherence"),
  pixelDeformation: document.querySelector("#pixel-deformation"),
  pixelPasses: document.querySelector("#pixel-passes"),
  timeseriesCanvas: document.querySelector("#timeseries-canvas"),
};

const layerText = {
  velocity: {
    title: "Velocity",
    copy: "LOS velocity is motion in the satellite line-of-sight direction, not direct vertical ground motion.",
    legend: "Diverging scale centred on zero. Negative and positive LOS motion depend on satellite viewing geometry.",
  },
  deformation: {
    title: "Deformation",
    copy: "Cumulative LOS displacement is relative to the processing reference date or reference point.",
    legend: "Diverging scale centred on zero for the selected acquisition date. The first date is a temporal reference, not absolute ground motion.",
  },
  coherence: {
    title: "Coherence",
    copy: "Coherence is a reliability layer. Higher coherence means more reliable deformation information.",
    legend: "Unitless reliability from 0 to 1. Low coherence is less reliable; high coherence is more reliable.",
  },
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

function setStatus(message, type = "info") {
  els.status.textContent = message;
  els.status.className = `status ${type}`;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function getBounds() {
  return state.data.project.bounds;
}

function getLayerValues() {
  if (!state.data) return null;
  if (state.activeLayer === "velocity") return state.data.layers.velocity.values;
  if (state.activeLayer === "coherence") return state.data.layers.coherence.values;
  return state.data.layers.deformation.values[state.dateIndex];
}

function getLayerRange() {
  if (state.activeLayer === "velocity") return state.data.layers.velocity.range;
  if (state.activeLayer === "coherence") return state.data.layers.coherence.range;
  return state.data.layers.deformation.range;
}

function isFilterableLayer() {
  return state.activeLayer === "velocity" || state.activeLayer === "deformation";
}

function colorForValue(value, range, layer) {
  if (value === null || value === undefined || Number.isNaN(value)) return [0, 0, 0, 0];

  if (layer === "coherence") {
    const t = clamp(value, 0, 1);
    return interpolateStops(t, [
      [31, 41, 55],
      [32, 139, 117],
      [250, 204, 21],
    ]);
  }

  const min = range.p02 ?? range.min ?? -1;
  const max = range.p98 ?? range.max ?? 1;
  const extent = Math.max(Math.abs(min), Math.abs(max), 0.000001);
  const t = clamp((value + extent) / (2 * extent), 0, 1);
  return interpolateStops(t, [
    [40, 89, 173],
    [246, 247, 240],
    [190, 54, 45],
  ]);
}

function interpolateStops(t, stops) {
  const scaled = t * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const localT = scaled - index;
  const start = stops[index];
  const end = stops[index + 1];
  return [
    Math.round(start[0] + (end[0] - start[0]) * localT),
    Math.round(start[1] + (end[1] - start[1]) * localT),
    Math.round(start[2] + (end[2] - start[2]) * localT),
    255,
  ];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resizeCanvasToDisplaySize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawMap() {
  resizeCanvasToDisplaySize(els.mapCanvas);
  const ctx = els.mapCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.mapCanvas.width, els.mapCanvas.height);

  if (!state.data) {
    els.mapPlaceholder.hidden = false;
    return;
  }

  els.mapPlaceholder.hidden = true;
  const values = getLayerValues();
  const range = getLayerRange();
  const coherence = state.data.layers.coherence.values;
  const rows = values.length;
  const cols = values[0].length;
  const image = ctx.createImageData(cols, rows);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const offset = (y * cols + x) * 4;
      const value = values[y][x];
      const pixelCoherence = coherence[y][x];
      const hiddenByFilter = isFilterableLayer()
        && (pixelCoherence === null || pixelCoherence < state.coherenceThreshold);
      const color = hiddenByFilter ? [0, 0, 0, 0] : colorForValue(value, range, state.activeLayer);
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = color[3];
    }
  }

  const buffer = document.createElement("canvas");
  buffer.width = cols;
  buffer.height = rows;
  buffer.getContext("2d").putImageData(image, 0, 0);

  const mapRect = mapDrawRect(rows, cols);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#eef1f4";
  ctx.fillRect(0, 0, els.mapCanvas.width, els.mapCanvas.height);
  ctx.drawImage(buffer, mapRect.x, mapRect.y, mapRect.width, mapRect.height);
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
  ctx.strokeRect(mapRect.x, mapRect.y, mapRect.width, mapRect.height);

  drawSelectedPixel(ctx, mapRect, rows, cols);
  updateMapLabels();
  updateLegend();
  updatePixelInfo();
}

function mapDrawRect(rows, cols) {
  const padding = 24 * (window.devicePixelRatio || 1);
  const availableWidth = els.mapCanvas.width - padding * 2;
  const availableHeight = els.mapCanvas.height - padding * 2;
  const scale = Math.min(availableWidth / cols, availableHeight / rows);
  const width = cols * scale;
  const height = rows * scale;
  return {
    x: (els.mapCanvas.width - width) / 2,
    y: (els.mapCanvas.height - height) / 2,
    width,
    height,
  };
}

function drawSelectedPixel(ctx, mapRect, rows, cols) {
  if (!state.selectedPixel) return;
  const { row, col } = state.selectedPixel;
  const x = mapRect.x + (col + 0.5) * (mapRect.width / cols);
  const y = mapRect.y + (row + 0.5) * (mapRect.height / rows);
  const radius = Math.max(5, 7 * (window.devicePixelRatio || 1));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = Math.max(2, 2 * (window.devicePixelRatio || 1));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

function handleMapClick(event) {
  if (!state.data) return;
  const rect = els.mapCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const x = (event.clientX - rect.left) * ratio;
  const y = (event.clientY - rect.top) * ratio;
  const rows = state.data.lat.length;
  const cols = state.data.lon.length;
  const mapRect = mapDrawRect(rows, cols);

  if (
    x < mapRect.x || x > mapRect.x + mapRect.width ||
    y < mapRect.y || y > mapRect.y + mapRect.height
  ) {
    return;
  }

  const col = clamp(Math.floor(((x - mapRect.x) / mapRect.width) * cols), 0, cols - 1);
  const row = clamp(Math.floor(((y - mapRect.y) / mapRect.height) * rows), 0, rows - 1);
  state.selectedPixel = { row, col };
  drawMap();
  drawTimeSeries();
}

function updateMapLabels() {
  const bounds = getBounds();
  els.lonRange.textContent = `Longitude: ${formatNumber(bounds.lon_min, 5)} to ${formatNumber(bounds.lon_max, 5)}`;
  els.latRange.textContent = `Latitude: ${formatNumber(bounds.lat_min, 5)} to ${formatNumber(bounds.lat_max, 5)}`;
}

function updateControls() {
  els.layerButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.layer === state.activeLayer);
  });

  els.datePanel.hidden = state.activeLayer !== "deformation";
  els.filterPanel.hidden = !isFilterableLayer();
  els.filterBadge.hidden = !isFilterableLayer();
  els.filterBadge.textContent = `Filter active: >= ${state.coherenceThreshold.toFixed(2)}`;
  els.coherenceValue.textContent = state.coherenceThreshold.toFixed(2);

  if (state.data) {
    els.dateSlider.max = Math.max(0, state.data.dates.length - 1);
    els.dateSlider.value = state.dateIndex;
    els.dateValue.textContent = state.data.dates[state.dateIndex] || "-";
  }

  els.activeLayerTitle.textContent = layerText[state.activeLayer].title;
  els.activeLayerCopy.textContent = layerText[state.activeLayer].copy;
}

function updateLegend() {
  if (!state.data) return;
  const range = getLayerRange();
  els.legendTitle.textContent = layerText[state.activeLayer].title;
  els.legendCopy.textContent = layerText[state.activeLayer].legend;

  if (state.activeLayer === "coherence") {
    els.legendBar.style.background = "linear-gradient(90deg, rgb(31,41,55), rgb(32,139,117), rgb(250,204,21))";
    els.legendMin.textContent = "0";
    els.legendMid.textContent = "Reliability";
    els.legendMax.textContent = "1";
    return;
  }

  const unit = state.activeLayer === "velocity" ? "mm/year" : "mm";
  els.legendBar.style.background = "linear-gradient(90deg, rgb(40,89,173), rgb(246,247,240), rgb(190,54,45))";
  els.legendMin.textContent = `${formatNumber(range.p02)} ${unit}`;
  els.legendMid.textContent = "0";
  els.legendMax.textContent = `${formatNumber(range.p98)} ${unit}`;
}

function updatePixelInfo() {
  if (!state.data || !state.selectedPixel) return;
  const { row, col } = state.selectedPixel;
  const velocity = state.data.layers.velocity.values[row][col];
  const coherence = state.data.layers.coherence.values[row][col];
  const deformation = state.data.layers.deformation.values[state.dateIndex][row][col];
  const passes = coherence !== null && coherence >= state.coherenceThreshold;

  els.pixelLat.textContent = formatNumber(state.data.lat[row], 6);
  els.pixelLon.textContent = formatNumber(state.data.lon[col], 6);
  els.pixelVelocity.textContent = `${formatNumber(velocity)} mm/year`;
  els.pixelCoherence.textContent = formatNumber(coherence, 2);
  els.pixelDeformation.textContent = `${formatNumber(deformation)} mm`;
  els.pixelPasses.textContent = isFilterableLayer() ? (passes ? "Yes" : "No") : "Not applied";
}

function drawTimeSeries() {
  resizeCanvasToDisplaySize(els.timeseriesCanvas);
  const ctx = els.timeseriesCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.timeseriesCanvas.width, els.timeseriesCanvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, els.timeseriesCanvas.width, els.timeseriesCanvas.height);

  const padding = 34 * (window.devicePixelRatio || 1);
  const width = els.timeseriesCanvas.width - padding * 2;
  const height = els.timeseriesCanvas.height - padding * 2;

  ctx.strokeStyle = "#d8dee8";
  ctx.strokeRect(padding, padding, width, height);

  if (!state.data || !state.selectedPixel) {
    ctx.fillStyle = "#627083";
    ctx.font = `${13 * (window.devicePixelRatio || 1)}px Arial`;
    ctx.fillText("Click a map pixel to show its deformation series.", padding, padding + 24);
    return;
  }

  const { row, col } = state.selectedPixel;
  const values = state.data.layers.deformation.values.map((plane) => plane[row][col]);
  const valid = values.filter((value) => value !== null && !Number.isNaN(value));
  if (!valid.length) {
    ctx.fillStyle = "#627083";
    ctx.fillText("No deformation values for this pixel.", padding, padding + 24);
    return;
  }

  const maxAbs = Math.max(...valid.map((value) => Math.abs(value)), 0.000001);
  const xForIndex = (index) => padding + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
  const yForValue = (value) => padding + height / 2 - (value / maxAbs) * (height / 2);

  ctx.strokeStyle = "#aab3c2";
  ctx.beginPath();
  ctx.moveTo(padding, padding + height / 2);
  ctx.lineTo(padding + width, padding + height / 2);
  ctx.stroke();

  ctx.strokeStyle = "#176b87";
  ctx.lineWidth = Math.max(2, 2 * (window.devicePixelRatio || 1));
  ctx.beginPath();
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      drawing = false;
      return;
    }
    const x = xForIndex(index);
    const y = yForValue(value);
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  values.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) return;
    ctx.fillStyle = index === state.dateIndex ? "#b6362d" : "#176b87";
    ctx.beginPath();
    ctx.arc(xForIndex(index), yForValue(value), 4 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#17202a";
  ctx.font = `${11 * (window.devicePixelRatio || 1)}px Arial`;
  ctx.fillText(`${formatNumber(maxAbs)} mm`, padding, padding - 10);
  ctx.fillText(`${formatNumber(-maxAbs)} mm`, padding, padding + height + 18);
}

function renderDatasetDetails() {
  const project = state.data.project;
  const bounds = project.bounds;
  els.datasetFile.textContent = project.dataset_file;
  els.gridDetails.textContent = `${project.lat_count} rows x ${project.lon_count} columns, ${project.date_count} dates`;
  els.boundsDetails.textContent = `${formatNumber(bounds.lat_min, 5)} to ${formatNumber(bounds.lat_max, 5)} lat; ${formatNumber(bounds.lon_min, 5)} to ${formatNumber(bounds.lon_max, 5)} lon`;
}

async function loadProject(projectPath = "") {
  setStatus("Loading project data...");
  try {
    await fetchJson("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_path: projectPath }),
    });
    state.data = await fetchJson("/api/map-data");
    state.dateIndex = 0;
    state.selectedPixel = null;
    renderDatasetDetails();
    updateControls();
    drawMap();
    drawTimeSeries();
    setStatus("Project loaded.", "success");
  } catch (error) {
    state.data = null;
    drawMap();
    drawTimeSeries();
    setStatus(error.message, "error");
  }
}

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadProject(els.projectPath.value.trim());
});

els.layerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeLayer = button.dataset.layer;
    updateControls();
    drawMap();
    drawTimeSeries();
  });
});

els.dateSlider.addEventListener("input", () => {
  state.dateIndex = Number(els.dateSlider.value);
  updateControls();
  drawMap();
  drawTimeSeries();
});

els.coherenceSlider.addEventListener("input", () => {
  state.coherenceThreshold = Number(els.coherenceSlider.value);
  updateControls();
  drawMap();
});

els.mapCanvas.addEventListener("click", handleMapClick);
window.addEventListener("resize", () => {
  drawMap();
  drawTimeSeries();
});

updateControls();
drawMap();
drawTimeSeries();
loadProject();
