from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import whisperx, openai, os, ffmpeg
from openai import OpenAI
from dotenv import load_dotenv
import torch


load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
app = Flask(__name__)
CORS(app)
from transformers import pipeline
summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6")


device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisperx.load_model("base", device, compute_type="float32")

@app.route('/upload', methods=['POST'])
def upload_video():
    file = request.files['video']
    file.save("temp.mp4")

    ffmpeg.input("temp.mp4").output("temp.mp3").run()
    audio = whisperx.load_audio("temp.mp3")
    result = model.transcribe(audio)
    transcript = " ".join([seg["text"] for seg in result["segments"]])



    summary = summarizer(transcript, max_length=300, min_length=60, do_sample=False)
    documentation = summary[0]['summary_text']

   
    

    
    print("🔄 Received file:", file.filename)
    print("Transcribing with WhisperX...")
    print("Transcript:", transcript[:100])  # just a snippet    
    

    
    import os
    os.remove("temp.mp4")
    os.remove("temp.mp3")


    return jsonify({ "transcript": transcript, "documentation": documentation })
