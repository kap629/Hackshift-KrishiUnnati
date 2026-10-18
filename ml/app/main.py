import io
import json
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(ROOT / "artifacts/krishiunnati_mobilenetv2.keras")))
CLASS_NAMES_PATH = Path(os.getenv("CLASS_NAMES_PATH", str(ROOT / "artifacts/class_names.json")))
CLASS_MAP_PATH = Path(os.getenv("CLASS_MAP_PATH", str(ROOT / "class_map.json")))
MAX_BYTES = int(os.getenv("MAX_IMAGE_MB", "10")) * 1024 * 1024
MIN_SCORE = float(os.getenv("CONFIDENCE_THRESHOLD", "0.65"))
MIN_MARGIN = float(os.getenv("UNCERTAINTY_MARGIN", "0.08"))
app = FastAPI(title="KrishiUnnati Inference", version="1.0.0")
model = None
class_names: list[str] = []
class_map: dict = {}
load_error: str | None = None

@app.on_event("startup")
def load_artifacts():
    global model, class_names, class_map, load_error
    if not MODEL_PATH.is_file() or not CLASS_NAMES_PATH.is_file():
        load_error = "Trained model artifacts are not installed. Follow ml/README.md to train the model."
        return
    try:
        import tensorflow as tf
        model = tf.keras.models.load_model(MODEL_PATH)
        class_names = json.loads(CLASS_NAMES_PATH.read_text(encoding="utf-8"))
        class_map = json.loads(CLASS_MAP_PATH.read_text(encoding="utf-8")) if CLASS_MAP_PATH.exists() else {}
        if len(class_names) != int(model.output_shape[-1]):
            raise ValueError("Saved class labels do not match model outputs.")
        load_error = None
    except Exception as exc:
        model = None
        load_error = f"Model artifacts could not be loaded: {exc}"

@app.get("/health")
def health():
    return {"status": "ready" if model is not None else "model_not_ready", "model_ready": model is not None, "message": load_error, "model_version": MODEL_PATH.name if model is not None else None}

def crop_key(label: str) -> str:
    crop = label.split("___", 1)[0].lower()
    if crop.startswith("corn_"): return "maize"
    if crop.startswith("pepper"): return "pepper"
    if crop.startswith("cherry_"): return "cherry"
    return crop.split("_")[0].strip()

def friendly(label: str) -> dict:
    if label in class_map: return class_map[label]
    parts = label.split("___", 1)
    crop = crop_key(label)
    disease = parts[-1].replace("_", " ").strip().title()
    return {"crop": crop, "disease": disease, "guidance": "This class has no reviewed local guidance yet. Ask a local agricultural expert to confirm the result."}

@app.post("/predict")
async def predict(image: UploadFile = File(...), crop_id: str = Form(""), x_service_token: str | None = Header(default=None)):
    expected = os.getenv("INFERENCE_SERVICE_TOKEN")
    if expected and x_service_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized inference request.")
    if model is None:
        raise HTTPException(status_code=503, detail=load_error or "Model is not ready.")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WEBP leaf photo.")
    contents = await image.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the configured size limit.")
    try:
        with Image.open(io.BytesIO(contents)) as check:
            check.verify()
        with Image.open(io.BytesIO(contents)) as original:
            if original.width < 64 or original.height < 64:
                raise HTTPException(status_code=422, detail="Image is too small. Use at least 64 × 64 pixels.")
            if original.width * original.height > 25_000_000:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")
            image_rgb = original.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=422, detail="The uploaded file is not a readable image.")
    import tensorflow as tf
    if crop_id and crop_id != 'other' and crop_id not in {crop_key(label) for label in class_names}:
        raise HTTPException(status_code=422, detail="This crop is not represented in the trained model. No prediction was made.")
    batch = np.asarray(image_rgb, dtype=np.float32)[None, ...]
    scores = model.predict(batch, verbose=0)[0]
    order = np.argsort(scores)[::-1]
    top_index = int(order[0]); top_score = float(scores[top_index]); second = float(scores[int(order[1])]) if len(order) > 1 else 0.0
    candidates = []
    for idx in order[:3]:
        label = class_names[int(idx)]; info = friendly(label)
        candidates.append({"class_name": label, **info, "confidence": float(scores[int(idx)])})
    chosen = candidates[0]
    if crop_id and crop_id != "other" and crop_id != chosen["crop"]:
        crop_mismatch = True
    else: crop_mismatch = False
    uncertain = top_score < MIN_SCORE or top_score - second < MIN_MARGIN or crop_mismatch
    return {
        "status": "completed", "is_uncertain": uncertain, "uncertainty": "uncertain" if uncertain else "accepted",
        "crop": chosen["crop"], "disease": chosen["disease"], "class_name": chosen["class_name"],
        "confidence": top_score, "score_note": "Raw model score; not a calibrated disease probability.",
        "guidance": chosen["guidance"], "message": "The photo did not produce a clear supported match. Try a sharper, close-up photo or seek local advice." if uncertain else None,
        "alternatives": candidates[1:], "crop_mismatch": crop_mismatch, "model_version": MODEL_PATH.name
    }
