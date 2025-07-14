import React, { useState } from "react";

function UploadForm() {
  const [transcript, setTranscript] = useState("");
  const [documentation, setDocumentation] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();

    if (videoUrl) {
      formData.append("video_url", videoUrl);
    } else if (e.target.video.files.length > 0) {
      formData.append("video", e.target.video.files[0]);
    } else {
      alert("Please upload a video or enter a URL.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setTranscript(data.transcript);
      setDocumentation(data.documentation || []);
      setFaqs(data.faqs || []);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = (index) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="upload-container">
      <h2>📤 Upload a Demo Video</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="video/*"
          name="video"
        />
        <p>— or —</p>
        <input
          type="text"
          placeholder="Paste video URL (e.g. .mp4, .webm)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>

      {loading && <p>⏳ Processing...</p>}

      {transcript && (
        <div className="result-section">
          <h3>📝 Transcript</h3>
          <p>{transcript}</p>

          <h3>📄 Documentation</h3>
          {Array.isArray(documentation) ? (
            documentation.map((point, index) => (
              <div key={index} className="collapse-item">
                <button
                  className="collapse-toggle"
                  onClick={() => toggleCollapse(index)}
                >
                  {expandedIndex === index ? "− " : "+ "} Section {index + 1}
                </button>
                {expandedIndex === index && <p>{point}</p>}
              </div>
            ))
          ) : (
            <p>{documentation}</p>
          )}

          <h3>❓ FAQs</h3>
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <strong>Q: {faq.question}</strong>
              <p>A: {faq.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadForm;

