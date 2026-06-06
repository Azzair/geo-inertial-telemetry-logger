import { useState } from "react";
import { TelemetryRecord } from "../types";
import TelemetryCanvasChart from "./TelemetryCanvasChart";

interface SlideChartsProps {
  records: TelemetryRecord[];
}

export default function SlideCharts({ records }: SlideChartsProps) {
  const [selectedChartTab, setSelectedChartTab] = useState<"imu" | "speed">("imu");

  return (
    <section className="flex flex-col gap-4 animate-fadeIn" id="slide_charts">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold font-sans text-slate-200">
          Візуалізація Телеметрії (Останні 100 вимірювань за 10-20Гц)
        </h3>
        
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 self-start sm:self-auto">
          {[
            { id: "imu", label: "Сенсори IMU" },
            { id: "speed", label: "Швидкість та Висота" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedChartTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                selectedChartTab === tab.id
                  ? "bg-slate-800 text-slate-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              id={`btn_chart_tab_${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {selectedChartTab === "imu" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TelemetryCanvasChart
              records={records}
              title="Графік Прискорення (Raw vs Filtered Ax/Ay/Az)"
              unit=" м/с²"
              selectedFields={[
                { label: "X-filtered", key: "accelX", color: "#10b981" },
                { label: "Y-filtered", key: "accelY", color: "#3b82f6" },
                { label: "Z-filtered", key: "accelZ", color: "#8b5cf6" },
                { label: "Linear raw sum", key: "accelRawMag", color: "#f43f5e" }
              ]}
            />
            <TelemetryCanvasChart
              records={records}
              title="Гіроскоп (Орієнтація & Кутова Швидкість)"
              unit=" рад/с"
              selectedFields={[
                { label: "Yaw (Z-Gyro)", key: "gyroZ", color: "#10b981" },
                { label: "Pitch (X-Gyro)", key: "gyroX", color: "#f59e0b" },
                { label: "Roll (Y-Gyro)", key: "gyroY", color: "#3b82f6" }
              ]}
            />
          </div>
        )}

        {selectedChartTab === "speed" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TelemetryCanvasChart
              records={records}
              title="Швидкість: GPS з супутника VS Інерційне Інтегрування IMU"
              unit=" км/год"
              selectedFields={[
                { label: "Швидкість GPS", key: "gpsSpeed", color: "#10b981", scale: 3.6 },
                { label: "Швидкість її IMU", key: "calcSpeedIMU", color: "#a855f7", scale: 3.6 }
              ]}
            />
            <TelemetryCanvasChart
              records={records}
              title="Профіль висоти над рівнем моря"
              unit=" м"
              selectedFields={[
                { label: "Висота GPS WGS84", key: "gpsAlt", color: "#3b82f6" }
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
