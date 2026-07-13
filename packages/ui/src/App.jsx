import React, { useCallback, useState, useRef, useEffect, useContext } from "react";
import "./App.css";
import { useDropzone } from "react-dropzone";
import {
  faPowerOff,
  faGear,
  faPlayCircle,
  faWindowClose,
  faFile,
  faTrashCan,
  faAdd,
  faClock,
  faClose,
  faKey,
  faFolder,
  faStop,
  faMinus,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { secondsToHHMMSS } from "./util";
import loc from "./localization";
import Context from "./Context/Context";
import { bridge } from "./bridge";
import textToSpeechImg from "./assets/text-to-speech.png";
import splashImg from "./assets/splash.png";

const WIT_URL = "https://wit.ai";

const FileItem = ({ name, id, duration, deleteFile }) => {
  const shortName = name.length > 14 ? name.substring(0, 12) + "…" : name;
  const numberOfClips = Math.max(1, Math.round(duration / 18));
  return (
    <div className="card bg-base-100 p-2 my-1 rounded-none border-b-2">
      <div className="flex flex-row justify-between items-center">
        <div className="text-ellipsis">
          <FontAwesomeIcon icon={faFile} fixedWidth size="lg" className="text-neutral" />
          {shortName}
        </div>
        <div className="flex flex-row items-center">
          <span className="badge badge-success mx-2 p-3">{numberOfClips}</span>
          <span className="badge badge-success-content mx-2 p-3">
            <div className="text-white">
              <FontAwesomeIcon icon={faClock} fixedWidth size="lg" />
              {secondsToHHMMSS(duration)}
            </div>
          </span>
          <button
            className="btn btn-square btn-outline btn-sm btn-error rounded-lg"
            onClick={() => deleteFile(id)}
          >
            <FontAwesomeIcon icon={faWindowClose} fixedWidth size="lg" />
          </button>
        </div>
      </div>
    </div>
  );
};

const TokenHelpModal = ({ onClose }) => (
  <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-[60] bg-slate-200 bg-opacity-50">
    <div className="card bg-base-100 shadow p-8 w-96 text-start">
      <div className="absolute top-2 right-2">
        <button className="btn btn-ghost btn-square btn-sm mx-1" onClick={onClose}>
          <FontAwesomeIcon icon={faClose} fixedWidth size="lg" />
        </button>
      </div>
      <h2 className="font-bold text-lg mb-1">{loc.token_help_title}</h2>
      <p className="text-sm text-success mb-3">{loc.free_note}</p>
      <ol className="list-decimal ms-5 space-y-2 text-sm">
        <li>{loc.token_step1}</li>
        <li>{loc.token_step2}</li>
        <li>{loc.token_step3}</li>
        <li>{loc.token_step4}</li>
        <li>{loc.token_step5}</li>
      </ol>
      <button
        className="btn btn-sm btn-success rounded-lg mt-4"
        onClick={() => bridge.openLink(WIT_URL)}
      >
        {loc.open_wit}
      </button>
    </div>
  </div>
);

const SettingsModal = ({ toggleModal, appInfo }) => {
  const {
    speechLanguage, setSpeechLanguage,
    apiKey, setApiKey,
    interfaceLanguage, setInterfaceLanguage,
    outputDirectory, setOutputDirectory,
    conversionEngine, setConversionEngine,
    setTheme, theme,
  } = useContext(Context);
  const [tokenHelp, setTokenHelp] = useState(false);

  const chooseDir = async () => {
    const dir = await bridge.chooseOutputDir();
    if (dir) setOutputDirectory(dir);
  };

  return (
    <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 bg-slate-200 bg-opacity-50">
      {tokenHelp && <TokenHelpModal onClose={() => setTokenHelp(false)} />}
      <div className="card bg-base-100 shadow p-10 w-96">
        <div className="absolute top-2 right-2">
          <button className="btn btn-ghost btn-square btn-sm mx-1" onClick={toggleModal}>
            <FontAwesomeIcon icon={faClose} fixedWidth size="lg" />
          </button>
        </div>

        <div className="mb-2">
          <div className="text-start">{loc.speech_language}</div>
          <select
            className="select w-full max-w-xs"
            value={speechLanguage}
            onChange={(e) => setSpeechLanguage(e.target.value)}
          >
            <option value="ar">{loc.arabic}</option>
          </select>
          <hr />
        </div>

        <div className="mb-2">
          <div className="text-start">{loc.conversion_engine}</div>
          <select
            className="select w-full max-w-xs"
            value={conversionEngine}
            onChange={(e) => setConversionEngine(e.target.value)}
          >
            <option value="wit">Wit.ai</option>
          </select>
          <hr />
        </div>

        <div className="mb-2">
          <div className="text-start">{loc.interface_language}</div>
          <select
            className="select w-full max-w-xs"
            value={interfaceLanguage}
            onChange={(e) => setInterfaceLanguage(e.target.value)}
          >
            <option value="ar">{loc.arabic}</option>
            <option value="en">{loc.english}</option>
          </select>
          <hr />
        </div>

        <div className="mb-2">
          <div className="text-start">{loc.theme}</div>
          <select
            className="select w-full max-w-xs"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">{loc.light}</option>
            <option value="dark">{loc.dark}</option>
          </select>
          <hr />
        </div>

        <div className="mb-2">
          <div className="text-start my-1">
            <span className="mx-1">{loc.choose_output_directory}</span>
            <button className="btn btn-ghost btn-xs mx-2 rounded-lg" onClick={chooseDir}>
              <FontAwesomeIcon icon={faFolder} fixedWidth className="text-warning" />
            </button>
          </div>
          <input
            type="text"
            value={outputDirectory}
            disabled
            placeholder={appInfo?.defaultOutputDir || "output"}
            className="input input-bordered w-full max-w-xs"
          />
          <hr />
        </div>

        <div className="mb-2">
          <div className="text-start my-1 flex items-center justify-between">
            <span className="mx-1">
              {loc.enter_wit_api_key}
              <FontAwesomeIcon icon={faKey} fixedWidth className="text-warning mx-2" />
            </span>
            <button
              className="btn btn-ghost btn-xs text-info"
              onClick={() => setTokenHelp(true)}
            >
              <FontAwesomeIcon icon={faCircleInfo} fixedWidth />
              <span className="mx-1">{loc.how_to_get_token}</span>
            </button>
          </div>
          <input
            type="text"
            value={apiKey}
            className="input input-bordered w-full max-w-xs"
            onChange={(e) => setApiKey(e.target.value)}
          />
          <hr />
        </div>

        <button className="btn btn-sm btn-success rounded-lg" onClick={toggleModal}>
          {loc.save}
        </button>

        <div className="mt-8 flex flex-row items-center justify-between">
          <div className="text-slate-400">
            {loc.version_label} {appInfo?.version || ""}
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => bridge.openLink(appInfo?.projectUrl || "")}
          >
            {loc.project_updates}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageModal = () => {
  const { setError, error } = useContext(Context);
  return (
    <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 bg-slate-200 bg-opacity-50">
      <div className="card bg-base-100 shadow p-10 w-96">
        <div className="absolute top-2 right-2">
          <button className="btn btn-ghost btn-square btn-sm mx-1" onClick={() => setError("")}>
            <FontAwesomeIcon icon={faClose} fixedWidth size="lg" />
          </button>
        </div>
        <div className="mb-2 whitespace-pre-wrap break-words">{error}</div>
      </div>
    </div>
  );
};

const LoadingModal = () => (
  <div className="justify-center items-center flex fixed inset-0 z-50 bg-slate-200 bg-opacity-50">
    <div className="card bg-base-100 shadow p-10 w-96">
      <span className="loading loading-spinner loading-lg mx-auto" />
    </div>
  </div>
);

function MyDropzone() {
  const { filesToProcess, setFilesToProcess, setLoading, outputDirectory, setError } =
    useContext(Context);

  const addFiles = (files) => {
    setFilesToProcess((prev) => {
      const existing = new Set(prev.map((f) => f.path));
      const fresh = files.filter((f) => f.path && !existing.has(f.path));
      return [...fresh, ...prev];
    });
  };

  const handleNewFiles = async (files) => {
    if (!files.length) return;
    setLoading(true);
    try {
      const withDurations = await bridge.getDurations(files);
      addFiles(withDurations);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const files = acceptedFiles
      .map((file) => ({ name: file.name, path: bridge.getPathForFile(file) }))
      .filter((f) => f.path);
    handleNewFiles(files);
  }, []);

  const pickFiles = async () => {
    const files = await bridge.pickFiles();
    handleNewFiles(files);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: { "audio/*": [".mp3", ".wav", ".ogg", ".m4a", ".flac"] },
  });

  const openOutputDir = () => bridge.openOutputDir(outputDirectory);
  const clearFiles = () => setFilesToProcess([]);
  const deleteFile = (id) => setFilesToProcess((prev) => prev.filter((f) => f.path !== id));

  return (
    <div
      {...getRootProps()}
      className="card content-center items-center mb-3 mt-1 bg-base-100 rounded-lg p-2"
    >
      <input {...getInputProps()} />
      {filesToProcess?.length !== 0 ? (
        <div>
          <div className="flex flex-row justify-evenly my-2">
            <button className="btn btn-success btn-sm rounded-lg" onClick={pickFiles}>
              <FontAwesomeIcon icon={faAdd} fixedWidth size="lg" />
              <span>{loc.add}</span>
            </button>
            <button className="btn btn-success btn-sm btn-outline rounded-lg mx-2" onClick={openOutputDir}>
              <FontAwesomeIcon icon={faFolder} fixedWidth size="lg" />
              <span>{loc.open_out_dir}</span>
            </button>
            <button className="btn btn-error btn-sm btn-outline rounded-lg" onClick={clearFiles}>
              <FontAwesomeIcon icon={faTrashCan} fixedWidth size="lg" />
              <span>{loc.clear}</span>
            </button>
          </div>
          <div className="overflow-y-auto h-96">
            {filesToProcess.map((file) => (
              <FileItem
                key={file.path}
                id={file.path}
                name={file.name}
                duration={file.duration}
                deleteFile={deleteFile}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed h-72 flex flex-col justify-center items-center w-full">
          <img className="opacity-10" src={textToSpeechImg} width="128" height="128" alt="" />
          {isDragActive ? (
            <p>{loc.drop_files_here}</p>
          ) : (
            <div>
              <p>{loc.drag_and_drop_or_click_select_button}</p>
              <div className="flex flex-row items-center justify-center mt-2">
                <button className="btn btn-success btn-sm rounded-lg" onClick={pickFiles}>
                  <FontAwesomeIcon icon={faAdd} fixedWidth size="lg" />
                  <span>{loc.add}</span>
                </button>
                <button className="btn btn-success btn-sm btn-outline rounded-lg mx-2" onClick={openOutputDir}>
                  <FontAwesomeIcon icon={faFolder} fixedWidth size="lg" />
                  <span>{loc.open_out_dir}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ProcessStats = () => {
  const {
    setProcessStarted, processStarted, totalFiles, numApiRequests,
    filesToProcess, outputDirectory, timePerClip, totalClipsInFile,
    apiKey, setError, setNumApiRequests,
  } = useContext(Context);

  const start = () => {
    if (!filesToProcess.length) return setError(loc.pleaseAddSomeFiles);
    if (!apiKey || apiKey === "null") return setError(loc.pleaseEnterApiKey);
    setNumApiRequests(0);
    setProcessStarted(true);
    bridge.start({ files: filesToProcess, token: apiKey, outputDir: outputDirectory });
  };
  const stop = () => {
    setProcessStarted(false);
    bridge.stop();
  };

  const eta = secondsToHHMMSS((timePerClip * totalClipsInFile * (totalFiles || 1)) / 1000)
    .split(":")
    .map((s) => Math.round(Number(s)));

  return (
    <div className="card">
      <div className="stats stats-horizontal shadow mb-1 rounded-lg flex">
        {!processStarted ? (
          <div className="stat items-center">
            <button className="btn btn-circle btn-success" onClick={start}>
              <FontAwesomeIcon icon={faPlayCircle} fixedWidth size="lg" className="text-accent-content" />
            </button>
            <div className="mt-2 text-lg font-bold">{loc.start}</div>
          </div>
        ) : (
          <div className="stat items-center">
            <button className="btn btn-circle btn-error" onClick={stop}>
              <FontAwesomeIcon icon={faStop} fixedWidth size="lg" />
            </button>
            <div className="mt-2 text-lg font-bold">{loc.stop}</div>
          </div>
        )}
        <div className="stat">
          <div className="stat-title">{loc.files}</div>
          <div className="text-lg font-bold">{totalFiles}</div>
        </div>
        <div className="stat">
          <div className="stat-title">{loc.estimated_time}</div>
          <div className="text-lg font-bold">{eta[0]} {loc.hour}</div>
          <div className="text-lg font-bold">{eta[1]} {loc.min}</div>
        </div>
        <div className="stat">
          <div className="stat-title">{loc.network}</div>
          <div className="stat-title">{loc.requests}</div>
          <div className="text-lg font-bold">{numApiRequests}</div>
        </div>
      </div>
    </div>
  );
};

const TitleBar = ({ closeApp, toggleModal, minimizeApp }) => (
  <div className="flex flex-row justify-between items-center fixed top-0 bg-success w-full">
    <div className="flex flex-row justify-start items-center p-2">
      <button className="btn btn-ghost btn-square btn-error btn-sm" onClick={closeApp}>
        <FontAwesomeIcon icon={faPowerOff} fixedWidth size="lg" />
      </button>
      <button className="btn btn-ghost btn-square btn-error btn-sm" onClick={minimizeApp}>
        <FontAwesomeIcon icon={faMinus} fixedWidth size="lg" />
      </button>
      <button className="btn btn-ghost btn-square btn-sm mx-1" onClick={toggleModal}>
        <FontAwesomeIcon icon={faGear} fixedWidth size="lg" />
      </button>
    </div>
    <div className="title-bar top-1 text-base-100"> </div>
  </div>
);

const Progress = () => {
  const { currentClip, totalClipsInFile, step } = useContext(Context);
  let progressPercent = Math.round((currentClip / totalClipsInFile) * 100);
  if (!progressPercent || !Number.isFinite(progressPercent)) progressPercent = 0;
  return (
    <div>
      {step === 0 ? (
        <div
          className="radial-progress text-success font-bold ml-5 animate-spin"
          style={{ "--value": 50, "--thickness": "15px", "--size": "5rem" }}
        />
      ) : (
        <div
          className="radial-progress text-success font-bold ml-5"
          style={{ "--value": progressPercent, "--thickness": "15px", "--size": "5rem" }}
        >
          {progressPercent}%
        </div>
      )}
    </div>
  );
};

const FileStats = () => {
  const { currentFile, currentClip, totalClipsInFile, step, currentSubtitle } = useContext(Context);
  return (
    <div className="card bg-base-100 shadow-xl p-3 rounded-lg">
      <div className="text-sm">{currentFile?.name || currentFile}</div>
      <div className="flex flex-row justify-between items-center">
        <div className="w-1/3">
          <Progress />
        </div>
        <div className="w-2/3">
          <ul className="steps steps-vertical">
            <li className={`step step-${step === 0 ? "success" : "neutral"}`}>
              <div className="text-l">{loc.split_audio_files}</div>
            </li>
            <div className="font-bold text-xl">{totalClipsInFile}</div>
            <li className={`step step-${step === 1 ? "success" : "neutral"}`}>
              <div className="text-l">{loc.upload_to_server}</div>
            </li>
            <div className="font-bold text-xl">{totalClipsInFile} / {currentClip}</div>
          </ul>
        </div>
      </div>
      <div className="whitespace-pre-wrap break-words">{currentSubtitle}</div>
    </div>
  );
};

const SplashScreen = () => (
  <div className="App justify-center items-center flex">
    <div className="card w-full h-full">
      <img src={splashImg} width="480" height="250" alt="Sada" />
    </div>
  </div>
);

const App = () => {
  const [modal, setModal] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [appInfo, setAppInfo] = useState(null);
  const ctx = useContext(Context);
  const currentFileNameRef = useRef("");

  useEffect(() => {
    bridge.appInfo?.().then(setAppInfo).catch(() => {});

    const off = bridge.onProgress((event, payload) => {
      switch (event) {
        case "numberOfClips":
          ctx.setTotalClipsInFile(payload);
          break;
        case "clipCreated":
          ctx.setTotalClipsInFile((n) => n + 1);
          break;
        case "APIHit":
          ctx.setNumApiRequests((n) => n + 1);
          break;
        case "currentClip":
          ctx.setCurrentClip(payload);
          break;
        case "currentFile":
          currentFileNameRef.current = payload?.name || "";
          ctx.setCurrentFile(payload);
          break;
        case "timePerClip":
          ctx.setTimePerClip(payload);
          break;
        case "step":
          if (payload === 0) {
            ctx.setTotalClipsInFile(0);
            ctx.setCurrentClip(0);
          }
          ctx.setStep(payload);
          break;
        case "currentSubtitle":
          ctx.setCurrentSubtitle(payload);
          break;
        case "fileComplete": {
          const name = currentFileNameRef.current;
          if (name) ctx.setFilesToProcess((prev) => prev.filter((f) => f.name !== name));
          break;
        }
        case "processComplete":
          ctx.setProcessStarted(false);
          ctx.resetStats();
          break;
        case "error":
          ctx.setError(payload);
          break;
        default:
          break;
      }
    });

    const t = setTimeout(() => setAppReady(true), 1500);
    return () => {
      off?.();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  loc.setLanguage(ctx.interfaceLanguage || "ar");

  if (!appReady) return <SplashScreen />;

  return (
    <div
      className="App bg-neutral-content text-accent-content"
      data-theme={ctx.theme === "dark" ? "dark" : "light"}
      dir={ctx.interfaceLanguage === "en" ? "ltr" : "rtl"}
    >
      {modal && <SettingsModal toggleModal={() => setModal(!modal)} appInfo={appInfo} />}
      {ctx.loading && <LoadingModal />}
      {ctx.error && <MessageModal />}
      <section className="z-0 bg-success" />
      <TitleBar
        closeApp={() => bridge.quit()}
        toggleModal={() => setModal(!modal)}
        minimizeApp={() => bridge.minimize()}
      />
      <div className="mx-5 pt-16">
        <ProcessStats />
        <FileStats />
        <MyDropzone />
      </div>
    </div>
  );
};

export default App;
