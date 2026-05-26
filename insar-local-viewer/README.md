# InSAR Local Viewer

A small local Flask application for inspecting processed InSAR/SBAS project data.

This first version opens a local project folder, selects the best available NetCDF
file, lists variables and coordinates, and returns summary statistics for selected
2D layers. It does not render maps or rasters yet.

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

Copy your processed project folder into:

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
PROJECT_DIR = BASE_DIR / "data" / "project_D"
```

You can update that value if your local data lives somewhere else.

## NetCDF selection order

The app automatically selects the first available file in this order:

1. `results_tight.nc`
2. `results_aoi_masked.nc`
3. `results_wide.nc`
4. First available `.nc` file in the project folder

## What this version can do

- Start a local Flask web app.
- Open a local processed InSAR project folder.
- Select a NetCDF file automatically.
- Show available variables and coordinate names.
- Show lat/lon/date counts.
- Show geographic bounds from `lat` and `lon`.
- Return basic statistics for selected 2D layers.

## Not implemented yet

- Map rendering.
- Leaflet integration.
- Canvas raster rendering.
- Pixel clicking.
- File uploads.
- Browser-based project folder picker.
- Time-series visualization.

## API endpoints

`GET /`

Serves the main HTML page.

`GET /api/project-info`

Returns project metadata, variables, coordinates, counts, and bounds.

`GET /api/layer-summary?layer=sbas_velocity_masked`

Returns summary statistics for a selected 2D layer.

## Troubleshooting

If the UI shows an error, check that:

- `data/project_D/` exists.
- The folder contains at least one `.nc` file.
- The NetCDF file can be opened by xarray/netCDF4.
- The dataset contains `lat` and `lon` coordinates.
- The selected layer exists and is 2D.
