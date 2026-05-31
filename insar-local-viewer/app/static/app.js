const state = {
  data: null,
  activeLayer: null,
  selectedLayer: null,
  psLayer: null,
  dateIndex: 0,
  coherencePairIndex: 0,
  qualityThresholds: {
    coherence: 0.3,
    stability: 0.2,
    goodPairs: 0,
  },
  filterInitialized: false,
  selectedPixel: null,
  selectedPsPoint: null,
  map: null,
  rasterLayer: null,
  psPointLayer: null,
  rasterValues: null,
  rasterRange: null,
  psRange: null,
  selectedPixelLayer: null,
  hasFitProjectBounds: false,
  is3D: localStorage.getItem("insar-view-mode") === "3d",
  verticalExaggeration: Number(localStorage.getItem("insar-vertical-exaggeration")) || 1.5,
  heatmapPalette: localStorage.getItem("insar-heatmap-palette") || "spectral",
  pixelShape: localStorage.getItem("insar-pixel-shape") || "rectangle",
  exportTitle: localStorage.getItem("insar-export-title") || "",
  exportSubtitle: localStorage.getItem("insar-export-subtitle") || "",
  scaleSettings: {
    mode: localStorage.getItem("insar-scale-mode") || "linear",
    percentile: 99.9,
    symmetric: true,
    gamma: 1,
    noiseMultiplier: 2,
  },
  scene3D: null,
  is3DAnimating: false,
  threePromise: null,
};

const els = {
  sidebar: document.querySelector("#sidebar"),
  appTitle: document.querySelector("#app-title"),
  openProjectButton: document.querySelector("#open-project-button"),
  datasetInfoButton: document.querySelector("#dataset-info-button"),
  settingsButton: document.querySelector("#settings-button"),
  datasetModal: document.querySelector("#dataset-modal"),
  datasetModalClose: document.querySelector("#dataset-modal-close"),
  settingsModal: document.querySelector("#settings-modal"),
  settingsModalClose: document.querySelector("#settings-modal-close"),
  settingsNavButtons: document.querySelectorAll(".settings-nav-button"),
  settingsContents: document.querySelectorAll(".settings-content"),
  heatmapOptions: document.querySelector("#heatmap-options"),
  colorScaleOptions: document.querySelector("#color-scale-options"),
  pixelShapeOptions: document.querySelector("#pixel-shape-options"),
  exportTitleInput: document.querySelector("#export-title-input"),
  exportSubtitleInput: document.querySelector("#export-subtitle-input"),
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
  mapLegend: document.querySelector("#map-legend"),
  legendTitle: document.querySelector("#legend-title"),
  legendSubtitle: document.querySelector("#legend-subtitle"),
  legendItems: document.querySelector("#legend-items"),
  mapFrame: document.querySelector("#map-frame"),
  map: document.querySelector("#map"),
  map3d: document.querySelector("#map-3d"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  mapContextMenu: document.querySelector("#map-context-menu"),
  exportMapImageButton: document.querySelector("#export-map-image-button"),
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
  pixelStabilityLabel: document.querySelector("#pixel-stability-label"),
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

const psLayerText = {
  velocity: { title: "PS Velocity", field: "velocity_mm_yr", unit: "mm/year" },
  displacement: { title: "PS Last Displacement", field: "displacement_last_mm", unit: "mm" },
};

const HEATMAP_PALETTES = {
  vik: {
    name: "vik",
    detail: "the geophysics standard (Crameri)",
    colors: [
      [0, 18, 102],
      [31, 88, 153],
      [93, 150, 190],
      [222, 229, 225],
      [218, 160, 118],
      [173, 65, 45],
      [88, 0, 12],
    ],
  },
  coolwarm: {
    name: "cool-warm",
    detail: "smooth, popular sci-viz default (Moreland)",
    colors: [
      [59, 76, 192],
      [102, 139, 240],
      [172, 196, 255],
      [221, 221, 221],
      [244, 166, 143],
      [211, 80, 78],
      [180, 4, 38],
    ],
  },
  rdbu: {
    name: "RdBu",
    detail: "classic ColorBrewer, available everywhere",
    colors: [
      [5, 48, 97],
      [33, 102, 172],
      [146, 197, 222],
      [247, 247, 247],
      [244, 165, 130],
      [178, 24, 43],
      [103, 0, 31],
    ],
  },
  puor: {
    name: "PuOr",
    detail: "purple-orange, very strong CVD safety",
    colors: [
      [45, 0, 75],
      [84, 39, 136],
      [178, 171, 210],
      [247, 247, 247],
      [253, 184, 99],
      [224, 130, 20],
      [127, 59, 8],
    ],
  },
  brbg: {
    name: "BrBG",
    detail: "brown-teal, if you want to avoid red/blue",
    colors: [
      [84, 48, 5],
      [166, 97, 26],
      [223, 194, 125],
      [245, 245, 245],
      [128, 205, 193],
      [1, 133, 113],
      [0, 60, 48],
    ],
  },
  spectral: {
    name: "Spectral",
    detail: "red, amber, green, cyan, blue",
    colors: [
      [155, 0, 36],
      [214, 39, 40],
      [247, 127, 43],
      [255, 226, 89],
      [92, 201, 83],
      [26, 174, 198],
      [37, 96, 173],
    ],
  },
  jet: {
    name: "Jet / InSAR",
    detail: "classic blue, cyan, yellow, red",
    colors: [
      [0, 0, 130],
      [0, 68, 255],
      [0, 205, 255],
      [92, 255, 155],
      [255, 238, 0],
      [255, 122, 0],
      [180, 0, 0],
    ],
  },
};

const COLOR_SCALE_MODES = {
  linear: {
    name: "Linear",
    detail: "Even value spacing across the spectrum",
  },
  symlog: {
    name: "Color-coded on a logarithmic scale",
    detail: "Compresses large signed values while keeping zero stable",
  },
};

const PIXEL_SHAPES = {
  rectangle: {
    name: "Rectangles",
    detail: "Display the ground footprint of each pixel",
  },
  circle: {
    name: "Vector circles",
    detail: "Display each pixel as a circular vector marker",
  },
};

const COHERENCE_LEGEND_COLORS = [
  [31, 41, 55],
  [46, 86, 96],
  [32, 139, 117],
  [119, 177, 75],
  [250, 204, 21],
];

function activeHeatmapPalette() {
  return HEATMAP_PALETTES[state.heatmapPalette] || HEATMAP_PALETTES.spectral;
}

if (!HEATMAP_PALETTES[state.heatmapPalette]) {
  state.heatmapPalette = "spectral";
}

if (!COLOR_SCALE_MODES[state.scaleSettings.mode]) {
  state.scaleSettings.mode = "linear";
}

if (!PIXEL_SHAPES[state.pixelShape]) {
  state.pixelShape = "rectangle";
}

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

  const scaleValues = getScaleValues(layer, values);
  const visibleValues = getVisibleValues(layer, scaleValues);

  if (!visibleValues.length) {
    return { min: null, max: null, p02: null, p98: null };
  }

  const robust = computeRobustExtent(visibleValues, {
    percentile: state.scaleSettings.percentile,
    symmetric: state.scaleSettings.symmetric,
  });
  const linthresh = estimateNoiseFloor(layer, robust.extent);
  const scale = {
    mode: state.scaleSettings.mode,
    negExtent: robust.negExtent,
    posExtent: robust.posExtent,
    rawNegExtent: robust.rawNegExtent,
    rawPosExtent: robust.rawPosExtent,
    linthresh,
    gamma: state.scaleSettings.gamma,
    percentile: state.scaleSettings.percentile,
    symmetric: state.scaleSettings.symmetric,
    locked: false,
  };

  return {
    min: -scale.negExtent,
    max: scale.posExtent,
    p02: -scale.negExtent,
    p98: scale.posExtent,
    zeroHalfWidth: linthresh,
    scale,
  };
}

function computeRobustExtent(values, { percentile = 99.9, symmetric = true } = {}) {
  const magnitudes = [];
  let rawNegExtent = 0;
  let rawPosExtent = 0;

  values.forEach((value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    if (value < 0) rawNegExtent = Math.max(rawNegExtent, Math.abs(value));
    if (value > 0) rawPosExtent = Math.max(rawPosExtent, value);
    magnitudes.push(Math.abs(value));
  });

  if (!magnitudes.length) {
    return { negExtent: 0.000001, posExtent: 0.000001, rawNegExtent: 0, rawPosExtent: 0, extent: 0.000001 };
  }

  magnitudes.sort((a, b) => a - b);
  const robustMagnitude = Math.max(quantileSorted(magnitudes, percentile / 100), 0.000001);
  const rawMagnitude = Math.max(rawNegExtent, rawPosExtent, 0.000001);
  const extent = Math.min(robustMagnitude, rawMagnitude);

  if (symmetric) {
    return {
      negExtent: extent,
      posExtent: extent,
      rawNegExtent,
      rawPosExtent,
      extent,
    };
  }

  return {
    negExtent: Math.min(Math.max(rawNegExtent, 0.000001), extent),
    posExtent: Math.min(Math.max(rawPosExtent, 0.000001), extent),
    rawNegExtent,
    rawPosExtent,
    extent,
  };
}

function quantileSorted(sortedValues, q) {
  if (!sortedValues.length) return null;
  const index = clamp(q, 0, 1) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function getVisibleValues(layer = state.activeLayer, values = getLayerValues(layer)) {
  if (!state.data || !layer || !values) return [];

  const visibleValues = [];
  for (let y = 0; y < values.length; y += 1) {
    for (let x = 0; x < values[y].length; x += 1) {
      const value = values[y][x];
      const hiddenByFilter = isFilterableLayer(layer) && !pixelPassesFilter(y, x);
      if (
        !hiddenByFilter
        && value !== null
        && value !== undefined
        && !Number.isNaN(value)
      ) {
        visibleValues.push(value);
      }
    }
  }
  return visibleValues;
}

function getScaleValues(layer = state.activeLayer, values = getLayerValues(layer)) {
  if (layer === "deformation") {
    return getFinalDeformationValues() || values;
  }
  return values;
}

function zeroBandHalfWidth(layer, min, max) {
  const extent = Math.max(Math.abs(min), Math.abs(max), 0.000001);
  if (layer === "deformation") {
    return Math.min(9, Math.max(4, extent * 0.095));
  }
  return Math.min(14, Math.max(5, extent * 0.095));
}

function estimateNoiseFloor(layer, extent) {
  if (layer === "deformation") {
    const estimated = estimateDeformationNoiseFloor();
    if (estimated !== null) return clamp(estimated, 0.5, Math.max(0.5, extent * 0.5));
    return Math.min(5, Math.max(3, extent * 0.04));
  }
  return Math.min(14, Math.max(1, extent * 0.05));
}

function estimateDeformationNoiseFloor({ sampleSize = 8000, minEpochs = 8 } = {}) {
  const stack = state.data?.layers.deformation.values;
  if (!stack || stack.length < minEpochs) return null;
  const rows = stack[0]?.length ?? 0;
  const cols = stack[0]?.[0]?.length ?? 0;
  if (!rows || !cols) return null;

  const total = rows * cols;
  const step = Math.max(1, Math.floor(total / sampleSize));
  const perPoint = [];

  for (let linearIndex = 0; linearIndex < total; linearIndex += step) {
    const row = Math.floor(linearIndex / cols);
    const col = linearIndex % cols;
    if (!pixelPassesFilter(row, col)) continue;

    const series = [];
    for (let epoch = 0; epoch < stack.length; epoch += 1) {
      const value = stack[epoch]?.[row]?.[col];
      if (value !== null && value !== undefined && !Number.isNaN(value)) {
        series.push({ x: epoch, y: value });
      }
    }
    if (series.length < minEpochs) continue;

    const fit = fitLinearTrend(series);
    const residuals = series.map((point) => point.y - (fit.intercept + fit.slope * point.x));
    const sigma = nmad(residuals);
    if (sigma !== null && sigma > 0) perPoint.push(sigma);
  }

  const sigma = median(perPoint);
  return sigma === null ? null : state.scaleSettings.noiseMultiplier * sigma;
}

function fitLinearTrend(points) {
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  points.forEach((point) => {
    sumX += point.x;
    sumY += point.y;
    sumXX += point.x * point.x;
    sumXY += point.x * point.y;
  });
  const n = points.length;
  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 0.000001) {
    return { slope: 0, intercept: sumY / n };
  }
  const slope = (n * sumXY - sumX * sumY) / denominator;
  return { slope, intercept: (sumY - slope * sumX) / n };
}

function nmad(values) {
  const center = median(values);
  if (center === null) return null;
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);
  return mad === null ? null : 1.4826 * mad;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return quantileSorted(sorted, 0.5);
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
  return colorInfoForValue(value, range, layer).color;
}

