import React, { useState, useEffect, useRef } from "react";
import { marked } from 'marked';

// --- Main Component ---
function UploadForm() {
  // --- State Management ---
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [documentationSections, setDocumentationSections] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Player State
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState(null);
  const [videoDownloadUrl, setVideoDownloadUrl] = useState(null);
  const [videoTitle, setVideoTitle] = useState(""); // State for the title
  // UI State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // --- Handlers & Functions ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoUrl && !videoFile) {
      setErrorMessage("Please upload a video or enter a URL.");
      return;
    }
    // Reset all states
    setLoading(true);
    setErrorMessage("");
    setTranscriptSegments([]);
    setDocumentationSections([]);
    setFaqs([]);
    setCurrentVideoId(null);
    setVideoPlaybackUrl(null);
    setVideoDownloadUrl(null);
    setVideoTitle(""); // Reset title
    setIsChatOpen(false);

    const formData = new FormData();
    if (videoUrl) formData.append("video_url", videoUrl);
    else if (videoFile) formData.append("video", videoFile);
    formData.append("language", language);

    try {
      const res = await fetch("http://localhost:5000/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      
      setTranscriptSegments(data.full_transcript_segments || []);
      setDocumentationSections(data.documentation || []);
      setFaqs(data.faqs || []);
      setVideoTitle(data.video_title || "video_analysis"); // Set the title from backend
      if (data.video_id) setCurrentVideoId(data.video_id);
      if (data.video_playback_url) setVideoPlaybackUrl(`http://localhost:5000${data.video_playback_url}`);
      if (data.video_download_url) setVideoDownloadUrl(`http://localhost:5000${data.video_download_url}`);

    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const seekTo = (seconds) => {
    const player = document.getElementById('youtube-player-container');
    const htmlPlayer = document.getElementById('html-video-player');
    if (currentVideoId && player && player.contentWindow) {
        player.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), '*');
        player.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
    } else if (videoPlaybackUrl && htmlPlayer) {
      htmlPlayer.currentTime = seconds;
      htmlPlayer.play();
    }
  };

  // --- Intelligent Filename Logic ---
  // Use the video title for YouTube videos, otherwise use a generic name.
  const baseFilename = videoUrl ? videoTitle : 'video_analysis';

  return (
    <div className="upload-container">
      <h2>📤 Upload & Analyze Video</h2>
      <form onSubmit={handleSubmit} className="main-form">
        <div className="form-controls">
            <div className="language-selector">
                <label htmlFor="language" style={{ color: '#6f42c1', fontWeight: '600' }}>Video Language: </label>
                <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option><option value="hi">Hindi</option>
                    <option value="kn">Kannada</option><option value="ta">Tamil</option>
                    <option value="te">Telugu</option><option value="es">Spanish</option>
                </select>
            </div>
            <div className="browse-video-section">
                <label htmlFor="video-upload" className="browse-btn">🎥 Browse Video File</label>
                <input id="video-upload" type="file" accept="video/*" style={{ display: "none" }}
                    onChange={(e) => { setVideoFile(e.target.files[0]); setVideoUrl(""); }}/>
                {videoFile && <span className="selected-file-name">{videoFile.name}</span>}
            </div>
            <p className="or-separator">— or —</p>
            <div className="url-submit-row">
                <input type="text" placeholder="Paste YouTube video URL" value={videoUrl}
                    onChange={(e) => { setVideoUrl(e.target.value); setVideoFile(null); }} className="youtube-input"/>
                <button type="submit" className="submit-btn" disabled={loading}>{loading ? "Processing..." : "🚀 Analyze"}</button>
            </div>
        </div>
      </form>

      {loading && <p className="loading-message">⏳ Processing... This may take a few minutes.</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {transcriptSegments.length > 0 && (
        <>
          <div className="results-grid">
            <div className="video-column">
              <div className="results-panel">
                <div className="panel-header">
                  <h3>Video Playback 🎥</h3>
                  {videoDownloadUrl && <a href={videoDownloadUrl} download className="download-btn">Download Video</a>}
                </div>
                <VideoPlayer videoId={currentVideoId} playbackUrl={videoPlaybackUrl} />
              </div>
            </div>
            <div className="transcript-column">
              <div className="results-panel">
                <div className="panel-header"><h3>Full Transcript 📝</h3>
                  <DownloadButton content={transcriptSegments.map(s => `[${s.formatted_timestamp}] ${s.text}`).join('\n')} filename={`${baseFilename}_transcript.txt`} />
                </div>
                <div className="transcript-output">
                  {transcriptSegments.map((s, i) => <p key={i} className="transcript-segment" onClick={() => seekTo(s.start)}><span className="timestamp">{s.formatted_timestamp}</span> {s.text}</p>)}
                </div>
              </div>
            </div>
          </div>

          <div className="results-grid">
            <div className="docs-column">
                <div className="results-panel">
                    <div className="panel-header"><h3>Generated Documentation 📚</h3>
                        <DownloadButton 
                            content={documentationSections.map(s => `Title: ${s.title}\n\n${s.summary.replace(/###|##|#|\*|_/g, '')}`).join('\n\n==============================\n\n')} 
                            filename={`${baseFilename}_documentation.txt`} 
                        />
                    </div>
                    <CollapsibleSection items={documentationSections} type="docs" />
                </div>
            </div>
            <div className="faq-column">
                <div className="results-panel">
                    <div className="panel-header"><h3>Frequently Asked Questions ❓</h3>
                        <DownloadButton 
                            content={faqs.map(faq => `Question: ${faq.question}\nAnswer: ${faq.answer}`).join('\n\n')} 
                            filename={`${baseFilename}_faqs.txt`} 
                        />
                    </div>
                    <CollapsibleSection items={faqs} type="faq" />
                </div>
            </div>
          </div>

          <ChatWidget transcript={transcriptSegments.map(s => s.text).join(' ')} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
        </>
      )}
    </div>
  );
}

