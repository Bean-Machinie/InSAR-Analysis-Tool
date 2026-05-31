import json
import csv
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
FERRETTI_POINTS_FILENAMES = [
    "ferretti_ps_final_points.csv",
]
FERRETTI_TIMESERIES_FILENAME = "ferretti_ps_deformation_timeseries_wide.csv"
FERRETTI_MANIFEST_FILENAME = "ferretti_ps_final_manifest.json"


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
    ferretti_dir = _select_ferretti_project_dir(project_dir)
    if ferretti_dir is not None:
        return _get_ferretti_project_info(ferretti_dir)

    selected_file, dataset = open_dataset(project_dir)
    try:
        resolved_project_dir = selected_file.parent
        lat = _coord_values(dataset, "lat")
        lon = _coord_values(dataset, "lon")
        dates = _date_strings(dataset)
        products = _resolve_products(dataset)
        metadata = _read_project_metadata(resolved_project_dir)
        ps_points = _read_ps_points(resolved_project_dir, include_points=False)

        return {
            "project_path": str(resolved_project_dir),
            "selected_file": str(selected_file),
            "dataset_file": selected_file.name,
            "products": {
                "velocity": products["velocity"] is not None,
                "deformation": products["deformation"] is not None,
                "coherence": products["coherence"] is not None,
                "terrain": products["dem"] is not None,
                "ps_points": ps_points["available"],
            },
            "lat_count": int(lat.size),
            "lon_count": int(lon.size),
            "date_count": int(len(dates)),
            "dates": dates,
            "bounds": _bounds(lat, lon),
            "pixel_footprint_m": _pixel_footprints_m(resolved_project_dir),
            "metadata": metadata,
            "ps_points": {
                "available": ps_points["available"],
                "count": ps_points["count"],
                "geocoded_count": ps_points["geocoded_count"],
            },
        }
    finally:
        dataset.close()


def get_map_data(project_dir: Path) -> dict:
    ferretti_dir = _select_ferretti_project_dir(project_dir)
    if ferretti_dir is not None:
        return _get_ferretti_map_data(ferretti_dir)

    selected_file, dataset = open_dataset(project_dir)
    try:
        resolved_project_dir = selected_file.parent
        lat = _coord_values(dataset, "lat")
        lon = _coord_values(dataset, "lon")
        dates = _date_strings(dataset)
        products = _resolve_products(dataset)
        ps_points = _read_ps_points(resolved_project_dir)

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
                "ps_points": ps_points,
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
    for filename in ["parameters.json", "manifest.json", "sbas_results_metadata.json", FERRETTI_MANIFEST_FILENAME]:
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


def _select_ferretti_project_dir(project_dir: Path) -> Path | None:
    if not project_dir.exists() or not project_dir.is_dir():
        return None

    candidates = [project_dir]
    candidates.extend(path for path in sorted(project_dir.glob(f"**/{FERRETTI_MANIFEST_FILENAME}")) if path.is_file())

    for candidate in candidates:
        candidate_dir = candidate if candidate.is_dir() else candidate.parent
        if not (candidate_dir / FERRETTI_MANIFEST_FILENAME).exists():
            continue
        points_path = next((candidate_dir / filename for filename in FERRETTI_POINTS_FILENAMES if (candidate_dir / filename).exists()), None)
        if points_path is None:
            continue
        with points_path.open(newline="", encoding="utf-8") as file:
            fields = csv.DictReader(file).fieldnames or []
        if {"longitude", "latitude"}.issubset(fields):
            return candidate_dir
    return None


def _get_ferretti_project_info(project_dir: Path) -> dict:
    ps_points = _read_ps_points(project_dir, include_points=False)
    dates, _ = _read_ps_timeseries_wide(project_dir / FERRETTI_TIMESERIES_FILENAME)
    bounds = _ps_bounds(project_dir)
    points_file, _, _ = _ps_source_files(project_dir)
    return {
        "project_path": str(project_dir),
        "selected_file": str(points_file),
        "dataset_file": points_file.name,
        "dataset_kind": "ferretti_ps",
        "products": {
            "velocity": False,
            "deformation": False,
            "coherence": False,
            "terrain": False,
            "ps_points": True,
        },
        "lat_count": 0,
        "lon_count": 0,
        "date_count": len(dates),
        "dates": dates,
        "bounds": bounds,
        "pixel_footprint_m": _pixel_footprints_m(project_dir),
        "metadata": _read_project_metadata(project_dir),
        "ps_points": {
            "available": True,
            "count": ps_points["count"],
            "geocoded_count": ps_points["geocoded_count"],
        },
    }


