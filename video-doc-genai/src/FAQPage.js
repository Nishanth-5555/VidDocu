// src/components/FAQPage.js
import React from "react";

function FAQPage() {
  const faqs = [
    {
      question: "How do I upload a video?",
      answer: "You can upload a video file or paste a YouTube URL."
    },
    {
      question: "What formats are supported?",
      answer: "MP4, MOV, and YouTube links are supported."
    },
    {
      question: "How long does it take to process a video?",
      answer: "Usually just a few seconds for short demos."
    }
  ];

  return (
    <div className="faq-page">
      <h2>❓ Frequently Asked Questions</h2>
      <div className="faq-list">
        {faqs.map((faq, index) => (
          <div key={index} className="faq-item">
            <strong>Q: {faq.question}</strong>
            <p>A: {faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FAQPage;