function colorInfoForValue(value, range, layer) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { color: [0, 0, 0, 0], t: 0, isOver: false, isUnder: false };
  }

  if (layer === "coherence") {
    const t = clamp(value, 0, 1);
    const color = colorFromPalette(t, COHERENCE_LEGEND_COLORS);
    return { color: [...color, 255], t, isOver: false, isUnder: false };
  }

  const scale = range.scale ?? {
    mode: "symlog",
    negExtent: Math.abs(range.min ?? range.p02 ?? -1),
    posExtent: Math.abs(range.max ?? range.p98 ?? 1),
    linthresh: range.zeroHalfWidth ?? 1,
    gamma: 1,
  };
  const normalized = normalizeDivergingValue(value, scale);
  const color = colorForNormalizedValue(normalized.t);
  return { color: [...color, 255], ...normalized };
}

function colorFromPalette(t, palette) {
  const index = Math.min(Math.floor(clamp(t, 0, 1) * palette.length), palette.length - 1);
  return palette[index];
}

function colorForDivergingValue(value, extent, neutralHalfWidth) {
  return colorForDivergingRangeValue(value, -extent, extent, neutralHalfWidth);
}

function colorForDivergingRangeValue(value, min, max, neutralHalfWidth) {
  const normalized = normalizeDivergingValue(value, {
    mode: "symlog",
    negExtent: Math.abs(min),
    posExtent: Math.abs(max),
    linthresh: neutralHalfWidth,
    gamma: 1,
  });
  return colorForNormalizedValue(normalized.t);
}

function normalizeDivergingValue(value, scale) {
  const negExtent = Math.max(scale.negExtent ?? 1, 0.000001);
  const posExtent = Math.max(scale.posExtent ?? 1, 0.000001);
  const linthresh = clamp(scale.linthresh ?? 0, 0, Math.max(negExtent, posExtent));
  const magnitude = Math.abs(value);
  const extent = value < 0 ? negExtent : posExtent;
  const sign = value < 0 ? -1 : 1;
  const isUnder = value < -negExtent;
  const isOver = value > posExtent;
  const normalizedMagnitude = normalizeMagnitude(magnitude, extent, linthresh, scale);

  return {
    t: sign * normalizedMagnitude,
    isOver,
    isUnder,
  };
}

function normalizeMagnitude(magnitude, extent, linthresh, scale) {
  if (magnitude <= linthresh) return 0;
  const usableExtent = Math.max(extent - linthresh, 0.000001);
  const shifted = Math.max(magnitude - linthresh, 0);
  const raw = (() => {
    if (scale.mode === "linear") return shifted / usableExtent;
    if (scale.mode === "power") {
      const gamma = Math.max(scale.gamma ?? 1, 0.000001);
      return Math.pow(shifted / usableExtent, gamma);
    }
    const base = Math.max(linthresh, usableExtent * 0.02, 0.000001);
    return Math.log1p(shifted / base) / Math.log1p(usableExtent / base);
  })();
  return clamp(raw, 0, 1);
}

function colorForNormalizedValue(t) {
  return interpolatePalette(activeHeatmapPalette().colors, (clamp(t, -1, 1) + 1) / 2);
}

function interpolatePalette(palette, position) {
  if (palette.length === 1) return palette[0];
  const scaled = clamp(position, 0, 1) * (palette.length - 1);
  const low = Math.floor(scaled);
  const high = Math.ceil(scaled);
  if (low === high) return palette[low];
  return interpolateColor(palette[low], palette[high], scaled - low);
}

function interpolateColor(start, end, t) {
  return [
    Math.round(start[0] + (end[0] - start[0]) * t),
    Math.round(start[1] + (end[1] - start[1]) * t),
    Math.round(start[2] + (end[2] - start[2]) * t),
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
      crossOrigin: true,
      attribution: "&copy; OpenStreetMap contributors",
    }),
    "Carto Light": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      crossOrigin: true,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
    }),
    "Esri Satellite": L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        crossOrigin: true,
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
  state.map.createPane("psPointPane");
  state.map.getPane("psPointPane").style.zIndex = 650;
  state.map.createPane("selectedPixelPane");
  state.map.getPane("selectedPixelPane").style.zIndex = 720;

  L.control.layers(baseLayers, {}, { collapsed: false, position: "bottomright" }).addTo(state.map);
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
  state.psRange = getPsDisplayRange();
  if (state.is3D) {
    update3DScene();
  } else {
    updateRasterLayer();
  }
  updatePsPointLayer();

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

