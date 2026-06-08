/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Settings } from "lucide-react";
import { FilterSettings, CalibrationData } from "../../types";

interface TuningConfigSectionProps {
  settings: FilterSettings;
  setSettings: (updater: FilterSettings | ((prev: FilterSettings) => FilterSettings)) => void;
  recordingState: "idle" | "recording" | "paused";
  handleStartRecording: () => void;
  handleCalibrate: () => void;
  offsetCalib: CalibrationData;
  sensorPermissionsGranted: boolean | null;
}

export default function TuningConfigSection({
  settings,
  setSettings,
  recordingState,
  handleStartRecording,
  handleCalibrate,
  offsetCalib,
  sensorPermissionsGranted
}: TuningConfigSectionProps) {
  return (
    <>
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
            <span className="text-[9.5px] text-slate-500 font-sans leading-normal">
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
                className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-550 focus:ring-offset-slate-950 mt-0.5 cursor-pointer"
              />
              <div className="space-y-0.5">
                <label htmlFor="kalman_checkbox" className="text-xs font-bold text-slate-200 font-mono select-none cursor-pointer">
                  Матричний Фільтр Калмана
                </label>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
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
            <span className="text-[10px] text-slate-500 font-sans leading-relaxed">
              Надає дискретизацію {settings.targetFrequencyHz} Гц (запис кожні {Math.round(1000/settings.targetFrequencyHz)} мс).
            </span>
          </div>

          {/* Interactive Live Sensors Calibrator */}
          <div className="flex flex-col justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Статичне калібрування</span>
              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
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
            <h3 className="text-sm font-semibold font-sans text-slate-200">Перевірка доступу до сенсорів</h3>
            <p className="text-[11px] text-slate-400 font-sans">Для iOS та Chrome на Android потрібне явне погодження на DeviceMotion</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Technical sensors status checks */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2.5">
            <h4 className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Перевірка сумісності</h4>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Датчик руху:</span>
                <span className={window.DeviceMotionEvent ? "text-emerald-400 font-bold" : "text-slate-500"}>
                  {window.DeviceMotionEvent ? "ПІДТРИМУЄТЬСЯ" : "ВІДСУТНІЙ"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Локація (GPS):</span>
                <span className={"geolocation" in navigator ? "text-emerald-400 font-bold" : "text-amber-500"}>
                  {"geolocation" in navigator ? "ДОСТУПНО" : "ОБМЕЖЕНО"}
                </span>
              </div>
              <div className="flex justify-between gap-3 sm:gap-4">
                <span className="text-slate-500">Дозвіл датчиків:</span>
                <span className={sensorPermissionsGranted ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>
                  {sensorPermissionsGranted ? "НАДАНО" : "ПОТРЕБУЄ КЛІКУ"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
