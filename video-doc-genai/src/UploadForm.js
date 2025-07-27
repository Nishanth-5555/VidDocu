import React, { useState, useEffect, useRef } from "react";
// Import marked.js if you installed it via npm/yarn
import { marked } from 'marked'; // <--- THIS LINE IS CRUCIAL IF INSTALLED VIA NPM/YARN

function UploadForm() {
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [documentationSections, setDocumentationSections] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const playerRef = useRef(null);

  const sectionEmojis = ["✨", "🚀", "💡", "🛠️", "🎯", "📊", "✅", "🌐", "🔗", "🔍"];

  // --- Utility Functions ---

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00:00";
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const secs = date.getUTCSeconds();
    const parts = [];
    if (hours > 0) parts.push(String(hours).padStart(2, "0"));
    parts.push(String(minutes).padStart(2, "0"));
    parts.push(String(secs).padStart(2, "0"));
    return parts.join(":");
  };

  const toggleCollapse = (index) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  // --- YouTube Player Integration ---
  useEffect(() => {
    if (currentVideoId) {
      if (window.YT && window.YT.Player) {
        createYouTubePlayer(currentVideoId);
      } else {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api"; // YouTube IFrame Player API
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
          createYouTubePlayer(currentVideoId);
        };
      }
    } else if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
    }
  }, [currentVideoId]);

  const createYouTubePlayer = (videoId) => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    playerRef.current = new window.YT.Player("youtube-player", {
      videoId: videoId,
      playerVars: {
        controls: 1,
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
      },
      events: {
        onReady: (event) => console.log("YouTube Player is ready"),
      },
    });
  };

  const seekTo = (seconds) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(parseFloat(seconds), true);
      playerRef.current.playVideo();
    } else {
      setErrorMessage("Video player not ready or seek function unavailable. Please use a YouTube URL.");
      console.error("Video player not ready or seekTo function not available.");
    }
  };

  // --- Form Submission Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setTranscriptSegments([]);
    setDocumentationSections([]);
    setCurrentVideoId(null);

    const formData = new FormData();
    let isYouTube = false;

    if (videoUrl) {
      formData.append("video_url", videoUrl);
      isYouTube = true;
    } else if (videoFile) {
      formData.append("video", videoFile);
    } else {
      setErrorMessage("Please upload a video or enter a URL.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        if (data.error) {
            setErrorMessage(data.error);
        }
        setTranscriptSegments(data.full_transcript_segments || []);
        setDocumentationSections(data.documentation || []);
        
        if (isYouTube && data.video_id) {
            setCurrentVideoId(data.video_id);
        } else if (!isYouTube) {
            setErrorMessage("Video playback for uploaded files is not supported in this demo. Please use a YouTube URL.");
        }

      } else {
        setErrorMessage(data.error || "An unknown error occurred from server.");
        console.error("Upload failed (HTTP error):", data);
      }
    } catch (error) {
      setErrorMessage("Network error or server unavailable: " + error.message);
      console.error("Upload failed (Fetch error):", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2>📤 Upload a Demo Video</h2>

      <form onSubmit={handleSubmit}>
        <div className="browse-video-section">
          <label htmlFor="video-upload" className="browse-btn">
            🎥 Browse Video File
          </label>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            name="video"
            style={{ display: "none" }}
            onChange={(e) => setVideoFile(e.target.files[0])}
          />
          {videoFile && <span className="selected-file-name">{videoFile.name}</span>}
        </div>

        <p className="or-separator">— or —</p>

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

      {loading && <p className="loading-message">⏳ Processing... This may take a few minutes.</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {(transcriptSegments.length > 0 || documentationSections.length > 0 || loading) && (
        <div className="results-area">
          <div className="results-panel video-player-panel">
            <h3>Video Playback 🎥</h3>
            <div id="youtube-player" style={{ width: '100%', height: '360px' }}>
                { !currentVideoId && !errorMessage && !loading && <p className="video-placeholder-text">Please provide a YouTube URL to enable video playback.</p> }
                { loading && <p className="video-placeholder-text">Loading video player...</p>}
            </div>
          </div>

          <div className="results-panel">
            <h3>Full Transcript 📝</h3>
            <div className="transcript-output">
              {transcriptSegments.length > 0 ? (
                transcriptSegments.map((segment, index) => (
                  <p key={index} className="transcript-segment" onClick={() => seekTo(segment.start)}>
                    <span className="timestamp">{formatTime(segment.start)}</span>{" "}
                    {segment.text}
                  </p>
                ))
              ) : (
                !loading && <p>No transcript available.</p>
              )}
            </div>
          </div>

          <div className="results-panel">
            <h3>Generated Documentation 📚</h3>
            <div className="documentation-section-output">
              {documentationSections.length > 0 ? (
                documentationSections.map((section, index) => (
                  <div key={index} className="doc-collapse-item">
                    <button
                      className="doc-collapse-toggle"
                      onClick={() => toggleCollapse(index)}
                    >
                      {expandedIndex === index ? "− " : "+ "} 
                      <span className="doc-section-emoji">{sectionEmojis[index % sectionEmojis.length]}</span>
                      {section.title || `Section ${index + 1}`} — 
                      <span className="doc-timestamp"> ⏱️ {formatTime(section.timestamp)}</span>
                    </button>
                    {expandedIndex === index && (
                      <div className="doc-block" dangerouslySetInnerHTML={{ __html: marked.parse(section.summary) }} /> // <--- KEY CHANGE HERE //
                    )}
                  </div>
                ))
              ) : (
                !loading && <p>No documentation generated.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadForm;
