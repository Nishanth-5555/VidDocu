import React, { useState } from "react";

function UploadForm() {
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    setVideoFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("video", videoFile);

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error("Upload failed:", err);
    }

    setLoading(false);
  };

  return (
    <div className="upload-container">
      <form onSubmit={handleSubmit}>
        <input type="file" accept="video/mp4" onChange={handleFileChange} />
        <button type="submit">Upload & Transcribe</button>
      </form>

      {loading && <p>🔄 Processing video…</p>}
      {result && (
        <div>
          <h3>📝 Transcript:</h3>
          <p>{result.transcript}</p>
          <h3>📄 Documentation:</h3>
          <p>{result.documentation}</p>
        </div>
      )}
    </div>
  );
}

export default UploadForm;
