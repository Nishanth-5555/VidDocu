# app.py (COMPREHENSIVE and DEBUG-READY Backend Code for Project 1)

import os
import json
import torch
from flask_cors import CORS
from dotenv import load_dotenv
import whisperx
import ffmpeg # Used for audio extraction
import yt_dlp # Used for YouTube video download
import uuid
import re
import logging # Import logging module for detailed logs
import subprocess # For robust ffmpeg execution
import openai # Using the official OpenAI library
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename # For secure filenames

# Configure basic logging for Flask app
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app_logger = logging.getLogger(__name__) # Get logger for this module

# 🌍 Load environment variables from .env file
load_dotenv()

# Global variables for API credentials
openai_api_key = os.getenv("OPENAI_API_KEY")

# --- IMPORTANT: Basic validation for API key ---
if not openai_api_key:
    app_logger.error("Error: OPENAI_API_KEY not found in .env file or environment variables.")
    app_logger.error("Please set OPENAI_API_KEY in your .env file.")
    exit(1)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ⚙️ Set up Flask
app = Flask(__name__)
app.debug = True # REMINDER: Set to False for production!
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER # Set upload folder
CORS(app)



# 🧠 Initialize OpenAI API Client
try:
    openai_client = openai.OpenAI(api_key=openai_api_key)
    app_logger.info("OpenAI API Client initialized successfully.")
except Exception as e:
    app_logger.error(f"Error initializing OpenAI API Client: {e}")
    exit(1) # Exit if client cannot be initialized


# 🧠 Load WhisperX transcription model
# ... (This section remains unchanged)
global transcription_model
transcription_model = None
try:
    current_device = "cuda" if torch.cuda.is_available() else "cpu"
    app_logger.info(f"Attempting to load WhisperX model on device: {current_device}...")
    transcription_model = whisperx.load_model("base", device=current_device, compute_type="float32")
    app_logger.info("WhisperX model loaded globally successfully.")
except Exception as e:
    app_logger.error(f"Error loading WhisperX model globally: {e}")
    transcription_model = None


# --- Utility Functions (format_timestamp, download_youtube_video) ---
# ... (These sections remain unchanged)
def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02}:{minutes:02}:{secs:02}"

