/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, Pause, RotateCcw, FileSpreadsheet, Download } from "lucide-react";
import { FilterSettings, CalibrationData } from "../types";
import ObdConfigSection from "./control/ObdConfigSection";
import TuningConfigSection from "./control/TuningConfigSection";

interface SlideControlProps {
  recordingState: "idle" | "recording" | "paused";
  handleStartRecording: () => void;
  handlePauseRecording: () => void;
  handleResumeRecording: () => void;
  handleResetRecording: () => void;
  handleSaveAndResetRecording: () => void;
  formatMilliseconds: (ms: number) => string;
  durationMs: number;
  recordsCount: number;
  settings: FilterSettings;
  setSettings: (updater: FilterSettings | ((prev: FilterSettings) => FilterSettings)) => void;
  wakeLockActive: boolean;
  recordingComment: string;
  setRecordingComment: (val: string) => void;
  obdConnected: "disconnected" | "connecting" | "real" | "simulated";
  activeCarEngineType: "ice" | "electric";
  setActiveCarEngineType: (type: "ice" | "electric") => void;
  handleConnectOBDReal: () => void;
  handleConnectOBDSimulated: () => void;
  handleDisconnectOBD: () => void;
  obdData: {
    rpm: number | null;
    speed: number | null;
    gear: string | null;
    fuelFlow: number | null;
    fuelEconomy: number | null;
    coolantTemp: number | null;
    oilTemp: number | null;
    totalFuelUsed: number | null;
    electricPower: number | null;
    energyConsumption: number | null;
    batterySOC: number | null;
    recuperation: number | null;
  };
  offsetCalib: CalibrationData;
  handleCalibrate: () => void;
  sensorPermissionsGranted: boolean | null;
  requestPermissions: () => void;
  authorizedDevices: any[];
  fetchAuthorizedDevices: () => void;
}

export default function SlideControl({
  recordingState,
  handleStartRecording,
  handlePauseRecording,
  handleResumeRecording,
  handleResetRecording,
  handleSaveAndResetRecording,
  formatMilliseconds,
  durationMs,
  recordsCount,
  settings,
  setSettings,
  wakeLockActive,
  recordingComment,
  setRecordingComment,
  obdConnected,
  activeCarEngineType,
  setActiveCarEngineType,
  handleConnectOBDReal,
  handleConnectOBDSimulated,
  handleDisconnectOBD,
  obdData,
  offsetCalib,
  handleCalibrate,
  sensorPermissionsGranted,
  requestPermissions,
  authorizedDevices,
  fetchAuthorizedDevices
}: SlideControlProps) {
  return (
    <div className="space-y-6" id="slide_control">
      
      {/* TOP STATUS CONTROL DECK */}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg relative overflow-hidden" id="control_status_deck">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Recording Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {recordingState !== "recording" ? (
              <button
                onClick={recordingState === "paused" ? handleResumeRecording : handleStartRecording}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 cursor-pointer border border-emerald-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                id="btn_start_recording"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{recordingState === "paused" ? "Продовжити запис" : "Розпочати запис лога"}</span>
              </button>
            ) : (
              <button
                onClick={handlePauseRecording}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-amber-50 shadow-lg shadow-amber-950/20 cursor-pointer border border-amber-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                id="btn_pause_recording"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Призупинити</span>
              </button>
            )}

            {recordingState !== "idle" && (
              <>
                <button
                  onClick={handleSaveAndResetRecording}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-white text-slate-950 shadow-md cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                  id="btn_save_recording"
                >
                  <Download className="w-4 h-4" />
                  <span>Зберегти & Зупинити</span>
                </button>

                <button
                  onClick={handleResetRecording}
                  className="p-3.5 rounded-xl bg-slate-950/70 text-rose-400 hover:bg-rose-950 hover:text-rose-350 border border-slate-800 hover:border-rose-900/30 cursor-pointer transition-all active:scale-[0.95]"
                  title="Скинути поточну сесію"
                  id="btn_reset_recording"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Current snapshot metrics (frequency, duration, recordCount) */}
          <div className="flex items-center gap-5 sm:gap-8 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-4 lg:pt-0 lg:pl-8">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-6">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-mono">Час запису</span>
                <span className="text-base font-bold font-mono tracking-tight text-slate-200">
                  {formatMilliseconds(durationMs)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-mono">Записано точок</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {recordsCount}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-mono">Частота запису</span>
                <span className="text-base font-bold font-mono text-slate-200">
                  {settings.targetFrequencyHz} Гц
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-mono">Wake lock екрану</span>
                <span className={`text-xs font-semibold font-mono ${wakeLockActive ? "text-emerald-400" : "text-amber-500"}`}>
                  {wakeLockActive ? "АКТИВНИЙ" : "ВІДКЛЮЧЕНО"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECORDER COMMENT FIELD */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3" id="recorder_comment_sec">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-200">Опис та текстовий коментар до запису треку</h3>
        </div>
        <p className="text-[11px] text-slate-400">
          Заповніть це поле перед початком або під час тесту для інтегрування опису поїздки/сесії. Опис буде поміщено в **перший рядок файла CSV** як текстовий коментар.
        </p>
        <div className="relative mt-1">
          <input
            type="text"
            placeholder="Наприклад: Тестування гальмування автомобіля, швидкість до 30 км/год, сухий асфальт..."
            value={recordingComment}
            onChange={(e) => setRecordingComment(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all placeholder:text-[12px]"
            id="comment_input"
          />
        </div>
      </section>

      {/* EXTERNAL OBD-II INTEGRATION DECK */}
      <ObdConfigSection
        obdConnected={obdConnected}
        activeCarEngineType={activeCarEngineType}
        setActiveCarEngineType={setActiveCarEngineType}
        handleConnectOBDReal={handleConnectOBDReal}
        handleConnectOBDSimulated={handleConnectOBDSimulated}
        handleDisconnectOBD={handleDisconnectOBD}
        obdData={obdData}
        authorizedDevices={authorizedDevices}
        fetchAuthorizedDevices={fetchAuthorizedDevices}
      />

      {/* DETAILED PARAMETERS TUNING DECK & COMPATIBILITY CHECKS */}
      <TuningConfigSection
        settings={settings}
        setSettings={setSettings}
        recordingState={recordingState}
        handleStartRecording={handleStartRecording}
        handleCalibrate={handleCalibrate}
        offsetCalib={offsetCalib}
        sensorPermissionsGranted={sensorPermissionsGranted}
      />

    </div>
  );
}