function hasPsPoints() {
  return Boolean(state.data?.layers?.ps_points?.available && state.data.layers.ps_points.points?.length);
}

function getPsLayerConfig(layer = state.psLayer) {
  return psLayerText[layer] ?? null;
}

function getPsDisplayRange(layer = state.psLayer) {
  const config = getPsLayerConfig(layer);
  const points = state.data?.layers?.ps_points?.points ?? [];
  if (!config || !points.length) return null;
  const values = points
    .map((point) => point[config.field])
    .filter((value) => value !== null && value !== undefined && !Number.isNaN(value));
  if (!values.length) return null;
  const robust = computeRobustExtent(values, {
    percentile: state.scaleSettings.percentile,
    symmetric: state.scaleSettings.symmetric,
  });
  const linthresh = estimateNoiseFloor(layer === "displacement" ? "deformation" : "velocity", robust.extent);
  const scale = {
    mode: state.scaleSettings.mode,
    negExtent: robust.negExtent,
    posExtent: robust.posExtent,
    rawNegExtent: robust.rawNegExtent,
    rawPosExtent: robust.rawPosExtent,
    linthresh,
    gamma: state.scaleSettings.gamma,
    percentile: state.scaleSettings.percentile,
    symmetric: state.scaleSettings.symmetric,
    locked: false,
  };
  return {
    min: -scale.negExtent,
    max: scale.posExtent,
    p02: -scale.negExtent,
    p98: scale.posExtent,
    zeroHalfWidth: linthresh,
    scale,
  };
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

function updatePsPointLayer() {
  if (!state.map || !state.data || !state.psLayer || !hasPsPoints() || !state.psRange) {
    if (state.psPointLayer) {
      state.psPointLayer.remove();
      state.psPointLayer = null;
    }
    return;
  }

  if (!state.psPointLayer) {
    state.psPointLayer = createPsPointGridLayer();
    state.psPointLayer.addTo(state.map);
  } else {
    state.psPointLayer.redrawInPlace();
  }
}

function createPsPointGridLayer() {
  const PsPointGridLayer = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement("canvas");
      const tileSize = this.getTileSize();
      tile.width = tileSize.x;
      tile.height = tileSize.y;
      tile.className = "ps-point-tile";

      const ctx = tile.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      drawPsPointTile(ctx, coords, tileSize);

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
        ctx.imageSmoothingEnabled = true;
        drawPsPointTile(ctx, coords, this.getTileSize());
      });
    },
  });

  return new PsPointGridLayer({
    pane: "psPointPane",
    tileSize: 256,
    opacity: 1,
    updateWhenIdle: false,
    updateWhenZooming: true,
    keepBuffer: 6,
  });
}

