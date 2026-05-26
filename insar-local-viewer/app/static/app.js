const state = {
  data: null,
  activeLayer: "velocity",
  dateIndex: 0,
  coherenceThreshold: 0.3,
  selectedPixel: null,
  map: null,
  rasterLayer: null,
  rasterValues: null,
  rasterRange: null,
  selectedPixelLayer: null,
  hasFitProjectBounds: false,
};

const els = {
  fileMenuButton: document.querySelector("#file-menu-button"),
  fileMenu: document.querySelector("#file-menu"),
  openProjectButton: document.querySelector("#open-project-button"),
  reloadProjectButton: document.querySelector("#reload-project-button"),
  currentProjectLabel: document.querySelector("#current-project-label"),
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
  activeLayerTitle: document.querySelector("#active-layer-title"),
  mapFrame: document.querySelector("#map-frame"),
  map: document.querySelector("#map"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  lonRange: document.querySelector("#lon-range"),
  latRange: document.querySelector("#lat-range"),
  pixelLat: document.querySelector("#pixel-lat"),
  pixelLon: document.querySelector("#pixel-lon"),
  pixelVelocity: document.querySelector("#pixel-velocity"),
  pixelCoherence: document.querySelector("#pixel-coherence"),
  pixelDeformation: document.querySelector("#pixel-deformation"),
  pixelPasses: document.querySelector("#pixel-passes"),
  pixelPanel: document.querySelector("#pixel-panel"),
  pixelPanelHeader: document.querySelector("#pixel-panel-header"),
  pixelPanelMinimize: document.querySelector("#pixel-panel-minimize"),
  pixelPanelResize: document.querySelector("#pixel-panel-resize"),
  pixelPanelSubtitle: document.querySelector("#pixel-panel-subtitle"),
  timeseriesCanvas: document.querySelector("#timeseries-canvas"),
};

const layerText = {
  velocity: { title: "Velocity" },
  deformation: { title: "Deformation" },
  coherence: { title: "Coherence" },
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

function getDisplayRange(values = getLayerValues()) {
  if (!state.data) return getLayerRange();
  if (state.activeLayer === "coherence") {
    return state.data.layers.coherence.range;
  }

  const coherence = state.data.layers.coherence.values;
  const visibleValues = [];

  for (let y = 0; y < values.length; y += 1) {
    for (let x = 0; x < values[y].length; x += 1) {
      const value = values[y][x];
      const pixelCoherence = coherence[y][x];
      if (
        value !== null
        && !Number.isNaN(value)
        && pixelCoherence !== null
        && pixelCoherence >= state.coherenceThreshold
      ) {
        visibleValues.push(value);
      }
    }
  }

  if (!visibleValues.length) {
    return { min: null, max: null, p02: null, p98: null };
  }

  visibleValues.sort((a, b) => a - b);
  const p02 = percentile(visibleValues, 2);
  const p98 = percentile(visibleValues, 98);
  const extent = Math.max(Math.abs(p02), Math.abs(p98), 0.000001);

  return {
    min: visibleValues[0],
    max: visibleValues[visibleValues.length - 1],
    p02: -extent,
    p98: extent,
  };
}

function percentile(sortedValues, percentileValue) {
  if (!sortedValues.length) return null;
  const index = (percentileValue / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
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

function initializeMap() {
  if (state.map || typeof L === "undefined") return;

  const baseLayers = {
    "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }),
    "Carto Light": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
    }),
    "Esri Satellite": L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution: "Esri",
      },
    ),
  };

  state.map = L.map(els.map, {
    fadeAnimation: true,
    zoomControl: true,
    zoomAnimation: true,
    preferCanvas: true,
    layers: [baseLayers["Esri Satellite"]],
  });

  state.map.createPane("insarRasterPane");
  state.map.getPane("insarRasterPane").style.zIndex = 410;
  state.map.getPane("insarRasterPane").style.pointerEvents = "none";
  state.map.createPane("selectedPixelPane");
  state.map.getPane("selectedPixelPane").style.zIndex = 720;

  L.control.layers(baseLayers, {}, { collapsed: false }).addTo(state.map);
  L.control.scale().addTo(state.map);
  state.map.setView([0, 0], 2);
  state.map.on("click", handleLeafletMapClick);
}

