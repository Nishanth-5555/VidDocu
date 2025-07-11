import React from 'react';
import './App.css';
import { FaMicrophone, FaRobot, FaCloudUploadAlt } from 'react-icons/fa';
import { MdStorage } from 'react-icons/md';

function App() {
  return (
    <div className="main">
      <header className="hero">
        <h1>🎥 Video to Documentation Converter</h1>
        <p>Turn product walkthroughs into structured, searchable docs using GenAI</p>
        <button className="cta-btn">Get Started</button>
      </header>

      <section className="features">
        <h2> Key Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <FaMicrophone className="icon" />
            <h3>Whisper AI Transcription</h3>
            <p>Multilingual, high-accuracy audio-to-text conversion</p>
          </div>
          <div className="feature-card">
            <FaRobot className="icon" />
            <h3>GPT-4o Summarization</h3>
            <p>Auto-generates structured docs with FAQs and guides</p>
          </div>
          <div className="feature-card">
            <MdStorage className="icon" />
            <h3>Firebase Storage</h3>
            <p>Secure cloud storage for videos and documentation</p>
          </div>
          <div className="feature-card">
            <FaCloudUploadAlt className="icon" />
            <h3>React + Flask Integration</h3>
            <p>Fast, scalable frontend and backend architecture</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Made by maums</p>
      </footer>
    </div>
  );
}

export default App;
