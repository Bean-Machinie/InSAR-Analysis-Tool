from pathlib import Path

import numpy as np
import xarray as xr


NETCDF_PRIORITY = [
    "results_tight.nc",
    "results_aoi_masked.nc",
    "results_wide.nc",
]


class ProjectDataError(Exception):
    """Raised when project data cannot be loaded or inspected."""


def select_netcdf_file(project_dir: Path) -> Path:
    if not project_dir.exists():
        raise ProjectDataError(f"Project folder does not exist: {project_dir}")

    if not project_dir.is_dir():
        raise ProjectDataError(f"Project path is not a folder: {project_dir}")

    for filename in NETCDF_PRIORITY:
        candidate = project_dir / filename
        if candidate.exists():
            return candidate

    netcdf_files = sorted(project_dir.glob("*.nc"))
    if netcdf_files:
        return netcdf_files[0]

    raise ProjectDataError(f"No NetCDF files found in project folder: {project_dir}")


def open_dataset(project_dir: Path):
    selected_file = select_netcdf_file(project_dir)
    try:
        return selected_file, xr.open_dataset(selected_file)
    except Exception as exc:
        raise ProjectDataError(f"Invalid or unreadable NetCDF file: {selected_file}") from exc


def get_coord_values(dataset, coord_name: str):
    if coord_name not in dataset.coords:
        raise ProjectDataError(f"Missing required coordinate: {coord_name}")
    return dataset.coords[coord_name].values


def get_project_info(project_dir: Path) -> dict:
    selected_file, dataset = open_dataset(project_dir)
    try:
        lat = get_coord_values(dataset, "lat")
        lon = get_coord_values(dataset, "lon")
        dates = dataset.coords["date"].values if "date" in dataset.coords else []

        return {
            "project_path": str(project_dir),
            "selected_file": str(selected_file),
            "available_variables": sorted(list(dataset.data_vars)),
            "coordinates": sorted(list(dataset.coords)),
            "lat_count": int(lat.size),
            "lon_count": int(lon.size),
            "date_count": int(np.asarray(dates).size),
            "bounds": {
                "lat_min": _finite_float(np.nanmin(lat)),
                "lat_max": _finite_float(np.nanmax(lat)),
                "lon_min": _finite_float(np.nanmin(lon)),
                "lon_max": _finite_float(np.nanmax(lon)),
            },
        }
    finally:
        dataset.close()


def get_layer_summary(project_dir: Path, layer_name: str) -> dict:
    if not layer_name:
        raise ProjectDataError("Missing required query parameter: layer")

    _, dataset = open_dataset(project_dir)
    try:
        if layer_name not in dataset.data_vars:
            raise ProjectDataError(f"Selected layer not found: {layer_name}")

        layer = dataset[layer_name]
        if layer.ndim != 2:
            raise ProjectDataError(
                f"Selected layer is not 2D: {layer_name} has dimensions {list(layer.dims)}"
            )

        values = np.asarray(layer.values, dtype=float)
        valid_mask = np.isfinite(values)
        valid_values = values[valid_mask]

        summary = {
            "layer": layer_name,
            "shape": [int(size) for size in values.shape],
            "valid_pixels": int(valid_mask.sum()),
            "nan_pixels": int(values.size - valid_mask.sum()),
            "min": None,
            "max": None,
            "mean": None,
            "p02": None,
            "p98": None,
        }

        if valid_values.size:
            summary.update(
                {
                    "min": _finite_float(np.nanmin(valid_values)),
                    "max": _finite_float(np.nanmax(valid_values)),
                    "mean": _finite_float(np.nanmean(valid_values)),
                    "p02": _finite_float(np.nanpercentile(valid_values, 2)),
                    "p98": _finite_float(np.nanpercentile(valid_values, 98)),
                }
            )

        return summary
    finally:
        dataset.close()


def _finite_float(value):
    value = float(value)
    return value if np.isfinite(value) else None
