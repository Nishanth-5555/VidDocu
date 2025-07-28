import React, { useState, useEffect, useRef } from "react";
import { marked } from 'marked';

function UploadForm() {
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [documentationSections, setDocumentationSections] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState(null);

  const playerRef = useRef(null); // For YouTube player
  const htmlPlayerRef = useRef(null); // For HTML5 video player
  
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
  
  const toggleFaqCollapse = (index) => {
    setExpandedFaqIndex((prev) => (prev === index ? null : index));
  };

  // --- YouTube Player Integration ---
  useEffect(() => {
    if (currentVideoId) {
      if (window.YT && window.YT.Player) {
        createYouTubePlayer(currentVideoId);
      } else {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
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
      playerVars: { controls: 1, autoplay: 0, modestbranding: 1, rel: 0, iv_load_policy: 3 },
      events: { onReady: () => console.log("YouTube Player is ready") },
    });
  };

  // --- Player Controls ---
  const seekTo = (seconds) => {
    if (currentVideoId && playerRef.current?.seekTo) {
      playerRef.current.seekTo(parseFloat(seconds), true);
      playerRef.current.playVideo();
    } 
    else if (videoPlaybackUrl && htmlPlayerRef.current) {
      htmlPlayerRef.current.currentTime = parseFloat(seconds);
      htmlPlayerRef.current.play();
    } else {
      setErrorMessage("Video player not ready or seek function unavailable.");
    }
  };

  // --- Form Submission Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setTranscriptSegments([]);
    setDocumentationSections([]);
    setFaqs([]);
    setCurrentVideoId(null);
    setVideoPlaybackUrl(null);

    const formData = new FormData();
    if (videoUrl) {
      formData.append("video_url", videoUrl);
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
      console.log("API RESPONSE RECEIVED:", data);

      if (res.ok) {
        if (data.error) {
            setErrorMessage(data.error);
        }
        setTranscriptSegments(data.full_transcript_segments || []);
        setDocumentationSections(data.documentation || []);
        setFaqs(data.faqs || []);
        
        if (data.video_id) {
            setCurrentVideoId(data.video_id);
        } else if (data.video_playback_url) {
            setVideoPlaybackUrl(`http://localhost:5000${data.video_playback_url}`);
        }
      } else {
        setErrorMessage(data.error || "An unknown error occurred from server.");
      }
    } catch (error) {
      setErrorMessage("Network error or server unavailable: " + error.message);
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
            onChange={(e) => {
                setVideoFile(e.target.files[0]);
                setVideoUrl(""); // Clear URL input when a file is selected
            }}
          />
          {videoFile && <span className="selected-file-name">{videoFile.name}</span>}
        </div>

        <p className="or-separator">— or —</p>

        <div className="url-submit-row">
          <input
            type="text"
            placeholder="Paste YouTube video URL"
            value={videoUrl}
            onChange={(e) => {
                setVideoUrl(e.target.value);
                setVideoFile(null); // Clear file input when a URL is typed
            }}
            className="youtube-input"
          />
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Processing..." : "🚀 Submit"}
          </button>
        </div>
      </form>

      {loading && <p className="loading-message">⏳ Processing... This may take a few minutes.</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {(transcriptSegments.length > 0 || documentationSections.length > 0 || faqs.length > 0 || loading) && (
        <div className="results-area">
          <div className="results-panel video-player-panel">
            <h3>Video Playback 🎥</h3>
            <div className="video-player-container">
              {currentVideoId && (
                <div id="youtube-player" style={{ width: '100%', height: '360px' }}></div>
              )}
              {videoPlaybackUrl && (
                <video
                  ref={htmlPlayerRef}
                  src={videoPlaybackUrl}
                  controls
                  width="100%"
                  height="360"
                  style={{ backgroundColor: '#000' }}
                >
                  Your browser does not support the video tag.
                </video>
              )}
              {!currentVideoId && !videoPlaybackUrl && (
                <div className="video-placeholder" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                  <p className="video-placeholder-text">Video player will appear here.</p>
                </div>
              )}
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
                      <div className="doc-block" dangerouslySetInnerHTML={{ __html: marked.parse(section.summary) }} />
                    )}
                  </div>
                ))
              ) : (
                !loading && <p>No documentation generated.</p>
              )}
            </div>
          </div>
          
          <div className="results-panel">
            <h3>Frequently Asked Questions ❓</h3>
            <div className="faq-section-output">
              {faqs.length > 0 ? (
                faqs.map((faq, index) => (
                  <div key={index} className="doc-collapse-item">
                    <button
                      className="doc-collapse-toggle"
                      onClick={() => toggleFaqCollapse(index)}
                    >
                      {expandedFaqIndex === index ? "− " : "+ "}
                      {faq.question}
                    </button>
                    {expandedFaqIndex === index && (
                      <div className="doc-block">
                        <p>{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                !loading && <p>No FAQs generated.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadForm;
