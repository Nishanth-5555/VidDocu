import whisperx
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

# Only load ASR model — no diarization
model = whisperx.load_model("base", device, compute_type="float32")

audio = whisperx.load_audio("temp.mp3")
result = model.transcribe(audio)

transcript = " ".join([seg["text"] for seg in result["segments"]])
print("Transcript:", transcript)
