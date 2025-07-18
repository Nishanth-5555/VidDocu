import os
import re
import torch
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from transformers import pipeline
import whisperx
import ffmpeg
import yt_dlp

# 🌍 Load environment variables
load_dotenv()

# ⚙️ Set up Flask
app = Flask(__name__)
CORS(app)

# 🧠 Load summarizer and transcription models
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
title_generator = pipeline("text2text-generation", model="t5-small")  # Optional

device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisperx.load_model("base", device, compute_type="float32")

# 🎥 Download YouTube video
def download_youtube_video(url, output_path="temp.mp4"):
    ydl_opts = {
        'outtmpl': output_path,
        'format': 'bestvideo+bestaudio/best',
        'merge_output_format': 'mp4',   
        'quiet': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
def summarize_text(text):
    token_count = len(text.split())

    # Auto-tune length limits based on input size
    max_len = min(300, max(30, token_count * 3))
    min_len = min(100, max(10, token_count * 1))

    # Skip summarizing ultra-short inputs
    if token_count < 8:
        return text

    summary = summarizer(text, max_length=max_len, min_length=min_len, do_sample=False)
    return summary[0]["summary_text"]



# 🚀 Main route
@app.route("/upload", methods=["POST"])
def upload_video():
    video_url = request.form.get("video_url")

    try:
        # 📥 Download or save video
        if video_url:
            download_youtube_video(video_url)
        else:
            file = request.files["video"]
            file.save("temp.mp4")

        # 🎙️ Convert and transcribe
        ffmpeg.input("temp.mp4").output("temp.mp3").run()
        audio = whisperx.load_audio("temp.mp3")
        result = model.transcribe(audio)
        transcript = " ".join([seg["text"] for seg in result["segments"]])
        summary_text = summarize_text(transcript)
        bullet_points = [f"• {line.strip()}" for line in summary_text.split(".") if line.strip()]



        # ❓ Static FAQs
        faq_list = [
            {
                "question": "How do I upload a video?",
                "answer": "You can upload a video file or paste a YouTube URL."
            },
            {
                "question": "What formats are supported?",
                "answer": "MP4, MOV, and YouTube links are supported."
            }
        ]

        # 📦 Return data
        return jsonify({
            "transcript": transcript,
            "documentation": bullet_points,
            "faqs": faq_list
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # 🧹 Clean up temp files
        for temp_file in ["temp.mp4", "temp.mp3"]:
            if os.path.exists(temp_file):
                os.remove(temp_file)