def _get_ferretti_map_data(project_dir: Path) -> dict:
    ps_points = _read_ps_points(project_dir)
    dates = ps_points["dates"]
    points_file, _, _ = _ps_source_files(project_dir)
    pair_count = max((point.get("valid_pair_count") or 0 for point in ps_points["points"]), default=0)
    empty_range = {"min": None, "max": None, "p02": None, "p98": None}
    return {
        "project": {
            "project_path": str(project_dir),
            "selected_file": str(points_file),
            "dataset_file": points_file.name,
            "dataset_kind": "ferretti_ps",
            "lat_count": 0,
            "lon_count": 0,
            "date_count": len(dates),
            "bounds": _ps_bounds(project_dir),
            "pixel_footprint_m": _pixel_footprints_m(project_dir),
            "last_updated": _project_last_updated(project_dir),
        },
        "dates": dates,
        "lat": [],
        "lon": [],
        "layers": {
            "velocity": {"values": [], "range": empty_range, "unit": "mm/year"},
            "deformation": {"values": [], "range": empty_range, "unit": "mm"},
            "coherence": {"values": [], "stack": [], "pairs": [], "pair_baselines_days": [], "stack_kind": "summary", "range": empty_range, "unit": "unitless"},
            "rmse": {"values": [], "unit": "mm"},
            "coherence_stability": {"values": [], "unit": "unitless"},
            "n_good_pairs": {"values": [], "unit": "count", "n_pairs_total": pair_count},
            "terrain": {"values": None, "range": empty_range, "unit": "m", "source": "flat-fallback"},
            "ps_points": ps_points,
        },
    }


def _ps_source_files(project_dir: Path):
    standard_csv = project_dir / "ps_points" / "ps_points.csv"
    if standard_csv.exists():
        return standard_csv, project_dir / "ps_points" / "ps_timeseries_wide.csv", "sbas_ps"

    for filename in FERRETTI_POINTS_FILENAMES:
        csv_path = project_dir / filename
        if csv_path.exists():
            return csv_path, project_dir / FERRETTI_TIMESERIES_FILENAME, "ferretti_ps"
    return None, None, None


def _ps_bounds(project_dir: Path):
    csv_path, _, _ = _ps_source_files(project_dir)
    lat = []
    lon = []
    with csv_path.open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            row_lat = _first_optional_float(row, ["lat", "latitude"])
            row_lon = _first_optional_float(row, ["lon", "longitude"])
            if row_lat is not None and row_lon is not None:
                lat.append(row_lat)
                lon.append(row_lon)
    if not lat or not lon:
        raise ProjectDataError(f"No geocoded PS points found in project folder: {project_dir}")
    return _bounds(np.asarray(lat), np.asarray(lon))


