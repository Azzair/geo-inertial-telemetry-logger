/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bluetooth, Zap } from "lucide-react";

interface ObdConfigSectionProps {
  obdConnected: "disconnected" | "connecting" | "real" | "simulated";
  activeCarEngineType: "ice" | "electric";
  setActiveCarEngineType: (type: "ice" | "electric") => void;
  handleConnectOBDReal: (preSelectedDevice?: any) => void;
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
  authorizedDevices?: any[];
  fetchAuthorizedDevices?: () => void;
}

export default function ObdConfigSection({
  obdConnected,
  activeCarEngineType,
  setActiveCarEngineType,
  handleConnectOBDReal,
  handleConnectOBDSimulated,
  handleDisconnectOBD,
  obdData,
  authorizedDevices = [],
  fetchAuthorizedDevices
}: ObdConfigSectionProps) {
  return (
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
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleConnectOBDReal()}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer border border-emerald-500/10 transition-all active:scale-[0.98]"
              id="btn_connect_obd_real"
            >
              <Bluetooth className="w-4 h-4 text-emerald-200" />
              Сканувати всі пристрої Bluetooth
            </button>
            <button
              onClick={handleConnectOBDSimulated}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700  cursor-pointer transition-all active:scale-[0.98]"
              id="btn_connect_obd_sim"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Емуляція OBD-II датчиків
            </button>
          </div>

          {authorizedDevices.length > 0 && (
            <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold font-mono tracking-wider block uppercase">
                  Дозволені Bluetooth-пристрої ({authorizedDevices.length}):
                </span>
                {fetchAuthorizedDevices && (
                  <button 
                    onClick={fetchAuthorizedDevices}
                    className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold font-mono active:scale-95 transition-all cursor-pointer"
                  >
                    Оновити список
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {authorizedDevices.map((dev, i) => (
                  <button
                    key={dev.id || `${dev.name}-${i}`}
                    onClick={() => handleConnectOBDReal(dev)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/60 hover:bg-indigo-950/10 hover:border-indigo-500/20 text-xs text-slate-200 transition-all text-left cursor-pointer active:scale-[0.99]"
                  >
                    <span className="font-mono flex items-center gap-2 font-medium">
                      <Bluetooth className="w-3.5 h-3.5 text-emerald-500" />
                      {dev.name || `Пристрій з OBD-II сесії #${i + 1}`}
                    </span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold font-mono px-2 py-0.5 rounded">
                      З'єднати
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
                  <span className="font-bold text-slate-300 block">
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
  );
}
