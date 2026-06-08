/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Mic, Volume2 } from "lucide-react";

interface AcousticRpmSectionProps {
  acousticRpmEnabled: boolean;
  acousticRpm: number | null;
  acousticFreq: number | null;
  acousticNoisy: boolean;
  acousticCylinders: number;
  setAcousticCylinders: (val: number) => void;
  handleStartAcousticRpm: (cyls: number) => void;
  handleStopAcousticRpm: () => void;
}

export default function AcousticRpmSection({
  acousticRpmEnabled,
  acousticRpm,
  acousticFreq,
  acousticNoisy,
  acousticCylinders,
  setAcousticCylinders,
  handleStartAcousticRpm,
  handleStopAcousticRpm
}: AcousticRpmSectionProps) {
  return (
    <div className="border border-slate-800/80 bg-slate-950/45 rounded-xl p-4 space-y-4 relative overflow-hidden" id="acoustic_rpm_block">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border transition-all ${acousticRpmEnabled ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}>
            <Mic className={`w-4 h-4 ${acousticRpmEnabled && !acousticNoisy ? "animate-pulse" : ""}`} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
              <span>Акустичний аналіз обертів двигуна (Мікрофон)</span>
              {acousticRpmEnabled && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/30 p-3 rounded-lg border border-slate-850/60 font-sans">
          <p className="text-[10.5px] text-slate-400 leading-normal max-w-md select-text">
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
                <span className="text-[10px] text-slate-400 font-medium font-sans">об/хв (RPM)</span>
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
                <div className="bg-cyan-405/80 bg-cyan-400 w-1 h-2.5 animate-bounce" style={{ animationDelay: "200ms" }} />
                <div className="bg-cyan-500/80 w-1 h-1.5 animate-bounce" style={{ animationDelay: "300ms" }} />
                <div className="bg-cyan-405/80 bg-cyan-400 w-1 h-2 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="bg-cyan-500/80 w-1 h-3 animate-bounce" style={{ animationDelay: "250ms" }} />
              </div>
            )}
          </div>

          {/* Stop button */}
          <div className="md:col-span-3 text-right">
            <button
              type="button"
              onClick={handleStopAcousticRpm}
              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-955/40 bg-red-950/40 text-red-400 hover:bg-red-900 border border-red-900/35 cursor-pointer transition-all"
              id="btn_stop_acoustic_rpm"
            >
              Вимкнути
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
