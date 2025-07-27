# app.py (COMPREHENSIVE and DEBUG-READY Backend Code for Project 1)

import os
import json
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import whisperx
import ffmpeg # Used for audio extraction
import yt_dlp # Used for YouTube video download
import uuid
import re
import logging # Import logging module for detailed logs
import subprocess # For robust ffmpeg execution

# Configure basic logging for Flask app
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app_logger = logging.getLogger(__name__) # Get logger for this module

# Import the Abacus.AI SDK client
from abacusai import ApiClient

# 🌍 Load environment variables from .env file
load_dotenv()

# Global variables for API credentials
abacus_api_key = os.getenv("ABACUS_AI_API_KEY")

# --- IMPORTANT: Basic validation for API key ---
if not abacus_api_key:
    app_logger.error("Error: ABACUS_AI_API_KEY not found in .env file or environment variables.")
    app_logger.error("Please set ABACUS_AI_API_KEY in your .env file.")
    exit(1)

# ⚙️ Set up Flask
app = Flask(__name__)
app.debug = True # REMINDER: Set to False for production!
CORS(app)

# 🧠 Initialize Abacus.AI API Client
try:
    abacus_client = ApiClient(api_key=abacus_api_key)
    app_logger.info("Abacus.AI API Client initialized successfully.")
except Exception as e:
    app_logger.error(f"Error initializing Abacus.AI API Client: {e}")
    exit(1) # Exit if client cannot be initialized


# 🧠 Load WhisperX transcription model (once globally for efficiency if possible)
# Ensure correct device inference and robust loading
global transcription_model
transcription_model = None # Initialize to None

try:
    current_device = "cuda" if torch.cuda.is_available() else "cpu"
    app_logger.info(f"Attempting to load WhisperX model on device: {current_device}...")
    transcription_model = whisperx.load_model("base", device=current_device, compute_type="float32")
    app_logger.info("WhisperX model loaded globally successfully.")
except Exception as e:
    app_logger.error(f"Error loading WhisperX model globally: {e}")
    app_logger.error("WhisperX model NOT loaded globally. It will be loaded per-request on CPU if needed, which might be slower.")
    transcription_model = None # Set to None, indicating it might need to be loaded in the route