function drawMap() {
  initializeMap();

  if (!state.data) {
    els.mapPlaceholder.hidden = false;
    return;
  }

  els.mapPlaceholder.hidden = true;
  state.map.invalidateSize();
  const values = getLayerValues();
  const range = getDisplayRange(values);
  const bounds = leafletBounds();
  state.rasterValues = values;
  state.rasterRange = range;
  updateRasterLayer();

  if (!state.hasFitProjectBounds) {
    state.map.fitBounds(bounds, { padding: [28, 28] });
    state.hasFitProjectBounds = true;
  }

  drawSelectedPixel();
  updateMapLabels();
  updateLegend();
  updatePixelInfo();
}

function leafletBounds() {
  const bounds = getBounds();
  return L.latLngBounds(
    [bounds.lat_min, bounds.lon_min],
    [bounds.lat_max, bounds.lon_max],
  );
}

function updateRasterLayer() {
  if (!state.map || !state.data || !state.rasterValues || !state.rasterRange) return;

  if (!state.rasterLayer) {
    state.rasterLayer = createRasterGridLayer();
    state.rasterLayer.addTo(state.map);
  } else {
    state.rasterLayer.redraw();
  }
}

function createRasterGridLayer() {
  const RasterGridLayer = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement("canvas");
      const tileSize = this.getTileSize();
      tile.width = tileSize.x;
      tile.height = tileSize.y;
      tile.className = "insar-raster-tile";

      const ctx = tile.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      drawRasterTile(ctx, coords, tileSize);

      return tile;
    },
  });

  return new RasterGridLayer({
    pane: "insarRasterPane",
    tileSize: 256,
    opacity: 1,
    updateWhenIdle: false,
    updateWhenZooming: true,
    keepBuffer: 6,
  });
}

function drawRasterTile(ctx, coords, tileSize) {
  if (!state.data || !state.rasterValues || !state.rasterRange) return;
  if (state.rasterRange.p02 === null && state.activeLayer !== "coherence") return;

  const values = state.rasterValues;
  const coherence = state.data.layers.coherence.values;
  const latEdges = axisEdges(state.data.lat);
  const lonEdges = axisEdges(state.data.lon);
  const tileOrigin = L.point(coords.x * tileSize.x, coords.y * tileSize.y);
  const tileBounds = L.bounds(tileOrigin, tileOrigin.add(tileSize));

  for (let row = 0; row < values.length; row += 1) {
    const south = Math.min(latEdges[row], latEdges[row + 1]);
    const north = Math.max(latEdges[row], latEdges[row + 1]);

    for (let col = 0; col < values[row].length; col += 1) {
      const value = values[row][col];
      const pixelCoherence = coherence[row][col];
      const hiddenByFilter = isFilterableLayer()
        && (pixelCoherence === null || pixelCoherence < state.coherenceThreshold);

      if (hiddenByFilter || value === null || Number.isNaN(value)) continue;

      const west = Math.min(lonEdges[col], lonEdges[col + 1]);
      const east = Math.max(lonEdges[col], lonEdges[col + 1]);
      const northWest = state.map.project([north, west], coords.z);
      const southEast = state.map.project([south, east], coords.z);
      const cellBounds = L.bounds(northWest, southEast);

      if (!tileBounds.intersects(cellBounds)) continue;

      const x = northWest.x - tileOrigin.x;
      const y = northWest.y - tileOrigin.y;
      const width = Math.max(1, southEast.x - northWest.x);
      const height = Math.max(1, southEast.y - northWest.y);
      const radius = Math.max(1, Math.min(width, height) * 0.48);
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const color = colorForValue(value, state.rasterRange, state.activeLayer);

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function axisEdges(values) {
  const edges = [];
  for (let index = 0; index <= values.length; index += 1) {
    if (index === 0) {
      edges.push(values[0] - (values[1] - values[0]) / 2);
    } else if (index === values.length) {
      edges.push(values[values.length - 1] + (values[values.length - 1] - values[values.length - 2]) / 2);
    } else {
      edges.push((values[index - 1] + values[index]) / 2);
    }
  }
  return edges;
}

function drawSelectedPixel() {
  if (!state.selectedPixel) return;
  if (!state.selectedPixelLayer) {
    state.selectedPixelLayer = createSelectedPixelLayer();
    state.selectedPixelLayer.addTo(state.map);
  } else {
    state.selectedPixelLayer.redraw();
  }
}

function createSelectedPixelLayer() {
  const SelectedPixelLayer = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement("canvas");
      const tileSize = this.getTileSize();
      tile.width = tileSize.x;
      tile.height = tileSize.y;
      tile.className = "selected-pixel-tile";

      const ctx = tile.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      drawSelectedPixelTile(ctx, coords, tileSize);

      return tile;
    },
  });

  return new SelectedPixelLayer({
    pane: "selectedPixelPane",
    tileSize: 256,
    updateWhenIdle: false,
    updateWhenZooming: true,
    keepBuffer: 6,
  });
}