function drawPsPointTile(ctx, coords, tileSize) {
  const config = getPsLayerConfig();
  const points = state.data?.layers?.ps_points?.points ?? [];
  if (!state.map || !config || !points.length || !state.psRange) return;

  const tileOrigin = L.point(coords.x * tileSize.x, coords.y * tileSize.y);
  const tileBounds = L.bounds(tileOrigin, tileOrigin.add(tileSize));
  points.forEach((point) => {
    const value = point[config.field];
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const projected = state.map.project([point.lat, point.lon], coords.z);
    const footprint = psFootprintPixels(point.lat, coords.z);
    const pixelBounds = L.bounds(
      L.point(projected.x - footprint.width / 2, projected.y - footprint.height / 2),
      L.point(projected.x + footprint.width / 2, projected.y + footprint.height / 2),
    );
    if (!tileBounds.intersects(pixelBounds)) return;

    const x = projected.x - tileOrigin.x;
    const y = projected.y - tileOrigin.y;
    const isSelected = state.selectedPsPoint?.ps_id === point.ps_id;
    const colorInfo = colorInfoForValue(value, state.psRange, config.field.includes("velocity") ? "velocity" : "deformation");
    const color = colorInfo.color;

    if (isSelected) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      drawPixelShape(ctx, x, y, footprint.width + 8, footprint.height + 8);
    }
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.95)`;
    drawPixelShape(ctx, x, y, footprint.width, footprint.height);
    if (isSelected || Math.min(footprint.width, footprint.height) >= 2) {
      ctx.lineWidth = isSelected ? 2.2 : Math.max(0.35, Math.min(0.8, Math.min(footprint.width, footprint.height) * 0.12));
      ctx.strokeStyle = isSelected ? "#fcd900" : "rgba(17, 17, 17, 0.34)";
      strokePixelShape(ctx, x, y, footprint.width, footprint.height);
    }
  });
}

function metersPerPixelAtLat(lat, zoom = state.map?.getZoom?.() ?? 10) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * (2 ** zoom));
}

function groundMetersToPixels(meters, lat, zoom) {
  const metersPerPixel = Math.max(metersPerPixelAtLat(lat, zoom), 0.000001);
  return meters / metersPerPixel;
}

function psFootprintPixels(lat, zoom = state.map?.getZoom?.() ?? 10) {
  const footprint = state.data?.layers?.ps_points;
  const minSize = footprint?.source === "ferretti_ps" ? 5 : 0.05;
  return {
    width: Math.max(minSize, groundMetersToPixels(footprint?.pixel_width_m ?? 3.4, lat, zoom)),
    height: Math.max(minSize, groundMetersToPixels(footprint?.pixel_height_m ?? 13.5, lat, zoom)),
  };
}

function sbasFootprintPixels(lat, zoom = state.map?.getZoom?.() ?? 10) {
  const footprint = state.data?.project?.pixel_footprint_m?.sbas;
  if (!footprint?.width_m || !footprint?.height_m) return null;
  return {
    width: Math.max(0.05, groundMetersToPixels(footprint.width_m, lat, zoom)),
    height: Math.max(0.05, groundMetersToPixels(footprint.height_m, lat, zoom)),
  };
}

function drawCenteredRect(ctx, centerX, centerY, width, height) {
  ctx.fillRect(centerX - width / 2, centerY - height / 2, width, height);
}

function strokeCenteredRect(ctx, centerX, centerY, width, height) {
  ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
}

function drawPixelShape(ctx, centerX, centerY, width, height) {
  if (state.pixelShape === "circle") {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(0.5, Math.min(width, height) * 0.48), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  drawCenteredRect(ctx, centerX, centerY, width, height);
}

function strokePixelShape(ctx, centerX, centerY, width, height) {
  if (state.pixelShape === "circle") {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(0.5, Math.min(width, height) * 0.48), 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  strokeCenteredRect(ctx, centerX, centerY, width, height);
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

      const centerLat = state.data.lat[row];
      const centerLon = state.data.lon[col];
      const west = Math.min(lonEdges[col], lonEdges[col + 1]);
      const east = Math.max(lonEdges[col], lonEdges[col + 1]);
      const northWest = state.map.project([north, west], coords.z);
      const southEast = state.map.project([south, east], coords.z);
      const cellWidth = Math.max(1, southEast.x - northWest.x);
      const cellHeight = Math.max(1, southEast.y - northWest.y);
      const projectedCenter = state.map.project([centerLat, centerLon], coords.z);
      const footprint = sbasFootprintPixels(centerLat, coords.z) ?? { width: cellWidth, height: cellHeight };
      const pixelBounds = L.bounds(
        L.point(projectedCenter.x - footprint.width / 2, projectedCenter.y - footprint.height / 2),
        L.point(projectedCenter.x + footprint.width / 2, projectedCenter.y + footprint.height / 2),
      );

      if (!tileBounds.intersects(pixelBounds)) continue;

      const centerX = projectedCenter.x - tileOrigin.x;
      const centerY = projectedCenter.y - tileOrigin.y;
      const colorInfo = colorInfoForValue(value, state.rasterRange, state.activeLayer);
      const color = colorInfo.color;

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
      drawPixelShape(ctx, centerX, centerY, footprint.width, footprint.height);
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
  const centerLat = state.data.lat[row];
  const centerLon = state.data.lon[col];
  const projectedCenter = state.map.project([centerLat, centerLon], coords.z);
  const fallbackWidth = Math.max(1, southEast.x - northWest.x);
  const fallbackHeight = Math.max(1, southEast.y - northWest.y);
  const footprint = sbasFootprintPixels(centerLat, coords.z) ?? { width: fallbackWidth, height: fallbackHeight };
  const cellBounds = L.bounds(
    L.point(projectedCenter.x - footprint.width / 2, projectedCenter.y - footprint.height / 2),
    L.point(projectedCenter.x + footprint.width / 2, projectedCenter.y + footprint.height / 2),
  );

  if (!tileBounds.intersects(cellBounds)) return;

  const centerX = projectedCenter.x - tileOrigin.x;
  const centerY = projectedCenter.y - tileOrigin.y;
  const ringWidth = Math.max(2, Math.min(4, Math.min(footprint.width, footprint.height) * 0.2));

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = ringWidth + 2;
  strokePixelShape(
    ctx,
    centerX,
    centerY,
    footprint.width + ringWidth * 1.6,
    footprint.height + ringWidth * 1.6,
  );

  ctx.strokeStyle = "#fcd900";
  ctx.lineWidth = ringWidth;
  strokePixelShape(
    ctx,
    centerX,
    centerY,
    footprint.width + ringWidth * 1.6,
    footprint.height + ringWidth * 1.6,
  );
}

function showMapContextMenu(event) {
  if (!state.map) return;
  event.preventDefault();
  const frame = els.mapFrame.getBoundingClientRect();
  const menuWidth = 230;
  const menuHeight = 48;
  const x = clamp(event.clientX - frame.left, 8, Math.max(8, frame.width - menuWidth - 8));
  const y = clamp(event.clientY - frame.top, 8, Math.max(8, frame.height - menuHeight - 8));
  els.mapContextMenu.style.left = `${x}px`;
  els.mapContextMenu.style.top = `${y}px`;
  els.mapContextMenu.hidden = false;
}

function hideMapContextMenu() {
  els.mapContextMenu.hidden = true;
}

async function exportMapImage() {
  hideMapContextMenu();
  if (!state.map) return;
  setStatus("Exporting high-resolution map...");

  try {
    if (state.is3D && state.scene3D) {
      await export3DMapImage();
      setStatus("High-resolution 3D map exported.", "success");
      return;
    }

    const scale = 3;
    const rect = els.map.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#e9e7dc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await drawVisibleMapTilesForExport(ctx, scale);
    drawRasterForExport(ctx, scale);
    drawSelectedPixelForExport(ctx, scale);
    drawExportStamp(ctx, scale);
    drawExportLegend(ctx, scale);
    drawLeafletScaleForExport(ctx, scale);

    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, exportMapFilename());
    setStatus("High-resolution map exported.", "success");
  } catch (error) {
    setStatus(`Could not export map: ${error.message}`, "error");
  }
}

async function export3DMapImage() {
  const view = state.scene3D;
  if (!view) throw new Error("3D scene is not ready.");

  const scale = 3;
  const rect = els.map3d.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const exportWidth = width * scale;
  const exportHeight = height * scale;
  const previousPixelRatio = view.renderer.getPixelRatio();
  const previousAspect = view.camera.aspect;
  let blob;

  try {
    view.renderer.setPixelRatio(1);
    view.renderer.setSize(exportWidth, exportHeight, false);
    view.camera.aspect = exportWidth / exportHeight;
    view.camera.updateProjectionMatrix();
    apply3DCamera();
    view.renderer.render(view.scene, view.camera);

    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(view.renderer.domElement, 0, 0, exportWidth, exportHeight);
    drawExportStamp(ctx, scale);
    drawExportLegend(ctx, scale);
    blob = await canvasToBlob(canvas);
  } finally {
    view.renderer.setPixelRatio(previousPixelRatio);
    view.camera.aspect = previousAspect;
    view.camera.updateProjectionMatrix();
    resize3DScene();
    apply3DCamera();
    view.renderer.render(view.scene, view.camera);
  }

  downloadBlob(blob, exportMapFilename("3d"));
}

async function drawVisibleMapTilesForExport(ctx, scale) {
  const mapRect = els.map.getBoundingClientRect();
  const tiles = Array.from(els.map.querySelectorAll(".leaflet-tile-loaded"));
  await Promise.all(tiles.map((tile) => {
    if (!(tile instanceof HTMLImageElement) || !tile.complete || !tile.naturalWidth) {
      return Promise.resolve();
    }
    const tileRect = tile.getBoundingClientRect();
    const x = (tileRect.left - mapRect.left) * scale;
    const y = (tileRect.top - mapRect.top) * scale;
    const width = tileRect.width * scale;
    const height = tileRect.height * scale;
    try {
      ctx.drawImage(tile, x, y, width, height);
    } catch {
      // Some third-party tiles may reject canvas export; the raster layer still exports.
    }
    return Promise.resolve();
  }));
}

function drawRasterForExport(ctx, scale) {
  if (!state.data || !state.activeLayer || !state.rasterValues || !state.rasterRange) return;
  if (state.rasterRange.p02 === null && state.activeLayer !== "coherence") return;
  drawPixelGridForExport(ctx, scale, state.rasterValues, ({ value }) => colorInfoForValue(value, state.rasterRange, state.activeLayer));
}

function drawSelectedPixelForExport(ctx, scale) {
  if (!state.data || !state.selectedPixel) return;
  const { row, col } = state.selectedPixel;
  drawPixelGridForExport(ctx, scale, [[state.rasterValues?.[row]?.[col] ?? 0]], () => [0, 0, 0, 0], { selectedOnly: { row, col } });
}

function drawPixelGridForExport(ctx, scale, values, colorResolver, options = {}) {
  const latEdges = axisEdges(state.data.lat);
  const lonEdges = axisEdges(state.data.lon);
  const rows = options.selectedOnly ? [options.selectedOnly.row] : values.map((_, index) => index);

  rows.forEach((row) => {
    const cols = options.selectedOnly ? [options.selectedOnly.col] : values[row].map((_, index) => index);
    const south = Math.min(latEdges[row], latEdges[row + 1]);
    const north = Math.max(latEdges[row], latEdges[row + 1]);

    cols.forEach((col) => {
      const value = options.selectedOnly ? state.rasterValues?.[row]?.[col] : values[row][col];
      const hiddenByFilter = isFilterableLayer() && !pixelPassesFilter(row, col);
      if (!options.selectedOnly && (hiddenByFilter || value === null || value === undefined || Number.isNaN(value))) return;

      const west = Math.min(lonEdges[col], lonEdges[col + 1]);
      const east = Math.max(lonEdges[col], lonEdges[col + 1]);
      const northWest = state.map.latLngToContainerPoint([north, west]);
      const southEast = state.map.latLngToContainerPoint([south, east]);
      const centerLat = state.data.lat[row];
      const centerLon = state.data.lon[col];
      const centerPoint = state.map.latLngToContainerPoint([centerLat, centerLon]);
      const fallbackWidth = Math.max(1, (southEast.x - northWest.x) * scale);
      const fallbackHeight = Math.max(1, (southEast.y - northWest.y) * scale);
      const footprint = sbasFootprintPixels(centerLat) ?? {
        width: fallbackWidth / scale,
        height: fallbackHeight / scale,
      };
      const width = Math.max(1, footprint.width * scale);
      const height = Math.max(1, footprint.height * scale);
      const centerX = centerPoint.x * scale;
      const centerY = centerPoint.y * scale;

      if (options.selectedOnly) {
        const ringWidth = Math.max(3, Math.min(8, Math.min(width, height) * 0.2));
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = ringWidth + 3;
        strokePixelShape(ctx, centerX, centerY, width + ringWidth * 1.6, height + ringWidth * 1.6);
        ctx.strokeStyle = "#fcd900";
        ctx.lineWidth = ringWidth;
        strokePixelShape(ctx, centerX, centerY, width + ringWidth * 1.6, height + ringWidth * 1.6);
        return;
      }

      const resolvedColor = colorResolver({ value, row, col });
      const color = Array.isArray(resolvedColor) ? resolvedColor : resolvedColor.color;
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
      drawPixelShape(ctx, centerX, centerY, width, height);
    });
  });
}

function drawExportStamp(ctx, scale) {
  if (!state.data || !state.activeLayer) return;
  const padding = 14 * scale;
  const lineHeight = 16 * scale;
  const defaultTitle = state.activeLayer === "deformation"
    ? `Displacement ${state.data.dates[state.dateIndex] || ""}`
    : layerText[state.activeLayer]?.title || "InSAR map";
  const title = state.exportTitle.trim() || defaultTitle;
  const subtitle = state.exportSubtitle.trim() || projectFolderName(state.data.project.project_path);
  const titleFont = `800 ${13 * scale}px Inter, Segoe UI, Arial, sans-serif`;
  const subtitleFont = `600 ${10 * scale}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.save();
  ctx.font = titleFont;
  const titleWidth = ctx.measureText(title).width;
  ctx.font = subtitleFont;
  const subtitleWidth = ctx.measureText(subtitle).width;
  const width = Math.max(titleWidth, subtitleWidth) + padding * 1.2;
  const height = lineHeight * 2 + padding * 1.4;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillRect(padding, padding, width, height);
  ctx.fillStyle = "#111111";
  ctx.font = titleFont;
  ctx.fillText(title, padding * 1.6, padding + lineHeight);
  ctx.fillStyle = "#555555";
  ctx.font = subtitleFont;
  ctx.fillText(subtitle, padding * 1.6, padding + lineHeight * 2);
  ctx.restore();
}

