const state = {
  data: null,
  activeLayer: null,
  selectedLayer: null,
  dateIndex: 0,
  coherencePairIndex: 0,
  qualityThresholds: {
    coherence: 0.3,
    stability: 0.2,
    goodPairs: 0,
  },
  filterInitialized: false,
  selectedPixel: null,
  map: null,
  rasterLayer: null,
  rasterValues: null,
  rasterRange: null,
  selectedPixelLayer: null,
  hasFitProjectBounds: false,
  is3D: localStorage.getItem("insar-view-mode") === "3d",
  verticalExaggeration: Number(localStorage.getItem("insar-vertical-exaggeration")) || 1.5,
  scene3D: null,
  is3DAnimating: false,
  threePromise: null,
};

const els = {
  sidebar: document.querySelector("#sidebar"),
  appTitle: document.querySelector("#app-title"),
  openProjectButton: document.querySelector("#open-project-button"),
  datasetInfoButton: document.querySelector("#dataset-info-button"),
  datasetModal: document.querySelector("#dataset-modal"),
  datasetModalClose: document.querySelector("#dataset-modal-close"),
  datasetProjectLabel: document.querySelector("#dataset-project-label"),
  status: document.querySelector("#status"),
  datasetFile: document.querySelector("#dataset-file"),
  gridDetails: document.querySelector("#grid-details"),
  boundsDetails: document.querySelector("#bounds-details"),
  datasetSelect: document.querySelector(".dataset-select"),
  datasetSelectButton: document.querySelector("#dataset-select-button"),
  datasetSelectValue: document.querySelector("#dataset-select-value"),
  datasetSelectPopover: document.querySelector("#dataset-select-popover"),
  datasetOptions: document.querySelectorAll(".select-option"),
  datePanel: document.querySelector("#date-panel"),
  dateSlider: document.querySelector("#date-slider"),
  dateValue: document.querySelector("#date-value"),
  coherencePairPanel: document.querySelector("#coherence-pair-panel"),
  coherencePairSlider: document.querySelector("#coherence-pair-slider"),
  coherencePairValue: document.querySelector("#coherence-pair-value"),
  coherenceBaselineValue: document.querySelector("#coherence-baseline-value"),
  coherenceBaselineFill: document.querySelector("#coherence-baseline-fill"),
  coherenceBaselineRange: document.querySelector("#coherence-baseline-range"),
  coherencePairDates: document.querySelector("#coherence-pair-dates"),
  coherencePairPrev: document.querySelector("#coherence-pair-prev"),
  coherencePairNext: document.querySelector("#coherence-pair-next"),
  filterPanel: document.querySelector("#filter-panel"),
  coherenceThresholdSlider: document.querySelector("#coherence-threshold-slider"),
  coherenceThresholdValue: document.querySelector("#coherence-threshold-value"),
  stabilityMaxSlider: document.querySelector("#stability-max-slider"),
  stabilityMaxValue: document.querySelector("#stability-max-value"),
  goodPairsMinSlider: document.querySelector("#good-pairs-min-slider"),
  goodPairsMinValue: document.querySelector("#good-pairs-min-value"),
  visiblePixelStatus: document.querySelector("#visible-pixel-status"),
  lastUpdatedStatus: document.querySelector("#last-updated-status"),
  legendTitle: document.querySelector("#legend-title"),
  legendBar: document.querySelector("#legend-bar"),
  legendMin: document.querySelector("#legend-min"),
  legendMid: document.querySelector("#legend-mid"),
  legendMax: document.querySelector("#legend-max"),
  mapFrame: document.querySelector("#map-frame"),
  map: document.querySelector("#map"),
  map3d: document.querySelector("#map-3d"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  view3dToggle: document.querySelector("#view-3d-toggle"),
  verticalExaggerationControl: document.querySelector("#vertical-exaggeration-control"),
  verticalExaggerationSlider: document.querySelector("#vertical-exaggeration-slider"),
  verticalExaggerationValue: document.querySelector("#vertical-exaggeration-value"),
  pixelLat: document.querySelector("#pixel-lat"),
  pixelLon: document.querySelector("#pixel-lon"),
  pixelElevation: document.querySelector("#pixel-elevation"),
  pixelVelocity: document.querySelector("#pixel-velocity"),
  pixelCoherenceLabel: document.querySelector("#pixel-coherence-label"),
  pixelCoherence: document.querySelector("#pixel-coherence"),
  pixelStability: document.querySelector("#pixel-stability"),
  pixelGoodPairs: document.querySelector("#pixel-good-pairs"),
  pixelRmse: document.querySelector("#pixel-rmse"),
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

const THREE_VIEW_CONFIG = {
  threeModuleUrl: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  demSource: "netcdf-dem",
  satelliteTileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  terrainTextureZoom: 15,
  terrainMeshMaxAxis: 180,
  maxTextureTilesPerAxis: 8,
  verticalOffsetMeters: 4,
  panSensitivity: 0.00055,
  orbitSensitivity: 0.009,
  tiltSensitivity: 0.006,
};

state.verticalExaggeration = clamp(state.verticalExaggeration, 1, 5);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

function setStatus(message, type = "info") {
  if (!els.status) return;
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

function getElevation(row, col) {
  const terrain = state.data?.layers.terrain?.values;
  const value = terrain?.[row]?.[col];
  return value === null || value === undefined || Number.isNaN(value) ? 0 : value;
}

function getElevationDatum() {
  const range = state.data?.layers.terrain?.range;
  if (!range || range.min === null || range.max === null) return 0;
  return (range.min + range.max) / 2;
}

function hasTerrainDem() {
  return Boolean(state.data?.layers.terrain?.values);
}

function getLayerValues(layer = state.activeLayer) {
  if (!state.data || !layer) return null;
  if (layer === "velocity") return state.data.layers.velocity.values;
  if (layer === "coherence") return getCoherenceValues();
  if (layer === "deformation") return getDeformationValues();
  return null;
}

function getDeformationValues(index = state.dateIndex) {
  const stack = state.data?.layers.deformation.values;
  if (!stack?.length) return null;
  return stack[clamp(index, 0, stack.length - 1)];
}

function getFinalDeformationValues() {
  const stack = state.data?.layers.deformation.values;
  if (!stack?.length) return null;
  return stack[stack.length - 1];
}

function getCoherenceValues() {
  const stack = state.data?.layers.coherence.stack;
  if (!stack?.length) return state.data?.layers.coherence.values ?? null;
  const index = clamp(state.coherencePairIndex, 0, stack.length - 1);
  return stack[index];
}

function getCoherencePairs() {
  return state.data?.layers.coherence.pairs ?? [];
}

function getCoherenceStackKind() {
  return state.data?.layers.coherence.stack_kind ?? "summary";
}

function getCoherenceBaselines() {
  return state.data?.layers.coherence.pair_baselines_days ?? [];
}

function getLayerRange(layer = state.activeLayer) {
  if (!state.data || !layer) return { min: null, max: null, p02: null, p98: null };
  if (layer === "velocity") return state.data.layers.velocity.range;
  if (layer === "coherence") return state.data.layers.coherence.range;
  return state.data.layers.deformation.range;
}

function getDisplayRange(layer = state.activeLayer, values = getLayerValues(layer)) {
  if (!state.data || !layer || !values) return getLayerRange(layer);
  if (layer === "coherence") {
    return state.data.layers.coherence.range;
  }

  const rangeValues = layer === "deformation"
    ? getFinalDeformationValues()
    : values;
  if (!rangeValues) return getLayerRange(layer);

  const visibleValues = [];

  for (let y = 0; y < rangeValues.length; y += 1) {
    for (let x = 0; x < rangeValues[y].length; x += 1) {
      const value = rangeValues[y][x];
      if (
        value !== null
        && !Number.isNaN(value)
        && pixelPassesFilter(y, x)
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

function isFilterableLayer(layer = state.activeLayer) {
  return layer === "velocity" || layer === "deformation";
}

function totalPairCount() {
  return state.data?.layers.n_good_pairs.n_pairs_total ?? 0;
}

function defaultGoodPairMinimum() {
  const total = totalPairCount();
  if (!total) return 0;
  return Math.round(total * 0.5);
}

function initializeFilterThresholds() {
  if (state.filterInitialized) return;
  state.qualityThresholds.goodPairs = defaultGoodPairMinimum();
  state.filterInitialized = true;
}

function pixelPassesFilter(row, col) {
  if (!state.data) return false;

  const thresholds = state.qualityThresholds;
  const coherence = state.data.layers.coherence.values[row][col];
  const stability = state.data.layers.coherence_stability.values[row][col];
  const goodPairs = state.data.layers.n_good_pairs.values[row][col];
  return coherence !== null
    && stability !== null
    && goodPairs !== null
    && coherence >= thresholds.coherence
    && stability <= thresholds.stability
    && goodPairs >= thresholds.goodPairs;
}

function visiblePixelSummary(values = getLayerValues()) {
  if (!state.data || !values) return { visible: 0, total: 0, percent: 0 };

  let visible = 0;
  let total = 0;
  for (let row = 0; row < values.length; row += 1) {
    for (let col = 0; col < values[row].length; col += 1) {
      total += 1;
      const value = values[row][col];
      if (
        value !== null
        && !Number.isNaN(value)
        && pixelPassesFilter(row, col)
      ) {
        visible += 1;
      }
    }
  }

  return {
    visible,
    total,
    percent: total ? Math.round((visible / total) * 100) : 0,
  };
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
  syncViewMode();

  if (!state.data) {
    els.mapPlaceholder.hidden = false;
    update3DScene();
    updateLegend();
    return;
  }

  els.mapPlaceholder.hidden = true;
  const bounds = leafletBounds();
  const values = getLayerValues();
  const range = getDisplayRange(state.activeLayer, values);
  state.rasterValues = values;
  state.rasterRange = range;
  if (state.is3D) {
    update3DScene();
  } else {
    updateRasterLayer();
  }

  if (!state.hasFitProjectBounds) {
    state.map.fitBounds(bounds, { padding: [28, 28] });
    state.hasFitProjectBounds = true;
  }

  if (!state.is3D) {
    drawSelectedPixel();
  }
  update3DSelection();
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
  if (!state.map || !state.data) return;

  if (!state.activeLayer || !state.rasterValues || !state.rasterRange) {
    if (state.rasterLayer) {
      state.rasterLayer.remove();
      state.rasterLayer = null;
    }
    return;
  }

  if (!state.rasterLayer) {
    state.rasterLayer = createRasterGridLayer();
    state.rasterLayer.addTo(state.map);
  } else {
    state.rasterLayer.redrawInPlace();
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
    redrawInPlace() {
      const tiles = Object.values(this._tiles || {});
      if (!tiles.length) {
        this.redraw();
        return;
      }

      tiles.forEach((tileRecord) => {
        const tile = tileRecord.el;
        const coords = tileRecord.coords;
        if (!tile || !coords) return;
        const ctx = tile.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, tile.width, tile.height);
        ctx.imageSmoothingEnabled = false;
        drawRasterTile(ctx, coords, this.getTileSize());
      });
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
  if (!state.data || !state.activeLayer || !state.rasterValues || !state.rasterRange) return;
  if (state.rasterRange.p02 === null && state.activeLayer !== "coherence") return;

  const values = state.rasterValues;
  const latEdges = axisEdges(state.data.lat);
  const lonEdges = axisEdges(state.data.lon);
  const tileOrigin = L.point(coords.x * tileSize.x, coords.y * tileSize.y);
  const tileBounds = L.bounds(tileOrigin, tileOrigin.add(tileSize));

  for (let row = 0; row < values.length; row += 1) {
    const south = Math.min(latEdges[row], latEdges[row + 1]);
    const north = Math.max(latEdges[row], latEdges[row + 1]);

    for (let col = 0; col < values[row].length; col += 1) {
      const value = values[row][col];
      const hiddenByFilter = isFilterableLayer() && !pixelPassesFilter(row, col);

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
    state.selectedPixelLayer.redrawInPlace();
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
    redrawInPlace() {
      const tiles = Object.values(this._tiles || {});
      if (!tiles.length) {
        this.redraw();
        return;
      }

      tiles.forEach((tileRecord) => {
        const tile = tileRecord.el;
        const coords = tileRecord.coords;
        if (!tile || !coords) return;
        const ctx = tile.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, tile.width, tile.height);
        ctx.imageSmoothingEnabled = false;
        drawSelectedPixelTile(ctx, coords, this.getTileSize());
      });
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

function syncViewMode() {
  els.view3dToggle.setAttribute("aria-pressed", String(state.is3D));
  els.verticalExaggerationControl.hidden = !state.is3D;
  els.verticalExaggerationSlider.value = String(state.verticalExaggeration);
  els.verticalExaggerationValue.textContent = `${state.verticalExaggeration.toFixed(1)}x`;
  els.map.hidden = state.is3D;
  els.map3d.hidden = !state.is3D;

  if (state.is3D) {
    if (state.rasterLayer) {
      state.rasterLayer.remove();
      state.rasterLayer = null;
    }
    if (state.selectedPixelLayer) {
      state.selectedPixelLayer.remove();
      state.selectedPixelLayer = null;
    }
    requestAnimationFrame(() => resize3DScene());
  } else {
    stop3DAnimation();
    requestAnimationFrame(() => state.map?.invalidateSize());
  }
}

function update3DScene() {
  if (!state.is3D || !state.data) return;
  if (typeof THREE === "undefined") {
    loadThreeModule()
      .then(() => update3DScene())
      .catch(() => setStatus("3D view could not load because Three.js is unavailable.", "error"));
    return;
  }
  const view = ensure3DScene();
  if (!view) return;

  update3DTerrain();
  update3DPoints();
  update3DSelection();
  resize3DScene();
  start3DAnimation();
}

function loadThreeModule() {
  if (typeof THREE !== "undefined") return Promise.resolve(THREE);
  if (!state.threePromise) {
    state.threePromise = import(THREE_VIEW_CONFIG.threeModuleUrl).then((module) => {
      window.THREE = module;
      return module;
    });
  }
  return state.threePromise;
}

function ensure3DScene() {
  if (state.scene3D) return state.scene3D;
  if (typeof THREE === "undefined") {
    setStatus("3D view could not load because Three.js is unavailable.", "error");
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x26303a);

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 1000000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  els.map3d.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  const directional = new THREE.DirectionalLight(0xffffff, 0.65);
  directional.position.set(0, 1200, 900);
  scene.add(ambient, directional);

  const target = new THREE.Vector3(0, 0, 0);
  const controls = {
    target,
    distance: 6000,
    theta: -Math.PI / 4,
    phi: THREE.MathUtils.degToRad(50),
    minDistance: 250,
    maxDistance: 180000,
  };

  state.scene3D = {
    scene,
    camera,
    renderer,
    controls,
    terrainMesh: null,
    pointMesh: null,
    selectedMesh: null,
    pixelLookup: [],
    pixelInstances: [],
    terrainKey: "",
    textureKey: "",
    texture: null,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    cameraChanged: true,
    fitKey: "",
  };

  initialize3DInteractions(state.scene3D);
  return state.scene3D;
}

function initialize3DInteractions(view) {
  let drag = null;

  els.map3d.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    els.map3d.setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      theta: view.controls.theta,
      phi: view.controls.phi,
      target: view.controls.target.clone(),
      pan: event.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey,
      moved: false,
    };
  });

  els.map3d.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 4;
    if (drag.pan) {
      pan3DCamera(view, drag, dx, dy);
    } else {
      view.controls.theta = drag.theta - dx * THREE_VIEW_CONFIG.orbitSensitivity;
      view.controls.phi = clamp(
        drag.phi + dy * THREE_VIEW_CONFIG.tiltSensitivity,
        THREE.MathUtils.degToRad(12),
        THREE.MathUtils.degToRad(86),
      );
    }
    view.cameraChanged = true;
  });

  els.map3d.addEventListener("pointerup", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasClick = !drag.moved;
    drag = null;
    if (wasClick) pick3DPixel(event);
  });

  els.map3d.addEventListener("wheel", (event) => {
    event.preventDefault();
    const scale = event.deltaY > 0 ? 1.12 : 0.88;
    view.controls.distance = clamp(view.controls.distance * scale, view.controls.minDistance, view.controls.maxDistance);
    view.cameraChanged = true;
  }, { passive: false });

  els.map3d.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

function pan3DCamera(view, drag, dx, dy) {
  const forward = new THREE.Vector3();
  view.camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.000001) {
    forward.set(0, 0, -1);
  }
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, view.camera.up).normalize();
  const panScale = view.controls.distance * THREE_VIEW_CONFIG.panSensitivity;
  view.controls.target.copy(drag.target)
    .addScaledVector(right, -dx * panScale)
    .addScaledVector(forward, dy * panScale);
}

function update3DTerrain() {
  const view = state.scene3D;
  if (!view || !state.data) return;

  const bounds = getBounds();
  const textureZoom = chooseTextureZoom(bounds);
  const key = [
    state.data.project.selected_file,
    hasTerrainDem() ? state.data.layers.terrain.source : "flat",
    state.data.lat.length,
    state.data.lon.length,
  ].join("|");

  if (view.terrainKey !== key) {
    if (view.terrainMesh) {
      disposeObject3D(view.terrainMesh);
      view.scene.remove(view.terrainMesh);
    }

    const geometry = buildTerrainGeometry();
    const material = new THREE.MeshBasicMaterial({
      color: hasTerrainDem() ? 0xd7d2bd : 0x8f9a9a,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    if (view.texture) {
      material.map = view.texture;
      material.color.set(0xffffff);
    }
    view.terrainMesh = new THREE.Mesh(geometry, material);
    view.terrainMesh.name = "terrain";
    view.scene.add(view.terrainMesh);
    view.terrainKey = key;
    if (view.fitKey !== state.data.project.selected_file) {
      fit3DCameraToBounds();
      view.fitKey = state.data.project.selected_file;
    }
  } else {
    update3DTerrainHeights();
  }

  const textureKey = `${state.data.project.selected_file}|${textureZoom}`;
  if (view.textureKey !== textureKey) {
    view.textureKey = textureKey;
    loadSatelliteTexture(bounds, textureZoom).then((texture) => {
      if (!state.scene3D || state.scene3D.textureKey !== textureKey || !texture) return;
      if (state.scene3D.texture) state.scene3D.texture.dispose();
      state.scene3D.texture = texture;
      state.scene3D.terrainMesh.material.map = texture;
      state.scene3D.terrainMesh.material.color.set(0xffffff);
      state.scene3D.terrainMesh.material.needsUpdate = true;
    }).catch(() => {
      if (state.scene3D?.terrainMesh) {
        state.scene3D.terrainMesh.material.map = null;
        state.scene3D.terrainMesh.material.needsUpdate = true;
      }
    });
  }
}

function buildTerrainGeometry() {
  const latIndices = sampledIndices(state.data.lat.length, THREE_VIEW_CONFIG.terrainMeshMaxAxis);
  const lonIndices = sampledIndices(state.data.lon.length, THREE_VIEW_CONFIG.terrainMeshMaxAxis);
  const positions = [];
  const uvs = [];
  const indices = [];
  const bounds = getBounds();
  const textureZoom = chooseTextureZoom(bounds);
  const westTile = lonToTileX(bounds.lon_min, textureZoom);
  const eastTile = lonToTileX(bounds.lon_max, textureZoom);
  const northTile = latToTileY(bounds.lat_max, textureZoom);
  const southTile = latToTileY(bounds.lat_min, textureZoom);
  const tileWidth = Math.max(1, eastTile - westTile + 1);
  const tileHeight = Math.max(1, southTile - northTile + 1);

  latIndices.forEach((row) => {
    lonIndices.forEach((col) => {
      const position = worldPosition(row, col, 0);
      positions.push(position.x, position.y - THREE_VIEW_CONFIG.verticalOffsetMeters, position.z);
      const lon = state.data.lon[col];
      const lat = state.data.lat[row];
      uvs.push(
        (lonToTileFloat(lon, textureZoom) - westTile) / tileWidth,
        1 - ((latToTileFloat(lat, textureZoom) - northTile) / tileHeight),
      );
    });
  });

  for (let y = 0; y < latIndices.length - 1; y += 1) {
    for (let x = 0; x < lonIndices.length - 1; x += 1) {
      const a = y * lonIndices.length + x;
      const b = a + 1;
      const c = a + lonIndices.length;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.latIndices = latIndices;
  geometry.userData.lonIndices = lonIndices;
  geometry.computeVertexNormals();
  return geometry;
}

function update3DTerrainHeights() {
  const view = state.scene3D;
  const geometry = view?.terrainMesh?.geometry;
  if (!geometry) return;
  const position = geometry.getAttribute("position");
  const latIndices = geometry.userData.latIndices || [];
  const lonIndices = geometry.userData.lonIndices || [];
  let vertex = 0;

  latIndices.forEach((row) => {
    lonIndices.forEach((col) => {
      position.setY(vertex, terrainY(row, col) - THREE_VIEW_CONFIG.verticalOffsetMeters);
      vertex += 1;
    });
  });

  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function sampledIndices(length, maxCount) {
  if (length <= maxCount) return Array.from({ length }, (_, index) => index);
  const indices = [];
  for (let index = 0; index < maxCount; index += 1) {
    indices.push(Math.round((index / (maxCount - 1)) * (length - 1)));
  }
  return [...new Set(indices)];
}

function update3DPoints() {
  const view = state.scene3D;
  if (!view) return;

  if (view.pointMesh) {
    disposeObject3D(view.pointMesh);
    view.scene.remove(view.pointMesh);
    view.pointMesh = null;
  }
  view.pixelLookup = [];
  view.pixelInstances = [];

  if (!state.activeLayer || !state.rasterValues || !state.rasterRange) return;
  if (state.rasterRange.p02 === null && state.activeLayer !== "coherence") return;

  const values = state.rasterValues;
  const offsets = [];
  const colors = [];
  const radius = current3DPointRadius();
  for (let row = 0; row < values.length; row += 1) {
    for (let col = 0; col < values[row].length; col += 1) {
      const value = values[row][col];
      const hiddenByFilter = isFilterableLayer() && !pixelPassesFilter(row, col);
      if (hiddenByFilter || value === null || Number.isNaN(value)) continue;
      const color = colorForValue(value, state.rasterRange, state.activeLayer);
      view.pixelLookup.push({ row, col });
      view.pixelInstances.push({ row, col });
      const position = worldPosition(row, col, THREE_VIEW_CONFIG.verticalOffsetMeters + radius);
      offsets.push(position.x, position.y, position.z);
      colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
    }
  }

  if (!view.pixelInstances.length) return;

  const sphereGeometry = new THREE.SphereGeometry(1, 14, 10);
  const geometry = new THREE.InstancedBufferGeometry().copy(sphereGeometry);
  sphereGeometry.dispose();
  const radii = new Float32Array(view.pixelInstances.length).fill(radius);
  geometry.setAttribute("instanceOffset", new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3));
  geometry.setAttribute("instanceColor", new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute("instanceRadius", new THREE.InstancedBufferAttribute(radii, 1));
  geometry.instanceCount = view.pixelInstances.length;

  const material = new THREE.ShaderMaterial({
    vertexShader: `
      attribute vec3 instanceOffset;
      attribute vec3 instanceColor;
      attribute float instanceRadius;
      varying vec3 vColor;
      varying vec3 vNormal;

      void main() {
        vColor = instanceColor;
        vNormal = normalize(normalMatrix * normal);
        vec3 spherePosition = position * instanceRadius + instanceOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(spherePosition, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying vec3 vNormal;

      void main() {
        float shade = 0.72 + 0.28 * max(dot(normalize(vNormal), normalize(vec3(0.35, 0.65, 0.7))), 0.0);
        gl_FragColor = vec4(vColor * shade, 1.0);
      }
    `,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
  view.pointMesh = new THREE.Mesh(geometry, material);
  view.pointMesh.name = "insar-pixels";
  view.pointMesh.frustumCulled = false;
  view.pointMesh.renderOrder = 0;
  view.scene.add(view.pointMesh);
  update3DPointPositions(radius);
}

function update3DPointPositions(radius = current3DPointRadius()) {
  const view = state.scene3D;
  if (!view?.pointMesh) return;
  const geometry = view.pointMesh.geometry;
  const offsets = geometry.getAttribute("instanceOffset");
  const radii = geometry.getAttribute("instanceRadius");

  view.pixelInstances.forEach((pixel, index) => {
    const position = worldPosition(pixel.row, pixel.col, THREE_VIEW_CONFIG.verticalOffsetMeters + radius);
    offsets.setXYZ(index, position.x, position.y, position.z);
    radii.setX(index, radius);
  });
  offsets.needsUpdate = true;
  radii.needsUpdate = true;
  update3DSelection();
}

function update3DPointMaterialSize() {
  update3DPointPositions();
}

function current3DPointRadius() {
  if (!state.data) return 8;
  const bounds = getBounds();
  const widthMeters = Math.abs(mercatorX(bounds.lon_max) - mercatorX(bounds.lon_min));
  const heightMeters = Math.abs(mercatorY(bounds.lat_max) - mercatorY(bounds.lat_min));
  const cellBase = Math.min(
    widthMeters / Math.max(state.data.lon.length, 1),
    heightMeters / Math.max(state.data.lat.length, 1),
  );
  return clamp(cellBase * 0.62, 4, Math.max(26, cellBase * 2.2));
}

function update3DSelection() {
  const view = state.scene3D;
  if (!view) return;
  if (view.selectedMesh) {
    disposeObject3D(view.selectedMesh);
    view.scene.remove(view.selectedMesh);
    view.selectedMesh = null;
  }
  if (!state.selectedPixel || !state.is3D) return;

  const { row, col } = state.selectedPixel;
  const geometry = new THREE.SphereGeometry(1, 18, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0xfcd900, wireframe: true });
  view.selectedMesh = new THREE.Mesh(geometry, material);
  view.selectedMesh.position.copy(worldPosition(row, col, THREE_VIEW_CONFIG.verticalOffsetMeters));
  view.selectedMesh.scale.setScalar(current3DPointRadius() * 1.9);
  view.scene.add(view.selectedMesh);
}

function pick3DPixel(event) {
  const view = state.scene3D;
  if (!view?.pointMesh) return;

  const rect = els.map3d.getBoundingClientRect();
  view.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  view.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  view.raycaster.setFromCamera(view.pointer, view.camera);
  const hitIndex = pick3DSphereInstance(view);
  if (hitIndex === null) return;

  const pixel = view.pixelLookup[hitIndex];
  if (!pixel) return;
  state.selectedPixel = { row: pixel.row, col: pixel.col };
  showPixelPanel();
  update3DSelection();
  updatePixelInfo();
  drawTimeSeries();
}

function pick3DSphereInstance(view) {
  const geometry = view.pointMesh.geometry;
  const offsets = geometry.getAttribute("instanceOffset");
  const radius = current3DPointRadius();
  const threshold = radius * 1.25;
  const thresholdSq = threshold * threshold;
  const point = new THREE.Vector3();
  const closest = new THREE.Vector3();
  let bestIndex = null;
  let bestDepth = Infinity;

  for (let index = 0; index < offsets.count; index += 1) {
    point.fromBufferAttribute(offsets, index);
    view.raycaster.ray.closestPointToPoint(point, closest);
    if (closest.distanceToSquared(point) > thresholdSq) continue;
    const depth = view.raycaster.ray.origin.distanceToSquared(point);
    if (depth < bestDepth) {
      bestDepth = depth;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function worldPosition(row, col, zOffset = 0) {
  const lon = state.data.lon[col];
  const lat = state.data.lat[row];
  const bounds = getBounds();
  const centerLon = (bounds.lon_min + bounds.lon_max) / 2;
  const centerLat = (bounds.lat_min + bounds.lat_max) / 2;
  return new THREE.Vector3(
    mercatorX(lon) - mercatorX(centerLon),
    terrainY(row, col) + zOffset,
    mercatorY(centerLat) - mercatorY(lat),
  );
}

function terrainY(row, col) {
  return ((getElevation(row, col) - getElevationDatum()) * state.verticalExaggeration);
}

function mercatorX(lon) {
  return 6378137 * lon * Math.PI / 180;
}

function mercatorY(lat) {
  const clippedLat = clamp(lat, -85.05112878, 85.05112878);
  const rad = clippedLat * Math.PI / 180;
  return 6378137 * Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function fit3DCameraToBounds() {
  const view = state.scene3D;
  if (!view || !state.data) return;
  const bounds = getBounds();
  const widthMeters = Math.abs(mercatorX(bounds.lon_max) - mercatorX(bounds.lon_min));
  const heightMeters = Math.abs(mercatorY(bounds.lat_max) - mercatorY(bounds.lat_min));
  const span = Math.max(widthMeters, heightMeters, 1000);
  view.controls.distance = span * 1.12;
  view.controls.theta = -Math.PI / 4;
  view.controls.phi = THREE.MathUtils.degToRad(50);
  view.controls.minDistance = Math.max(120, span * 0.05);
  view.controls.maxDistance = Math.max(3000, span * 5);
  view.cameraChanged = true;
}

function apply3DCamera() {
  const view = state.scene3D;
  if (!view) return;
  const { distance, theta, phi, target } = view.controls;
  const sinPhi = Math.sin(phi);
  view.camera.position.set(
    target.x + distance * sinPhi * Math.sin(theta),
    target.y + distance * Math.cos(phi),
    target.z + distance * sinPhi * Math.cos(theta),
  );
  view.camera.lookAt(target);
  view.cameraChanged = false;
  update3DPointMaterialSize();
}

function resize3DScene() {
  const view = state.scene3D;
  if (!view) return;
  const rect = els.map3d.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  view.renderer.setSize(width, height, false);
  view.camera.aspect = width / height;
  view.camera.updateProjectionMatrix();
  view.cameraChanged = true;
}

function start3DAnimation() {
  if (state.is3DAnimating) return;
  state.is3DAnimating = true;
  const animate = () => {
    if (!state.is3DAnimating || !state.scene3D) return;
    if (state.scene3D.cameraChanged) apply3DCamera();
    state.scene3D.renderer.render(state.scene3D.scene, state.scene3D.camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function stop3DAnimation() {
  state.is3DAnimating = false;
}

function disposeObject3D(object) {
  object.geometry?.dispose?.();
  if (Array.isArray(object.material)) {
    object.material.forEach((material) => material.dispose?.());
  } else {
    object.material?.dispose?.();
  }
}

function create3DPointTexture() {
  if (state.scene3D?.pointTexture) return state.scene3D.pointTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  if (state.scene3D) state.scene3D.pointTexture = texture;
  return texture;
}

function chooseTextureZoom(bounds) {
  let zoom = THREE_VIEW_CONFIG.terrainTextureZoom;
  while (zoom > 8) {
    const span = tileSpan(bounds, zoom);
    if (
      span.x <= THREE_VIEW_CONFIG.maxTextureTilesPerAxis
      && span.y <= THREE_VIEW_CONFIG.maxTextureTilesPerAxis
    ) {
      return zoom;
    }
    zoom -= 1;
  }
  return zoom;
}

function tileSpan(bounds, zoom) {
  const west = lonToTileX(bounds.lon_min, zoom);
  const east = lonToTileX(bounds.lon_max, zoom);
  const north = latToTileY(bounds.lat_max, zoom);
  const south = latToTileY(bounds.lat_min, zoom);
  return {
    x: Math.abs(east - west) + 1,
    y: Math.abs(south - north) + 1,
  };
}

async function loadSatelliteTexture(bounds, zoom) {
  const westTile = lonToTileX(bounds.lon_min, zoom);
  const eastTile = lonToTileX(bounds.lon_max, zoom);
  const northTile = latToTileY(bounds.lat_max, zoom);
  const southTile = latToTileY(bounds.lat_min, zoom);
  const width = (eastTile - westTile + 1) * 256;
  const height = (southTile - northTile + 1) * 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const tasks = [];
  for (let x = westTile; x <= eastTile; x += 1) {
    for (let y = northTile; y <= southTile; y += 1) {
      const url = THREE_VIEW_CONFIG.satelliteTileUrl
        .replace("{z}", zoom)
        .replace("{x}", x)
        .replace("{y}", y);
      tasks.push(loadImage(url).then((image) => {
        ctx.drawImage(image, (x - westTile) * 256, (y - northTile) * 256, 256, 256);
      }).catch(() => {}));
    }
  }

  await Promise.all(tasks);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function lonToTileX(lon, zoom) {
  return Math.floor(lonToTileFloat(lon, zoom));
}

function latToTileY(lat, zoom) {
  return Math.floor(latToTileFloat(lat, zoom));
}

function lonToTileFloat(lon, zoom) {
  return ((lon + 180) / 360) * (2 ** zoom);
}

function latToTileFloat(lat, zoom) {
  const latRad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * (2 ** zoom);
}

function syncQualityControls() {
  const thresholds = state.qualityThresholds;
  const totalPairs = totalPairCount();
  const goodPairSliderMax = totalPairs || Math.max(12, thresholds.goodPairs);

  els.coherenceThresholdSlider.value = thresholds.coherence.toFixed(2);
  els.coherenceThresholdValue.textContent = thresholds.coherence.toFixed(2);
  els.stabilityMaxSlider.value = thresholds.stability.toFixed(2);
  els.stabilityMaxValue.textContent = thresholds.stability.toFixed(2);
  els.goodPairsMinSlider.max = String(goodPairSliderMax);
  els.goodPairsMinSlider.value = String(thresholds.goodPairs);
  els.goodPairsMinValue.textContent = totalPairs
    ? `${thresholds.goodPairs} / ${totalPairs}`
    : String(thresholds.goodPairs);
}

function updateControls() {
  els.datasetOptions.forEach((option) => {
    const isSelected = option.dataset.layer === state.selectedLayer;
    option.classList.toggle("active", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
    option.dataset.activeLayer = String(option.dataset.layer === state.activeLayer);
  });
  updateDatasetSelectValue();

  els.datePanel.hidden = state.activeLayer !== "deformation" || !state.data;
  els.coherencePairPanel.hidden = state.activeLayer !== "coherence" || !state.data;
  els.filterPanel.hidden = !isFilterableLayer();
  syncQualityControls();
  updateStatusFooter();
  updateAppTitle();
  updateLegend();

  if (state.data) {
    els.dateSlider.max = Math.max(0, state.data.dates.length - 1);
    els.dateSlider.value = state.dateIndex;
    els.dateValue.textContent = state.data.dates[state.dateIndex] || "-";

    const coherencePairs = getCoherencePairs();
    const maxPairIndex = Math.max(0, coherencePairs.length - 1);
    state.coherencePairIndex = clamp(state.coherencePairIndex, 0, maxPairIndex);
    els.coherencePairSlider.max = maxPairIndex;
    els.coherencePairSlider.value = state.coherencePairIndex;
    els.coherencePairValue.textContent = coherencePairIndexLabel(state.coherencePairIndex);
    els.coherencePairDates.textContent = coherencePairDatesLabel(state.coherencePairIndex);
    updateCoherenceBaselineSummary(state.coherencePairIndex);
    els.coherencePairPrev.disabled = state.coherencePairIndex <= 0;
    els.coherencePairNext.disabled = state.coherencePairIndex >= maxPairIndex;
  }
}

function coherencePairIndexLabel(index) {
  const pairs = getCoherencePairs();
  if (!pairs.length) return "Median coherence";
  return `${index + 1} / ${pairs.length}`;
}

function coherencePairDatesLabel(index) {
  const pairs = getCoherencePairs();
  if (!pairs.length) return "-";
  const label = pairs[index] || pairs[0];
  if (getCoherenceStackKind() === "pair") {
    return label.replace(/\s+/, " to ");
  }
  if (getCoherenceStackKind() === "date") {
    return `Attributed date: ${label}`;
  }
  return label;
}

function updateCoherenceBaselineSummary(index) {
  if (getCoherenceStackKind() !== "pair") {
    els.coherenceBaselineValue.textContent = "n/a";
    els.coherenceBaselineRange.textContent = getCoherenceStackKind() === "date"
      ? "Temporal baseline unavailable for date-attributed coherence"
      : "Temporal baseline unavailable";
    els.coherenceBaselineFill.style.width = "0%";
    return;
  }

  const baselines = getCoherenceBaselines().filter((value) => value !== null && value !== undefined);
  const baseline = getCoherenceBaselines()[index];

  if (baseline === null || baseline === undefined || !baselines.length) {
    els.coherenceBaselineValue.textContent = "n/a";
    els.coherenceBaselineRange.textContent = "No temporal baseline available";
    els.coherenceBaselineFill.style.width = "0%";
    return;
  }

  const minBaseline = Math.min(...baselines);
  const maxBaseline = Math.max(...baselines);
  const spread = Math.max(1, maxBaseline - minBaseline);
  const percent = ((baseline - minBaseline) / spread) * 100;

  els.coherenceBaselineValue.textContent = `${baseline} days`;
  els.coherenceBaselineRange.textContent = `${minBaseline}-${maxBaseline} days in stack`;
  els.coherenceBaselineFill.style.width = `${clamp(percent, 0, 100)}%`;
}

function updateStatusFooter() {
  if (!state.data || !state.activeLayer) {
    els.visiblePixelStatus.textContent = "No pixels visible";
    els.lastUpdatedStatus.textContent = "Last updated: n/a";
    return;
  }

  const summary = visiblePixelSummary();
  els.visiblePixelStatus.textContent = `${summary.visible.toLocaleString()} pixels visible (${summary.percent}% of dataset)`;
  els.lastUpdatedStatus.textContent = `Last updated: ${formatDateTime(state.data.project.last_updated)}`;
}

function updateAppTitle() {
  const projectName = state.data ? projectFolderName(state.data.project.project_path) : "No project loaded";
  els.appTitle.textContent = `InSAR SBAS Viewer - ${projectName}`;
}

function formatDateTime(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function updateLegend() {
  if (!state.data || !state.activeLayer) {
    els.legendTitle.textContent = "No dataset selected";
    els.legendBar.style.background = "transparent";
    els.legendMin.textContent = "-";
    els.legendMid.textContent = "-";
    els.legendMax.textContent = "-";
    return;
  }

  const range = getDisplayRange(state.activeLayer);
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
  const coherence = state.activeLayer === "coherence"
    ? getCoherenceValues()?.[row]?.[col]
    : state.data.layers.coherence.values[row][col];
  const stability = state.data.layers.coherence_stability.values[row][col];
  const goodPairs = state.data.layers.n_good_pairs.values[row][col];
  const totalPairs = state.data.layers.n_good_pairs.n_pairs_total;
  const rmse = state.data.layers.rmse.values[row][col];
  const deformation = state.data.layers.deformation.values[state.dateIndex][row][col];
  const elevation = getElevation(row, col);
  const passes = pixelPassesFilter(row, col);

  els.pixelLat.textContent = formatNumber(state.data.lat[row], 6);
  els.pixelLon.textContent = formatNumber(state.data.lon[col], 6);
  els.pixelElevation.textContent = hasTerrainDem() ? `${formatNumber(elevation, 1)} m` : "n/a";
  els.pixelVelocity.textContent = `${formatNumber(velocity)} mm/year`;
  els.pixelCoherenceLabel.innerHTML = `${state.activeLayer === "coherence" ? "Pair coherence" : "Median coherence"} <span class="metric-hint">high = good</span>`;
  els.pixelCoherence.textContent = formatNumber(coherence, 2);
  els.pixelStability.textContent = formatNumber(stability, 2);
  els.pixelGoodPairs.textContent = `${formatNumber(goodPairs, 0)} / ${totalPairs}`;
  els.pixelRmse.textContent = `${formatNumber(rmse, 2)} mm`;
  els.pixelDeformation.textContent = `${formatNumber(deformation)} mm`;
  els.pixelPasses.textContent = isFilterableLayer() ? (passes ? "Yes" : "No") : "Not applied";
  els.pixelPanelSubtitle.textContent = `${formatNumber(state.data.lat[row], 5)}, ${formatNumber(state.data.lon[col], 5)}`;
}

function resetPixelInfo() {
  els.pixelLat.textContent = "Click the map";
  els.pixelLon.textContent = "Click the map";
  els.pixelElevation.textContent = "-";
  els.pixelVelocity.textContent = "-";
  els.pixelCoherenceLabel.innerHTML = "Median coherence <span class=\"metric-hint\">high = good</span>";
  els.pixelCoherence.textContent = "-";
  els.pixelStability.textContent = "-";
  els.pixelGoodPairs.textContent = "-";
  els.pixelRmse.textContent = "-";
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
  if (!state.data) {
    els.datasetProjectLabel.textContent = "No project loaded";
    els.datasetFile.textContent = "Not loaded";
    els.gridDetails.textContent = "-";
    els.boundsDetails.textContent = "-";
    return;
  }

  const project = state.data.project;
  const bounds = project.bounds;
  els.datasetProjectLabel.textContent = `Project: ${projectFolderName(project.project_path)}`;
  els.datasetFile.textContent = project.dataset_file;
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
    initializeFilterThresholds();
    state.dateIndex = 0;
    state.coherencePairIndex = 0;
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

function openDatasetModal() {
  renderDatasetDetails();
  els.datasetModal.hidden = false;
  els.datasetModal.setAttribute("aria-hidden", "false");
  els.datasetModalClose.focus();
}

function closeDatasetModal() {
  els.datasetModal.hidden = true;
  els.datasetModal.setAttribute("aria-hidden", "true");
  els.datasetInfoButton.focus();
}

function selectedLayerNames() {
  return state.selectedLayer ? [layerText[state.selectedLayer].title] : [];
}

function updateDatasetSelectValue() {
  const names = selectedLayerNames();
  if (!names.length) {
    els.datasetSelectValue.textContent = "Select datasets";
    return;
  }
  if (names.length <= 2) {
    els.datasetSelectValue.textContent = names.join(", ");
    return;
  }
  els.datasetSelectValue.textContent = `${names.length} datasets selected`;
}

function setDatasetSelectOpen(isOpen) {
  els.datasetSelect.dataset.open = String(isOpen);
  els.datasetSelectButton.setAttribute("aria-expanded", String(isOpen));
  els.datasetSelectPopover.hidden = !isOpen;
}

function toggleSelectedLayer(layer) {
  if (state.selectedLayer === layer) {
    state.selectedLayer = null;
    state.activeLayer = null;
  } else {
    state.selectedLayer = layer;
    state.activeLayer = layer;
  }

  updateControls();
  drawMap();
  drawTimeSeries();
}

async function openProjectFromFolderPicker() {
  setStatus("Opening folder picker...");
  try {
    const result = await fetchJson("/api/browse-folder", { method: "POST" });
    if (result.cancelled) {
      setStatus("Folder selection cancelled.");
      return;
    }

    state.data = await fetchJson("/api/map-data");
    initializeFilterThresholds();
    state.dateIndex = 0;
    state.coherencePairIndex = 0;
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

els.openProjectButton.addEventListener("click", openProjectFromFolderPicker);
els.datasetInfoButton.addEventListener("click", () => {
  openDatasetModal();
});

els.view3dToggle.addEventListener("click", () => {
  state.is3D = !state.is3D;
  localStorage.setItem("insar-view-mode", state.is3D ? "3d" : "2d");
  syncViewMode();
  drawMap();
});

els.verticalExaggerationSlider.addEventListener("input", () => {
  state.verticalExaggeration = Number(els.verticalExaggerationSlider.value);
  localStorage.setItem("insar-vertical-exaggeration", String(state.verticalExaggeration));
  syncViewMode();
  if (state.scene3D) {
    update3DTerrainHeights();
    update3DPointPositions();
    state.scene3D.cameraChanged = true;
  } else {
    drawMap();
  }
});

els.datasetModalClose.addEventListener("click", closeDatasetModal);
els.datasetModal.addEventListener("click", (event) => {
  if (event.target === els.datasetModal) {
    closeDatasetModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.datasetModal.hidden) {
    closeDatasetModal();
  }

  if (event.key === "Escape" && !els.datasetSelectPopover.hidden) {
    setDatasetSelectOpen(false);
    els.datasetSelectButton.focus();
  }
});

els.datasetSelectButton.addEventListener("click", () => {
  setDatasetSelectOpen(els.datasetSelectPopover.hidden);
});

els.datasetOptions.forEach((option) => {
  option.addEventListener("click", () => {
    toggleSelectedLayer(option.dataset.layer);
  });
});

document.addEventListener("click", (event) => {
  if (!els.datasetSelect.contains(event.target)) {
    setDatasetSelectOpen(false);
  }
});

els.dateSlider.addEventListener("input", () => {
  state.dateIndex = Number(els.dateSlider.value);
  updateControls();
  drawMap();
  drawTimeSeries();
});

function setCoherencePairIndex(index) {
  const pairs = getCoherencePairs();
  state.coherencePairIndex = clamp(index, 0, Math.max(0, pairs.length - 1));
  updateControls();
  drawMap();
  updatePixelInfo();
}

els.coherencePairSlider.addEventListener("input", () => {
  setCoherencePairIndex(Number(els.coherencePairSlider.value));
});

els.coherencePairPrev.addEventListener("click", () => {
  setCoherencePairIndex(state.coherencePairIndex - 1);
});

els.coherencePairNext.addEventListener("click", () => {
  setCoherencePairIndex(state.coherencePairIndex + 1);
});

els.coherenceThresholdSlider.addEventListener("input", () => {
  state.qualityThresholds.coherence = Number(els.coherenceThresholdSlider.value);
  updateControls();
  drawMap();
});

els.stabilityMaxSlider.addEventListener("input", () => {
  state.qualityThresholds.stability = Number(els.stabilityMaxSlider.value);
  updateControls();
  drawMap();
});

els.goodPairsMinSlider.addEventListener("input", () => {
  state.qualityThresholds.goodPairs = Number(els.goodPairsMinSlider.value);
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
  update3DSelection();
}

function placePanelBottomRight() {
  const frame = els.mapFrame.getBoundingClientRect();
  const width = Math.min(420, Math.max(320, frame.width * 0.36));
  const height = Math.min(420, Math.max(300, frame.height * 0.44));
  setPanelGeometry({
    left: frame.width - width - 18,
    top: 18,
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
    minimizePixelPanel({ keepPanelVisible: false });
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