function drawSelectedPixelTile(ctx, coords, tileSize) {
  if (!state.data || !state.selectedPixel) return;

  const { row, col } = state.selectedPixel;
  const latEdges = axisEdges(state.data.lat);
  const lonEdges = axisEdges(state.data.lon);
  const south = Math.min(latEdges[row], latEdges[row + 1]);
  const north = Math.max(latEdges[row], latEdges[row + 1]);
  const west = Math.min(lonEdges[col], lonEdges[col + 1]);
  const east = Math.max(lonEdges[col], lonEdges[col + 1]);
  const tileOrigin = L.point(coords.x * tileSize.x, coords.y * tileSize.y);
  const tileBounds = L.bounds(tileOrigin, tileOrigin.add(tileSize));
  const northWest = state.map.project([north, west], coords.z);
  const southEast = state.map.project([south, east], coords.z);
  const cellBounds = L.bounds(northWest, southEast);

  if (!tileBounds.intersects(cellBounds)) return;

  const x = northWest.x - tileOrigin.x;
  const y = northWest.y - tileOrigin.y;
  const width = Math.max(1, southEast.x - northWest.x);
  const height = Math.max(1, southEast.y - northWest.y);
  const radius = Math.max(1, Math.min(width, height) * 0.48);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const ringWidth = Math.max(2, Math.min(4, radius * 0.42));

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + ringWidth * 0.8, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = ringWidth + 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + ringWidth * 0.8, 0, Math.PI * 2);
  ctx.strokeStyle = "#fcd900";
  ctx.lineWidth = ringWidth;
  ctx.stroke();
}

function handleLeafletMapClick(event) {
  if (!state.data) return;
  if (!leafletBounds().contains(event.latlng)) return;

  const row = nearestIndex(state.data.lat, event.latlng.lat);
  const col = nearestIndex(state.data.lon, event.latlng.lng);
  state.selectedPixel = { row, col };
  showPixelPanel();
  drawSelectedPixel();
  updatePixelInfo();
  drawTimeSeries();
}