def _read_ps_points(project_dir: Path, include_points: bool = True) -> dict:
    csv_path, timeseries_path, source = _ps_source_files(project_dir)
    footprint = _pixel_footprints_m(project_dir)
    if csv_path is None:
        return {
            "available": False,
            "source": None,
            "count": 0,
            "geocoded_count": 0,
            "pixel_width_m": footprint["ps"]["width_m"],
            "pixel_height_m": footprint["ps"]["height_m"],
            "dates": [],
            "points": [],
            "ranges": _ps_empty_ranges(),
        }

    ps_dates, ps_timeseries = _read_ps_timeseries_wide(timeseries_path) if include_points else ([], {})
    points = []
    total = 0
    metric_values = {key: [] for key in _ps_metric_columns()}

    with csv_path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            total += 1
            lon = _first_optional_float(row, ["lon", "longitude"])
            lat = _first_optional_float(row, ["lat", "latitude"])
            if lon is None or lat is None:
                continue

            point = {
                "ps_id": _first_optional_int(row, ["ps_id", "point_id"]),
                "lon": lon,
                "lat": lat,
                "velocity_mm_yr": _first_optional_float(row, ["velocity_mm_yr", "velocity_relative_mm_yr"]),
                "displacement_last_mm": _optional_float(row.get("displacement_last_mm")),
                "displacement_delta_mm": _optional_float(row.get("displacement_delta_mm")),
                "rmse_mm": _first_optional_float(row, ["rmse_mm", "rmse_rad", "residual_rmse_after_aps_rad"]),
                "rmse_unit": "rad" if _first_optional_float(row, ["rmse_rad", "residual_rmse_after_aps_rad"]) is not None else "mm",
                "psf": _first_optional_float(row, ["psf", "amplitude_dispersion_index"]),
                "corr_median": _first_optional_float(row, ["corr_median", "gamma", "residual_gamma_after_aps"]),
                "corr_mean": _optional_float(row.get("corr_mean")),
                "valid_pair_count": _optional_int(row.get("valid_pair_count")),
                "first_date": row.get("first_date") or None,
                "last_date": row.get("last_date") or None,
                "dem_error_m": _first_optional_float(row, ["dem_error_m", "height_relative_m"]),
                "gamma": _first_optional_float(row, ["gamma", "residual_gamma_after_aps"]),
                "amplitude_dispersion_index": _optional_float(row.get("amplitude_dispersion_index")),
                "is_reference_ps": _optional_bool(row.get("is_reference_ps")),
                "reference_ps_id": _optional_int(row.get("reference_ps_id")),
            }
            if include_points:
                point["timeseries"] = ps_timeseries.get(point["ps_id"], [])
                if point["timeseries"]:
                    point["displacement_last_mm"] = point["timeseries"][-1]
                    valid_values = [value for value in point["timeseries"] if value is not None]
                    if valid_values:
                        point["displacement_delta_mm"] = valid_values[-1] - valid_values[0]
            for key in metric_values:
                value = point.get(key)
                if value is not None:
                    metric_values[key].append(value)
            if include_points:
                points.append(point)

    return {
        "available": True,
        "source": source,
        "count": total,
        "geocoded_count": len(points) if include_points else sum(1 for _ in _iter_geocoded_ps_rows(csv_path)),
        "pixel_width_m": footprint["ps"]["width_m"],
        "pixel_height_m": footprint["ps"]["height_m"],
        "dates": ps_dates,
        "points": points,
        "ranges": {
            key: _robust_range(np.asarray(values, dtype=float), center_zero=key in {"velocity_mm_yr", "displacement_last_mm", "displacement_delta_mm"})
            for key, values in metric_values.items()
        },
    }


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

    ps_width_m = 3.4
    ps_height_m = 13.5
    return {
        "ps": {
            "width_m": ps_width_m,
            "height_m": ps_height_m,
            "source": "fallback:intf_ps_median_spacing",
        },
        "sbas": {
            "width_m": ps_width_m * coarsen_x,
            "height_m": ps_height_m * coarsen_y,
            "coarsen": [coarsen_y, coarsen_x],
            "source": "ps_footprint_times_sbas_coarsen",
        },
    }


def _read_ps_timeseries_wide(csv_path: Path | None):
    if csv_path is None or not csv_path.exists():
        return [], {}

    with csv_path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        fields = reader.fieldnames or []
        date_fields = [field for field in fields if field.startswith("d_") or _is_iso_date(field)]
        dates = [f"{field[2:6]}-{field[6:8]}-{field[8:10]}" if field.startswith("d_") else field for field in date_fields]
        series_by_id = {}
        for row in reader:
            ps_id = _first_optional_int(row, ["ps_id", "point_id"])
            if ps_id is None:
                continue
            series_by_id[ps_id] = [_optional_float(row.get(field)) for field in date_fields]
    return dates, series_by_id


def _iter_geocoded_ps_rows(csv_path: Path):
    with csv_path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if _first_optional_float(row, ["lon", "longitude"]) is not None and _first_optional_float(row, ["lat", "latitude"]) is not None:
                yield row


def _ps_metric_columns():
    return [
        "velocity_mm_yr",
        "displacement_last_mm",
        "displacement_delta_mm",
        "rmse_mm",
        "psf",
        "corr_median",
        "corr_mean",
        "valid_pair_count",
    ]


def _ps_empty_ranges():
    return {key: {"min": None, "max": None, "p02": None, "p98": None} for key in _ps_metric_columns()}


def _optional_float(value):
    if value is None or value == "":
        return None
    try:
        return _finite_float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value):
    parsed = _optional_float(value)
    return None if parsed is None else int(parsed)


def _optional_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"true", "1", "yes"}:
        return True
    if text in {"false", "0", "no"}:
        return False
    return None


def _first_optional_float(row, keys):
    for key in keys:
        value = _optional_float(row.get(key))
        if value is not None:
            return value
    return None


def _first_optional_int(row, keys):
    value = _first_optional_float(row, keys)
    return None if value is None else int(value)


def _is_iso_date(value):
    try:
        np.datetime64(value, "D")
        return len(value) == 10 and value[4] == "-" and value[7] == "-"
    except (TypeError, ValueError):
        return False


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
