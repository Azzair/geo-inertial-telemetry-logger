/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Wrench, Info, Zap, Trash2, ShieldAlert, Compass } from "lucide-react";
import AcousticRpmSection from "./control/AcousticRpmSection";

interface SlideUtilitiesProps {
  acousticRpmEnabled: boolean;
  acousticRpm: number | null;
  acousticFreq: number | null;
  acousticNoisy: boolean;
  acousticCylinders: number;
  setAcousticCylinders: (val: number) => void;
  handleStartAcousticRpm: (cyls: number) => void;
  handleStopAcousticRpm: () => void;
  
  // Quick diagnostics data
  currentIMU: {
    accelX: number;
    accelY: number;
    accelZ: number;
    gyroX: number;
    gyroY: number;
    gyroZ: number;
  };
  offsetCalib: {
    accelOffsetX: number;
    accelOffsetY: number;
    accelOffsetZ: number;
    gyroOffsetX: number;
    gyroOffsetY: number;
    gyroOffsetZ: number;
  };
  handleResetCalibration: () => void;
}

export default function SlideUtilities({
  acousticRpmEnabled,
  acousticRpm,
  acousticFreq,
  acousticNoisy,
  acousticCylinders,
  setAcousticCylinders,
  handleStartAcousticRpm,
  handleStopAcousticRpm,
  currentIMU,
  offsetCalib,
  handleResetCalibration
}: SlideUtilitiesProps) {
  
  const handleClearCache = () => {
    if (confirm("⚠️ Ви впевнені, що хочете видалити всі збережені сесії логів та очистити налаштування за замовчуванням? Цю дію неможливо скасувати!")) {
      localStorage.clear();
      alert("Кеш успішно очищено. Сторінка буде перезавантажена!");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="slide_utilities">
      
      {/* HEADER BANNER */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden" id="utilities_banner">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-505/10 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4 z-10 relative">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Wrench className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-100">Лабораторія утиліт та математичних тестів</h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Додаткові інструменти обробки фізичних спектрів, калібрування інерційного обчислювального блоку та тонке тестування механічних коливань.
            </p>
          </div>
        </div>
      </section>

      {/* ACOUSTIC RPM SECTION */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3.5" id="acoustic_wrapper">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
          <Wrench className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200">Акустичний спектрометр</h3>
        </div>
        <AcousticRpmSection
          acousticRpmEnabled={acousticRpmEnabled}
          acousticRpm={acousticRpm}
          acousticFreq={acousticFreq}
          acousticNoisy={acousticNoisy}
          acousticCylinders={acousticCylinders}
          setAcousticCylinders={setAcousticCylinders}
          handleStartAcousticRpm={handleStartAcousticRpm}
          handleStopAcousticRpm={handleStopAcousticRpm}
        />
      </section>

      {/* INERTIAL TELEMETRY MATH DIAGNOSTICS */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="imu_diag_panel">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Діагностика інерціального модуля (IMU)</h3>
          </div>
          <span className="text-[10px] bg-slate-800 font-mono text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">
            Оновлюється наживо
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-normal">
          Значення лінійного прискорення компенсуються за кутами тангажу та крену. Якщо сенсор постійно перебуває в стані спокою, система ZUPT (Zero-Velocity Update) утримує швидкість на нулі, щоб запобігти дрейфу інтегрування.
        </p>

        {/* Real-time values table */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono block uppercase">Прискорення X (Ax)</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {currentIMU.accelX !== undefined ? `${currentIMU.accelX.toFixed(4)} м/с²` : "0.0000 м/с²"}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono block uppercase">Прискорення Y (Ay)</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {currentIMU.accelY !== undefined ? `${currentIMU.accelY.toFixed(4)} м/с²` : "0.0000 м/с²"}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 space-y-1 col-span-2 md:col-span-1">
            <span className="text-[10px] text-slate-500 font-mono block uppercase">Прискорення Z (Az)</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {currentIMU.accelZ !== undefined ? `${currentIMU.accelZ.toFixed(4)} м/с²` : "9.8066 м/с²"}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono block uppercase">Гіроскоп X (Pitch Rate)</span>
            <span className="text-sm font-semibold font-mono text-slate-350 text-slate-300">
              {currentIMU.gyroX !== undefined ? `${(currentIMU.gyroX * (180 / Math.PI)).toFixed(2)} °/с` : "0.00 °/с"}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono block uppercase">Гіроскоп Y (Roll Rate)</span>
            <span className="text-sm font-semibold font-mono text-slate-300">
              {currentIMU.gyroY !== undefined ? `${(currentIMU.gyroY * (180 / Math.PI)).toFixed(2)} °/с` : "0.00 °/с"}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/80 space-y-1 col-span-2 md:col-span-1">
            <span className="text-[10px] text-slate-500 font-mono block uppercase">Гіроскоп Z (Yaw Rate)</span>
            <span className="text-sm font-semibold font-mono text-slate-300">
              {currentIMU.gyroZ !== undefined ? `${(currentIMU.gyroZ * (180 / Math.PI)).toFixed(2)} °/с` : "0.00 °/с"}
            </span>
          </div>
        </div>

        {/* Current calibration metrics list */}
        <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2 text-xs">
          <span className="text-[10px] text-slate-400 font-bold font-mono tracking-wider block uppercase">Діючі калибровочні зміщення (Offsets):</span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-350 text-slate-300 font-mono text-[11px]">
            <div>Ax Bias: {offsetCalib.accelOffsetX.toFixed(5)}</div>
            <div>Ay Bias: {offsetCalib.accelOffsetY.toFixed(5)}</div>
            <div>Az Bias: {offsetCalib.accelOffsetZ.toFixed(5)}</div>
            <div>Gx Drift: {offsetCalib.gyroOffsetX.toFixed(5)}</div>
            <div>Gy Drift: {offsetCalib.gyroOffsetY.toFixed(5)}</div>
            <div>Gz Drift: {offsetCalib.gyroOffsetZ.toFixed(5)}</div>
          </div>
          <div className="pt-2 flex justify-start">
            <button
              onClick={handleResetCalibration}
              className="px-3 py-1.5 rounded bg-amber-950/40 text-amber-400 hover:bg-amber-900/30 border border-amber-900/40 font-bold tracking-tight text-[10px] transition-all cursor-pointer"
            >
              Скинути калібрування до 0
            </button>
          </div>
        </div>
      </section>

      {/* DISASTER SECURITY CONTROL */}
      <section className="bg-slate-900 border border-red-950/40 rounded-2xl p-5 shadow-lg space-y-3.5" id="critical_cache_deck">
        <div className="flex items-center gap-2 pb-2 border-b border-red-950/20">
          <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-200">Обслуговування сховища</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400 max-w-xlLeading-relaxed leading-normal">
            Якщо під час запису сесій виникли технічні збої або файли експорту відображають некоректну структуру даних, ви можете примусово перезапустити локальну базу, очистивши її кеш.
          </p>
          <button
            onClick={handleClearCache}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-red-650/10 hover:bg-red-650/20 text-red-400 hover:text-red-300 border border-red-500/20 cursor-pointer transition-all active:scale-[0.98] whitespace-nowrap"
            id="btn_erase_db"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Очистити локальний кеш
          </button>
        </div>
      </section>

    </div>
  );
}
