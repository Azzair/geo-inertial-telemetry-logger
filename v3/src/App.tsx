/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity, Compass, Flame, FileSpreadsheet, Wrench } from "lucide-react";
import { useTelemetryLogger } from "./hooks/useTelemetryLogger";

import SlideControl from "./components/SlideControl";
import SlideMetrics from "./components/SlideMetrics";
import SlideCharts from "./components/SlideCharts";
import SlideHistory from "./components/SlideHistory";
import SlideUtilities from "./components/SlideUtilities";
import { InstallPWAButton } from "./components/InstallPWAButton";
import { ReloadPrompt } from "./components/ReloadPrompt";

export default function App() {
  const {
    settings,
    setSettings,
    activeSlide,
    setActiveSlide,
    recordingComment,
    setRecordingComment,
    recordingState,
    durationMs,
    recordsCount,
    currentGPS,
    currentIMU,
    currentExtraSensors,
    liveWeather,
    sensorPermissionsGranted,
    wakeLockActive,
    offsetCalib,
    savedSessions,
    recoveryNotice,
    setRecoveryNotice,
    activeCarEngineType,
    setActiveCarEngineType,

    // OBD and acoustic values
    obdConnected,
    obdData,
    handleConnectOBDReal,
    handleConnectOBDSimulated,
    handleDisconnectOBD,
    authorizedDevices,
    fetchAuthorizedDevices,
    acousticRpmEnabled,
    acousticRpm,
    acousticFreq,
    acousticNoisy,
    acousticCylinders,
    setAcousticCylinders,
    handleStartAcousticRpm,
    handleStopAcousticRpm,

    // References & Action handlers
    recordsRef,
    handleCalibrate,
    handleResetCalibration,
    handleStartRecording,
    handleSessionDelete,
    handleDownloadSessionCSV,
    handleShareSessionFile,
    handlePauseRecording,
    handleResumeRecording,
    handleResetRecording,
    handleSaveAndResetRecording,
    formatMilliseconds,
    requestPermissions
  } = useTelemetryLogger();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-inner">
              <Activity className="w-5 h-5 animate-pulse" id="header_logo" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
                Geo-Inertial Telemetry Suite
                <span className="text-[10px] bg-indigo-900/30 text-indigo-300 font-mono font-bold py-0.5 px-2 rounded-full border border-indigo-500/20">
                  v{import.meta.env.VITE_APP_VERSION || "3.0.0-dev"}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Високоточний логер GPS (10-20Гц) та інерціальних датчиків з фільтрацією
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <InstallPWAButton />
            {recordingState === "recording" && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] font-mono text-red-400 uppercase font-bold tracking-wider">Запис</span>
              </div>
            )}
            {recordingState === "paused" && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider">Пауза</span>
              </div>
            )}
            {recordingState === "idle" && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">Готовий</span>
              </div>
            )}
            <div className="text-right text-[11px] font-mono text-slate-400 hidden md:block ml-2">
              <span className="text-slate-500">Режим: </span>
              <span className="text-emerald-400 font-bold">Реальні сенсори</span>
            </div>
          </div>
        </div>
      </header>

      {/* TABS SLIDES NAVIGATOR (MOBILE OPTIMIZED GRID & SLEEK SLIDER) */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-[69px] z-30 px-3 py-2 flex justify-center shadow-lg">
        <div className="max-w-6xl w-full grid grid-cols-2 sm:flex sm:flex-row bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 gap-1">
          {[
            { id: "control", label: "Запис & Керування", icon: Flame },
            { id: "metrics", label: "Показники & Сенсори", icon: Compass },
            { id: "charts", label: "Графіки Онлайн", icon: Activity },
            { id: "utilities", label: "Утиліти", icon: Wrench },
            { id: "history", label: "Архів сесій логів", icon: FileSpreadsheet }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSlide === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSlide(tab.id as any)}
                className={`flex-grow sm:flex-1 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-semibold font-sans cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                } ${tab.id === "history" ? "col-span-2 sm:col-span-1" : ""}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 lg:py-6 flex flex-col gap-6">

        {recoveryNotice && (
          <div className="bg-indigo-950/45 border-2 border-indigo-500/25 rounded-2xl p-4 flex items-start gap-3 shadow-lg shadow-indigo-950/20 text-indigo-200 animate-fadeIn relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
            <div className="flex-1 text-xs leading-relaxed">
              <p className="font-bold mb-1 text-indigo-150">Автоматичне відновлення даних!</p>
              {recoveryNotice}
            </div>
            <button
              onClick={() => setRecoveryNotice(null)}
              className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white cursor-pointer transition-colors text-xs font-mono font-bold"
            >
              Закрити
            </button>
          </div>
        )}

        {/* SLIDE 1: CONTROL & RECORDER SETUP */}
        {activeSlide === "control" && (
          <SlideControl
            recordingState={recordingState}
            handleStartRecording={handleStartRecording}
            handlePauseRecording={handlePauseRecording}
            handleResumeRecording={handleResumeRecording}
            handleResetRecording={handleResetRecording}
            handleSaveAndResetRecording={handleSaveAndResetRecording}
            formatMilliseconds={formatMilliseconds}
            durationMs={durationMs}
            recordsCount={recordsCount}
            settings={settings}
            setSettings={setSettings}
            wakeLockActive={wakeLockActive}
            recordingComment={recordingComment}
            setRecordingComment={setRecordingComment}
            obdConnected={obdConnected}
            activeCarEngineType={activeCarEngineType}
            setActiveCarEngineType={setActiveCarEngineType}
            handleConnectOBDReal={handleConnectOBDReal}
            handleConnectOBDSimulated={handleConnectOBDSimulated}
            handleDisconnectOBD={handleDisconnectOBD}
            obdData={obdData}
            offsetCalib={offsetCalib}
            handleCalibrate={handleCalibrate}
            sensorPermissionsGranted={sensorPermissionsGranted}
            requestPermissions={requestPermissions}
            authorizedDevices={authorizedDevices}
            fetchAuthorizedDevices={fetchAuthorizedDevices}
          />
        )}

        {/* SLIDE 2: FULL METRICS & COMPLEX ENVIRONMENTAL METRICS */}
        {activeSlide === "metrics" && (
          <SlideMetrics
            currentGPS={currentGPS}
            currentIMU={currentIMU}
            currentExtraSensors={currentExtraSensors}
            liveWeather={liveWeather}
            obdConnected={obdConnected}
            activeCarEngineType={activeCarEngineType}
            obdData={obdData}
            handleCalibrate={handleCalibrate}
            handleResetCalibration={handleResetCalibration}
            offsetCalib={offsetCalib}
          />
        )}

        {/* SLIDE 3: ONLINE CHARTS VISUALIZATION */}
        {activeSlide === "charts" && (
          <SlideCharts records={recordsRef.current} />
        )}

        {/* SLIDE 4: SAVED SESSIONS MANAGEMENT & SYSTEM ADVICES */}
        {activeSlide === "history" && (
          <SlideHistory
            savedSessions={savedSessions}
            handleDownloadSessionCSV={handleDownloadSessionCSV}
            handleShareSessionFile={handleShareSessionFile}
            handleSessionDelete={handleSessionDelete}
          />
        )}

        {/* SLIDE 5: COMPREHENSIVE UTILITIES & SPECTROSCOPY */}
        {activeSlide === "utilities" && (
          <SlideUtilities
            acousticRpmEnabled={acousticRpmEnabled}
            acousticRpm={acousticRpm}
            acousticFreq={acousticFreq}
            acousticNoisy={acousticNoisy}
            acousticCylinders={acousticCylinders}
            setAcousticCylinders={setAcousticCylinders}
            handleStartAcousticRpm={handleStartAcousticRpm}
            handleStopAcousticRpm={handleStopAcousticRpm}
            currentIMU={currentIMU}
            offsetCalib={offsetCalib}
            handleResetCalibration={handleResetCalibration}
          />
        )}

      </main>

      {/* FOOTER METADATA */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-xs font-mono space-y-1">
          <p>© 2026 Geo-Inertial Telemetry Suite. Спеціально для високочастотного аналізу на Android.</p>
          <p className="text-[10px] text-slate-600">Сенсори: Векторне інтегрування з затуханням нульового зміщення для запобігання похибкам.</p>
        </div>
      </footer>

      <ReloadPrompt />

    </div>
  );
}
