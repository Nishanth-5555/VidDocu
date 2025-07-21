import React, { useState } from "react";

function UploadForm() {
  const [transcript, setTranscript] = useState("");
  const [documentation, setDocumentation] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleCollapse = (index) => {
  setExpandedIndex((prev) => (prev === index ? null : index));
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();

    if (videoUrl) {
      formData.append("video_url", videoUrl);
    } else if (videoFile) {
      formData.append("video", videoFile);
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

  return (
    <div className="upload-container">
      <h2>📤 Upload a Demo Video</h2>

      <form onSubmit={handleSubmit}>
        <label htmlFor="video-upload" className="browse-btn">
          🎥 Browse Video
        </label>
        <input
          id="video-upload"
          type="file"
          accept="video/*"
          name="video"
          style={{ display: "none" }}
          onChange={(e) => setVideoFile(e.target.files[0])}
        />

        <p>— or —</p>

        <div className="url-submit-row">
          <input
            type="text"
            placeholder="Paste YouTube video URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="youtube-input"
          />
          <button type="submit" className="submit-btn">
            🚀 Submit
          </button>
        </div>
      </form>

      {loading && <p>⏳ Processing...</p>}

      {transcript && (
        <div className="result-section">
          <h3>📝 Transcript</h3>
          <p>{transcript}</p>

        <h3>📄 Documentation</h3>
<div className="documentation-section">
  {documentation.map((point, index) => (
    <div key={index} className="collapse-item">
      <button
        className="collapse-toggle"
        onClick={() => toggleCollapse(index)}
      >
        {expandedIndex === index ? "− " : "+ "} 📄 Section {index + 1}
      </button>
      {expandedIndex === index && (
        <div className="doc-block">
          <p>{typeof point === "string" ? point.replace(/^•\s?/, "") : "⚠️ Summary missing"}</p>
        </div>
      )}
    </div>
  ))}
</div>



        </div>
      )}
    </div>
  );
}

export default UploadForm;
