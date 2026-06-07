"""Loader for the PS-SBAS *folder* result format.

This is a parallel path to the legacy single-file loader in ``data_loader``.
A folder-format project is a directory that contains a ``metadata.json``
manifest plus a set of single-variable NetCDF4/HDF5 files, e.g.::

    results/
      metadata.json          # manifest -- the source of truth
      velocity_mm_yr.nc      # (lat, lon)
      rmse_mm.nc             # (lat, lon)
      coherence_mean.nc      # (lat, lon)
      displacement_mm.nc     # (date, lat, lon)
      landmask.nc            # (lat, lon)   OPTIONAL

Design rules (kept deliberately strict so the same code works for the future
``method: "ps"`` export with identical layer names):

* The manifest is authoritative. We never hardcode filenames or assume a layer
  exists -- we iterate ``manifest["product"]`` and load whatever it lists.
* Every ``.nc`` holds exactly one named ``DataArray`` -> ``xr.open_dataarray``
  with ``engine="h5netcdf"``.
* Arrays are materialized with ``.load()`` immediately and their file handles
  closed, so later pixel-time-series clicks never hit a stale handle.
* Missing files / unreadable layers are logged and skipped, never fatal.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import xarray as xr


log = logging.getLogger("insar.folder_loader")

MANIFEST_NAME = "metadata.json"

# Dependencies for loading are intentionally limited to xarray + h5netcdf.
NETCDF_ENGINE = "h5netcdf"


class FolderProjectError(Exception):
    """Raised when a folder-format project cannot be loaded."""


def find_manifest(project_dir: Path) -> Path | None:
    """Return the ``metadata.json`` path if *project_dir* looks like a
    folder-format project, else ``None``.

    Searches the directory itself and one level of immediate sub-directories so
    a user can point the picker at either the results folder or its parent.
    """
    if not project_dir or not project_dir.exists() or not project_dir.is_dir():
        return None

    direct = project_dir / MANIFEST_NAME
    if direct.is_file():
        return direct

    try:
        for child in sorted(project_dir.iterdir()):
            if child.is_dir():
                candidate = child / MANIFEST_NAME
                if candidate.is_file():
                    return candidate
    except OSError:
        pass
    return None


def is_folder_project(project_dir: Path) -> bool:
    """True when *project_dir* (or an immediate child) contains a manifest."""
    return find_manifest(project_dir) is not None


def _norm_date(value) -> str:
    """Normalize a manifest date to ``YYYY-MM-DD`` (accepts ``YYYYMMDD``)."""
    text = str(value)
    if len(text) == 8 and text.isdigit():
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
    return text


def _resolve_dates(displacement, acquisition: dict) -> list[str]:
    """Date labels for the displacement cube.

    Per spec, ``metadata.acquisition.dates`` is the source of truth for labels
    -- we do not trust raw array index order alone. The loader sorts the cube by
    its date coordinate when present, then labels those ordered slices from the
    manifest when the counts match.
    """
    meta_dates = [_norm_date(d) for d in (acquisition.get("dates") or [])]

    if displacement is None:
        return meta_dates

    n = int(displacement.sizes.get("date", 0))
    if "date" in displacement.coords:
        try:
            coord = np.asarray(displacement.coords["date"].values)
            arr_dates = [np.datetime_as_string(v, unit="D") for v in coord]
            if arr_dates and (not meta_dates or len(meta_dates) != len(arr_dates)):
                return arr_dates
        except (ValueError, TypeError):
            pass

    if meta_dates and (n == 0 or len(meta_dates) == n):
        return meta_dates
    return meta_dates or [f"Epoch {i + 1}" for i in range(n)]


def load_folder_project(project_dir: Path) -> dict:
    """Read the manifest and load every layer it lists into memory.

    Returns a uniform in-memory model::

        {
          "root": Path, "manifest": {...},
          "method": "sbas", "geometry": "line-of-sight (LOS)",
          "units": {"velocity": "mm/year", ...},
          "dates": ["2024-06-02", ...],
          "layers": {"velocity": DataArray, "displacement": DataArray, ...},
          "acquisition": {...}, "processing": {...},
          "missing": ["landmask", ...],
        }
    """
    manifest_path = find_manifest(project_dir)
    if manifest_path is None:
        raise FolderProjectError(f"No {MANIFEST_NAME} found in: {project_dir}")

    root = manifest_path.parent
    try:
        with manifest_path.open("r", encoding="utf-8") as handle:
            manifest = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise FolderProjectError(f"Could not parse manifest: {manifest_path}") from exc

    product = manifest.get("product", {}) or {}
    acquisition = manifest.get("acquisition", {}) or {}
    processing = manifest.get("processing", {}) or {}

    layers: dict[str, xr.DataArray] = {}
    units: dict[str, str] = {}
    missing: list[str] = []

    for key, entry in product.items():
        # Non-layer entries such as "geometry": "..." or "note": "..." are scalars.
        if not isinstance(entry, dict):
            continue
        file_name = entry.get("file")
        var_name = entry.get("var")
        if not file_name or not var_name:
            continue

        path = root / file_name
        if not path.is_file():
            log.warning("Manifest lists layer '%s' -> %s, but file is missing; skipping.", key, file_name)
            missing.append(key)
            continue

        try:
            data_array = xr.open_dataarray(path, engine=NETCDF_ENGINE)
            # Materialize immediately, then drop the file handle. Grids are
            # small; this avoids stale-handle errors on later pixel clicks.
            data_array = data_array.load()
            data_array.close()
        except Exception as exc:  # noqa: BLE001 - tolerant by design
            log.warning("Could not load layer '%s' (%s): %s; skipping.", key, file_name, exc)
            missing.append(key)
            continue

        layers[key] = data_array
        if entry.get("units") is not None:
            units[key] = str(entry.get("units"))

    # Older folder manifests may omit the optional landmask even when
    # landmask.nc was exported beside metadata.json. Load it opportunistically
    # so water pixels can be excluded without requiring a manifest rewrite.
    if "landmask" not in layers:
        fallback_landmask = root / "landmask.nc"
        if fallback_landmask.is_file():
            try:
                data_array = xr.open_dataarray(fallback_landmask, engine=NETCDF_ENGINE)
                data_array = data_array.load()
                data_array.close()
                layers["landmask"] = data_array
                units["landmask"] = "0/1"
            except Exception as exc:  # noqa: BLE001 - optional by design
                log.warning("Could not load optional landmask (%s): %s; skipping.", fallback_landmask.name, exc)
                missing.append("landmask")

    if not layers:
        raise FolderProjectError(f"Manifest at {manifest_path} listed no loadable layers.")

    # Keep the displacement cube in chronological order (don't trust raw order).
    displacement = layers.get("displacement")
    if displacement is not None and "date" in displacement.coords:
        layers["displacement"] = displacement.sortby("date")
        displacement = layers["displacement"]

    # The upstream RMSE file stores per-pixel scatter with a sign; the quantity
    # we surface as a +/- uncertainty is its magnitude. Normalizing here keeps
    # the RMSE filter and the |v| > 2*rmse "significant" cut correct.
    if "rmse" in layers:
        layers["rmse"] = np.abs(layers["rmse"])

    geometry = product.get("geometry") or manifest.get("geometry")

    return {
        "root": root,
        "manifest_path": manifest_path,
        "manifest": manifest,
        "method": manifest.get("method"),
        "geometry": geometry,
        "units": units,
        "layers": layers,
        "dates": _resolve_dates(displacement, acquisition),
        "acquisition": acquisition,
        "processing": processing,
        "missing": missing,
    }


# ---------------------------------------------------------------------------
# Geographic lookup helpers (used by the pixel-inspect feature).
# Each array carries its own lat/lon coords, so lookups are geographic.
# ---------------------------------------------------------------------------

def value_at(model: dict, layer: str, lat: float, lon: float):
    """Nearest-pixel scalar value of a 2D *layer* at (lat, lon), or None."""
    data_array = model["layers"].get(layer)
    if data_array is None or "lat" not in data_array.coords or "lon" not in data_array.coords:
        return None
    try:
        value = float(data_array.sel(lat=lat, lon=lon, method="nearest"))
    except (KeyError, ValueError, TypeError):
        return None
    return value if np.isfinite(value) else None


def series_at(model: dict, lat: float, lon: float):
    """Displacement time series at the nearest pixel to (lat, lon).

    Returns ``(dates, values)`` where *dates* are the manifest-derived labels
    and *values* is a list aligned to them (None for non-finite samples).
    """
    dates = model.get("dates", [])
    displacement = model["layers"].get("displacement")
    if displacement is None:
        return dates, []
    try:
        selected = displacement.sel(lat=lat, lon=lon, method="nearest")
    except (KeyError, ValueError, TypeError):
        return dates, []
    raw = np.asarray(selected.values, dtype="float64").ravel()
    values = [float(v) if np.isfinite(v) else None for v in raw]
    return dates, values
