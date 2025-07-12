from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import whisper, openai, os, ffmpeg

load_dotenv()
app = Flask(__name__)
CORS(app)

model = whisper.load_model("base")

@app.route('/upload', methods=['POST'])
def upload_video():
    file = request.files['video']
    file.save("temp.mp4")

    ffmpeg.input("temp.mp4").output("temp.mp3").run()
    result = model.transcribe("temp.mp3")
    transcript = result["text"]

    openai.api_key = os.getenv("OPENAI_API_KEY")
    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Summarize and structure transcript into overview, features, usage guide, FAQs."},
            {"role": "user", "content": transcript}
        ]
    )

    documentation = response.choices[0].message["content"]

    return jsonify({ "transcript": transcript, "documentation": documentation })
