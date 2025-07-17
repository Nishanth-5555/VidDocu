import os, re, torch, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import whisperx, ffmpeg
import yt_dlp
import google.generativeai as genai

load_dotenv()
app = Flask(__name__)
CORS(app)

# ✅ Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-2.5-flash")

# ✅ Load WhisperX model
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisperx.load_model("base", device, compute_type="float32")

# ✅ Chunk transcript into ~400-word blocks
def chunk_text(text, chunk_size=400):
    words = text.split()
    return [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]

# ✅ Gemini: Summarize transcript chunk
def summarize_with_gemini(text):
    prompt = f"""You are a technical documentation assistant.

Summarize the following transcript chunk into clear, concise bullet points. Focus on technical insights, instructions, or key takeaways. Format each point as a bullet starting with •.
If there is a conversation or a dialogue or anything summarise the story into the same bullet points.

Transcript:
{text}
"""
    response = gemini_model.generate_content(prompt)
    return response.text.strip() if response.text else ""

def generate_title_with_gemini(text):
    prompt = f"""You are a documentation assistant.

Read the following content and return a short, descriptive title (max 8 words) that captures its essence in a technical or thematic way.

Content:
{text}
"""
    response = gemini_model.generate_content(prompt)
    return response.text.strip() if response.text else None


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

        # ✅ Chunk + summarize
        chunks = chunk_text(transcript)
        titled_doc = []

        for section_idx, chunk in enumerate(chunks):
            summary = summarize_with_gemini(chunk)
            if not summary.strip():
                continue

    # 🔍 Smart bullet splitting
        raw_bullets = re.split(r"\n\*+", summary)
        bullets = [line.strip(" .") for line in raw_bullets if line.strip()]

         # 🟪 Generate section title from full summary text
        section_title = generate_title_with_gemini(summary) or f"Section {section_idx + 1}"

        subsections = []
        for sub_idx, bullet in enumerate(bullets):
        # 🟦 Generate title for each bullet point
            sub_title = generate_title_with_gemini(bullet) or f"Subsection {section_idx + 1}.{sub_idx + 1}"
            subsections.append({
            "title": sub_title,
            "text": f"• {bullet}"
        })

        titled_doc.append({
        "title": section_title,
        "subsections": subsections
    })




        faq_list = [
            {"question": "How do I upload a video?", "answer": "You can upload a video file or paste a YouTube URL."},
            {"question": "What formats are supported?", "answer": "MP4, MOV, and YouTube links are supported."},
            # more FAQs...
        ]

        return jsonify({
            "transcript": transcript,
            "documentation": titled_doc,
            "faqs": faq_list
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        for temp_file in ["temp.mp4", "temp.mp3"]:
            if os.path.exists(temp_file):
                os.remove(temp_file)
