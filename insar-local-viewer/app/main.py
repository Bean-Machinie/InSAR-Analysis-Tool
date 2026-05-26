from pathlib import Path
import threading

from flask import Flask, jsonify, render_template, request

from data_loader import (
    ProjectDataError,
    get_layer_summary,
    get_map_data,
    get_project_info,
)


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_PROJECT_DIR = BASE_DIR / "data" / "project_D"

app = Flask(__name__)
app.config["PROJECT_DIR"] = DEFAULT_PROJECT_DIR


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/project", methods=["POST"])
def load_project():
    payload = request.get_json(silent=True) or {}
    project_path = str(payload.get("project_path", "")).strip()

    if not project_path:
        app.config["PROJECT_DIR"] = DEFAULT_PROJECT_DIR
    else:
        candidate = Path(project_path).expanduser()
        if not candidate.is_absolute():
            candidate = BASE_DIR / candidate
        app.config["PROJECT_DIR"] = candidate.resolve()

    return _json_response(lambda: get_project_info(_current_project_dir()))


@app.route("/api/browse-folder", methods=["POST"])
def browse_folder():
    try:
        selected_path = _open_folder_dialog()
    except Exception as exc:
        return jsonify({"error": f"Could not open folder picker: {exc}"}), 500

    if not selected_path:
        return jsonify({"cancelled": True})

    app.config["PROJECT_DIR"] = Path(selected_path).resolve()
    return _json_response(
        lambda: {
            "cancelled": False,
            "project_path": str(_current_project_dir()),
            "project_info": get_project_info(_current_project_dir()),
        }
    )


@app.route("/api/project-info")
def project_info():
    return _json_response(lambda: get_project_info(_current_project_dir()))


@app.route("/api/map-data")
def map_data():
    return _json_response(lambda: get_map_data(_current_project_dir()))


@app.route("/api/layer-summary")
def layer_summary():
    layer = request.args.get("layer", "").strip()
    return _json_response(lambda: get_layer_summary(_current_project_dir(), layer))


def _current_project_dir() -> Path:
    return Path(app.config["PROJECT_DIR"])


def _json_response(callback):
    try:
        return jsonify(callback())
    except ProjectDataError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unexpected error: {exc}"}), 500


def _open_folder_dialog() -> str:
    result = {"path": ""}

    def choose_folder():
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        initial_dir = _current_project_dir()
        if not initial_dir.exists():
            initial_dir = BASE_DIR
        result["path"] = filedialog.askdirectory(
            title="Open Processed InSAR Project Folder",
            initialdir=str(initial_dir),
            mustexist=True,
        )
        root.destroy()

    thread = threading.Thread(target=choose_folder)
    thread.start()
    thread.join()
    return result["path"]


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
