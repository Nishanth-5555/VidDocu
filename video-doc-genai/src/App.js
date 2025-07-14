import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UploadForm from "./UploadForm";
import Home from "./Home";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadForm />} />
      </Routes>
    </Router>
  );
}

export default App;
