import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMicrophone, FaRobot, FaCloudUploadAlt } from "react-icons/fa";
import { MdStorage } from "react-icons/md";
import "./App.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="main">
      <header className="hero">
        <h1>🎥 Video to Documentation Converter</h1>
        <p>Transform product demos into structured, searchable knowledge using GenAI</p>
        <button className="cta-btn" onClick={() => navigate("/upload")}>
          Try It Now
        </button>
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

      <footer className="footer">
        <p>Made by the maums</p>
      </footer>
    </div>
  );
}

export default Home;
