import os
import json
import numpy as np
from io import BytesIO
from PIL import Image
from flask import Blueprint, request, jsonify, current_app
import tensorflow as tf
from utilities.preprocess import preprocess_image

predict_bp = Blueprint("predict", __name__)

# ----------------------------
# CONFIG
# ----------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "skin_cnn.h5")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "..", "class_labels.json")

# Load class labels
with open(os.path.abspath(LABELS_PATH), "r", encoding="utf-8") as f:
    RAW_CLASS_NAMES = json.load(f)

# Pretty mapping for display
PRETTY_NAMES = {
    "Acne And Rosacea Photos": "Acne & Rosacea",
    "Actinic Keratosis Basal Cell Carcinoma And Other Maligna...": "Actinic Keratosis & Skin Cancer",
    "Atopic Dermatitis Photos": "Atopic Dermatitis (Eczema)",
    "Ba Cellulitis": "Cellulitis (Bacterial Infection)",
    "Ba Impetigo": "Impetigo (Bacterial Infection)",
    "Benign": "Benign Skin Lesions",
    "Bullous Disease Photos": "Bullous Diseases (Blistering)",
    "Cellulitis Impetigo And Other Bacterial Infections": "Bacterial Skin Infections",
    "Eczema Photos": "Eczema",
    "Exanthems And Drug Eruptions": "Drug Rashes & Exanthems",
    "Fu Athlete Foot": "Athlete's Foot (Tinea Pedis)",
    "Fu Nail Fungus": "Nail Fungus (Onychomycosis)",
    "Fu Ringworm": "Ringworm (Tinea Corporis)",
    "Hair Loss Photos Alopecia And Other Hair Diseases": "Alopecia & Hair Loss",
    "Healthy": "Healthy Skin",
    "Herpes Hpv And Other Stds Photos": "Herpes, HPV & Other STDs",
    "Light Diseases And Disorders Of Pigmentation": "Pigmentation Disorders",
    "Lupus And Other Connective Tissue Diseases": "Lupus & Connective Tissue Disorders",
    "Malignant": "Malignant Skin Tumors",
    "Melanoma Skin Cancer Nevi And Moles": "Melanoma, Moles & Nevi",
    "Nail Fungus And Other Nail Disease": "Nail Disorders",
    "Pa Cutaneous Larva Migrans": "Cutaneous Larva Migrans",
    "Poison Ivy Photos And Other Contact Dermatitis": "Contact Dermatitis",
    "Psoriasis Pictures Lichen Planus And Related Diseases": "Psoriasis & Lichen Planus",
    "Rashes": "General Rashes",
    "Scabies Lyme Disease And Other Infestations An...": "Scabies, Lyme & Infestations",
    "Seborrheic Keratoses And Other Benign Tumors": "Seborrheic Keratoses & Benign Tumors",
    "Systemic Disease": "Systemic Disease (skin signs)",
    "Tinea Ringworm Candidiasis And Other Fungal Infections": "Fungal Infections (Tinea, Candida)",
    "Urticaria Hives": "Urticaria (Hives)",
    "Vascular Tumors": "Vascular Tumors",
    "Vasculitis Photos": "Vasculitis",
    "Vi Chickenpox": "Chickenpox",
    "Vi Shingles": "Shingles (Herpes Zoster)",
    "Warts Molluscum And Other Viral Infections": "Warts & Viral Infections"
}

def pretty(name):
    return PRETTY_NAMES.get(name, name)

# ----------------------------
# Load model once
# ----------------------------
_model = None
def get_model():
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(os.path.abspath(MODEL_PATH), compile=False)
        current_app.logger.info("✅ Model loaded successfully")
    return _model

# ----------------------------
# Prediction endpoint
# ----------------------------
@predict_bp.route("/", methods=["POST"])
def predict():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        img = Image.open(BytesIO(file.read()))

        x = preprocess_image(img)
        model = get_model()
        preds = model.predict(x, verbose=0)[0]

        # Top-1
        top_idx = np.argmax(preds)
        raw_name = RAW_CLASS_NAMES[top_idx]
        disease_name = pretty(raw_name)
        confidence = float(preds[top_idx])

        # Top-3 predictions
        top3_idx = preds.argsort()[-3:][::-1]
        top3 = [{"disease": pretty(RAW_CLASS_NAMES[i]), "confidence": float(preds[i])} for i in top3_idx]

        return jsonify({
            "disease": disease_name,
            "confidence": confidence,
            "top3": top3
        })

    except Exception as e:
        current_app.logger.exception("Prediction failed")
        return jsonify({"error": str(e)}), 500
