const state = {
  projectInfo: null,
};

const elements = {
  selectedFile: document.querySelector("#selected-file"),
  gridCounts: document.querySelector("#grid-counts"),
  bounds: document.querySelector("#bounds"),
  coordinates: document.querySelector("#coordinates"),
  variables: document.querySelector("#variables"),
  layerSelect: document.querySelector("#layer-select"),
  loadSummary: document.querySelector("#load-summary"),
  summaryOutput: document.querySelector("#summary-output"),
  status: document.querySelector("#status"),
};

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function renderProjectInfo(info) {
  elements.selectedFile.textContent = info.selected_file;
  elements.gridCounts.textContent = `lat: ${info.lat_count}, lon: ${info.lon_count}, date: ${info.date_count}`;
  elements.bounds.textContent = [
    `lat ${formatNumber(info.bounds.lat_min)} to ${formatNumber(info.bounds.lat_max)}`,
    `lon ${formatNumber(info.bounds.lon_min)} to ${formatNumber(info.bounds.lon_max)}`,
  ].join("; ");
  elements.coordinates.textContent = info.coordinates.length ? info.coordinates.join(", ") : "None found";
  elements.variables.textContent = info.available_variables.length
    ? info.available_variables.join(", ")
    : "None found";

  elements.layerSelect.innerHTML = "";
  for (const variableName of info.available_variables) {
    const option = document.createElement("option");
    option.value = variableName;
    option.textContent = variableName;
    elements.layerSelect.appendChild(option);
  }

  const preferredLayer = info.available_variables.includes("sbas_velocity_masked")
    ? "sbas_velocity_masked"
    : info.available_variables[0];

  if (preferredLayer) {
    elements.layerSelect.value = preferredLayer;
  }
}

function renderSummary(summary) {
  elements.summaryOutput.textContent = JSON.stringify(summary, null, 2);
}

async function loadProjectInfo() {
  setStatus("Loading project information...");
  try {
    state.projectInfo = await fetchJson("/api/project-info");
    renderProjectInfo(state.projectInfo);
    setStatus("Project information loaded.", "success");
  } catch (error) {
    setStatus(error.message, "error");
    elements.summaryOutput.textContent = "Project data could not be loaded.";
  }
}

async function loadLayerSummary() {
  const layer = elements.layerSelect.value;
  if (!layer) {
    setStatus("Select a layer first.", "error");
    return;
  }

  setStatus(`Loading summary for ${layer}...`);
  try {
    const summary = await fetchJson(`/api/layer-summary?layer=${encodeURIComponent(layer)}`);
    renderSummary(summary);
    setStatus(`Layer summary loaded for ${layer}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

elements.loadSummary.addEventListener("click", loadLayerSummary);
loadProjectInfo();
