import { Magnet, Volume2, Sun, BatteryCharging, Battery, Activity, Compass, Navigation, Thermometer, Gauge, Bluetooth, Zap } from "lucide-react";

interface SlideMetricsProps {
  currentGPS: {
    lat: number | null;
    lon: number | null;
    alt: number | null;
    speed: number;
    distance: number;
    accel: number;
  };
  currentIMU: {
    accelX: number;
    accelY: number;
    accelZ: number;
    accelRawMag: number;
    gyroX: number;
    gyroY: number;
    gyroZ: number;
    speedIMU: number;
    distIMU: number;
    accelIMU: number;
    heightIMU: number;
  };
  currentExtraSensors: {
    magX: number;
    magY: number;
    magZ: number;
    heading: number;
    pitch: number;
    roll: number;
    baroPressure: number;
    calcHeightBaro: number;
    noiseLevelDb: number;
    lightLux: number;
    batteryLevel: number;
    batteryCharging: number;
  };
  liveWeather: {
    temp: number;
    pressure: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windDir: number | null;
  };
  obdConnected: "disconnected" | "connecting" | "real" | "simulated";
  activeCarEngineType: "ice" | "electric";
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
  handleCalibrate: () => void;
  handleResetCalibration: () => void;
  offsetCalib: {
    accelOffsetX: number;
    accelOffsetY: number;
    accelOffsetZ: number;
    gyroOffsetX: number;
    gyroOffsetY: number;
    gyroOffsetZ: number;
  };
}