function nearestIndex(values, target) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  values.forEach((value, index) => {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
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
}

function updateLegend() {
  if (!state.data) return;
  const range = getDisplayRange();
  els.legendTitle.textContent = layerText[state.activeLayer].title;

  if (state.activeLayer === "coherence") {
    els.legendBar.style.background = "linear-gradient(90deg, rgb(31,41,55), rgb(32,139,117), rgb(250,204,21))";
    els.legendMin.textContent = "0";
    els.legendMid.textContent = "Reliability";
    els.legendMax.textContent = "1";
    return;
  }

  const unit = state.activeLayer === "velocity" ? "mm/year" : "mm";
  els.legendBar.style.background = "linear-gradient(90deg, rgb(40,89,173), rgb(246,247,240), rgb(190,54,45))";
  els.legendMin.textContent = range.p02 === null ? `No visible pixels` : `${formatNumber(range.p02)} ${unit}`;
  els.legendMid.textContent = "0";
  els.legendMax.textContent = range.p98 === null ? "" : `${formatNumber(range.p98)} ${unit}`;
}

function updatePixelInfo() {
  if (!state.data || !state.selectedPixel) {
    resetPixelInfo();
    return;
  }
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
  els.pixelPanelSubtitle.textContent = `${formatNumber(state.data.lat[row], 5)}, ${formatNumber(state.data.lon[col], 5)}`;
}

function resetPixelInfo() {
  els.pixelLat.textContent = "Click the map";
  els.pixelLon.textContent = "Click the map";
  els.pixelVelocity.textContent = "-";
  els.pixelCoherence.textContent = "-";
  els.pixelDeformation.textContent = "-";
  els.pixelPasses.textContent = "-";
  els.pixelPanelSubtitle.textContent = "No point selected";
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
  els.currentProjectLabel.textContent = `Project: ${projectFolderName(project.project_path)}`;
  els.gridDetails.textContent = `${project.lat_count} rows x ${project.lon_count} columns, ${project.date_count} dates`;
  els.boundsDetails.textContent = `${formatNumber(bounds.lat_min, 5)} to ${formatNumber(bounds.lat_max, 5)} lat; ${formatNumber(bounds.lon_min, 5)} to ${formatNumber(bounds.lon_max, 5)} lon`;
}

function projectFolderName(projectPath) {
  const parts = String(projectPath).split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || "Loaded project";
}

async function loadProject(projectPath = "") {
  setStatus("Loading project data...");
  try {
    if (projectPath !== "__CURRENT__") {
      await fetchJson("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_path: projectPath }),
      });
    }
    state.data = await fetchJson("/api/map-data");
    state.dateIndex = 0;
    state.selectedPixel = null;
    minimizePixelPanel({ keepPanelVisible: false });
    resetMapLayers();
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

function setMenuOpen(open) {
  els.fileMenu.hidden = !open;
  els.fileMenuButton.setAttribute("aria-expanded", String(open));
}

async function openProjectFromFolderPicker() {
  setMenuOpen(false);
  setStatus("Opening folder picker...");
  try {
    const result = await fetchJson("/api/browse-folder", { method: "POST" });
    if (result.cancelled) {
      setStatus("Folder selection cancelled.");
      return;
    }

    state.data = await fetchJson("/api/map-data");
    state.dateIndex = 0;
    state.selectedPixel = null;
    minimizePixelPanel({ keepPanelVisible: false });
    resetMapLayers();
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

els.fileMenuButton.addEventListener("click", () => {
  setMenuOpen(els.fileMenu.hidden);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-root")) {
    setMenuOpen(false);
  }
});

els.openProjectButton.addEventListener("click", openProjectFromFolderPicker);
els.reloadProjectButton.addEventListener("click", () => {
  setMenuOpen(false);
  loadProject("__CURRENT__");
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

window.addEventListener("resize", () => {
  drawMap();
  drawTimeSeries();
  constrainFloatingPanel();
});

function showPixelPanel() {
  els.pixelPanel.hidden = false;
  els.pixelPanel.classList.remove("minimized");
  if (!els.pixelPanel.dataset.positioned) {
    placePanelBottomRight();
  }
}

function minimizePixelPanel({ keepPanelVisible = true } = {}) {
  clearSelectedPixel();
  resetPixelInfo();
  drawTimeSeries();

  if (keepPanelVisible) {
    els.pixelPanel.hidden = false;
    els.pixelPanel.classList.add("minimized");
    if (!els.pixelPanel.dataset.positioned) {
      placePanelBottomRight();
    }
  } else {
    els.pixelPanel.hidden = true;
    els.pixelPanel.classList.remove("minimized");
  }
}

function clearSelectedPixel() {
  state.selectedPixel = null;
  if (state.selectedPixelLayer) {
    state.selectedPixelLayer.remove();
    state.selectedPixelLayer = null;
  }
}

function placePanelBottomRight() {
  const frame = els.mapFrame.getBoundingClientRect();
  const width = Math.min(420, Math.max(320, frame.width * 0.36));
  const height = Math.min(420, Math.max(300, frame.height * 0.44));
  setPanelGeometry({
    left: frame.width - width - 18,
    top: frame.height - height - 18,
    width,
    height,
  });
  els.pixelPanel.dataset.positioned = "true";
}

function setPanelGeometry({ left, top, width, height }) {
  const frame = els.mapFrame.getBoundingClientRect();
  const minWidth = 300;
  const minHeight = 170;
  const nextWidth = clamp(width, minWidth, Math.max(minWidth, frame.width - 24));
  const nextHeight = clamp(height, minHeight, Math.max(minHeight, frame.height - 24));
  const nextLeft = clamp(left, 12, Math.max(12, frame.width - nextWidth - 12));
  const nextTop = clamp(top, 12, Math.max(12, frame.height - nextHeight - 12));

  els.pixelPanel.style.left = `${nextLeft}px`;
  els.pixelPanel.style.top = `${nextTop}px`;
  els.pixelPanel.style.width = `${nextWidth}px`;
  els.pixelPanel.style.height = `${nextHeight}px`;
}

function constrainFloatingPanel() {
  if (els.pixelPanel.hidden || !els.pixelPanel.dataset.positioned) return;
  const panel = els.pixelPanel.getBoundingClientRect();
  const frame = els.mapFrame.getBoundingClientRect();
  setPanelGeometry({
    left: panel.left - frame.left,
    top: panel.top - frame.top,
    width: panel.width,
    height: panel.height,
  });
}

function snapFloatingPanel() {
  if (els.pixelPanel.hidden) return;
  const panel = els.pixelPanel.getBoundingClientRect();
  const frame = els.mapFrame.getBoundingClientRect();
  let left = panel.left - frame.left;
  let top = panel.top - frame.top;
  const threshold = 28;

  if (left < threshold) left = 12;
  if (top < threshold) top = 12;
  if (frame.width - (left + panel.width) < threshold) left = frame.width - panel.width - 12;
  if (frame.height - (top + panel.height) < threshold) top = frame.height - panel.height - 12;

  setPanelGeometry({ left, top, width: panel.width, height: panel.height });
}

function initializeFloatingPanel() {
  L.DomEvent.disableClickPropagation(els.pixelPanel);
  L.DomEvent.disableScrollPropagation(els.pixelPanel);

  let dragState = null;
  let resizeState = null;

  els.pixelPanelHeader.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    els.pixelPanelHeader.setPointerCapture(event.pointerId);
    const panel = els.pixelPanel.getBoundingClientRect();
    const frame = els.mapFrame.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: panel.left - frame.left,
      top: panel.top - frame.top,
      width: panel.width,
      height: panel.height,
    };
    els.pixelPanel.classList.add("dragging");
  });

  els.pixelPanelHeader.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setPanelGeometry({
      left: dragState.left + event.clientX - dragState.startX,
      top: dragState.top + event.clientY - dragState.startY,
      width: dragState.width,
      height: dragState.height,
    });
  });

  els.pixelPanelHeader.addEventListener("pointerup", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState = null;
    els.pixelPanel.classList.remove("dragging");
    snapFloatingPanel();
  });

  els.pixelPanelResize.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    els.pixelPanelResize.setPointerCapture(event.pointerId);
    const panel = els.pixelPanel.getBoundingClientRect();
    const frame = els.mapFrame.getBoundingClientRect();
    resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: panel.left - frame.left,
      top: panel.top - frame.top,
      width: panel.width,
      height: panel.height,
    };
    els.pixelPanel.classList.add("resizing");
  });

  els.pixelPanelResize.addEventListener("pointermove", (event) => {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    setPanelGeometry({
      left: resizeState.left,
      top: resizeState.top,
      width: resizeState.width + event.clientX - resizeState.startX,
      height: resizeState.height + event.clientY - resizeState.startY,
    });
    drawTimeSeries();
  });

  els.pixelPanelResize.addEventListener("pointerup", (event) => {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    resizeState = null;
    els.pixelPanel.classList.remove("resizing");
    snapFloatingPanel();
    drawTimeSeries();
  });

  els.pixelPanelMinimize.addEventListener("click", () => {
    minimizePixelPanel({ keepPanelVisible: true });
  });
}

function resetMapLayers() {
  state.hasFitProjectBounds = false;
  state.rasterValues = null;
  state.rasterRange = null;
  if (state.rasterLayer) {
    state.rasterLayer.remove();
    state.rasterLayer = null;
  }
  if (state.selectedPixelLayer) {
    state.selectedPixelLayer.remove();
    state.selectedPixelLayer = null;
  }
}

updateControls();
initializeFloatingPanel();
drawMap();
drawTimeSeries();
setStatus("");