function drawExportLegend(ctx, scale) {
  const legend = getExportLegendConfig();
  if (!legend) return;

  const margin = 18 * scale;
  const panelWidth = Math.min(650 * scale, ctx.canvas.width - margin * 2);
  const panelHeight = 104 * scale;
  const x = ctx.canvas.width - panelWidth - margin;
  const y = margin;
  const innerX = x + 11 * scale;
  const innerWidth = panelWidth - 22 * scale;
  const headerBaseline = y + 17 * scale;
  const dividerY = y + 28 * scale;
  const barY = y + 49 * scale;
  const barHeight = legend.type === "segmented" ? 18 * scale : 26 * scale;

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.fillRect(x, y, panelWidth, panelHeight);
  ctx.fillStyle = "#111111";
  ctx.font = `900 ${14 * scale}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(legend.title, innerX, headerBaseline);
  ctx.fillStyle = "#555555";
  ctx.font = `italic 650 ${12 * scale}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(legend.subtitle, innerX + innerWidth, headerBaseline);
  ctx.strokeStyle = "rgba(17, 17, 17, 0.18)";
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(innerX, dividerY);
  ctx.lineTo(innerX + innerWidth, dividerY);
  ctx.stroke();

  if (legend.type === "segmented") {
    const segmentWidth = innerWidth / legend.colors.length;
    legend.colors.forEach((color, index) => {
      ctx.fillStyle = rgbCss(color);
      ctx.fillRect(innerX + segmentWidth * index, barY, segmentWidth + 1, barHeight);
      if (index > 0) {
        ctx.strokeStyle = "rgba(17, 17, 17, 0.22)";
        ctx.lineWidth = scale;
        ctx.beginPath();
        ctx.moveTo(innerX + segmentWidth * index, barY);
        ctx.lineTo(innerX + segmentWidth * index, barY + barHeight);
        ctx.stroke();
      }
    });
  } else {
    const sampleCount = 64;
    for (let index = 0; index < sampleCount; index += 1) {
      const left = innerX + (innerWidth * index) / sampleCount;
      const width = innerWidth / sampleCount + 1;
      const t = -1 + (2 * index) / (sampleCount - 1);
      ctx.fillStyle = rgbCss(colorForNormalizedValue(t));
      ctx.fillRect(left, barY, width, barHeight);
    }
  }

  ctx.strokeStyle = "rgba(17, 17, 17, 0.42)";
  ctx.lineWidth = scale;
  ctx.strokeRect(innerX, barY, innerWidth, barHeight);
  const tickPositions = legend.type === "segmented"
    ? [0, 0.5, 1]
    : [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  if (legend.type !== "segmented") {
    tickPositions.forEach((position) => {
      const tickX = innerX + ((position + 1) / 2) * innerWidth;
      ctx.strokeStyle = position === 0 ? "rgba(17, 17, 17, 0.58)" : "rgba(17, 17, 17, 0.28)";
      ctx.lineWidth = (position === 0 ? 2 : 1) * scale;
      ctx.beginPath();
      ctx.moveTo(tickX, barY);
      ctx.lineTo(tickX, barY + barHeight);
      ctx.stroke();
    });
  }
  ctx.fillStyle = "#222222";
  ctx.font = `650 ${12 * scale}px Inter, Segoe UI, Arial, sans-serif`;
  const ticks = legend.type === "segmented"
    ? [0, 0.5, 1]
    : tickPositions.map((t) => inverseNormalizeDivergingValue(t, legend.range.scale));
  ticks.forEach((value, index) => {
    const position = index / (ticks.length - 1);
    ctx.textAlign = index === 0 ? "left" : index === ticks.length - 1 ? "right" : "center";
    ctx.fillText(formatLegendNumber(value), innerX + innerWidth * position, y + 93 * scale);
  });
  ctx.restore();
}

function getExportLegendConfig() {
  if (state.activeLayer === "coherence") {
    return {
      type: "segmented",
      title: "Coherence",
      subtitle: getCoherenceStackKind() === "pair" ? "pair reliability - unitless" : "median reliability - unitless",
      colors: COHERENCE_LEGEND_COLORS,
    };
  }
  if (state.activeLayer && state.rasterRange?.scale) {
    const unit = state.activeLayer === "velocity" ? "mm/year" : "mm";
    return {
      type: "continuous",
      title: state.activeLayer === "velocity" ? `Velocity (${unit})` : `Displacement (${unit})`,
      subtitle: state.activeLayer === "deformation" ? getDeformationLegendDates() : "line of sight rate",
      range: state.rasterRange,
    };
  }
  if (state.psLayer && state.psRange?.scale) {
    const config = getPsLayerConfig();
    return {
      type: "continuous",
      title: config.title,
      subtitle: `PS overlay - ${config.unit}`,
      range: state.psRange,
    };
  }
  return null;
}

function drawLeafletScaleForExport(ctx, scale) {
  const mapRect = els.map.getBoundingClientRect();
  const scaleControl = els.map.querySelector(".leaflet-control-scale");
  if (!scaleControl || !mapRect.width || !mapRect.height) return;
  const lines = Array.from(scaleControl.querySelectorAll(".leaflet-control-scale-line"));
  ctx.save();
  ctx.font = `${11 * scale}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((line) => {
    const rect = line.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (rect.left - mapRect.left) * scale;
    const y = (rect.top - mapRect.top) * scale;
    const width = rect.width * scale;
    const height = rect.height * scale;
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#777777";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y);
    ctx.stroke();
    ctx.fillStyle = "#333333";
    ctx.fillText(line.textContent.trim(), x + 5 * scale, y + 1 * scale);
  });
  ctx.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not create the PNG."));
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportMapFilename(viewMode = state.is3D ? "3d" : "2d") {
  const layer = state.activeLayer || "map";
  const date = state.activeLayer === "deformation" ? state.data?.dates[state.dateIndex] : "";
  const suffix = date ? `-${date}` : "";
  return `insar-${layer}-${viewMode}${suffix}-${new Date().toISOString().slice(0, 10)}.png`;
}

function handleLeafletMapClick(event) {
  if (!state.data) return;
  if (state.psLayer && hasPsPoints()) {
    const psPoint = nearestPsPoint(event.containerPoint);
    if (psPoint) {
      state.selectedPsPoint = psPoint;
      state.selectedPixel = null;
      if (state.selectedPixelLayer) {
        state.selectedPixelLayer.remove();
        state.selectedPixelLayer = null;
      }
      showPixelPanel();
      updatePsPointLayer();
      updatePixelInfo();
      drawTimeSeries();
      updateLegendIndicator();
      return;
    }
  }

  if (!state.activeLayer || !state.data.lat.length || !state.data.lon.length) return;
  if (!leafletBounds().contains(event.latlng)) return;
  const row = nearestIndex(state.data.lat, event.latlng.lat);
  const col = nearestIndex(state.data.lon, event.latlng.lng);
  state.selectedPixel = { row, col };
  state.selectedPsPoint = null;
  showPixelPanel();
  updatePsPointLayer();
  drawSelectedPixel();
  updatePixelInfo();
  drawTimeSeries();
}

function nearestPsPoint(containerPoint) {
  const points = state.data?.layers?.ps_points?.points ?? [];
  if (!points.length || !state.map) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  points.forEach((point) => {
    const screenPoint = state.map.latLngToContainerPoint([point.lat, point.lon]);
    const footprint = psFootprintPixels(point.lat);
    const dx = Math.abs(screenPoint.x - containerPoint.x);
    const dy = Math.abs(screenPoint.y - containerPoint.y);
    const pad = 4;
    const isInsideFootprint = dx <= footprint.width / 2 + pad && dy <= footprint.height / 2 + pad;
    const distance = screenPoint.distanceTo(containerPoint);
    if (isInsideFootprint && distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  });
  return nearest;
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
  const supports3D = state.data?.project?.dataset_kind !== "ferretti_ps";
  if (!supports3D) state.is3D = false;
  els.view3dToggle.hidden = !supports3D;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
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
      pan: event.button === 1 || event.shiftKey || event.ctrlKey || event.metaKey,
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
  view.pixelBaseColors = null;

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
      const colorInfo = colorInfoForValue(value, state.rasterRange, state.activeLayer);
      const color = colorInfo.color;
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
  view.pixelBaseColors = new Float32Array(colors);
  geometry.setAttribute("instanceOffset", new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3));
  geometry.setAttribute("instanceColor", new THREE.InstancedBufferAttribute(new Float32Array(view.pixelBaseColors), 3));
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
  return clamp(cellBase * 0.44, 3, Math.max(18, cellBase * 1.6));
}

function update3DSelection() {
  const view = state.scene3D;
  if (!view) return;
  if (view.selectedMesh) {
    disposeObject3D(view.selectedMesh);
    view.scene.remove(view.selectedMesh);
    view.selectedMesh = null;
  }

  const colors = view.pointMesh?.geometry?.getAttribute("instanceColor");
  if (!colors || !view.pixelBaseColors) return;

  for (let index = 0; index < colors.count; index += 1) {
    const base = index * 3;
    colors.setXYZ(
      index,
      view.pixelBaseColors[base],
      view.pixelBaseColors[base + 1],
      view.pixelBaseColors[base + 2],
    );
  }

  if (state.selectedPixel && state.is3D) {
    const selectedIndex = view.pixelLookup.findIndex((pixel) => (
      pixel.row === state.selectedPixel.row && pixel.col === state.selectedPixel.col
    ));
    if (selectedIndex >= 0) {
      const base = selectedIndex * 3;
      const opacity = 0.38;
      colors.setXYZ(
        selectedIndex,
        view.pixelBaseColors[base] * (1 - opacity) + 1.0 * opacity,
        view.pixelBaseColors[base + 1] * (1 - opacity) + 0.92 * opacity,
        view.pixelBaseColors[base + 2] * (1 - opacity) + 0.34 * opacity,
      );
    }
  }

  colors.needsUpdate = true;
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
    const isPsOption = Boolean(option.dataset.psLayer);
    const sbasLayerAvailable = isPsOption || Boolean(state.data?.project?.dataset_kind !== "ferretti_ps");
    const isSelected = isPsOption
      ? option.dataset.psLayer === state.psLayer
      : option.dataset.layer === state.selectedLayer;
    option.hidden = isPsOption ? !hasPsPoints() : !sbasLayerAvailable;
    option.classList.toggle("active", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
    option.dataset.activeLayer = String(!isPsOption && option.dataset.layer === state.activeLayer);
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
  if (state.data && state.psLayer && hasPsPoints() && !state.activeLayer) {
    const count = state.data.layers.ps_points.points.length;
    els.visiblePixelStatus.textContent = `${count.toLocaleString()} PS points visible`;
    els.lastUpdatedStatus.textContent = `Last updated: ${formatDateTime(state.data.project.last_updated)}`;
    return;
  }
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
  const viewerName = state.data?.project?.dataset_kind === "ferretti_ps" ? "InSAR PSI Viewer" : "InSAR SBAS Viewer";
  els.appTitle.textContent = `${viewerName} - ${projectName}`;
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
    if (state.data && state.psLayer && state.psRange) {
      const config = getPsLayerConfig();
      els.legendTitle.textContent = config.title;
      els.legendSubtitle.textContent = `PS overlay - ${config.unit}`;
      renderContinuousLegend(state.psRange, config.unit, config.field.includes("velocity") ? "velocity" : "deformation");
      return;
    }
    els.legendTitle.textContent = "No dataset selected";
    els.legendSubtitle.textContent = "-";
    els.legendItems.replaceChildren();
    return;
  }

  const values = getLayerValues(state.activeLayer);
  const renderRange = getDisplayRange(state.activeLayer, values);
  if (state.activeLayer === "coherence") {
    els.legendTitle.textContent = "Coherence";
    els.legendSubtitle.textContent = getCoherenceStackKind() === "pair" ? "pair reliability" : "median reliability";
    renderLegendRows(buildLegendBins(0, 1, COHERENCE_LEGEND_COLORS.length), "unitless", state.activeLayer, renderRange);
    return;
  }

  const unit = state.activeLayer === "velocity" ? "mm/year" : "mm";
  els.legendTitle.textContent = state.activeLayer === "velocity" ? `Velocity (${unit})` : `Displacement (${unit})`;
  const scaleName = COLOR_SCALE_MODES[renderRange.scale?.mode]?.name?.toLowerCase() ?? "linear";
  const noiseLabel = renderRange.scale
    ? `${scaleName} - stable +/-${formatLegendNumber(renderRange.scale.linthresh)} ${unit}`
    : "linear scale";
  els.legendSubtitle.textContent = state.activeLayer === "deformation"
    ? `${getDeformationLegendDates()} - ${noiseLabel}`
    : `line of sight rate - ${noiseLabel}`;

  if (renderRange.p02 === null || renderRange.p98 === null) {
    renderLegendMessage("No visible pixels");
    return;
  }

  renderContinuousLegend(renderRange, unit, state.activeLayer);
}

function updateLegendIndicator() {
  updateLegend();
}

function buildLegendBins(min, max, count) {
  if (max < min) return [];
  if (max === min) return [{ low: min, high: max }];
  const step = (max - min) / count;
  return Array.from({ length: count }, (_, index) => {
    const low = min + step * index;
    const high = index === count - 1 ? max : min + step * (index + 1);
    return { low, high };
  });
}

function renderLegendRows(bins, unit, layer, renderRange) {
  const selectedValue = getSelectedLegendValue();
  const wrap = document.createElement("div");
  wrap.className = "map-legend-segmented";

  const segments = document.createElement("div");
  segments.className = "map-legend-segments";
  bins.forEach((bin, index) => {
    const segment = document.createElement("span");
    segment.className = "map-legend-segment";
    if (selectedValue !== null && valueInLegendBin(selectedValue, bin, index, bins.length)) {
      segment.classList.add("is-active");
    }
    segment.style.backgroundColor = rgbCss(bin.color || colorForValue((bin.low + bin.high) / 2, renderRange, layer));
    segment.title = `${formatLegendNumber(bin.low)} - ${formatLegendNumber(bin.high)} ${unit}`;
    segments.appendChild(segment);
  });

  const ticks = document.createElement("div");
  ticks.className = "map-legend-ticks";
  [bins[0]?.low ?? 0, 0.5, bins.at(-1)?.high ?? 1].forEach((value) => {
    const tick = document.createElement("span");
    tick.textContent = formatLegendNumber(value);
    tick.title = unit;
    ticks.appendChild(tick);
  });

  const marker = renderLegendMarker(selectedValue, bins[0]?.low ?? 0, bins.at(-1)?.high ?? 1, unit);
  wrap.append(segments, ticks);
  if (marker) wrap.appendChild(marker);
  els.legendItems.replaceChildren(wrap);
}

function renderContinuousLegend(range, unit, layer) {
  const scale = range.scale ?? {
    mode: "symlog",
    negExtent: Math.abs(range.min ?? range.p02 ?? 0),
    posExtent: Math.abs(range.max ?? range.p98 ?? 0),
    linthresh: range.zeroHalfWidth ?? 0,
    gamma: 1,
  };
  const tickPositions = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  const values = tickPositions.map((t) => inverseNormalizeDivergingValue(t, scale));

  const wrap = document.createElement("div");
  wrap.className = "map-legend-continuous";

  const gradient = document.createElement("div");
  gradient.className = "map-legend-gradient";
  gradient.style.background = continuousLegendGradient(scale);
  gradient.appendChild(renderLegendGridlines(tickPositions));

  const ticks = document.createElement("div");
  ticks.className = "map-legend-ticks";
  values.forEach((value, index) => {
    const tick = document.createElement("span");
    tick.textContent = formatLegendNumber(value);
    tick.title = unit;
    tick.style.left = `${((tickPositions[index] + 1) / 2) * 100}%`;
    if (index === 0) tick.dataset.edge = "start";
    if (index === values.length - 1) tick.dataset.edge = "end";
    ticks.appendChild(tick);
  });

  const marker = renderNormalizedLegendMarker(getSelectedLegendValue(), scale, unit);
  wrap.append(gradient, ticks);
  if (marker) wrap.appendChild(marker);
  els.legendItems.replaceChildren(wrap);
}

function renderLegendGridlines(tickPositions) {
  const grid = document.createElement("div");
  grid.className = "map-legend-gridlines";
  tickPositions.forEach((position) => {
    const line = document.createElement("span");
    line.style.left = `${((position + 1) / 2) * 100}%`;
    if (position === 0) line.dataset.major = "true";
    grid.appendChild(line);
  });
  return grid;
}

function continuousLegendGradient(scale) {
  const stops = [];
  const sampleCount = 24;
  for (let index = 0; index <= sampleCount; index += 1) {
    const percent = (index / sampleCount) * 100;
    const t = -1 + (2 * index) / sampleCount;
    stops.push(`${rgbCss(colorForNormalizedValue(t))} ${percent}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function inverseNormalizeDivergingValue(t, scale) {
  const clamped = clamp(t, -1, 1);
  if (clamped === 0) return 0;
  const sign = clamped < 0 ? -1 : 1;
  const extent = sign < 0 ? scale.negExtent : scale.posExtent;
  const magnitude = inverseNormalizeMagnitude(Math.abs(clamped), extent, scale.linthresh ?? 0, scale);
  return sign * magnitude;
}

function inverseNormalizeMagnitude(t, extent, linthresh, scale) {
  if (t <= 0) return 0;
  const usableExtent = Math.max(extent - linthresh, 0.000001);
  if (scale.mode === "linear") return linthresh + t * usableExtent;
  if (scale.mode === "power") {
    const gamma = Math.max(scale.gamma ?? 1, 0.000001);
    return linthresh + Math.pow(t, 1 / gamma) * usableExtent;
  }
  const base = Math.max(linthresh, usableExtent * 0.02, 0.000001);
  return linthresh + base * Math.expm1(t * Math.log1p(usableExtent / base));
}

function renderLegendMarker(value, min, max, unit) {
  if (value === null || value === undefined || Number.isNaN(value) || max <= min) return null;
  const marker = document.createElement("span");
  marker.className = "map-legend-marker";
  const percent = clamp(((value - min) / (max - min)) * 100, 0, 100);
  marker.style.left = `${percent}%`;
  marker.title = `Selected pixel: ${formatLegendNumber(value)} ${unit}`;
  return marker;
}

function renderNormalizedLegendMarker(value, scale, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const marker = document.createElement("span");
  marker.className = "map-legend-marker";
  const normalized = normalizeDivergingValue(value, scale);
  marker.style.left = `${((normalized.t + 1) / 2) * 100}%`;
  marker.title = `Selected pixel: ${formatLegendNumber(value)} ${unit}`;
  return marker;
}

function renderLegendMessage(message) {
  const row = document.createElement("div");
  row.className = "map-legend-row";
  const swatch = document.createElement("span");
  swatch.className = "map-legend-swatch";
  swatch.style.backgroundColor = "rgba(17, 17, 17, 0.18)";
  const label = document.createElement("span");
  label.className = "map-legend-label";
  label.textContent = message;
  row.append(swatch, label);
  els.legendItems.replaceChildren(row);
}

function getSelectedLegendValue() {
  if (state.data && state.selectedPsPoint && state.psLayer) {
    const config = getPsLayerConfig();
    const value = state.selectedPsPoint?.[config?.field];
    return value === null || value === undefined || Number.isNaN(value) ? null : value;
  }
  if (!state.data || !state.activeLayer || !state.selectedPixel) return null;
  const { row, col } = state.selectedPixel;
  const value = getLayerValues()?.[row]?.[col];
  return value === null || value === undefined || Number.isNaN(value) ? null : value;
}

function valueInLegendBin(value, bin, index, totalBins) {
  if (index === 0) return value >= bin.low && value <= bin.high;
  if (index === totalBins - 1) return value > bin.low && value <= bin.high;
  return value > bin.low && value <= bin.high;
}

function rgbCss(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function formatLegendNumber(value) {
  if (Math.abs(value) < 0.05) return "0";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function getDeformationLegendDates() {
  const dates = state.data?.dates ?? [];
  if (!dates.length) return "date range unavailable";
  const start = dates[0];
  const end = dates[clamp(state.dateIndex, 0, dates.length - 1)] ?? dates[dates.length - 1];
  return `${formatLegendDate(start)} - ${formatLegendDate(end)}`;
}

function formatLegendDate(value) {
  if (!value) return "-";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const year = String(parts[0]).slice(-2);
  if (!monthNames[monthIndex] || Number.isNaN(day)) return value;
  return `${day}-${monthNames[monthIndex]}-${year}`;
}

function updatePixelInfo() {
  if (state.data && state.selectedPsPoint) {
    updatePsPixelInfo(state.selectedPsPoint);
    return;
  }
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
  updateLegendIndicator();
}

function updatePsPixelInfo(point) {
  const validPairs = point.valid_pair_count ?? "-";
  const totalPairs = state.data?.layers?.n_good_pairs?.n_pairs_total ?? "-";
  const isFerretti = state.data?.layers?.ps_points?.source === "ferretti_ps";
  els.pixelLat.textContent = formatNumber(point.lat, 6);
  els.pixelLon.textContent = formatNumber(point.lon, 6);
  els.pixelElevation.textContent = "n/a";
  els.pixelVelocity.textContent = `${formatNumber(point.velocity_mm_yr)} mm/year`;
  els.pixelCoherenceLabel.innerHTML = `${isFerretti ? "Residual gamma after APS" : "Median correlation"} <span class="metric-hint">high = good</span>`;
  els.pixelCoherence.textContent = formatNumber(point.corr_median, 2);
  els.pixelStabilityLabel.innerHTML = isFerretti
    ? "Amplitude dispersion index <span class=\"metric-hint\">low = good</span>"
    : "Stability (std) <span class=\"metric-hint\">low = good</span>";
  els.pixelStability.textContent = formatNumber(point.psf, 2);
  els.pixelGoodPairs.textContent = `${validPairs} / ${totalPairs}`;
  els.pixelRmse.textContent = `${formatNumber(point.rmse_mm, 2)} ${point.rmse_unit ?? "mm"}`;
  els.pixelDeformation.textContent = `${formatNumber(point.displacement_last_mm)} mm`;
  els.pixelPasses.textContent = point.is_reference_ps ? "Reference PS" : "PS geocoded";
  els.pixelPanelSubtitle.textContent = `PS ${point.ps_id}${point.is_reference_ps ? " (reference)" : ""} - ${formatNumber(point.lat, 5)}, ${formatNumber(point.lon, 5)}`;
  updateLegendIndicator();
}

function resetPixelInfo() {
  els.pixelLat.textContent = "Click the map";
  els.pixelLon.textContent = "Click the map";
  els.pixelElevation.textContent = "-";
  els.pixelVelocity.textContent = "-";
  els.pixelCoherenceLabel.innerHTML = "Median coherence <span class=\"metric-hint\">high = good</span>";
  els.pixelCoherence.textContent = "-";
  els.pixelStabilityLabel.innerHTML = "Stability (std) <span class=\"metric-hint\">low = good</span>";
  els.pixelStability.textContent = "-";
  els.pixelGoodPairs.textContent = "-";
  els.pixelRmse.textContent = "-";
  els.pixelDeformation.textContent = "-";
  els.pixelPasses.textContent = "-";
  els.pixelPanelSubtitle.textContent = "No point selected";
  updateLegendIndicator();
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

  if (!state.data || (!state.selectedPixel && !state.selectedPsPoint)) {
    ctx.fillStyle = "#627083";
    ctx.font = `${13 * (window.devicePixelRatio || 1)}px Arial`;
    ctx.fillText("Click a map pixel or PS point to show its deformation series.", padding, padding + 24);
    return;
  }

  const values = state.selectedPsPoint
    ? state.selectedPsPoint.timeseries ?? []
    : state.data.layers.deformation.values.map((plane) => plane[state.selectedPixel.row][state.selectedPixel.col]);
  const valid = values.filter((value) => value !== null && !Number.isNaN(value));
  if (!valid.length) {
    ctx.fillStyle = "#627083";
    ctx.fillText("No deformation values for this point.", padding, padding + 24);
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
    ctx.fillStyle = index === state.dateIndex ? "#b6362d" : state.selectedPsPoint ? "#6f3fb5" : "#176b87";
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
  els.gridDetails.textContent = project.dataset_kind === "ferretti_ps"
    ? `${state.data.layers.ps_points.points.length} geocoded PS points, ${project.date_count} dates`
    : `${project.lat_count} rows x ${project.lon_count} columns, ${project.date_count} dates`;
  els.boundsDetails.textContent = `${formatNumber(bounds.lat_min, 5)} to ${formatNumber(bounds.lat_max, 5)} lat; ${formatNumber(bounds.lon_min, 5)} to ${formatNumber(bounds.lon_max, 5)} lon`;
}

function projectFolderName(projectPath) {
  const parts = String(projectPath).split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || "Loaded project";
}

function initializeLoadedProjectState() {
  initializeFilterThresholds();
  state.dateIndex = Math.max(0, state.data.dates.length - 1);
  state.coherencePairIndex = 0;
  state.selectedPixel = null;
  state.selectedPsPoint = null;

  if (state.data.project.dataset_kind === "ferretti_ps") {
    state.selectedLayer = null;
    state.activeLayer = null;
    state.psLayer = "velocity";
    state.is3D = false;
  } else if (!state.data.layers.ps_points?.available) {
    state.psLayer = null;
  }
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
    initializeLoadedProjectState();
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

function openSettingsModal() {
  renderHeatmapOptions();
  renderPixelShapeOptions();
  els.exportTitleInput.value = state.exportTitle;
  els.exportSubtitleInput.value = state.exportSubtitle;
  setSettingsPanel("heatmaps");
  els.settingsModal.hidden = false;
  els.settingsModal.setAttribute("aria-hidden", "false");
  els.settingsModalClose.focus();
}

function closeSettingsModal() {
  els.settingsModal.hidden = true;
  els.settingsModal.setAttribute("aria-hidden", "true");
  els.settingsButton.focus();
}

function setSettingsPanel(panelName) {
  els.settingsNavButtons.forEach((button) => {
    const isActive = button.dataset.settingsPanel === panelName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.settingsContents.forEach((section) => {
    section.hidden = section.dataset.settingsContent !== panelName;
  });
}

function renderHeatmapOptions() {
  const options = Object.entries(HEATMAP_PALETTES).map(([key, palette]) => {
    const button = document.createElement("button");
    button.className = "heatmap-option";
    button.type = "button";
    button.dataset.palette = key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(key === state.heatmapPalette));
    button.classList.toggle("active", key === state.heatmapPalette);

    const label = document.createElement("span");
    label.className = "heatmap-option-label";
    label.textContent = palette.name;

    const detail = document.createElement("span");
    detail.className = "heatmap-option-detail";
    detail.textContent = palette.detail;

    const preview = document.createElement("span");
    preview.className = "heatmap-preview";
    preview.style.background = paletteGradient(palette.colors);

    const steps = document.createElement("span");
    steps.className = "heatmap-steps";
    palette.colors.forEach((color) => {
      const swatch = document.createElement("span");
      swatch.style.backgroundColor = rgbCss(color);
      steps.appendChild(swatch);
    });

    button.append(label, detail, preview, steps);
    return button;
  });

  els.heatmapOptions.replaceChildren(...options);
  renderColorScaleOptions();
}

function selectHeatmapPalette(paletteKey) {
  if (!HEATMAP_PALETTES[paletteKey]) return;
  state.heatmapPalette = paletteKey;
  localStorage.setItem("insar-heatmap-palette", paletteKey);
  renderHeatmapOptions();
  drawMap();
}

function renderColorScaleOptions() {
  if (!els.colorScaleOptions) return;
  const options = Object.entries(COLOR_SCALE_MODES).map(([key, mode]) => {
    const button = document.createElement("button");
    button.className = "scale-option";
    button.type = "button";
    button.dataset.scaleMode = key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(key === state.scaleSettings.mode));
    button.classList.toggle("active", key === state.scaleSettings.mode);

    const label = document.createElement("span");
    label.className = "scale-option-label";
    label.textContent = mode.name;

    const detail = document.createElement("span");
    detail.className = "scale-option-detail";
    detail.textContent = mode.detail;

    button.append(label, detail);
    return button;
  });
  els.colorScaleOptions.replaceChildren(...options);
}

function selectColorScaleMode(mode) {
  if (!COLOR_SCALE_MODES[mode]) return;
  state.scaleSettings.mode = mode;
  localStorage.setItem("insar-scale-mode", mode);
  renderColorScaleOptions();
  drawMap();
}

function renderPixelShapeOptions() {
  if (!els.pixelShapeOptions) return;
  const options = Object.entries(PIXEL_SHAPES).map(([key, shape]) => {
    const button = document.createElement("button");
    button.className = "shape-option";
    button.type = "button";
    button.dataset.pixelShape = key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(key === state.pixelShape));
    button.classList.toggle("active", key === state.pixelShape);

    const label = document.createElement("span");
    label.className = "shape-option-label";
    label.textContent = shape.name;

    const detail = document.createElement("span");
    detail.className = "shape-option-detail";
    detail.textContent = shape.detail;

    button.append(label, detail);
    return button;
  });
  els.pixelShapeOptions.replaceChildren(...options);
}

function selectPixelShape(shape) {
  if (!PIXEL_SHAPES[shape]) return;
  state.pixelShape = shape;
  localStorage.setItem("insar-pixel-shape", shape);
  renderPixelShapeOptions();
  drawMap();
}

function setExportTitle(title) {
  state.exportTitle = title;
  localStorage.setItem("insar-export-title", title);
}

function setExportSubtitle(subtitle) {
  state.exportSubtitle = subtitle;
  localStorage.setItem("insar-export-subtitle", subtitle);
}

function paletteGradient(colors) {
  const stops = colors.map((color, index) => {
    const percent = colors.length === 1 ? 0 : (index / (colors.length - 1)) * 100;
    return `${rgbCss(color)} ${percent}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function selectedLayerNames() {
  const names = [];
  if (state.selectedLayer) names.push(layerText[state.selectedLayer].title);
  if (state.psLayer) names.push(psLayerText[state.psLayer].title);
  return names;
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
  state.selectedPsPoint = null;

  updateControls();
  drawMap();
  drawTimeSeries();
}

function togglePsLayer(layer) {
  state.psLayer = state.psLayer === layer ? null : layer;
  state.selectedPsPoint = null;
  state.psRange = getPsDisplayRange();
  updateControls();
  drawMap();
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
    initializeLoadedProjectState();
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

els.settingsButton.addEventListener("click", () => {
  openSettingsModal();
});

els.mapFrame.addEventListener("contextmenu", showMapContextMenu, true);
els.exportMapImageButton.addEventListener("click", exportMapImage);

els.view3dToggle.addEventListener("click", () => {
  if (state.data?.project?.dataset_kind === "ferretti_ps") return;
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

els.settingsModalClose.addEventListener("click", closeSettingsModal);
els.settingsModal.addEventListener("click", (event) => {
  if (event.target === els.settingsModal) {
    closeSettingsModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.datasetModal.hidden) {
    closeDatasetModal();
  }

  if (event.key === "Escape" && !els.settingsModal.hidden) {
    closeSettingsModal();
  }

  if (event.key === "Escape" && !els.mapContextMenu.hidden) {
    hideMapContextMenu();
  }

  if (event.key === "Escape" && !els.datasetSelectPopover.hidden) {
    setDatasetSelectOpen(false);
    els.datasetSelectButton.focus();
  }
});

els.settingsNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSettingsPanel(button.dataset.settingsPanel);
  });
});

els.heatmapOptions.addEventListener("click", (event) => {
  const option = event.target.closest(".heatmap-option");
  if (!option) return;
  selectHeatmapPalette(option.dataset.palette);
});

els.colorScaleOptions?.addEventListener("click", (event) => {
  const option = event.target.closest(".scale-option");
  if (!option) return;
  selectColorScaleMode(option.dataset.scaleMode);
});

els.pixelShapeOptions?.addEventListener("click", (event) => {
  const option = event.target.closest(".shape-option");
  if (!option) return;
  selectPixelShape(option.dataset.pixelShape);
});

els.exportTitleInput?.addEventListener("input", () => {
  setExportTitle(els.exportTitleInput.value);
});

els.exportSubtitleInput?.addEventListener("input", () => {
  setExportSubtitle(els.exportSubtitleInput.value);
});

els.datasetSelectButton.addEventListener("click", () => {
  setDatasetSelectOpen(els.datasetSelectPopover.hidden);
});

els.datasetOptions.forEach((option) => {
  option.addEventListener("click", () => {
    if (option.dataset.psLayer) {
      togglePsLayer(option.dataset.psLayer);
      return;
    }
    toggleSelectedLayer(option.dataset.layer);
  });
});

document.addEventListener("click", (event) => {
  if (!els.mapContextMenu.hidden && !els.mapContextMenu.contains(event.target)) {
    hideMapContextMenu();
  }

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
  if (state.psPointLayer) {
    state.psPointLayer.remove();
    state.psPointLayer = null;
  }
  if (state.selectedPixelLayer) {
    state.selectedPixelLayer.remove();
    state.selectedPixelLayer = null;
  }
  state.selectedPsPoint = null;
}

updateControls();
initializeFloatingPanel();
drawMap();
drawTimeSeries();
setStatus("");