export default function SlideMetrics({
  currentGPS,
  currentIMU,
  currentExtraSensors,
  liveWeather,
  obdConnected,
  activeCarEngineType,
  obdData,
  handleCalibrate,
  handleResetCalibration,
  offsetCalib
}: SlideMetricsProps) {
  return (
    <div className="space-y-6 animate-fadeIn" id="slide_metrics">
      
      {/* LARGE GRID: GPS + IMU */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* GPS METRICS BOARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4" id="gps_metrics_board">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold font-sans text-slate-200">Розраховані Дані з GPS / ГНСС</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded">1 Гц ліміт</span>
          </div>

          {/* Latitude / longitude */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-mono block">Широта (Lat)</span>
              <span className="text-sm font-semibold font-mono text-slate-300">
                {currentGPS.lat !== null ? currentGPS.lat.toFixed(6) : "50.450100"}
              </span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-mono block">Довгота (Lon)</span>
              <span className="text-sm font-semibold font-mono text-slate-300">
                {currentGPS.lon !== null ? currentGPS.lon.toFixed(6) : "30.523400"}
              </span>
            </div>
          </div>

          {/* KPI metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Швидкість GPS</span>
              <div>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {(currentGPS.speed * 3.6).toFixed(1)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">км/год ({(currentGPS.speed).toFixed(1)} м/с)</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Відстань GPS</span>
              <div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {(currentGPS.distance / 1000).toFixed(3)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">км</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Прискорення GPS</span>
              <div>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {currentGPS.accel.toFixed(2)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">м/с²</span>
              </div>
            </div>
          </div>

          {/* Altitude info */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-indigo-400" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-mono">Розрахована / Записана висота</span>
                <span className="text-sm font-semibold font-sans text-slate-200">Висота над рівнем моря WGS-84</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-indigo-400">
                {currentGPS.alt !== null ? currentGPS.alt.toFixed(1) : "175.4"}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-mono">м</span>
            </div>
          </div>
        </div>

        {/* IMU SENSORS METRICS BOARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4" id="imu_metrics_board">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold font-sans text-slate-200">Інерціальний Обчислювальний Модуль (IMU)</h2>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-slate-950 px-2 py-0.5 rounded">10...20Гц сенсори</span>
          </div>

          {/* Accel Axis */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
              <span className="text-slate-550 block text-[9px] mb-0.5">Accel X</span>
              <span className="font-bold text-slate-350">{currentIMU.accelX.toFixed(3)} м/с²</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
              <span className="text-slate-550 block text-[9px] mb-0.5">Accel Y</span>
              <span className="font-bold text-slate-350">{currentIMU.accelY.toFixed(3)} м/с²</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
              <span className="text-slate-550 block text-[9px] mb-0.5">Accel Z</span>
              <span className="font-bold text-slate-350">{currentIMU.accelZ.toFixed(3)} м/с²</span>
            </div>
          </div>

          {/* IMU dynamic equations results */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Швидкість IMU</span>
              <div>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {(currentIMU.speedIMU * 3.6).toFixed(1)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">км/год ({(currentIMU.speedIMU).toFixed(1)} м/с)</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Дистанція IMU</span>
              <div>
                <div className="text-xl font-bold font-mono text-indigo-400">
                  {(currentIMU.distIMU / 1000).toFixed(3)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">км</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Прискорення рух</span>
              <div>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {currentIMU.accelIMU.toFixed(2)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">м/с² (без G)</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Відносна висота (IMU)</span>
              <div>
                <div className="text-xl font-bold font-mono text-cyan-400">
                  {currentIMU.heightIMU.toFixed(2)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">метрів</span>
              </div>
            </div>
          </div>

          {/* Gyro elements */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[9px] text-slate-550 uppercase font-mono block">Кутова швидкість (Gyro X/Y/Z)</span>
              <span className="text-[10.5px] text-indigo-300 font-mono block mt-0.5">
                {currentIMU.gyroX.toFixed(2)} / {currentIMU.gyroY.toFixed(2)} / {currentIMU.gyroZ.toFixed(2)} <span className="text-slate-500 text-[9px]">рад/с</span>
              </span>
            </div>

            <div className="flex gap-1.5 font-mono">
              <button
                onClick={handleCalibrate}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-705 rounded text-[9px] cursor-pointer"
                id="btn_calibrate_imu"
              >
                Калібрувати нуль
              </button>
              {(offsetCalib.accelOffsetX !== 0 || offsetCalib.gyroOffsetX !== 0) && (
                <button
                  onClick={handleResetCalibration}
                  className="px-1.5 py-1 bg-rose-950/60 text-rose-450 border border-rose-900 rounded text-[9px] cursor-pointer"
                  id="btn_reset_calib_imu"
                >
                  Скинути
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* COMPOSITE MULTI-SENSOR HARDWARE BOARD (POINTS 1, 2, 3) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5" id="multi_sensor_board">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4.5 h-4.5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200 font-sans">
              Додаткова Телеметрія ТЗ (Датчики Смартфона • Пункти 1, 2, 3)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-900/30 px-2 py-0.5 rounded">
            Всі дані в CSV
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* POINT 1 DETAILS: MAGNETOMETER & ATTITUDE FUSION */}
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Magnet className="w-4 h-4 text-rose-400" />
                <span className="text-[10.5px] font-bold text-slate-350 uppercase font-mono tracking-wider">Магнітометр & Орієнтація</span>
              </div>
              <span className="text-[9px] font-mono text-slate-550">Пункт 1, 3</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline font-mono bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-900">
                <span className="text-[10px] text-slate-500">Курс (Азимут):</span>
                <span className="text-xs font-bold text-slate-200">{currentExtraSensors.heading}°</span>
              </div>
              <span className="text-[9px] text-slate-500 block text-right">Корекція IMU за азимутом магнітометра & гіроскопа</span>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-900 text-center font-mono">
                  <span className="text-[9px] text-slate-500 block">Тангаж (Pitch)</span>
                  <span className="text-xs font-semibold text-rose-400">{currentExtraSensors.pitch}°</span>
                </div>
                <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-900 text-center font-mono">
                  <span className="text-[9px] text-slate-500 block">Крен (Roll)</span>
                  <span className="text-xs font-semibold text-rose-400">{currentExtraSensors.roll}°</span>
                </div>
              </div>

              <div className="text-[9.5px] text-slate-500 font-mono flex justify-between mt-1 pt-1 border-t border-slate-850/40 font-semibold text-slate-400">
                <span>Геомагн. поле (μT):</span>
                <span className="text-right">
                  X:{currentExtraSensors.magX} Y:{currentExtraSensors.magY} Z:{currentExtraSensors.magZ}
                </span>
              </div>
            </div>
          </div>

          {/* POINT 2 DETAILS: BAROMETER & STABLE ALTIMETER */}
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="text-[10.5px] font-bold text-slate-350 uppercase font-mono tracking-wider">Барометричний Альтиметр</span>
              </div>
              <span className="text-[9px] font-mono text-slate-550">Пункт 1, 2</span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col items-center justify-center bg-slate-950/60 p-3 rounded-lg border border-slate-900 text-center">
                <span className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wide">Відносна Висота (Барометр)</span>
                <span className="text-2xl font-black font-mono text-cyan-400 mt-0.5">
                  {currentExtraSensors.calcHeightBaro >= 0 ? "+" : ""}
                  {currentExtraSensors.calcHeightBaro.toFixed(2)} <span className="text-xs font-medium text-slate-400">m</span>
                </span>
                <span className="text-[8.5px] text-slate-500 font-mono mt-1">З точністю сенсора барометра (початок = 0.0)</span>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono pt-1 text-slate-450">
                <span className="text-slate-500">Тиск смартфона:</span>
                <span className="font-bold text-slate-400">{currentExtraSensors.baroPressure.toFixed(2)} hPa / мбар</span>
              </div>
            </div>
          </div>

          {/* POINT 3 DETAILS: DIAGNOSTICS & ENVIRONMENT */}
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[10.5px] font-bold text-slate-350 uppercase font-mono tracking-wider">Кабіна / Діагностика</span>
              </div>
              <span className="text-[9px] font-mono text-slate-550">Пункт 3</span>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-900 font-mono">
                  <span className="text-[9px] text-slate-500 block">Шум в салоні</span>
                  <div className="flex items-baseline gap-0.5 mt-0.5">
                    <span className="text-sm font-bold text-emerald-400">{currentExtraSensors.noiseLevelDb}</span>
                    <span className="text-[9px] text-slate-400">dB / дБ</span>
                  </div>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-900 font-mono">
                  <span className="text-[9px] text-slate-500 block">Освітленість</span>
                  <div className="flex items-baseline gap-0.5 mt-0.5">
                    <span className="text-sm font-bold text-amber-400">{currentExtraSensors.lightLux}</span>
                    <span className="text-[9px] text-slate-400">lux / лк</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 font-mono flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9.5px]">
                  {currentExtraSensors.batteryCharging === 1 ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-450 animate-pulse text-emerald-400" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className="text-slate-500">Заряд батареї:</span>
                </div>
                <span className="text-xs font-bold text-slate-300">
                  {currentExtraSensors.batteryLevel}% {currentExtraSensors.batteryCharging === 1 && "(Заряджається)"}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* EXPANDED METEOROLOGICAL / WEATHER METRICS MODULE */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4" id="meteorology_sec">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Thermometer className="w-4.5 h-4.5 text-orange-400" />
            <h3 className="text-sm font-semibold text-slate-200 font-sans">Погодні Показники Навколишнього Середовища (API 1 раз/хв)</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-950 px-2 py-0.5 rounded-full">
            Зовнішні датчики
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Згідно з вимогами замовника, ці дані фіксуються в кожному записі телеметрії та оновлюються 1 раз на хвилину з ресурсу Open-Meteo за геокоординатами. Ви бачите температуру повітря, барометричний тиск, вологість, швидкість та точний кутовий напрямок вітру.
        </p>

        {/* Responsive Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-2">
          
          {/* Temp */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
            <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Температура</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-orange-400">
                {liveWeather.temp.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400">°C</span>
            </div>
          </div>

          {/* Pressure */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
            <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Атмосф. Тиск</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-cyan-400">
                {liveWeather.pressure !== null ? liveWeather.pressure.toFixed(2) : "—"}
              </span>
              <span className="text-[10px] text-slate-400">кПа</span>
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
            <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Вологість</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-blue-400">
                {liveWeather.humidity !== null ? liveWeather.humidity.toFixed(1) : "—"}
              </span>
              <span className="text-[10px] text-slate-400">%</span>
            </div>
          </div>

          {/* Wind Speed */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
            <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Швидкість вітру</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {liveWeather.windSpeed !== null ? liveWeather.windSpeed.toFixed(1) : "—"}
              </span>
              <span className="text-[10px] text-slate-400">м/с</span>
            </div>
          </div>

          {/* Wind Dir */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
            <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Напрям вітру</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-amber-400">
                {liveWeather.windDir !== null ? liveWeather.windDir : "—"}
              </span>
              <span className="text-[10px] text-slate-400">°</span>
            </div>
          </div>

        </div>

      </section>

      {/* FULL COMPREHENSIVE OBD STATUS VIEW */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4" id="full_obd_status_sec">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Gauge className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200 font-sans">Поточний Стан Автомобіля (OBD-II Телеметрія)</h3>
          </div>
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${obdConnected !== "disconnected" ? "bg-emerald-500/10 text-emerald-400 font-bold animate-pulse" : "bg-slate-950 text-slate-500"}`}>
            {obdConnected !== "disconnected" ? "Активний прийом" : "Непідключено"}
          </span>
        </div>

        {obdConnected === "disconnected" ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-950/20 rounded-xl border border-dashed border-slate-800 gap-2">
            <Bluetooth className="w-8 h-8 text-slate-600 mb-1" />
            <p className="text-xs text-slate-400 max-w-sm">
              Зовнішній OBD-II модуль ELM327 не спарено. Будь ласка, перейдіть на першу вкладку <b>&quot;Запис & Керування&quot;</b> для початку прийому даних.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Оберти двигуна</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {obdData.rpm !== null ? `${obdData.rpm} RPM` : "0 RPM"}
                </span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Швидкість OBD</span>
                <span className="text-lg font-bold font-mono text-slate-100">
                  {obdData.speed !== null ? `${obdData.speed} км/год` : "0 км/год"}
                </span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Передача</span>
                <span className="text-lg font-bold font-mono text-amber-500">
                  {obdData.gear !== null ? obdData.gear : "Нейтраль (N)"}
                </span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">
                  {activeCarEngineType === "ice" ? "Витрата палива" : "Потужність батареї"}
                </span>
                <span className="text-lg font-bold font-mono text-cyan-400">
                  {activeCarEngineType === "ice" 
                    ? (obdData.fuelFlow !== null ? `${obdData.fuelFlow.toFixed(2)} л/год` : "—")
                    : (obdData.electricPower !== null ? `${(obdData.electricPower / 1000).toFixed(2)} кВт` : "—")
                  }
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850/80 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">Тепловий стан силової установки</h4>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Охолоджуюча рідина (Тосол):</span>
                    <span className="text-sm font-bold text-orange-400 font-mono">
                      {obdData.coolantTemp !== null ? `${obdData.coolantTemp} °C` : "н/д"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Моторна олива:</span>
                    <span className="text-sm font-bold text-orange-400 font-mono">
                      {obdData.oilTemp !== null ? `${obdData.oilTemp} °C` : "н/д"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850/80 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">Ефективність та залишкові запаси</h4>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {activeCarEngineType === "ice" ? "Економічність:" : "Батарея SOC:"}
                    </span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {activeCarEngineType === "ice"
                        ? (obdData.fuelEconomy !== null && obdData.fuelEconomy > 0 ? `${obdData.fuelEconomy.toFixed(1)} км/л` : "—")
                        : (obdData.batterySOC !== null ? `${obdData.batterySOC.toFixed(1)} %` : "—")
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {activeCarEngineType === "ice" ? "Загальне пальне:" : "Сервісне споживання:"}
                    </span>
                    <span className="text-sm font-bold text-sky-400 font-mono">
                      {activeCarEngineType === "ice"
                        ? (obdData.totalFuelUsed !== null ? `${obdData.totalFuelUsed.toFixed(4)} л` : "—")
                        : (obdData.energyConsumption !== null ? `${obdData.energyConsumption.toFixed(1)} Вт·год/км` : "—")
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
