import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const [videoTitle, setVideoTitle] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState(null);
  const [videoDownloadUrl, setVideoDownloadUrl] = useState(null);

  // --- Refs for Scrolling ---
  const uploadFormRef = useRef(null);
  const docsRef = useRef(null);
  const faqRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  // --- Effect to handle navigation from Home page ---
  useEffect(() => {
    const state = location.state || {};
    if (state.url) {
      setVideoUrl(state.url);
      handleFormSubmit(state.url);
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (state.scrollTo) {
      const refMap = { faq: faqRef, docs: docsRef, upload: uploadFormRef };
      const targetRef = refMap[state.scrollTo];
      if (targetRef && targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location]);

  const handleFormSubmit = async (urlOverride = null) => {
    const currentUrl = urlOverride || videoUrl;
    if (!currentUrl && !videoFile) {
      setErrorMessage("Please upload a video or enter a URL.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    setTranscriptSegments([]);
    setDocumentationSections([]);
    setFaqs([]);
    setCurrentVideoId(null);
    setVideoPlaybackUrl(null);
    setVideoDownloadUrl(null);
    setVideoTitle("");

    const formData = new FormData();
    if (currentUrl) formData.append("video_url", currentUrl);
    else if (videoFile) formData.append("video", videoFile);
    formData.append("language", language);

    try {
      const res = await fetch("http://localhost:5000/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      
      setTranscriptSegments(data.full_transcript_segments || []);
      setDocumentationSections(data.documentation || []);
      setFaqs(data.faqs || []);
      setVideoTitle(data.video_title || "video_analysis");
      if (data.video_id) setCurrentVideoId(data.video_id);
      if (data.video_playback_url) setVideoPlaybackUrl(`http://localhost:5000${data.video_playback_url}`);
      if (data.video_download_url) setVideoDownloadUrl(`http://localhost:5000${data.video_download_url}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const baseFilename = videoUrl ? videoTitle : 'video_analysis';

  return (
    <div className="upload-container">
      <div ref={uploadFormRef}>
        <h2>📤 Upload & Analyze Video</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }} className="main-form">
          <div className="form-controls">
              <div className="language-selector">
                  <label htmlFor="language" style={{ color: '#6f42c1', fontWeight: '600' }}>Video Language: </label>
                  <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en">English</option><option value="hi">Hindi</option>
                      <option value="kn">Kannada</option><option value="ta">Tamil</option>
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
      </div>

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
                  {transcriptSegments.map((s, i) => <p key={i} className="transcript-segment" onClick={() => document.getElementById('youtube-player-container')?.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [s.start, true] }), '*') || document.getElementById('html-video-player')?.play()}><span className="timestamp">{s.formatted_timestamp}</span> {s.text}</p>)}
                </div>
              </div>
            </div>
          </div>

          <div className="results-grid">
            <div className="docs-column" ref={docsRef}>
                <div className="results-panel">
                    <div className="panel-header"><h3>Generated Documentation 📚</h3>
                        <DownloadButton content={documentationSections.map(s => `Title: ${s.title}\n\n${s.summary.replace(/###|##|#|\*|_/g, '')}`).join('\n\n---\n\n')} filename={`${baseFilename}_documentation.txt`} />
                    </div>
                    <CollapsibleSection items={documentationSections} type="docs" />
                </div>
            </div>
            <div className="faq-column" ref={faqRef}>
                <div className="results-panel">
                    <div className="panel-header"><h3>Frequently Asked Questions ❓</h3>
                        <DownloadButton content={faqs.map(faq => `Question: ${faq.question}\nAnswer: ${faq.answer}`).join('\n\n')} filename={`${baseFilename}_faqs.txt`} />
                    </div>
                    <CollapsibleSection items={faqs} type="faq" />
                </div>
            </div>
          </div>
        </>
      )}
      
      <ChatWidget 
        transcript={transcriptSegments.map(s => s.text).join(' ')}
        setVideoUrl={setVideoUrl}
        handleFormSubmit={handleFormSubmit}
        refs={{ uploadFormRef, docsRef, faqRef }}
      />
    </div>
  );
}

const VideoPlayer = ({ videoId, playbackUrl }) => {
  if (videoId) return <iframe id="youtube-player-container" width="100%" height="360" src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`} frameBorder="0" allowFullScreen style={{ borderRadius: '8px' }}></iframe>;
  if (playbackUrl) return <video id="html-video-player" src={playbackUrl} controls width="100%" height="360" style={{ borderRadius: '8px', backgroundColor: '#000' }}/>;
  return <div className="video-placeholder" style={{ height: '360px' }}><p>Video player will appear here.</p></div>;
};

const DownloadButton = ({ content, filename }) => {
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
  const toggle = (index) => setExpandedIndex(prev => prev === index ? null : index);
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="doc-collapse-item">
          <button className="doc-collapse-toggle" onClick={() => toggle(i)}>
            {expandedIndex === i ? "−" : "+"}
            {type === 'docs' ? `✨ ${item.title || 'Untitled'}` : item.question}
          </button>
          {expandedIndex === i && <div className="doc-block">{type === 'docs' ? <div dangerouslySetInnerHTML={{ __html: marked.parse(item.summary || "") }} /> : <p>{item.answer}</p>}</div>}
        </div>
      ))}
    </div>
  );
};

const ChatWidget = ({ transcript, setVideoUrl, handleFormSubmit, refs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isBotLoading, setIsBotLoading] = useState(false);
  const chatBodyRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatHistory]);

  const handleAskSubmit = async () => {
    if (!userQuestion.trim()) return;
    const question = userQuestion;
    const newHistory = [...chatHistory, { sender: 'user', text: question }];
    setChatHistory(newHistory);
    setUserQuestion("");
    setIsBotLoading(true);

    try {
      const commandRes = await fetch("http://localhost:5000/command", {
        method: "POST", headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: question }),
      });
      const commandData = await commandRes.json();
      if (!commandRes.ok) throw new Error(commandData.error || "Command error");

      switch (commandData.intent) {
        case 'upload_youtube_video':
          const url = commandData.parameters.url;
          setChatHistory([...newHistory, { sender: 'bot', text: `Understood! Uploading the video from: ${url}` }]);
          setVideoUrl(url);
          setTimeout(() => handleFormSubmit(url), 100);
          setIsOpen(false);
          break;
        
        case 'navigate':
          const page = commandData.parameters.page;
          const pageMap = { home: '/', faqs: '/faqs', upload: '/upload' };
          if (pageMap[page]) {
             setChatHistory([...newHistory, { sender: 'bot', text: `Sure, taking you to the ${page} page.` }]);
             setTimeout(() => navigate(pageMap[page]), 1000);
             setIsOpen(false);
          } else {
             setChatHistory([...newHistory, { sender: 'bot', text: `Sorry, I can't navigate to that page.` }]);
          }
          break;

        case 'scroll_to_section':
          const section = commandData.parameters.section;
          const refMap = { faq: refs.faqRef, docs: refs.docsRef, upload: refs.uploadFormRef };
          if (refMap[section] && refMap[section].current) {
            refMap[section].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setChatHistory([...newHistory, { sender: 'bot', text: `Sure, scrolling to the ${section} section.` }]);
            setIsOpen(false);
          } else {
             setChatHistory([...newHistory, { sender: 'bot', text: `I can't find the ${section} section. Please upload a video first to generate it.` }]);
          }
          break;

        case 'answer_question':
          if (!transcript) {
            setChatHistory([...newHistory, { sender: 'bot', text: "Please upload a video first so I can answer questions about it." }]);
            break;
          }
          const askRes = await fetch("http://localhost:5000/ask", {
            method: "POST", headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, context: transcript }),
          });
          const askData = await askRes.json();
          if (!askRes.ok) throw new Error(askData.error || "Bot error");
          setChatHistory([...newHistory, { sender: 'bot', text: askData.answer }]);
          break;
        
        default:
          setChatHistory([...newHistory, { sender: 'bot', text: "Sorry, I didn't understand that command." }]);
      }
    } catch (error) {
      setChatHistory([...newHistory, { sender: 'bot', text: `Error: ${error.message}` }]);
    } finally {
      setIsBotLoading(false);
    }
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setIsOpen(!isOpen)}>{isOpen ? '✕' : '🤖'}</button>
      <div className={`chat-window ${isOpen ? 'open' : ''}`}>
        <div className="chat-header"><h3>Ask the Assistant</h3></div>
        <div className="chat-body" ref={chatBodyRef}>
          {chatHistory.length === 0 && <div className="chat-message bot"><p>I can help! Try asking me: "Take me to the FAQs" or "Upload https://youtube.com/..."</p></div>}
          {chatHistory.map((entry, i) => <div key={i} className={`chat-message ${entry.sender}`}><p>{entry.text}</p></div>)}
          {isBotLoading && <div className="chat-message bot"><p>Thinking...</p></div>}
        </div>
        <div className="chat-input-area">
          <input type="text" value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} placeholder="Type a command or question..." onKeyPress={(e) => e.key === 'Enter' && handleAskSubmit()} />
          <button onClick={handleAskSubmit} disabled={isBotLoading || !userQuestion}>Send</button>
        </div>
      </div>
    </>
  );
};

export default UploadForm;
