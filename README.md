# KrishiUnnati

KrishiUnnati is a mobile-first crop-help website with phone OTP sign-in, a multilingual conversational interface, optional voice input, weather context, and an optional TensorFlow leaf-image classifier. Its purpose is educational crop screening and practical next-step guidance, not confirmed diagnosis.

The supplied logo is stored at `frontend/public/branding/krishiunnati-logo.png`. The interface supports English, Hindi, and Tamil. It includes the Devanagari brand treatment **कृषि उन्नति** and **किसान की बात, किसान की भाषा में**.

## Requirements

- Node.js 20.9 or newer and npm.
- Python 3.10 or 3.11 for the TensorFlow service and training scripts.
- A Supabase project with Phone Auth and an SMS provider configured.
- A Gemini API key and a currently supported chat/transcription/TTS model ID for those features.
- Internet access for configured Gemini and Open-Meteo calls. The local TensorFlow inference service runs separately.

## Start the web app

```powershell
cd frontend
npm install
Copy-Item ..\.env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Fill in `frontend/.env.local` with the values from the project-root `.env.example`. The Supabase publishable key is intended for client-side use with RLS. Never put the Supabase service-role key or Gemini key in a `NEXT_PUBLIC_` variable.

## Configure Supabase phone sign-in

1. Create a Supabase project.
2. Enable Phone Auth.
3. Configure an SMS provider and the required sender/template settings for the countries where the app will be tested.
4. Set the project URL and publishable key in `frontend/.env.local`.
5. Apply `supabase/migrations/202610180001_initial_schema.sql` using the Supabase CLI or SQL editor.
6. Configure local and deployed redirect URLs as required by the Supabase project.

SMS delivery may have costs, rate limits, and country-specific requirements. Without a configured provider, OTP sign-in reports a setup error.

## Configure Gemini

Set `GEMINI_API_KEY` and `GEMINI_CHAT_MODEL` in the server-side `frontend/.env.local`. Set transcription and TTS model IDs only if those features are enabled for the chosen account and region. Confirm current model identifiers and supported languages in Google’s official documentation. Gemini calls are made from Next.js server routes; the key is never sent to the browser.

The `.env.example` includes current suggested Gemini IDs for chat, transcription, and speech output. Gemini speech transcription and text-to-speech use Google’s Interactions API; the transcription route asks for the user's selected language and returns a transcript for review before sending.

Voice requires microphone permission and a secure browser context (HTTPS outside localhost). The transcript is shown for editing before it enters the chat. Browser speech synthesis is only a fallback; its language and voice availability vary.

## Weather

Weather uses Open-Meteo Geocoding and Forecast APIs from server routes. Enter a town or district; exact device location is not required. The application marks cached responses as stale and displays provider and update time. If the service fails, the app shows an error instead of fabricated weather. Review the provider’s current usage and attribution terms before deployment.

## Train the crop model

No PlantVillage images or trained model weights are included. For a college demo, use the [PlantVillage dataset repository](https://github.com/spMohanty/PlantVillage-Dataset) or its [dataset card](https://huggingface.co/datasets/mohanty/PlantVillage). The card lists CC BY-SA 3.0; review the source's current license, attribution, and redistribution requirements before using or sharing the data. The original dataset paper is [Using Deep Learning for Image-Based Plant Disease Detection](https://doi.org/10.3389/fpls.2016.01419).

To prepare files for the included directory-based training script, download the source's color images and place the class folders under `ml/data/plantvillage/`. Keep the original class-folder names:

```text
ml/data/plantvillage/
  Tomato___Early_blight/
  Tomato___healthy/
  Potato___Late_blight/
```

Then:

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python train.py --data data/plantvillage --epochs 10
python evaluate.py --data data/plantvillage
uvicorn app.main:app --reload --port 8001
```

The model and label files are written under `ml/artifacts/`. Evaluation writes per-class metrics and a confusion matrix to `ml/reports/`. Training can take significant time and memory. PlantVillage images are controlled and do not establish field performance. Do not make accuracy or yield claims without appropriate independent testing.

Set `INFERENCE_SERVICE_URL=http://127.0.0.1:8001` for local web-to-model calls. Set the same `INFERENCE_SERVICE_TOKEN` in both services outside a local development environment. Until both trained artifacts are installed, the model service returns `model_not_ready`; it never fabricates a result.

## Security and privacy

- Apply the Supabase migration and verify RLS before using real accounts.
- Keep crop photos private; the current flow sends them to inference without saving them.
- Audio is processed for transcription and is not stored by this app.
- Do not use photos for model training without explicit consent.
- Configure rate limits and CAPTCHA for OTP and protect server endpoints before deployment.
- The provided app is a college-project MVP and needs a production security review before public deployment.

## Local checks

From `frontend/`, run `npm run lint`, `npm run typecheck`, and `npm run build` after installing dependencies. Python model scripts can be syntax-checked with `python -m compileall ml` from the project root. Training and inference require installing the ML dependencies and separately acquiring the image dataset.

## Current implementation boundaries

- Real phone OTP requires Supabase SMS provider setup.
- Real chat, transcription, and TTS require configured Gemini API credentials and supported models.
- Real live weather requires a network connection to Open-Meteo.
- Real photo screening requires separately acquired data and trained model artifacts.
- No fabricated model predictions or weather are shown when an integration is unavailable.

## ZIP contents

The project ZIP excludes secrets, datasets, virtual environments, and trained weights. Configure those locally after extraction.
