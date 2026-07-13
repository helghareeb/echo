import React, { useEffect, useState } from "react";
import loc from "../localization";
import Context from "./Context";

const persisted = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    const val = raw ? JSON.parse(raw) : null;
    return val ?? fallback;
  } catch {
    return fallback;
  }
};

export default function ContextWrapper(props) {
  const [numApiRequests, setNumApiRequests] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [currentClip, setCurrentClip] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalClipsInFile, setTotalClipsInFile] = useState(0);
  const [step, setStep] = useState(-1);
  const [timePerClip, setTimePerClip] = useState(0);
  const [filesToProcess, setFilesToProcess] = useState([]);
  const [processStarted, setProcessStarted] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [speechLanguage, setSpeechLanguage] = useState(() => persisted("speechLanguage", "ar"));
  const [theme, setTheme] = useState(() => persisted("theme", "light"));
  const [conversionEngine, setConversionEngine] = useState(() => persisted("conversionEngine", "wit"));
  const [apiKey, setApiKey] = useState(() => persisted("apiKey", ""));
  const [interfaceLanguage, setInterfaceLanguage] = useState(() => persisted("interfaceLanguage", "ar"));
  const [outputDirectory, setOutputDirectory] = useState(() => persisted("outputDirectory", ""));

  const resetStats = () => {
    setCurrentClip(0);
    setCurrentFile("");
    setTotalClipsInFile(0);
    setStep(-1);
    setCurrentSubtitle("");
  };

  useEffect(() => {
    localStorage.setItem("speechLanguage", JSON.stringify(speechLanguage));
    localStorage.setItem("conversionEngine", JSON.stringify(conversionEngine));
    localStorage.setItem("interfaceLanguage", JSON.stringify(interfaceLanguage));
    loc.setLanguage(interfaceLanguage);
    localStorage.setItem("outputDirectory", JSON.stringify(outputDirectory));
    localStorage.setItem("apiKey", JSON.stringify(apiKey));
    localStorage.setItem("theme", JSON.stringify(theme));
  }, [speechLanguage, conversionEngine, apiKey, interfaceLanguage, outputDirectory, theme]);

  useEffect(() => {
    setTotalFiles(filesToProcess.length);
  }, [filesToProcess]);

  return (
    <Context.Provider
      value={{
        numApiRequests, setNumApiRequests,
        currentFile, setCurrentFile,
        currentClip, setCurrentClip,
        totalFiles, setTotalFiles,
        totalClipsInFile, setTotalClipsInFile,
        filesToProcess, setFilesToProcess,
        step, setStep,
        timePerClip, setTimePerClip,
        speechLanguage, setSpeechLanguage,
        apiKey, setApiKey,
        interfaceLanguage, setInterfaceLanguage,
        outputDirectory, setOutputDirectory,
        conversionEngine, setConversionEngine,
        processStarted, setProcessStarted,
        resetStats,
        currentSubtitle, setCurrentSubtitle,
        setLoading, loading,
        setError, error,
        theme, setTheme,
      }}
    >
      {props.children}
    </Context.Provider>
  );
}
