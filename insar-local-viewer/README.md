# InSAR Local Viewer

A portable local Flask web application for viewing the core user-facing outputs
from a processed InSAR/SBAS project:

- LOS velocity map
- LOS deformation/displacement map by acquisition date
- Coherence map
- Coherence-based visual filtering for velocity and deformation

The app is intentionally focused on map inspection for non-specialist users. It
does not expose advanced NetCDF browsing or secondary scientific layers in the
main UI.

## Run on Windows

From this folder, run either:

```bat
run.bat
```

or:

```powershell
.\run.ps1
```

The script will:

1. Create `.venv` if it does not exist.
2. Activate the virtual environment.
3. Install `requirements.txt`.
4. Start the Flask app at `http://127.0.0.1:5000`.

If PowerShell blocks scripts on your machine, run this once in the same terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then run:

```powershell
.\run.ps1
```

## Where to place data

You can open a project from the application menu:

```text
File > Open Project...
```

This opens a native Windows folder picker from the local Flask backend. Select
the processed project folder that contains the NetCDF result file.

You can also copy your processed project folder into the default location:

```text
data/project_D/
```

Expected structure:

```text
data/project_D/
├── results_tight.nc
├── results_wide.nc
├── parameters.json
├── manifest.json
└── geotiffs/
```

The default project path is configured in `app/main.py`:

```python
DEFAULT_PROJECT_DIR = BASE_DIR / "data" / "project_D"
```

Then start the app and choose `File > Open Project...`, or keep using the
default project path in `app/main.py`.

## NetCDF Selection Order

The app automatically selects the first available file in this order:

1. `results_tight.nc`
2. `results_aoi_masked.nc`
3. `results_wide.nc`
4. First available `.nc` file in the project folder

## Supported Products

The viewer keeps the main UI limited to:

- `Velocity`: LOS velocity in mm/year
- `Deformation`: cumulative LOS displacement in mm for the selected acquisition date
- `Coherence`: unitless reliability from 0 to 1

The code prefers these NetCDF variables when available:

- Velocity: `sbas_velocity_masked`, then `sbas_velocity_raw`
- Deformation: `sbas_displacement_masked`, then `sbas_displacement_raw`
- Coherence: `coherence_median`, then `coherence_mean`

Raw variable names are used internally and are not presented as primary layer
choices in the normal UI.

## What This Version Can Do

- Load a local processed project folder.
- Select the best available NetCDF result file.
- Render velocity, deformation, and coherence as pixel-based canvas maps.
- Preserve the processed grid extent and resolution from `lat` and `lon`.
- Switch deformation by acquisition date.
- Apply an interactive coherence threshold to velocity and deformation maps.
- Show a dynamic legend for the active product.
- Click a map pixel to inspect latitude, longitude, velocity, coherence,
  current deformation, and whether the pixel passes the current visual filter.
- Plot a simple deformation time series for the selected pixel.

## Important Caveats

- LOS means line-of-sight motion relative to the satellite.
- Positive and negative values depend on satellite viewing geometry.
- Deformation is relative to the processing reference date or reference point.
- Coherence indicates reliability; low-coherence pixels may be noisy.
- The coherence threshold is only a visual filter. It does not modify, delete,
  overwrite, or reprocess NetCDF data.

## Not Implemented Yet

- DEM map layer
- RMSE map layer
- Valid pixel mask layer
- GeoTIFF viewer
- Export tools
- Advanced NetCDF browser
- Scientific debug mode
- Multi-layer overlay blending
- Atmospheric/noise diagnostics
- GNSS correction or absolute displacement calibration
- User accounts
- Report generation
- Alerting
- Drawing or editing AOIs

## API Endpoints

`GET /`

Serves the main HTML page.

`POST /api/project`

Sets the current project folder for the local Flask process. Use an empty
`project_path` to return to `data/project_D`.

`GET /api/project-info`

Returns selected file, grid counts, dates, product availability, and geographic
bounds.

`POST /api/browse-folder`

Opens a native local folder picker and sets the current project folder to the
selected directory. This endpoint is intended for local desktop use only.

`GET /api/map-data`

Returns the core map products needed by the browser viewer: velocity,
deformation, coherence, lat/lon axes, dates, bounds, and display ranges.

`GET /api/layer-summary?layer=sbas_velocity_masked`

Legacy inspection endpoint for basic 2D layer statistics.

## Troubleshooting

If the UI shows an error, check that:

- The project folder exists.
- The folder contains at least one `.nc` file.
- The NetCDF file can be opened by xarray/netCDF4.
- The dataset contains `lat` and `lon` coordinates.
- Velocity, deformation, and coherence products are present.
