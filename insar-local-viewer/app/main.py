from pathlib import Path

from flask import Flask, jsonify, render_template, request

from data_loader import ProjectDataError, get_layer_summary, get_project_info


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR / "data" / "project_D"

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/project-info")
def project_info():
    try:
        return jsonify(get_project_info(PROJECT_DIR))
    except ProjectDataError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unexpected error while loading project: {exc}"}), 500


@app.route("/api/layer-summary")
def layer_summary():
    layer = request.args.get("layer", "").strip()
    try:
        return jsonify(get_layer_summary(PROJECT_DIR, layer))
    except ProjectDataError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unexpected error while summarizing layer: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
