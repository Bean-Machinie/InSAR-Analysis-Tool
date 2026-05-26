from pathlib import Path

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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
