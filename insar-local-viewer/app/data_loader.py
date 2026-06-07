import json
from pathlib import Path

import numpy as np
import xarray as xr


NETCDF_PRIORITY = [
    "results_tight.nc",
    "results_aoi_masked.nc",
    "results_wide.nc",
]

VELOCITY_CANDIDATES = ["sbas_velocity_raw", "sbas_velocity_masked"]
DISPLACEMENT_CANDIDATES = ["sbas_displacement_raw", "sbas_displacement_masked"]
COHERENCE_CANDIDATES = ["coherence_median", "coherence_mean"]
RMSE_CANDIDATES = ["sbas_rmse_raw", "sbas_rmse_masked"]
DEM_CANDIDATES = ["dem", "elevation", "topography"]
COHERENCE_STACK_NAME = "coherence_stack"
COHERENCE_DATE_STACK_CANDIDATES = ["coherence_per_date", "pairwise_coherence_attributed_to_date"]


class ProjectDataError(Exception):
    """Raised when project data cannot be loaded or inspected."""


def select_netcdf_file(project_dir: Path) -> Path:
    if not project_dir.exists():
        raise ProjectDataError(f"Project folder does not exist: {project_dir}")

    if not project_dir.is_dir():
        raise ProjectDataError(f"Project path is not a folder: {project_dir}")

    for candidate_dir in _candidate_project_dirs(project_dir):
        for filename in NETCDF_PRIORITY:
            candidate = candidate_dir / filename
            if candidate.exists():
                return candidate

        netcdf_files = sorted(candidate_dir.glob("*.nc"))
        if netcdf_files:
            return netcdf_files[0]

    nested_files = sorted(project_dir.glob("**/*.nc"))
    if nested_files:
        for filename in NETCDF_PRIORITY:
            for candidate in nested_files:
                if candidate.name == filename:
                    return candidate
        return nested_files[0]

    raise ProjectDataError(f"No NetCDF files found in project folder: {project_dir}")


def _candidate_project_dirs(project_dir: Path) -> list[Path]:
    candidates = [
        project_dir,
        project_dir / "outputs" / "project_D",
    ]

    outputs_dir = project_dir / "outputs"
    if outputs_dir.exists():
        candidates.extend(path for path in sorted(outputs_dir.iterdir()) if path.is_dir())

    candidates.extend(project_dir.parents[:3])

    unique_candidates = []
    seen = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if resolved in seen or not resolved.exists() or not resolved.is_dir():
            continue
        seen.add(resolved)
        unique_candidates.append(resolved)
    return unique_candidates


def open_dataset(project_dir: Path):
    selected_file = select_netcdf_file(project_dir)
    try:
        return selected_file, xr.open_dataset(selected_file)
    except Exception as exc:
        raise ProjectDataError(f"Invalid or unreadable NetCDF file: {selected_file}") from exc


def get_project_info(project_dir: Path) -> dict:
    selected_file, dataset = open_dataset(project_dir)
    try:
        resolved_project_dir = selected_file.parent
        lat = _coord_values(dataset, "lat")
        lon = _coord_values(dataset, "lon")
        dates = _date_strings(dataset)
        products = _resolve_products(dataset)
        metadata = _read_project_metadata(resolved_project_dir)

        return {
            "project_path": str(resolved_project_dir),
            "selected_file": str(selected_file),
            "dataset_file": selected_file.name,
            "products": {
                "velocity": products["velocity"] is not None,
                "deformation": products["deformation"] is not None,
                "coherence": products["coherence"] is not None,
                "terrain": products["dem"] is not None,
            },
            "lat_count": int(lat.size),
            "lon_count": int(lon.size),
            "date_count": int(len(dates)),
            "dates": dates,
            "bounds": _bounds(lat, lon),
            "pixel_footprint_m": _pixel_footprints_m(resolved_project_dir),
            "metadata": metadata,
        }
    finally:
        dataset.close()


