import React from 'react';
import './App.css';

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
            <h3>🎙️ Whisper AI Transcription</h3>
            <p>Accurate multilingual transcription from video audio</p>
          </div>
          <div className="feature-card">
            <h3>🧠 GPT-4o Summarization</h3>
            <p>Auto-generates structured docs with FAQs and usage guides</p>
          </div>
          <div className="feature-card">
            <h3>☁️ Firebase Storage</h3>
            <p>Securely store videos and generated documentation</p>
          </div>
          <div className="feature-card">
            <h3>🌐 React + Flask Integration</h3>
            <p>Fast, scalable frontend and backend architecture</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Made by Mountain and Hound</p>
      </footer>
    </div>
  );
}

export default App;
