import os, re, torch, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from transformers import pipeline
import whisperx, ffmpeg
import yt_dlp

load_dotenv()
app = Flask(__name__)
CORS(app)

# Load summarizer and transcription model
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisperx.load_model("base", device, compute_type="float32")
from transformers import pipeline

title_generator = pipeline("text2text-generation", model="t5-small")


def download_youtube_video(url, output_path="temp.mp4"):
    ydl_opts = {
        'outtmpl': output_path,
        'format': 'bestvideo+bestaudio/best',
        'merge_output_format': 'mp4',
        'quiet': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

@app.route("/upload", methods=["POST"])
def upload_video():
    video_url = request.form.get("video_url")
    try:
        if video_url:
            download_youtube_video(video_url)
        else:
            file = request.files["video"]
            file.save("temp.mp4")

        ffmpeg.input("temp.mp4").output("temp.mp3").run()
        audio = whisperx.load_audio("temp.mp3")
        result = model.transcribe(audio)
        transcript = " ".join([seg["text"] for seg in result["segments"]])
        summary = summarizer(transcript, max_length=300, min_length=60, do_sample=False)
        bullet_points = [f"• {line.strip()}" for line in summary[0]["summary_text"].split(".") if line.strip()]
        faq_list = [
    {"question": "How do I upload a video?", "answer": "You can upload a video file or paste a YouTube URL."},
    {"question": "What formats are supported?", "answer": "MP4, MOV, and YouTube links are supported."},
    # more FAQs...
]


        return jsonify({
            "transcript": transcript,
            "documentation": bullet_points,
            "faqs": faq_list
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        for temp_file in ["temp.mp4", "temp.mp3"]:
            if os.path.exists(temp_file):
                os.remove(temp_file)