def get_map_data(project_dir: Path) -> dict:
    selected_file, dataset = open_dataset(project_dir)
    try:
        resolved_project_dir = selected_file.parent
        lat = _coord_values(dataset, "lat")
        lon = _coord_values(dataset, "lon")
        dates = _date_strings(dataset)
        products = _resolve_products(dataset)

        _require_product(products, "velocity")
        _require_product(products, "deformation")
        _require_product(products, "coherence")
        _require_product(products, "rmse")

        velocity = _read_2d(dataset, products["velocity"])
        coherence = _read_2d(dataset, products["coherence"])
        displacement = _read_3d(dataset, products["deformation"])
        rmse = _read_2d(dataset, products["rmse"])
        dem = _read_optional_2d(dataset, products["dem"])
        coherence_stack, coherence_labels, coherence_baselines, coherence_stack_kind = _read_coherence_display_stack(
            dataset,
            products,
            coherence,
            dates,
        )
        n_pairs_total = int(coherence_stack.shape[0])
        coherence_stability = coherence_stack.std(axis=0).astype("float32")
        n_good_pairs = (coherence_stack >= 0.3).sum(axis=0).astype("int16")

        return {
            "project": {
                "project_path": str(resolved_project_dir),
                "selected_file": str(selected_file),
                "dataset_file": selected_file.name,
                "lat_count": int(lat.size),
                "lon_count": int(lon.size),
                "date_count": int(len(dates)),
                "bounds": _bounds(lat, lon),
                "pixel_footprint_m": _pixel_footprints_m(resolved_project_dir),
                "last_updated": _project_last_updated(resolved_project_dir),
            },
            "dates": dates,
            "lat": _axis_to_json(lat),
            "lon": _axis_to_json(lon),
            "layers": {
                "velocity": {
                    "values": _array_to_json(velocity),
                    "range": _robust_range(velocity, center_zero=True),
                    "unit": "mm/year",
                },
                "deformation": {
                    "values": _array_to_json(displacement),
                    "range": _robust_range(displacement, center_zero=True),
                    "unit": "mm",
                },
                "coherence": {
                    "values": _array_to_json(coherence),
                    "stack": _array_to_json(coherence_stack),
                    "pairs": coherence_labels,
                    "pair_baselines_days": coherence_baselines,
                    "stack_kind": coherence_stack_kind,
                    "range": {"min": 0.0, "max": 1.0, "p02": 0.0, "p98": 1.0},
                    "unit": "unitless",
                },
                "rmse": {
                    "values": _array_to_json(rmse),
                    "unit": "mm",
                },
                "coherence_stability": {
                    "values": _array_to_json(coherence_stability),
                    "unit": "unitless",
                },
                "n_good_pairs": {
                    "values": _array_to_json(n_good_pairs),
                    "unit": "count",
                    "n_pairs_total": n_pairs_total,
                },
                "terrain": {
                    "values": _array_to_json(dem) if dem is not None else None,
                    "range": _robust_range(dem) if dem is not None else {"min": None, "max": None, "p02": None, "p98": None},
                    "unit": "m",
                    "source": products["dem"] or "flat-fallback",
                },
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


def _coord_values(dataset, coord_name: str):
    if coord_name not in dataset.coords:
        raise ProjectDataError(f"Missing required coordinate: {coord_name}")
    values = np.asarray(dataset.coords[coord_name].values, dtype=float)
    if values.ndim != 1 or values.size == 0:
        raise ProjectDataError(f"Coordinate must be a non-empty 1D axis: {coord_name}")
    return values


def _date_strings(dataset):
    if "date" not in dataset.coords:
        return []
    values = np.asarray(dataset.coords["date"].values)
    return [np.datetime_as_string(value, unit="D") for value in values]


def _pair_strings(dataset):
    if "pair" not in dataset.coords:
        return []
    values = np.asarray(dataset.coords["pair"].values)
    return [str(value) for value in values]


def _pair_baseline_days(pair_label: str):
    parts = str(pair_label).split()
    if len(parts) < 2:
        return None
    try:
        start = np.datetime64(parts[0], "D")
        end = np.datetime64(parts[1], "D")
    except ValueError:
        return None
    return int(abs((end - start).astype("timedelta64[D]").astype(int)))


def _resolve_products(dataset):
    return {
        "velocity": _first_existing_var(dataset, VELOCITY_CANDIDATES),
        "deformation": _first_existing_var(dataset, DISPLACEMENT_CANDIDATES),
        "coherence": _first_existing_var(dataset, COHERENCE_CANDIDATES),
        "rmse": _first_existing_var(dataset, RMSE_CANDIDATES),
        "dem": _first_existing_var(dataset, DEM_CANDIDATES),
        "coherence_stack": COHERENCE_STACK_NAME if COHERENCE_STACK_NAME in dataset.data_vars else None,
        "coherence_date_stack": _first_existing_var(dataset, COHERENCE_DATE_STACK_CANDIDATES),
    }


def _first_existing_var(dataset, names):
    for name in names:
        if name in dataset.data_vars:
            return name
    return None


def _require_product(products, product_name):
    if products[product_name] is None:
        raise ProjectDataError(f"Required product is not available: {product_name}")


def _read_2d(dataset, variable_name):
    variable = dataset[variable_name]
    if variable.ndim != 2 or set(variable.dims) != {"lat", "lon"}:
        raise ProjectDataError(f"Expected {variable_name} to be a 2D lat/lon layer")
    return np.asarray(variable.transpose("lat", "lon").values, dtype=float)


def _read_optional_2d(dataset, variable_name):
    if variable_name is None:
        return None
    return _read_2d(dataset, variable_name)


def _read_3d(dataset, variable_name):
    variable = dataset[variable_name]
    if variable.ndim != 3 or set(variable.dims) != {"date", "lat", "lon"}:
        raise ProjectDataError(f"Expected {variable_name} to be a 3D date/lat/lon layer")
    return np.asarray(variable.transpose("date", "lat", "lon").values, dtype=float)


def _read_coherence_stack(dataset, variable_name):
    variable = dataset[variable_name]
    if variable.ndim != 3 or set(variable.dims) != {"pair", "lat", "lon"}:
        raise ProjectDataError(f"Expected {variable_name} to be a 3D pair/lat/lon layer")
    return np.asarray(variable.transpose("pair", "lat", "lon").values, dtype=float)


def _read_coherence_display_stack(dataset, products, coherence_2d, dates):
    if products["coherence_stack"]:
        coherence_stack = _read_coherence_stack(dataset, products["coherence_stack"])
        coherence_pairs = _pair_strings(dataset)
        return (
            coherence_stack,
            coherence_pairs,
            [_pair_baseline_days(pair) for pair in coherence_pairs],
            "pair",
        )

    if products["coherence_date_stack"]:
        coherence_stack = _read_3d(dataset, products["coherence_date_stack"])
        labels = dates or [f"Slice {index + 1}" for index in range(coherence_stack.shape[0])]
        return (
            coherence_stack,
            labels,
            [None for _ in labels],
            "date",
        )

    return (
        np.asarray(coherence_2d, dtype=float)[np.newaxis, :, :],
        ["Median coherence"],
        [None],
        "summary",
    )


def _bounds(lat, lon):
    return {
        "lat_min": _finite_float(np.nanmin(lat)),
        "lat_max": _finite_float(np.nanmax(lat)),
        "lon_min": _finite_float(np.nanmin(lon)),
        "lon_max": _finite_float(np.nanmax(lon)),
    }


def _read_project_metadata(project_dir: Path):
    metadata = {}
    for filename in ["parameters.json", "manifest.json", "sbas_results_metadata.json"]:
        path = project_dir / filename
        if not path.exists():
            continue
        try:
            with path.open("r", encoding="utf-8") as file:
                metadata[filename] = json.load(file)
        except Exception:
            metadata[filename] = {"warning": "Metadata file could not be read"}
    return metadata


def _project_last_updated(project_dir: Path):
    metadata = _read_project_metadata(project_dir)
    parameters = metadata.get("parameters.json", {})
    manifest = metadata.get("manifest.json", {})
    return parameters.get("processing_date") or manifest.get("created") or manifest.get("created_utc")


def _axis_to_json(values):
    return [_finite_float(value) for value in values]


def _array_to_json(values):
    array = np.asarray(values, dtype=float)
    if array.ndim == 2:
        return [[_finite_float(value) for value in row] for row in array]
    if array.ndim == 3:
        return [[[_finite_float(value) for value in row] for row in plane] for plane in array]
    raise ProjectDataError("Only 2D and 3D arrays can be serialized for map display")


def _pixel_footprints_m(project_dir: Path):
    metadata = _read_project_metadata(project_dir)
    processing = metadata.get("sbas_results_metadata.json", {}).get("processing", {})
    coarsen = processing.get("sbas_coarsen") or [1, 1]
    try:
        coarsen_y = float(coarsen[0])
        coarsen_x = float(coarsen[1])
    except (TypeError, ValueError, IndexError):
        coarsen_y = 1.0
        coarsen_x = 1.0

    base_width_m = 3.4
    base_height_m = 13.5
    return {
        "sbas": {
            "width_m": base_width_m * coarsen_x,
            "height_m": base_height_m * coarsen_y,
            "coarsen": [coarsen_y, coarsen_x],
            "source": "sbas_coarsened_pixel_footprint",
        },
    }


def _robust_range(values, center_zero=False):
    array = np.asarray(values, dtype=float)
    valid = array[np.isfinite(array)]
    if valid.size == 0:
        return {"min": None, "max": None, "p02": None, "p98": None}

    p02 = float(np.nanpercentile(valid, 2))
    p98 = float(np.nanpercentile(valid, 98))
    if center_zero:
        extent = max(abs(p02), abs(p98))
        p02 = -extent
        p98 = extent

    return {
        "min": _finite_float(np.nanmin(valid)),
        "max": _finite_float(np.nanmax(valid)),
        "p02": _finite_float(p02),
        "p98": _finite_float(p98),
    }


def _finite_float(value):
    value = float(value)
    return value if np.isfinite(value) else None
