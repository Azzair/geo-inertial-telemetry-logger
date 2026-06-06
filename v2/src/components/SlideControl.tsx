import { Play, Pause, RotateCcw, Bluetooth, Zap, FileSpreadsheet, Settings, Download, Mic, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { FilterSettings, CalibrationData } from "../types";

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

  acousticRpmEnabled: boolean;
  acousticRpm: number | null;
  acousticFreq: number | null;
  acousticNoisy: boolean;
  acousticCylinders: number;
  setAcousticCylinders: (val: number) => void;
  handleStartAcousticRpm: (cyls: number) => void;
  handleStopAcousticRpm: () => void;
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
  acousticRpmEnabled,
  acousticRpm,
  acousticFreq,
  acousticNoisy,
  acousticCylinders,
  setAcousticCylinders,
  handleStartAcousticRpm,
  handleStopAcousticRpm
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
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-505 text-amber-50 hover:bg-amber-550 shadow-lg shadow-amber-950/20 cursor-pointer border border-amber-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
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
                  className="p-3.5 rounded-xl bg-slate-950/70 text-rose-400 hover:bg-rose-955/20 hover:text-rose-350 border border-slate-800 hover:border-rose-900/30 cursor-pointer transition-all active:scale-[0.95]"
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
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4" id="obd_integration_sec">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/85">
          <div className="flex items-center gap-2.5">
            <Bluetooth className={`w-5 h-5 ${obdConnected !== "disconnected" ? "text-emerald-400 animate-pulse" : "text-slate-400"}`} />
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Зовнішній OBD-II (ELM327) модуль</h3>
              <p className="text-[11px] text-slate-400">Синхронізація обертів двигуна, витрати палива та гібридних показників</p>
            </div>
          </div>
          
          {obdConnected !== "disconnected" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Двигун автомобіля:</span>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px]">
                <button 
                  onClick={() => setActiveCarEngineType("ice")}
                  className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${activeCarEngineType === "ice" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  id="btn_engine_ice"
                >
                  ДВЗ (Бензин)
                </button>
                <button 
                  onClick={() => setActiveCarEngineType("electric")}
                  className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${activeCarEngineType === "electric" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  id="btn_engine_ev"
                >
                  Гібрид / EV
                </button>
              </div>
            </div>
          )}
        </div>

        {obdConnected === "disconnected" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleConnectOBDReal}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer border border-emerald-500/10 transition-all active:scale-[0.98]"
                id="btn_connect_obd_real"
              >
                <Bluetooth className="w-4 h-4 text-emerald-200" />
                Підключити адаптер Bluetooth BLE
              </button>
              <button
                onClick={handleConnectOBDSimulated}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer transition-all active:scale-[0.98]"
                id="btn_connect_obd_sim"
              >
                <Zap className="w-4 h-4 text-amber-500" />
                Емуляція OBD-II датчиків
              </button>
            </div>

            {/* ACOUSTIC RPM ESTIMATOR INTERFACE */}
            <div className="border border-slate-800/80 bg-slate-950/45 rounded-xl p-4 space-y-4 relative overflow-hidden" id="acoustic_rpm_block">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg border transition-all ${acousticRpmEnabled ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-slate-955 bg-slate-900 border-slate-800 text-slate-400"}`}>
                    <Mic className={`w-4 h-4 ${acousticRpmEnabled && !acousticNoisy ? "animate-pulse" : ""}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
                      <span>Акустичний аналіз обертів двигуна (Мікрофон)</span>
                      {acousticRpmEnabled && (
                        <span className="flex h-1.5 w-1.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-450 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-400">Аналіз звуку ДВЗ за частотою згоряння суміші в циліндрах</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-mono">Циліндри (ДВЗ):</span>
                  <select
                    value={acousticCylinders}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setAcousticCylinders(val);
                      if (acousticRpmEnabled) {
                        handleStartAcousticRpm(val);
                      }
                    }}
                    className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold rounded px-1.5 py-1 focus:outline-none focus:border-cyan-500"
                    id="select_acoustic_cylinders"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((c) => (
                      <option key={c} value={c}>
                        {c}-цил. двигун
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!acousticRpmEnabled ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/30 p-3 rounded-lg border border-slate-850/60">
                  <p className="text-[10.5px] text-slate-400 leading-normal max-w-md">
                    Помістіть телефон на тримач у кабіні або біля повітропроводу. Система виявляє акустичні коливання ДВЗ та обчислює оберти двигуна в реальному часі за математичним DSP алгоритмом.
                  </p>
                  <button
                    onClick={() => handleStartAcousticRpm(acousticCylinders)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold bg-cyan-600/10 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-500/20 cursor-pointer transition-colors whitespace-nowrap self-stretch sm:self-auto"
                    id="btn_enable_acoustic_rpm"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Увімкнути аналізатор
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/40 p-3.5 rounded-lg border border-slate-850/60 items-center">
                  
                  {/* Realtime RPM display */}
                  <div className="md:col-span-5 flex items-center justify-between sm:justify-start gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-500 uppercase font-mono block">Визначені оберти</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono text-cyan-400 animate-pulse" id="acoustic_rpm_value">
                          {acousticRpm !== null ? acousticRpm : "—"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">об/хв (RPM)</span>
                      </div>
                    </div>

                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-500 uppercase font-mono block">Частота звуку</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-sm font-bold font-mono text-slate-200">
                          {acousticFreq !== null ? `${acousticFreq}` : "—"}
                        </span>
                        <span className="text-[9.5px] text-slate-500 font-mono"> Гц</span>
                      </div>
                    </div>
                  </div>

                  {/* Signal Quality Visualizer */}
                  <div className="md:col-span-4 space-y-1">
                    <span className="text-[9.5px] text-slate-500 uppercase font-mono block">Стан сигналу мікрофона</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${acousticNoisy ? "bg-amber-500 animate-pulse" : "bg-cyan-500"}`} />
                      <span className="text-[10.5px] font-mono text-slate-300">
                        {acousticNoisy ? (
                          <span className="text-amber-500 font-medium">Занадто тихо / Шум</span>
                        ) : (
                          <span className="text-cyan-400 font-medium">Спектр ДВЗ стабільний</span>
                        )}
                      </span>
                    </div>

                    {/* Fun miniature active spectrum bars animation */}
                    {!acousticNoisy && (
                      <div className="flex gap-0.5 pt-1 h-3 items-end">
                        <div className="bg-cyan-500/80 w-1 h-1 animate-bounce" style={{ animationDelay: "100ms" }} />
                        <div className="bg-cyan-400/80 w-1 h-2.5 animate-bounce" style={{ animationDelay: "200ms" }} />
                        <div className="bg-cyan-500/80 w-1 h-1.5 animate-bounce" style={{ animationDelay: "300ms" }} />
                        <div className="bg-cyan-400/80 w-1 h-2 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="bg-cyan-500/80 w-1 h-3 animate-bounce" style={{ animationDelay: "250ms" }} />
                      </div>
                    )}
                  </div>

                  {/* Stop button */}
                  <div className="md:col-span-3 text-right">
                    <button
                      type="button"
                      onClick={handleStopAcousticRpm}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-950/40 text-red-400 hover:bg-red-900 border border-red-900/35 cursor-pointer transition-all"
                      id="btn_stop_acoustic_rpm"
                    >
                      Вимкнути
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {obdConnected === "connecting" && (
          <div className="flex flex-col items-center justify-center py-6 bg-slate-950/45 rounded-xl border border-slate-850 gap-3" id="obd_connecting_loader">
            <div className="w-8 h-8 rounded-full border-2 border-t-emerald-500 border-r-transparent border-slate-800 animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Шукаємо пристрої &quot;OBD&quot;, &quot;ELM&quot; чи &quot;V-LINK&quot;...</p>
            <button
              onClick={handleDisconnectOBD}
              className="text-[10px] text-red-400 hover:underline cursor-pointer font-bold"
              id="btn_cancel_obd_connect"
            >
              Скасувати
            </button>
          </div>
        )}

        {obdConnected !== "disconnected" && obdConnected !== "connecting" && (
          <div className="space-y-4" id="obd_active_dashboard">
            {/* Connected Status Ribbon */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-bold">Активовано OBD:</span>
                <span className="font-mono text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase text-[10px]">
                  {obdConnected === "real" ? "Bluetooth BLE" : "Симуляція"}
                </span>
              </div>
              <button
                onClick={handleDisconnectOBD}
                className="px-3 py-1 rounded bg-red-950/60 text-red-400 hover:bg-red-900/40 font-bold border border-red-900/30 text-[10px] transition-all cursor-pointer"
                id="btn_disconnect_obd"
              >
                ВІДКЛЮЧИТИ
              </button>
            </div>

            {/* GRID FOR ACTIVE PARAMETERS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-850">
              
              {activeCarEngineType === "ice" ? (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Оберти двигуна</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-emerald-400">
                      {obdData.rpm !== null ? `${obdData.rpm} об/хв` : "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Швидкість OBD</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-slate-100">
                      {obdData.speed !== null ? `${obdData.speed} км/год` : "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Розрахована передача</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-amber-500">
                      {obdData.gear !== null ? `${obdData.gear} ПХ` : "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Витрата пального</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-emerald-400">
                      {obdData.fuelFlow !== null ? `${obdData.fuelFlow.toFixed(2)} л/год` : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Електро-потужність</span>
                    <span className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${obdData.electricPower !== null && obdData.electricPower < 0 ? "text-emerald-400" : "text-amber-500"}`}>
                      {obdData.electricPower !== null ? `${(obdData.electricPower / 1000).toFixed(2)} кВт` : "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Заряд батареї (SOC)</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-sky-400">
                      {obdData.batterySOC !== null ? `${obdData.batterySOC.toFixed(1)} %` : "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Витрата енергії</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-slate-200">
                      {obdData.energyConsumption !== null ? `${obdData.energyConsumption.toFixed(1)} Вт·год/км` : "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">Потужність рекуперації</span>
                    <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-emerald-400 flex items-center gap-1">
                      {obdData.recuperation !== null && obdData.recuperation > 0 ? (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-400 animate-pulse" />
                          {`${(obdData.recuperation / 1000).toFixed(1)} кВт`}
                        </>
                      ) : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* BOTTOM INFO GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850/80 text-[11px]">
              <div className="space-y-0.5">
                <span className="text-slate-500 font-mono block">Антифриз (Coolant):</span>
                <span className="font-bold text-slate-200 block">
                  {obdData.coolantTemp !== null ? `${obdData.coolantTemp} °C` : "н/д"}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 font-mono block">Темп. оливи (Oil):</span>
                <span className="font-bold text-slate-200 block">
                  {obdData.oilTemp !== null ? `${obdData.oilTemp} °C` : "н/д"}
                </span>
              </div>
              {activeCarEngineType === "ice" ? (
                <>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 font-mono block">Економічність:</span>
                    <span className="font-bold text-slate-250 text-slate-300 block">
                      {obdData.fuelEconomy !== null ? `${obdData.fuelEconomy.toFixed(1)} км/л` : "н/д"}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 font-mono block">Витрачено палива:</span>
                    <span className="font-bold text-emerald-400 block">
                      {obdData.totalFuelUsed !== null ? `${obdData.totalFuelUsed.toFixed(3)} л` : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 font-mono block">Напруга комірок:</span>
                    <span className="font-semibold text-slate-300 block">398.5 В</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 font-mono block">Здоров'я АКБ (SOH):</span>
                    <span className="font-semibold text-emerald-400 block">97.8 %</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* DETAILED PARAMETERS TUNING DECK */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5" id="tuning_deck">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
          <Settings className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Налаштування фільтрації та тактової частоти</h3>
            <p className="text-[11px] text-slate-400">Тонке калібрування інерційного трекера для пригнічення вібрацій</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Low pass alpha coefficient */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-mono flex justify-between">
              <span>Коефіцієнт (α) Low-pass:</span>
              <span className="text-indigo-400 font-bold">{settings.alphaLowPass}</span>
            </label>
            <input
              type="range"
              min="0.02"
              max="0.40"
              step="0.01"
              value={settings.alphaLowPass}
              onChange={(e) => setSettings({ ...settings, alphaLowPass: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
              id="range_alpha_low_pass"
            />
            <span className="text-[9.5px] text-slate-500">
              Менші значення сильніше гасять дрібне дрижання кузова, але вносять фазове відставання.
            </span>
          </div>

          {/* Kalman noise model checkbox toggle */}
          <div className="flex flex-col justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="kalman_checkbox"
                checked={settings.enableKalman}
                onChange={(e) => setSettings({ ...settings, enableKalman: e.target.checked })}
                className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-550 focus:ring-offset-slate-950 mt-0.5"
              />
              <div className="space-y-0.5">
                <label htmlFor="kalman_checkbox" className="text-xs font-bold text-slate-200 font-mono select-none cursor-pointer">
                  Матричний Фільтр Калмана
                </label>
                <p className="text-[10px] text-slate-500">
                  Адаптивна оцінка похибок GPS та акселерометра в реальному часі.
                </p>
              </div>
            </div>
          </div>

          {/* Samping Frequency Hz Buttons */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-mono">Частота запису даних</label>
            <div className="flex gap-2">
              {[5, 10, 20].map((hz) => (
                <button
                  key={hz}
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, targetFrequencyHz: hz }));
                    if (recordingState === "recording") {
                      // Re-trigger loop with the new interval timing
                      handleStartRecording();
                    }
                  }}
                  className={`flex-1 py-1.5 text-center text-xs font-bold font-mono rounded-lg border cursor-pointer transition-colors ${
                    settings.targetFrequencyHz === hz
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                  id={`btn_hz_${hz}`}
                >
                  {hz} Гц
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              Надає дискретизацію {settings.targetFrequencyHz} Гц (запис кожні {Math.round(1000/settings.targetFrequencyHz)} мс).
            </span>
          </div>

          {/* Interactive Live Sensors Calibrator */}
          <div className="flex flex-col justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Статичне калібрування</span>
              <p className="text-[10px] text-slate-500">
                Залиште пристрій нерухомим на рівній поверхні перед запуском поїздки.
              </p>
            </div>
            <button
              onClick={handleCalibrate}
              className="mt-1.5 w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-all active:scale-[0.97]"
              id="btn_calibrate_sensors"
            >
              Калібрувати нулі
            </button>
          </div>
        </div>

        {/* Static Offsets Report Card */}
        {(offsetCalib.accelOffsetX !== 0 || offsetCalib.gyroOffsetX !== 0) && (
          <div className="p-3 bg-indigo-950/15 border border-indigo-900/35 rounded-xl text-[11px] font-mono flex flex-wrap gap-x-6 gap-y-1 text-indigo-400/80">
            <span>Зміщення Accel: X={offsetCalib.accelOffsetX.toFixed(4)} Y={offsetCalib.accelOffsetY.toFixed(4)} Z={offsetCalib.accelOffsetZ.toFixed(4)}</span>
            <span>Зміщення Gyro: X={offsetCalib.gyroOffsetX.toFixed(4)} Y={offsetCalib.gyroOffsetY.toFixed(4)} Z={offsetCalib.gyroOffsetZ.toFixed(4)}</span>
          </div>
        )}
      </section>

      {/* COMPATIBILITY NOTICE CARD */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4" id="compatibility_sec">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Перевірка доступу до сенсорів</h3>
            <p className="text-[11px] text-slate-400">Для iOS та Chrome на Android потрібне явне погодження на DeviceMotion</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Technical sensors status checks */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2.5">
            <h4 className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Перевірка сумісності</h4>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Датчик руху:</span>
                <span className={window.DeviceMotionEvent ? "text-emerald-400 font-bold" : "text-slate-550"}>
                  {window.DeviceMotionEvent ? "ПІДТРИМУЄТЬСЯ" : "ВІДСУТНІЙ"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Локація (GPS):</span>
                <span className={"geolocation" in navigator ? "text-emerald-400 font-bold" : "text-amber-500"}>
                  {"geolocation" in navigator ? "ДОСТУПНО" : "ОБМЕЖЕНО"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Дозвіл датчиків:</span>
                <span className={sensorPermissionsGranted ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>
                  {sensorPermissionsGranted ? "НАДАНО" : "ПОТРЕБУЄ КЛІКУ"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
