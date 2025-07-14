import React from "react";
import UploadForm from "./UploadForm";
import { FaMicrophone, FaRobot, FaCloudUploadAlt } from "react-icons/fa";
import { MdStorage } from "react-icons/md";
import "./App.css"; // Or wherever your stylesheet lives


function App() {
  return (
    <div className="main">
      <header className="hero">
        <h1>🎥 Video to Documentation Converter</h1>
        <p>Transform product demos into structured, searchable knowledge using GenAI</p>
        <button className="cta-btn">Try It Now</button>
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
            <h3>GPT-4o Summarization</h3>
            <p>Auto-generates structured docs with FAQs and guides</p>
          </div>
          <div className="feature-card">
            <MdStorage className="icon" />
            <h3>Firebase Storage</h3>
            <p>Securely store videos and generated documentation</p>
          </div>
          <div className="feature-card">
            <FaCloudUploadAlt className="icon" />
            <h3>React + Flask Integration</h3>
            <p>Fast, scalable frontend and backend architecture</p>
          </div>
        </div>
      </section>

      {/* 🔽 Add the UploadForm component here */}
      <section className="upload-section">
        <h2>📤 Try It Out!</h2>
        <UploadForm />
      </section>

      <footer className="footer">
        <p>Made by the maums</p>
      </footer>
    </div>
  );
}

export default App;