def download_youtube_video(url, output_dir="."):
    unique_filename = os.path.join(output_dir, f"temp_{uuid.uuid4().hex}.mp4")
    ydl_opts = {
        'outtmpl': unique_filename,
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'merge_output_format': 'mp4',
        'quiet': False, 'no_warnings': False,
    }
    try:
        app_logger.info(f"Starting YouTube video download: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        app_logger.info(f"YouTube video downloaded to: {unique_filename}")
        return unique_filename
    except Exception as e:
        app_logger.error(f"Failed to download YouTube video from {url}: {e}")
        raise RuntimeError(f"Failed to download YouTube video: {e}")


# --- REFACTORED: LLM Interaction Function for OpenAI ---
def call_openai_api(user_prompt: str, system_message: str, model_name: str, max_tokens: int, temperature: float, json_mode: bool = False) -> str:
    """
    Makes a call to the OpenAI Chat Completions API.
    """
    try:
        app_logger.info(f"Calling OpenAI API with model: {model_name}")
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_prompt}
        ]
        
        request_params = {
            "model": model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        if json_mode:
            request_params["response_format"] = {"type": "json_object"}

        response = openai_client.chat.completions.create(**request_params)
        
        app_logger.info("OpenAI API call successful.")
        return response.choices[0].message.content
        
    except Exception as e:
        app_logger.error(f"Error calling OpenAI API: {e}", exc_info=True)
        raise RuntimeError(f"Failed to get response from OpenAI: {e}")


# --- UPDATED: Functions to use the new OpenAI wrapper ---
def summarize_text(text: str) -> str:
    system_message = """You are an expert technical writer. Your task is to summarize the provided transcript into a clear, concise, and well-structured format. Focus on key information and steps. Use clear, professional language. Format your summary using **Markdown**, including headings and bullet points."""
    user_prompt = text
    return call_openai_api(user_prompt, system_message, model_name="gpt-4o-mini", max_tokens=800, temperature=0.3)

def generate_title(text: str) -> str:
    system_message = "Based on the transcript chunk, provide a concise, factual, documentation-style section title. Keep it under 8 words. Do not use emojis."
    user_prompt = text
    return call_openai_api(user_prompt, system_message, model_name="gpt-4o-mini", max_tokens=30, temperature=0.3)

def generate_faqs(full_transcript_text: str) -> list:
    app_logger.info("Generating FAQs based on the full transcript...")
    system_message = """You are a JSON generation machine. Create a 'Frequently Asked Questions' section based on the transcript.
    - Generate 3 to 5 relevant FAQs.
    - The answers must be based ONLY on the information provided.
    - **CRITICAL:** Your entire response must be a valid JSON object.
    """
    user_prompt = f"Create the FAQ JSON from this transcript:\n\n{full_transcript_text}"
    
    try:
        response_content = call_openai_api(
            user_prompt, 
            system_message, 
            model_name="gpt-4o-mini", # gpt-4o-mini is great for JSON mode
            max_tokens=1000, 
            temperature=0.2,
            json_mode=True # Enforce JSON output
        )
        
        # The response should be a valid JSON string now
        # The key for the array might be 'faqs' or similar, inspect if needed
        data = json.loads(response_content)
        
        # Look for a key that contains the list (e.g., 'faqs', 'questions')
        faqs_list = []
        for key in data:
            if isinstance(data[key], list):
                faqs_list = data[key]
                break
        
        if faqs_list and all("question" in item and "answer" in item for item in faqs_list):
            app_logger.info(f"Successfully generated and parsed {len(faqs_list)} FAQs.")
            return faqs_list
        else:
            app_logger.error(f"Generated JSON does not contain a valid FAQ list. Raw: {response_content}")
            return []
            
    except Exception as e:
        app_logger.error(f"An error occurred during FAQ generation: {e}", exc_info=True)
        return []


# --- Chunking Function and YouTube Helper ---
# ... (These sections remain unchanged)
def chunk_segments(segments: list, max_words: int = 150) -> list:
    chunks = []
    current_chunk_segments = []
    current_start = None
    word_count = 0
    for seg in segments:
        seg_text = seg.get("text", "").strip()
        if not seg_text: continue
        seg_words = len(seg_text.split())
        if current_chunk_segments and (word_count + seg_words > max_words):
            combined_text = " ".join(s["text"].strip() for s in current_chunk_segments)
            chunks.append({"text": combined_text, "timestamp": current_start})
            current_chunk_segments = []
            word_count = 0
        if not current_chunk_segments:
            current_start = seg.get("start", 0)
        current_chunk_segments.append(seg)
        word_count += seg_words
    if current_chunk_segments:
        combined_text = " ".join(s["text"].strip() for s in current_chunk_segments)
        chunks.append({"text": combined_text, "timestamp": current_start})
    app_logger.info(f"Transcript chunking complete. Generated {len(chunks)} chunks.")
    return chunks

def get_youtube_video_id(url: str) -> str | None:
    match = re.search(r'(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})', url)
    return match.group(1) if match else None

@app.route('/videos/<path:filename>')
def serve_video(filename):
    """Serves a video file from the uploads directory."""
    app_logger.info(f"Serving video file: {filename}")
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# 🚀 Main route
@app.route("/upload", methods=["POST"])
def upload_video():
    video_url = request.form.get("video_url")
    temp_video_path = None
    temp_audio_path = None
    video_playback_url = None # Variable for local video playback URL
    
    global transcription_model
    if transcription_model is None:
        app_logger.info("WhisperX model loading per-request on CPU.")
        transcription_model = whisperx.load_model("base", device="cpu", compute_type="float32")

    video_id = get_youtube_video_id(video_url) if video_url else None

    try:
        # Check if a YouTube URL was provided or a file was uploaded
        if video_url:
            app_logger.info(f"Received YouTube URL: {video_url}")
            temp_video_path = download_youtube_video(video_url)
        else:
            file = request.files.get("video")
            if not file or file.filename == '':
                raise RuntimeError("No video file provided.")
            
            # Save the file securely for processing and playback
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(save_path)
            
            temp_video_path = save_path # Path for ffmpeg to process
            video_playback_url = f"/videos/{unique_filename}" # URL for the frontend player
            app_logger.info(f"Local video saved to: {save_path}")

        # --- Audio Extraction and Transcription ---
        app_logger.info("Starting audio extraction...")
        temp_audio_path = f"temp_{uuid.uuid4().hex}.mp3"
        
        try:
            # Run ffmpeg to extract audio from the video file
            subprocess.run(
                ['ffmpeg', '-i', temp_video_path, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', temp_audio_path], 
                check=True, 
                capture_output=True
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Audio extraction failed: {e.stderr.decode()}")
        except FileNotFoundError:
            raise RuntimeError("FFmpeg is not installed or not in system PATH.")

        # Transcribe the extracted audio using WhisperX
        audio = whisperx.load_audio(temp_audio_path)
        result = transcription_model.transcribe(audio)
        
        # Format the transcript segments for the frontend
        full_transcript_segments_for_frontend = [{
            "text": seg["text"].strip(),
            "start": seg["start"],
            "formatted_timestamp": format_timestamp(seg["start"])
        } for seg in result.get("segments", []) if "text" in seg and "start" in seg]

        # --- Content Generation with OpenAI ---
        sections, faqs = [], []
        if full_transcript_segments_for_frontend:
            app_logger.info("Generating documentation sections and FAQs...")
            
            # Generate documentation from chunks
            for chunk in chunk_segments(result.get("segments", [])): 
                if chunk["text"].strip():
                    try:
                        title = generate_title(chunk["text"])
                        summary = summarize_text(chunk["text"])
                        sections.append({"title": title, "summary": summary, "timestamp": chunk["timestamp"]})
                    except RuntimeError as llm_error:
                        sections.append({"title": "Error Generating Section", "summary": str(llm_error), "timestamp": chunk.get("timestamp", 0)})

            # Generate FAQs from the entire text
            full_text = " ".join(seg['text'] for seg in full_transcript_segments_for_frontend)
            faqs = generate_faqs(full_text)

        # --- Final JSON Response to Frontend ---
        return jsonify({
            "full_transcript_segments": full_transcript_segments_for_frontend,
            "documentation": sections,
            "faqs": faqs,
            "video_id": video_id, # For YouTube player
            "video_playback_url": video_playback_url # For local HTML5 player
        })

    except Exception as e:
        app_logger.error(f"An unexpected error occurred during upload: {e}", exc_info=True)
        return jsonify({"error": "An unexpected server error occurred: " + str(e)}), 500

    finally:
        # --- Cleanup Temporary Files ---
        # The uploaded video file is kept, but temporary audio and downloaded YouTube videos are deleted.
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
            app_logger.info(f"Cleaned up temp audio file: {temp_audio_path}")
        
        if video_url and temp_video_path and os.path.exists(temp_video_path):
             os.remove(temp_video_path)
             app_logger.info(f"Cleaned up temp YouTube video: {temp_video_path}")

if __name__ == '__main__':
    app.run(debug=True, port=5000)
