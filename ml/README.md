# TensorFlow crop screening service

The service uses a trained MobileNetV2 classifier. No weights or PlantVillage images are shipped in this project. Until training artifacts exist, `/health` reports `model_not_ready` and `/predict` returns HTTP 503.

## Prepare data and train

Install Python 3.10 or 3.11, create a virtual environment, and run `pip install -r requirements.txt`. Acquire PlantVillage from the [official repository](https://github.com/spMohanty/PlantVillage-Dataset) or [dataset card](https://huggingface.co/datasets/mohanty/PlantVillage); review and follow the current license and attribution requirements. Put color images in folders named by their class under `ml/data/plantvillage/`. Example:

```text
ml/data/plantvillage/
  Tomato___Early_blight/
  Tomato___healthy/
  Potato___Late_blight/
```

Then run `python train.py --data data/plantvillage --epochs 10` and `python evaluate.py --data data/plantvillage`. Training saves `artifacts/krishiunnati_mobilenetv2.keras` and `artifacts/class_names.json`. Evaluation writes per-class metrics and a confusion matrix to `reports/`.

PlantVillage has controlled image conditions and is not independent field validation. Do not claim field accuracy from this validation split. Raw model scores are not calibrated probabilities. Review per-class metrics and test on locally collected field images before using the model for real decisions.

## Run locally

From `ml/`, run `uvicorn app.main:app --reload --port 8001`. Set `INFERENCE_SERVICE_URL=http://127.0.0.1:8001` in the Next.js environment. Configure `INFERENCE_SERVICE_TOKEN` on both processes for non-local deployments.
