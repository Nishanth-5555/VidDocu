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
            <h3>Abacus AI Integration</h3>
            <p> A wide range of trained models</p>
          </div>
          
          <div className="feature-card">
            <FaCloudUploadAlt className="icon" />
            <h3>React + Flask Integration</h3>
            <p>Fast, scalable frontend and backend architecture</p>
          </div>
        </div>
      </section>

      <footer className="footer">
          <button className="cta-btn secondary" onClick={() => navigate("/faqs")}>
            📚 Learn More
          </button>
        <p>Made by the maums</p>
      </footer>
    </div>
  );
}

export default Home;
