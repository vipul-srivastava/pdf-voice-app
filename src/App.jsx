import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?worker";
import "./App.css";

// Production worker (Vite compatible)
pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorker();

const WORDS_PER_CLICK = 10;

export default function App() {
  const [status, setStatus] = useState("Upload a PDF to start.");
  const [previewText, setPreviewText] = useState("");
  const [progress, setProgress] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const pdfRef = useRef(null);
  const allWordsRef = useRef([]);
  const pointerRef = useRef(0);
  const isParsingRef = useRef(false);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  // Speech Engine
  const speak = (text) => {
    if (!text) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utter);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // BACKGROUND PARSER (non-blocking)
  const parseAllPagesInBackground = async (pdf) => {
    if (isParsingRef.current) return;
    isParsingRef.current = true;

    for (let i = 2; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent({
        disableCombineTextItems: true
      });

      const pageWords = [];

      for (const item of textContent.items) {
        if (item.str) {
          pageWords.push(...item.str.split(/\s+/));
        }
      }

      allWordsRef.current.push(...pageWords.filter(Boolean));
      setProgress(`Parsing page ${i} of ${pdf.numPages}...`);
    }

    setProgress("PDF fully parsed.");
  };

  // FAST FIRST PAGE PARSE
  const parseFirstPageFast = async (pdf) => {
    const page = await pdf.getPage(1);

    const textContent = await page.getTextContent({
      disableCombineTextItems: true
    });

    let words = [];

    for (const item of textContent.items) {
      if (item.str) {
        words.push(...item.str.split(/\s+/));
      }
    }

    allWordsRef.current = words.filter(Boolean);
    pointerRef.current = 0;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Opening PDF...");
    setPreviewText("");
    setProgress("");
    stop();

    try {
      const buffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        disableFontFace: true,
        disableAutoFetch: false
      });

      const pdf = await loadingTask.promise;
      pdfRef.current = pdf;

      setStatus("Preparing instant preview...");

      // Parse first page immediately
      await parseFirstPageFast(pdf);

      setStatus("Ready. Click Hear Instantly.");

      // Parse rest in background
      parseAllPagesInBackground(pdf);

    } catch (err) {
      console.error(err);
      setStatus("Could not open PDF.");
    }
  };

  // INSTANT 10 WORD CHUNK
  const hearNextChunk = () => {
    const words = allWordsRef.current;
    if (!words.length) {
      speak("No readable text found.");
      return;
    }

    const start = pointerRef.current;
    const end = start + WORDS_PER_CLICK;

    const chunk = words.slice(start, end).join(" ");

    pointerRef.current = end >= words.length ? 0 : end;

    setPreviewText(chunk);
    speak(chunk);
  };

  const hearFullPDF = () => {
    if (!allWordsRef.current.length) {
      speak("PDF not ready.");
      return;
    }

    speak(allWordsRef.current.join(" "));
  };

  return (
    <div className="bg">
      <div className="shell">

        <h1>⚡ PDF Voice Reader</h1>
        <p className="sub">Read PDF • 10 word preview • Instant listen</p>

        <label className="uploadBtn">
          Upload PDF
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFile}
          />
        </label>

        <div className="status">{status}</div>
        <div className="progress">{progress}</div>

        <div className="actions">
          <button className="btn primary" onClick={hearNextChunk}>
            ▶ Hear instantly next 10 words
          </button>

          <button className="btn" onClick={hearFullPDF}>
            Read Full PDF
          </button>

          <button
            className="btn danger"
            onClick={stop}
            disabled={!isSpeaking}
          >
            Stop
          </button>
        </div>

        <div className="card">
          <h3>Preview</h3>
          <div className="preview">
            {previewText || "Click Hear Instantly..."}
          </div>
        </div>

      </div>
    </div>
  );
}