# --- Utility for Timestamp Formatting ---
def format_timestamp(seconds: float) -> str:
    """Converts seconds to HH:MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02}:{minutes:02}:{secs:02}"

# 🎥 Download YouTube video
def download_youtube_video(url, output_dir="."):
    unique_filename = os.path.join(output_dir, f"temp_{uuid.uuid4().hex}.mp4")
    ydl_opts = {
        'outtmpl': unique_filename,
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', # Prioritize mp4, then general best
        'merge_output_format': 'mp4',
        'quiet': False, # Set to False for yt_dlp output
        'no_warnings': False, # Set to False for yt_dlp warnings
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

# --- LLM Interaction Functions (Using Abacus.AI SDK's evaluate_prompt) ---
# These functions will ONLY be called if transcription is successful.
def call_chatllm_sdk(user_prompt: str, system_message: str, llm_name: str, max_tokens: int, temperature: float) -> str:
    """
    Makes a call to the Abacus.AI ChatLLM API using the Abacus.AI SDK's evaluate_prompt.
    """
    try:
        app_logger.info(f"Calling ChatLLM SDK with model: {llm_name}, prompt length: {len(user_prompt.split())} words")
        response = abacus_client.evaluate_prompt(
            prompt=user_prompt,
            system_message=system_message,
            llm_name=llm_name,
            max_tokens=max_tokens,
            temperature=temperature
        )
        app_logger.info("ChatLLM SDK call successful.")
        return response.content
        
    except Exception as e:
        app_logger.error(f"Error calling Abacus.AI LLM via SDK: {e}", exc_info=True)
        raise RuntimeError(f"Failed to get response from ChatLLM SDK: {e}")


def summarize_text(text: str) -> str:
    """
    Summarizes a given text using Abacus.AI ChatLLM via SDK.
    Prompt refined for better-looking, structured summary using Markdown.
    """
    system_message = """You are an expert technical writer, product explainer, and documentation specialist.
    Your task is to summarize the provided transcript chunk into a clear, concise, and well-structured format.
    Focus on key information, functionalities, and steps demonstrated.
    Use clear, professional language. Do NOT add information not present in the transcript.
    Format your summary using **Markdown**, including:
    -   Clear headings or bolded key points.
    -   Bullet points for lists of features, steps, or takeaways.
    -   Well-formed paragraphs where prose is more appropriate.
    Aim for clarity and directness, making it easy for a reader to understand product functionality quickly."""
    user_prompt = text
    return call_chatllm_sdk(user_prompt, system_message, llm_name="GPT_4_1_MINI", max_tokens=800, temperature=0.3)

def generate_title(text: str) -> str:
    """
    Generates a short, documentation-style title for a text chunk using Abacus.AI ChatLLM via SDK.
    Prompt refined for conciseness.
    """
    system_message = "You are a helpful assistant. Based on the following transcript chunk, provide a concise, factual, and documentation-style section title. Avoid conversational tone and keep it under 8 words. Do not include any emojis in the title itself."
    user_prompt = text
    return call_chatllm_sdk(user_prompt, system_message, llm_name="GPT_4_1_MINI", max_tokens=30, temperature=0.3)

# --- Chunking Function ---
def chunk_segments(segments: list, max_words: int = 150) -> list:
    """
    Groups WhisperX segments into transcript chunks for LLM summarization.
    Returns chunks with combined text and starting timestamp.
    """
    chunks = []
    current_chunk_segments = []
    current_start = None
    word_count = 0

    for seg in segments:
        seg_text = seg.get("text", "").strip()
        if not seg_text:
            continue

        seg_words = len(seg_text.split())

        # Check if adding this segment exceeds max_words or if it's a new "paragraph" (heuristic)
        # We also look for short pauses or explicit newlines as potential break points
        # `max_words` is a soft limit, LLM token limits are the hard limit, so better safe.
        if current_chunk_segments and (word_count + seg_words > max_words or "\n\n" in seg_text or (seg.get("start") - current_chunk_segments[-1].get("end", 0) > 1.5)): # Pause > 1.5s
            combined_text = " ".join(s["text"].strip() for s in current_chunk_segments)
            chunks.append({
                "text": combined_text,
                "timestamp": current_start
            })
            current_chunk_segments = []
            word_count = 0

        if not current_chunk_segments:
            current_start = seg.get("start", 0)

        current_chunk_segments.append(seg)
        word_count += seg_words

    if current_chunk_segments:
        combined_text = " ".join(s["text"].strip() for s in current_chunk_segments)
        chunks.append({
            "text": combined_text,
            "timestamp": current_start
        })

    app_logger.info(f"Transcript chunking complete. Generated {len(chunks)} chunks.")
    return chunks

# --- Helper for extracting YouTube Video ID ---
def get_youtube_video_id(url: str) -> str | None:
    """Extracts YouTube video ID from various YouTube URL formats."""
    # Standard watch URL, embed URL, short URL, etc.
    match = re.search(r'(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})', url)
    if match:
        return match.group(1)
    return None

# 🚀 Main route
@app.route("/upload", methods=["POST"])
def upload_video():
    video_url = request.form.get("video_url")
    temp_video_path = None
    temp_audio_path = None
    
    # Load transcription model (globally or here as fallback)
    global transcription_model
    if transcription_model is None:
        app_logger.info("WhisperX model was not loaded globally. Attempting to load locally for this request on CPU.")
        # Force CPU to avoid CUDA issues on non-GPU machines or misconfigurations
        transcription_model = whisperx.load_model("base", device="cpu", compute_type="float32")

    video_id = None
    if video_url:
        video_id = get_youtube_video_id(video_url)

    try:
        # 📥 Download or save video
        if video_url:
            app_logger.info(f"Received YouTube URL: {video_url}")
            temp_video_path = download_youtube_video(video_url)
            if not temp_video_path:
                raise RuntimeError("Video download failed.")
        else:
            if "video" not in request.files:
                raise RuntimeError("No video file provided.")
            file = request.files["video"]
            if file.filename == '':
                raise RuntimeError("No selected file.")
            temp_video_path = f"temp_{uuid.uuid4().hex}_{secure_filename(file.filename.split('.')[-1])}" # Add original extension
            file.save(temp_video_path)
            app_logger.info(f"Local video saved to: {temp_video_path}")

        # 🎙️ Convert and transcribe audio
        app_logger.info("Starting audio extraction with ffmpeg...")
        temp_audio_path = f"temp_{uuid.uuid4().hex}.mp3"
        
        try:
            # Use a subprocess call to capture ffmpeg output for better debugging if it fails
            ffmpeg_command = [
                'ffmpeg',
                '-i', temp_video_path,
                '-vn', # no video
                '-acodec', 'libmp3lame', # MP3 audio codec
                '-q:a', '2', # audio quality (2 is good)
                temp_audio_path
            ]
            app_logger.info(f"Running FFmpeg command: {' '.join(ffmpeg_command)}")
            subprocess_process = subprocess.run(ffmpeg_command, capture_output=True, text=True, check=True)
            app_logger.info(f"FFmpeg stdout: {subprocess_process.stdout}")
            app_logger.info(f"FFmpeg stderr: {subprocess_process.stderr}")
            app_logger.info("Audio extraction by FFmpeg complete.")
        except subprocess.CalledProcessError as e:
            app_logger.error(f"FFmpeg audio extraction failed: {e}")
            app_logger.error(f"FFmpeg stdout: {e.stdout}")
            app_logger.error(f"FFmpeg stderr: {e.stderr}")
            raise RuntimeError(f"Audio extraction failed. Check FFmpeg installation and video file. Error: {e.stderr}")
        except FileNotFoundError:
            app_logger.error("FFmpeg command not found. Is FFmpeg installed and in your PATH?")
            raise RuntimeError("FFmpeg is not installed or not found in system PATH. Please install FFmpeg.")

        app_logger.info("Loading audio for WhisperX...")
        audio = whisperx.load_audio(temp_audio_path)
        app_logger.info("Audio loaded. Starting WhisperX transcription...")
        
        result = transcription_model.transcribe(audio)
        
        # --- Prepare Structured Transcript Segments for Frontend ---
        full_transcript_segments_for_frontend = []
        if result and "segments" in result:
            for seg in result["segments"]:
                if "text" in seg and "start" in seg:
                    full_transcript_segments_for_frontend.append({
                        "text": seg["text"].strip(),
                        "start": seg["start"],
                        "formatted_timestamp": format_timestamp(seg["start"]) # Add formatted timestamp here
                    })
        
        if not full_transcript_segments_for_frontend:
            app_logger.warning("WhisperX returned no transcript segments. Check audio quality or model.")
            # Do NOT raise error here, just return empty segments and proceed, or handle gracefully.
            # If no segments, LLM calls won't happen (chunk_segments will be empty).

        app_logger.info(f"Transcription complete. Found {len(full_transcript_segments_for_frontend)} segments.")

        sections = []
        # Only call LLM if there are actual transcript segments
        if full_transcript_segments_for_frontend:
            app_logger.info("Generating documentation sections with ChatLLM via SDK...")
            # Use original WhisperX result segments for chunking to preserve original structure/timing
            for chunk in chunk_segments(result.get("segments", [])): 
                if not chunk["text"].strip():
                    continue

                try:
                    title = generate_title(chunk["text"])
                    summary = summarize_text(chunk["text"])
                    
                    if summary and title:
                        sections.append({
                            "title": title.strip(),
                            "summary": summary.strip(),
                            "timestamp": chunk["timestamp"]
                        })
                except RuntimeError as llm_error:
                    app_logger.error(f"LLM generation failed for a chunk: {llm_error}", exc_info=True)
                    sections.append({
                        "title": "Error Generating Section",
                        "summary": f"Could not generate content for this part due to LLM error. Please check backend logs. Error: {llm_error}",
                        "timestamp": chunk.get("timestamp", 0)
                    })
            app_logger.info("Documentation generation complete.")
        else:
            app_logger.warning("No transcript segments to generate documentation from.")


        return jsonify({
            "full_transcript_segments": full_transcript_segments_for_frontend,
            "documentation": sections,
            "video_id": video_id # Pass YouTube video ID for player
        })

    except RuntimeError as re:
        app_logger.error(f"A runtime error occurred: {re}", exc_info=True)
        return jsonify({"error": str(re)}), 500
    except Exception as e:
        app_logger.error(f"An unexpected error occurred during upload: {e}", exc_info=True)
        return jsonify({"error": "An unexpected server error occurred: " + str(e)}), 500

    finally:
        for temp_file in [temp_video_path, temp_audio_path]:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
                app_logger.info(f"Cleaned up {temp_file}")
            else:
                app_logger.info(f"No temp file to clean up: {temp_file}") # Log if file didn't exist

@app.errorhandler(Exception)
def handle_exception(e):
    app_logger.error(f"An unhandled Flask exception occurred: {e}", exc_info=True)
    return jsonify({
        "error": str(e),
        "type": type(e).__name__,
        "message": "An unexpected error occurred on the server."
    }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
