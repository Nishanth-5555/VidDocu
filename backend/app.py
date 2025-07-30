# app.py (Phase 2 - Final with Updated AI Assistant Logic)

import os
import json
import torch
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import whisperx
import yt_dlp
import uuid
import re
import logging
import subprocess
import openai

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app_logger = logging.getLogger(__name__)
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- Environment and API Setup ---
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    app_logger.error("Error: OPENAI_API_KEY not found in .env file.")
    exit(1)

# --- Flask App Initialization ---
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.debug = True
CORS(app)

# --- AI Model Initialization ---
try:
    openai_client = openai.OpenAI(api_key=openai_api_key)
    app_logger.info("OpenAI API Client initialized.")
except Exception as e:
    app_logger.error(f"Error initializing OpenAI API Client: {e}")
    exit(1)

transcription_model = None
try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        torch.set_num_threads(os.cpu_count())
    app_logger.info(f"Loading WhisperX model on device: {device}...")
    transcription_model = whisperx.load_model("base", device, compute_type="float32")
    app_logger.info("Transcription model loaded globally.")
except Exception as e:
    app_logger.error(f"Could not load AI models globally: {e}")

# --- Helper Functions (Unchanged) ---
def format_timestamp(seconds: float) -> str:
    if not isinstance(seconds, (int, float)) or seconds < 0: return "00:00:00"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02}:{minutes:02}:{secs:02}"

def call_openai_api(user_prompt: str, system_message: str, model_name: str, max_tokens: int, temperature: float, json_mode: bool = False) -> str:
    try:
        messages = [{"role": "system", "content": system_message}, {"role": "user", "content": user_prompt}]
        params = {"model": model_name, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
        if json_mode: params["response_format"] = {"type": "json_object"}
        response = openai_client.chat.completions.create(**params)
        return response.choices[0].message.content
    except Exception as e:
        raise RuntimeError(f"Failed to get response from OpenAI: {e}")

def summarize_text(text: str) -> str:
    system_message = "You are an expert technical writer. Summarize the provided transcript chunk into a clear, well-structured format using Markdown (headings, bullet points)."
    return call_openai_api(text, system_message, "gpt-4o-mini", 800, 0.3)

def generate_title(text: str) -> str:
    system_message = "Provide a concise, factual, documentation-style title (under 8 words) for this transcript chunk. No emojis."
    return call_openai_api(text, system_message, "gpt-4o-mini", 30, 0.3)

def generate_faqs(full_transcript_text: str) -> list:
    system_message = "You are a JSON generation machine. Create a 'faqs' key containing a JSON array of 3-5 question/answer objects based on the provided transcript. Your response must be a valid JSON object."
    user_prompt = f"Create the FAQ JSON from this transcript:\n\n{full_transcript_text}"
    try:
        response_content = call_openai_api(user_prompt, system_message, "gpt-4o-mini", 1000, 0.2, json_mode=True)
        data = json.loads(response_content)
        faqs_list = data.get("faqs", [])
        return faqs_list if isinstance(faqs_list, list) else []
    except Exception: return []

def chunk_segments(segments: list, max_words: int = 150) -> list:
    chunks, current_chunk, word_count = [], [], 0
    current_start = None
    for seg in segments:
        seg_words = len(seg.get("text", "").split())
        if current_chunk and (word_count + seg_words > max_words):
            chunks.append({"text": " ".join(s["text"].strip() for s in current_chunk), "timestamp": current_start})
            current_chunk, word_count = [], 0
        if not current_chunk: current_start = seg.get("start", 0)
        current_chunk.append(seg)
        word_count += seg_words
    if current_chunk: chunks.append({"text": " ".join(s["text"].strip() for s in current_chunk), "timestamp": current_start})
    return chunks

def get_youtube_video_id(url: str) -> str | None:
    match = re.search(r'(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})', url)
    return match.group(1) if match else None

# --- API Routes ---
@app.route('/videos/<path:filename>')
def serve_video(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.get_json()
    question, context = data.get("question"), data.get("context")
    if not question or not context: return jsonify({"error": "Question and context are required."}), 400
    
    # --- MODIFIED: New prompt for more flexible answers ---
    system_message = """You are a helpful Q&A assistant. Your primary goal is to answer the user's question based on the provided video transcript context.
    - First, find the direct answer within the context.
    - Then, you may briefly supplement the answer with your general knowledge if it adds helpful, relevant information. Always prioritize the transcript's content as the main source of truth.
    - If the answer is not in the context at all, you can use your general knowledge to provide a helpful response, but you MUST state that this information is not from the video.
    """
    user_prompt = f"CONTEXT:\n\"\"\"\n{context}\n\"\"\"\n\nQUESTION: {question}"
    
    try:
        # --- MODIFIED: Increased temperature for more natural responses ---
        answer = call_openai_api(user_prompt, system_message, "gpt-4o-mini", 300, 0.3)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": f"LLM error: {e}"}), 500

@app.route("/upload", methods=["POST"])
def upload_video():
    global transcription_model
    if not transcription_model: return jsonify({"error": "Transcription model is not loaded."}), 500

    video_url = request.form.get("video_url")
    language = request.form.get("language", "en")
    processing_path, audio_path = None, None
    video_id, video_playback_url, video_download_url, video_title = None, None, None, "video_analysis"

    try:
        if video_url:
            video_id = get_youtube_video_id(video_url)
            temp_dir = 'temp_downloads'
            if not os.path.exists(temp_dir): os.makedirs(temp_dir)
            ydl_opts = {'outtmpl': os.path.join(temp_dir, f"{uuid.uuid4().hex}.mp4"), 'format': 'best[ext=mp4]/best'}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                processing_path = info['requested_downloads'][0]['filepath']
                video_title = info.get('title', 'youtube_video')
        else:
            file = request.files.get("video")
            if not file or not file.filename: raise RuntimeError("No video file provided.")
            base_filename = secure_filename(file.filename)
            video_title, _ = os.path.splitext(base_filename)
            filename = f"{uuid.uuid4().hex}_{base_filename}"
            processing_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(processing_path)
            video_playback_url = f"/videos/{filename}"
            video_download_url = video_playback_url

        audio_path = f"temp_{uuid.uuid4().hex}.wav"
        subprocess.run(['ffmpeg', '-i', processing_path, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', audio_path], check=True, capture_output=True)
        
        result = transcription_model.transcribe(whisperx.load_audio(audio_path), language=language)
        
        segments = result.get("segments", [])
        transcript = [{"text": s["text"].strip(), "start": s.get("start", 0), "formatted_timestamp": format_timestamp(s.get("start", 0))} for s in segments]
        
        sections, faqs = [], []
        if transcript:
            full_text = " ".join(s['text'] for s in transcript)
            for chunk in chunk_segments(segments):
                try:
                    sections.append({"title": generate_title(chunk["text"]), "summary": summarize_text(chunk["text"]), "timestamp": chunk["timestamp"]})
                except Exception as e:
                    sections.append({"title": "Error Generating Section", "summary": str(e), "timestamp": chunk.get("timestamp", 0)})
            faqs = generate_faqs(full_text)
        
        return jsonify({
            "full_transcript_segments": transcript, "documentation": sections, "faqs": faqs,
            "video_id": video_id,
            "video_playback_url": video_playback_url,
            "video_download_url": video_download_url,
            "video_title": video_title
        })

    except Exception as e:
        app_logger.error(f"An error occurred during upload: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        if audio_path and os.path.exists(audio_path): os.remove(audio_path)
        if video_url and processing_path and os.path.exists(processing_path): os.remove(processing_path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
