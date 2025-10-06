# backend/app.py
from flask import Flask, jsonify
from flask_cors import CORS
from routes.predict import predict_bp
from routes.gemini import gemini_bp
from routes.report import report_bp

app = Flask(__name__)
CORS(app)  # allow frontend to call backend

# Register blueprints
app.register_blueprint(predict_bp, url_prefix="/api/predict")
app.register_blueprint(gemini_bp, url_prefix="/api/gemini")
app.register_blueprint(report_bp, url_prefix="/api/report")

@app.route("/")
def home():
    return jsonify({"message": "DermAI backend running"})

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))  # Render assigns a random port
    app.run(host="0.0.0.0", port=port)
