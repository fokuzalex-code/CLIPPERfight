import os
from flask import Flask, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")


@app.route("/")
def index():
  return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def serve_file(filename):
  file_path = os.path.join(BASE_DIR, filename)
  if os.path.isfile(file_path):
    return send_from_directory(BASE_DIR, filename)
  return send_from_directory(BASE_DIR, "index.html")


@app.route("/health")
def health():
  return {"status": "ok"}, 200


if __name__ == "__main__":
  port = int(os.environ.get("PORT", 5000))
  app.run(host="0.0.0.0", port=port)
