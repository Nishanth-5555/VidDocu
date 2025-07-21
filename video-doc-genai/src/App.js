import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UploadForm from "./UploadForm";
import Home  from "/home/nishanthjsrkpseethi/project1/video-doc-genai/src/Home.js";
import FAQPage from "/home/nishanthjsrkpseethi/project1/video-doc-genai/src/FAQPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadForm />} />
        <Route path="/faqs" element={<FAQPage />} />
      </Routes>
    </Router>
  );
}

export default App;