// --- Child Components for Cleaner Code ---

const VideoPlayer = ({ videoId, playbackUrl }) => {
  if (videoId) {
    return <iframe id="youtube-player-container" width="100%" height="360" src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ borderRadius: '8px' }}></iframe>;
  }
  if (playbackUrl) {
    return <video id="html-video-player" src={playbackUrl} controls width="100%" height="360" style={{ borderRadius: '8px', backgroundColor: '#000' }}/>;
  }
  return <div className="video-placeholder" style={{ height: '360px' }}><p>Video player will appear here.</p></div>;
};

const DownloadButton = ({ content, filename }) => {
  // Sanitize the filename to remove invalid characters
  const sanitizedFilename = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
  
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sanitizedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  return <button onClick={handleDownload} className="download-btn">Download</button>;
};

const CollapsibleSection = ({ items, type }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const sectionEmojis = ["✨", "🚀", "💡", "🛠️", "🎯", "📊", "✅", "🌐", "🔗", "🔍"];
  const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(11, 8);

  const toggle = (index) => setExpandedIndex(prev => prev === index ? null : index);

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="doc-collapse-item">
          <button className="doc-collapse-toggle" onClick={() => toggle(i)}>
            {expandedIndex === i ? "−" : "+"}
            {type === 'docs' ? (
              <>
                <span className="doc-section-emoji">{sectionEmojis[i % sectionEmojis.length]}</span>
                {item.title || 'Untitled Section'}
                <span className="doc-timestamp">⏱️ {formatTime(item.timestamp)}</span>
              </>
            ) : item.question}
          </button>
          {expandedIndex === i && (
            <div className="doc-block">
              {type === 'docs' ? <div dangerouslySetInnerHTML={{ __html: marked.parse(item.summary || "") }} /> : <p>{item.answer}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ChatWidget = ({ transcript, isOpen, setIsOpen }) => {
  const [userQuestion, setUserQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isBotLoading, setIsBotLoading] = useState(false);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleAskSubmit = async () => {
    if (!userQuestion.trim()) return;
    const newHistory = [...chatHistory, { sender: 'user', text: userQuestion }];
    setChatHistory(newHistory);
    setUserQuestion("");
    setIsBotLoading(true);

    try {
      const res = await fetch("http://localhost:5000/ask", {
        method: "POST", headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, context: transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bot error");
      setChatHistory([...newHistory, { sender: 'bot', text: data.answer }]);
    } catch (error) {
      setChatHistory([...newHistory, { sender: 'bot', text: `Error: ${error.message}` }]);
    } finally {
      setIsBotLoading(false);
    }
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '🤖'}
      </button>
      <div className={`chat-window ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <h3>Ask the Assistant</h3>
          <button className="chat-close-btn" onClick={() => setIsOpen(false)}>✕</button>
        </div>
        <div className="chat-body" ref={chatBodyRef}>
          {chatHistory.length === 0 && <div className="chat-message bot"><p>Ask me anything about the video!</p></div>}
          {chatHistory.map((entry, index) => (
            <div key={index} className={`chat-message ${entry.sender}`}>
              <p>{entry.text}</p>
            </div>
          ))}
          {isBotLoading && <div className="chat-message bot"><p>Thinking...</p></div>}
        </div>
        <div className="chat-input-area">
          <input type="text" value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} placeholder="Type your question..." onKeyPress={(e) => e.key === 'Enter' && handleAskSubmit()} />
          <button onClick={handleAskSubmit} disabled={isBotLoading || !userQuestion}>Send</button>
        </div>
      </div>
    </>
  );
};

export default UploadForm;

