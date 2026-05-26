# Data Folder

Copy your processed InSAR project folder here and name it `project_D`.

Expected local layout:

```text
data/
└── project_D/
    ├── results_tight.nc
    ├── results_wide.nc
    ├── parameters.json
    ├── manifest.json
    └── geotiffs/
```

The app currently reads from `data/project_D`. To use a different folder, update
`PROJECT_DIR` in `app/main.py`.
