import os
import re
import json
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
import google.generativeai as genai

# Load env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

gemini_bp = Blueprint("gemini", __name__)

if not api_key:
    raise ValueError("❌ GEMINI_API_KEY missing in .env")

# Configure Gemini
genai.configure(api_key=api_key)
model = genai.GenerativeModel("models/gemini-flash-latest")

@gemini_bp.route("/", methods=["POST"])
def gemini_info():
    data = request.get_json()
    disease = data.get("disease", "Unknown")

    prompt = f"""
    Provide a medical explanation for the skin condition: {disease}.
    Respond in **valid JSON only** with exactly this structure:

    {{
      "description": "Plain-text explanation of the condition.",
      "treatment": "Plain-text summary of common treatments.",
      "references": ["https://reliable-medical-source.org/example1",
                     "https://reliable-medical-source.org/example2"]
    }}
    Only return JSON, no extra text or markdown.
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        print("🔎 Gemini raw output:", text)

        # --- Try parsing JSON ---
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            print("⚠️ Cleaning Gemini output...")
            cleaned = re.sub(r"^```json|```$", "", text, flags=re.MULTILINE).strip()
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                cleaned = match.group(0)
            try:
                result = json.loads(cleaned)
            except Exception:
                result = {
                    "description": text,
                    "treatment": "Consult a dermatologist.",
                    "references": []
                }

        return jsonify({
            "disease": disease,
            "description": result.get("description", "No description found."),
            "treatment": result.get("treatment", "Consult a dermatologist."),
            "references": result.get("references", [])
        })

    except Exception as e:
        return jsonify({
            "disease": disease,
            "description": "Error fetching info",
            "treatment": str(e),
            "references": []
        }), 500
