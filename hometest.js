import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaMicrophone, FaRobot, FaCloudUploadAlt } from "react-icons/fa";
import "./App.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="main">
      <header className="hero">
        <h1>🎥 Video to Documentation Converter</h1>
        <p>Transform product demos into structured, searchable knowledge using GenAI</p>
        <div className="home-button-group">
          <button className="cta-btn" onClick={() => navigate("/upload")}>
            🚀 Try It Now
          </button>
        </div>
      </header>

      <section className="features">
        <h2>✨ Key Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <FaMicrophone className="icon" />
            <h3>Whisper AI Transcription</h3>
            <p>Accurate multilingual transcription from video audio</p>
          </div>
          <div className="feature-card">
            <FaRobot className="icon" />
            <h3>OpenAI Integration</h3>
            <p>Powerful content generation with GPT models</p>
          </div>
          <div className="feature-card">
            <FaCloudUploadAlt className="icon" />
            <h3>React + Flask Integration</h3>
            <p>Fast, scalable frontend and backend architecture</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        {/* You can add more content here if needed */}
      </footer>

      {/* --- Add the Chat Widget to the Home page --- */}
      <ChatWidget />
    </div>
  );
}

// --- Reusable Chat Widget Component ---
const ChatWidget = () => {
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
          setChatHistory([...newHistory, { sender: 'bot', text: `Perfect! Taking you to the upload page to analyze: ${url}` }]);
          // Navigate to upload page and pass the URL in state
          setTimeout(() => navigate('/upload', { state: { url: url } }), 1000);
          setIsOpen(false);
          break;
        
        case 'scroll_to_section':
          // On the home page, "upload", "demo", "try it" all mean go to the upload page.
          const section = commandData.parameters.section;
          if (section === 'upload' || section === 'faq' || section === 'docs') {
             setChatHistory([...newHistory, { sender: 'bot', text: `Sure, taking you to the main application page.` }]);
             setTimeout(() => navigate('/upload'), 1000);
             setIsOpen(false);
          } else {
             setChatHistory([...newHistory, { sender: 'bot', text: `Sorry, I can't navigate to that section from here.` }]);
          }
          break;

        case 'answer_question':
          // The bot on the home page doesn't have transcript context
          setChatHistory([...newHistory, { sender: 'bot', text: "I can answer questions about a video once you upload one on the 'Try It Now' page." }]);
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
          {chatHistory.length === 0 && <div className="chat-message bot"><p>Hi! How can I help you? You can ask me to "take you to the demo" or "upload a youtube video...".</p></div>}
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

export default Home;

