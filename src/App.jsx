import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?worker";
import mammoth from "mammoth";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorker();

const WORDS_PER_CLICK = 10;

function AdUnit() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
      data-ad-slot="1234567890"
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  );
}

export default function App() {
  const [status, setStatus] = useState("Upload a file to start.");
  const [previewText, setPreviewText] = useState("");
  const [progress, setProgress] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const allWordsRef = useRef([]);
  const pointerRef = useRef(0);
  const isParsingRef = useRef(false);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

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

  const extractWords = (text) => {
    const words = text.split(/\s+/).filter(Boolean);
    allWordsRef.current = words;
    pointerRef.current = 0;
  };

  const parsePDF = async (file) => {
    setStatus("Opening PDF...");
    const buffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer)
    });

    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      textContent.items.forEach((item) => {
        if (item.str) fullText += item.str + " ";
      });

      setProgress(`Parsing page ${i} of ${pdf.numPages}...`);
    }

    setProgress("");
    extractWords(fullText);
    setStatus("PDF ready. Click Instant Preview.");
  };

  const parseTXT = async (file) => {
    setStatus("Reading text file...");
    const text = await file.text();
    extractWords(text);
    setStatus("Text file ready.");
  };

  const parseDOCX = async (file) => {
    setStatus("Reading Word file...");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    extractWords(result.value);
    setStatus("Word file ready.");
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewText("");
    setProgress("");
    stop();

    try {
      if (file.type === "application/pdf") {
        await parsePDF(file);
      } else if (file.type === "text/plain") {
        await parseTXT(file);
      } else if (file.name.endsWith(".docx")) {
        await parseDOCX(file);
      } else {
        setStatus("Unsupported file format.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Could not open file.");
    }
  };

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

  const hearFullFile = () => {
    if (!allWordsRef.current.length) {
      speak("File not ready.");
      return;
    }

    speak(allWordsRef.current.join(" "));
  };

  return (
    <div className="bg">
      <div className="shell">
        <h1>⚡ Document Voice for the Reader</h1>
        <p className="sub">PDF • Word • Listen </p>

        <AdUnit />

        <label className="uploadBtn">
          Upload File
          <input
            type="file"
            accept=".pdf,.txt,.docx"
            onChange={handleFile}
          />
        </label>

        <div className="status">{status}</div>
        <div className="progress">{progress}</div>

        <div className="actions">
          <button className="btn primary" onClick={hearNextChunk}>
            ▶ Slow Reading
          </button>

          <button className="btn" onClick={hearFullFile}>
            Read Full File
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
            {previewText || "Click Instant Preview to begin..."}
          </div>
        </div>

        <AdUnit />
      </div>
    </div>
  );
}
