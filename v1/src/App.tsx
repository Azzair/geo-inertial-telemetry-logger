/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Trash2,
  Compass,
  Navigation,
  Activity,
  Thermometer,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle,
  Flame,
  Info,
  Mail,
  Share2,
  Square,
  Bluetooth,
  Zap,
  Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { TelemetryRecord, CalibrationData, FilterSettings, SavedSession } from "./types";
import {
  getHaversineDistance,
  applyLowPass,
  formatMilliseconds,
  convertToCSV,
  getNumericTimestampFilename
} from "./utils/telemetryHelpers";
import TelemetryCanvasChart from "./components/TelemetryCanvasChart";
import AndroidGuide from "./components/AndroidGuide";

const KYIV_LAT = 50.4501;
const KYIV_LON = 30.5234;

export default function App() {
  // --- UI and Settings State ---
  const [settings, setSettings] = useState<FilterSettings>({
    alphaLowPass: 0.15,
    enableKalman: true,
    targetFrequencyHz: 10,
    simulatedMode: true // default to true so desktop users can see live simulation instantly
  });

  const [activeSlide, setActiveSlide] = useState<"control" | "metrics" | "charts" | "history">("control");
  const [recordingComment, setRecordingComment] = useState<string>("");

  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");
  const [durationMs, setDurationMs] = useState<number>(0);
  const [recordsCount, setRecordsCount] = useState<number>(0);

  // Live filtered telemetry for flashing numbers on the metric dashboards
  const [currentGPS, setCurrentGPS] = useState<{
    lat: number | null;
    lon: number | null;
    alt: number | null;
    speed: number;
    distance: number;
    accel: number;
  }>({ lat: null, lon: null, alt: null, speed: 0, distance: 0, accel: 0 });

  const [currentIMU, setCurrentIMU] = useState<{
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
  }>({
    accelX: 0,
    accelY: 0,
    accelZ: 0,
    accelRawMag: 0,
    gyroX: 0,
    gyroY: 0,
    gyroZ: 0,
    speedIMU: 0,
    distIMU: 0,
    accelIMU: 0
  });

  const [currentTemp, setCurrentTemp] = useState<number>(22.4);
  const [liveWeather, setLiveWeather] = useState<{
    temp: number;
    pressure: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windDir: number | null;
  }>({
    temp: 22.4,
    pressure: 1013.25,
    humidity: 60.0,
    windSpeed: 2.5,
    windDir: 180.0
  });

  const [weatherStatus, setWeatherStatus] = useState<string>("Використовується барометрична модель");
  const [sensorPermissionsGranted, setSensorPermissionsGranted] = useState<boolean | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [offsetCalib, setOffsetCalib] = useState<CalibrationData>({
    accelOffsetX: 0,
    accelOffsetY: 0,
    accelOffsetZ: 0,
    gyroOffsetX: 0,
    gyroOffsetY: 0,
    gyroOffsetZ: 0
  });

  // Saved Session list (persisted in localStorage)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [selectedChartTab, setSelectedChartTab] = useState<"imu" | "speed" | "altitude">("imu");

  // --- OBD-II Telemetry State ---
  const [obdConnected, setObdConnected] = useState<"disconnected" | "connecting" | "real" | "simulated">("disconnected");
  
  const [obdData, setObdData] = useState<{
    rpm: number | null;
    speed: number | null; // km/h
    gear: string | null;
    fuelFlow: number | null; // L/h
    fuelEconomy: number | null; // km/L
    coolantTemp: number | null;
    oilTemp: number | null;
    totalFuelUsed: number;
    electricPower: number | null; // Watts (hybrid/electric)
    energyConsumption: number | null; // Wh/km (hybrid/electric)
    batterySOC: number | null; // % (hybrid/electric)
    recuperation: number | null; // Watts
  }>({
    rpm: null,
    speed: null,
    gear: null,
    fuelFlow: null,
    fuelEconomy: null,
    coolantTemp: null,
    oilTemp: null,
    totalFuelUsed: 0.0,
    electricPower: null,
    energyConsumption: null,
    batterySOC: null,
    recuperation: null
  });

  const [activeCarEngineType, setActiveCarEngineType] = useState<"ice" | "electric">("ice");

  // --- Refs — Needed to run high-speed logging loop smoothly without triggering rendering bottlenecks ---
  const recordsRef = useRef<TelemetryRecord[]>([]);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const activeBtDeviceRef = useRef<any>(null);

  const obdDataRef = useRef({
    rpm: null as number | null,
    speed: null as number | null,
    gear: null as string | null,
    fuelFlow: null as number | null,
    fuelEconomy: null as number | null,
    coolantTemp: null as number | null,
    oilTemp: null as number | null,
    totalFuelUsed: 0.0,
    electricPower: null as number | null,
    energyConsumption: null as number | null,
    batterySOC: null as number | null,
    recuperation: null as number | null,
    connectedState: "disconnected" as "disconnected" | "connecting" | "real" | "simulated"
  });

  const weatherDataRef = useRef<{
    temp: number;
    pressure: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windDir: number | null;
  }>({
    temp: 22.4,
    pressure: 1013.25,
    humidity: 60.0,
    windSpeed: 2.5,
    windDir: 180.0
  });

  // Buffer state to keep raw device readings in between 10-20Hz logs ticks
  const rawSensorBuffer = useRef({
    ax: 0, ay: 0, az: 0,
    axRaw: 0, ayRaw: 0, azRaw: 0,
    gx: 0, gy: 0, gz: 0,
    gxRaw: 0, gyRaw: 0, gzRaw: 0
  });

  const filteredSensorBuffer = useRef({
    ax: 0, ay: 0, az: 0,
    gx: 0, gy: 0, gz: 0
  });

  const gpsBuffer = useRef<{
    lat: number | null;
    lon: number | null;
    alt: number | null;
    speed: number;
    accuracy: number | null;
  }>({ lat: null, lon: null, alt: null, speed: 0, accuracy: null });

  const accumulatedGpsDistance = useRef<number>(0);
  const lastGpsCoords = useRef<{ lat: number; lon: number } | null>(null);
  const lastGpsTime = useRef<number>(0);
  const lastGpsSpeed = useRef<number>(0);

  // Integrated IMU movement variables
  const integratedImuVelocity = useRef<number>(0);
  const integratedImuDistance = useRef<number>(0);

  // Simulated path variables
  const simAngleRef = useRef<number>(0);
  const simLatRef = useRef<number>(KYIV_LAT);
  const simLonRef = useRef<number>(KYIV_LON);
  const simAltRef = useRef<number>(179.3);

  // --- Initialize Session List ---
  useEffect(() => {
    loadSessions();
    checkSensorAPI();
  }, []);

  const loadSessions = () => {
    try {
      const stored = localStorage.getItem("telemetry_sessions");
      if (stored) {
        setSavedSessions(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Помилка зчитування збережених логів", e);
    }
  };

  const checkSensorAPI = () => {
    // Check if Geolocation or DeviceMotion are supported
    if (!window.DeviceMotionEvent) {
      setSensorPermissionsGranted(false);
    }
  };

  // Run dynamic open-meteo weather details fetcher to hook real ambient data to user coordinates
  const fetchLocalWeather = async (lat: number, lon: number) => {
    try {
      setWeatherStatus("Зчитування даних погоди Open-Meteo...");
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`
      );
      const data = await res.json();
      if (data && data.current) {
        const tempVal = data.current.temperature_2m ?? 22.4;
        const pressureVal = data.current.surface_pressure ?? 1013.25;
        const humidityVal = data.current.relative_humidity_2m ?? 60.0;
        const windSpeedVal = data.current.wind_speed_10m ?? 2.5;
        const windDirVal = data.current.wind_direction_10m ?? 180.0;

        weatherDataRef.current = {
          temp: tempVal,
          pressure: pressureVal,
          humidity: humidityVal,
          windSpeed: windSpeedVal,
          windDir: windDirVal
        };

        setCurrentTemp(tempVal);
        setLiveWeather(weatherDataRef.current);
        setWeatherStatus(`Дані оновлено з Open-Meteo (${tempVal}°C, ${pressureVal}hPa, ${humidityVal}%, ${windSpeedVal}м/с, ${windDirVal}°)`);
      }
    } catch (err) {
      setWeatherStatus("Помилка API погоди. Використовується барометрична симуляція");
    }
  };

  // Custom Screen Wake Lock to prevent screen shutdown
  const requestWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        setWakeLockActive(true);
      } catch (err: any) {
        console.warn(`Wake Lock Error: ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
        setWakeLockActive(false);
      });
    }
  };

  // Request native Android browser sensor and geolocation permissions
  const requestPermissions = async () => {
    // 1. Geolocation Permission
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsBuffer.current = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            alt: pos.coords.altitude || 145.0,
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy
          };
          fetchLocalWeather(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn("GPS Permission Denied: ", err.message),
        { enableHighAccuracy: true }
      );
    }

    // 2. iOS/Chrome Sensor Permission (requires user interaction in standard web environment)
    const DeviceMotionEventClass = (window as any).DeviceMotionEvent;
    if (
      DeviceMotionEventClass &&
      typeof DeviceMotionEventClass.requestPermission === "function"
    ) {
      try {
        const response = await DeviceMotionEventClass.requestPermission();
        if (response === "granted") {
          setSensorPermissionsGranted(true);
          listenToDeviceSensors();
        } else {
          setSensorPermissionsGranted(false);
        }
      } catch (e) {
        console.error("Request DeviceMotion permission failed", e);
        setSensorPermissionsGranted(false);
      }
    } else {
      // Standard Android Chrome doesn't require separate permission dialog, just direct triggers
      setSensorPermissionsGranted(true);
      listenToDeviceSensors();
    }
  };

  // Bind Hardware Listeners (accelerometer, gyroscope)
  const listenToDeviceSensors = () => {
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      // Standard Android returns acceleration excluding gravity
      const rax = event.acceleration?.x ?? 0;
      const ray = event.acceleration?.y ?? 0;
      const raz = event.acceleration?.z ?? 0;

      // Gravity-included for fallback or dynamic orientation
      const raxg = event.accelerationIncludingGravity?.x ?? 0;
      const rayg = event.accelerationIncludingGravity?.y ?? 0;
      const razg = event.accelerationIncludingGravity?.z ?? 0;

      // Gyroscope delta rotation (deg/s inside browsers by specification, convert to rad/s)
      const rgx = (event.rotationRate?.alpha ?? 0) * (Math.PI / 180);
      const rgy = (event.rotationRate?.beta ?? 0) * (Math.PI / 180);
      const rgz = (event.rotationRate?.gamma ?? 0) * (Math.PI / 180);

      // Save raw buffers (prior to filtering calibration)
      rawSensorBuffer.current = {
        ax: rax,
        ay: ray,
        az: raz,
        axRaw: raxg,
        ayRaw: rayg,
        azRaw: razg,
        gx: rgx,
        gy: rgy,
        gz: rgz,
        gxRaw: rgx,
        gyRaw: rgy,
        gzRaw: rgz
      };

      // Apply calibration corrections
      const calibratedAx = rax - offsetCalib.accelOffsetX;
      const calibratedAy = ray - offsetCalib.accelOffsetY;
      const calibratedAz = raz - offsetCalib.accelOffsetZ;

      const calibratedGx = rgx - offsetCalib.gyroOffsetX;
      const calibratedGy = rgy - offsetCalib.gyroOffsetY;
      const calibratedGz = rgz - offsetCalib.gyroOffsetZ;

      // Continuously apply Low-Pass exponential smoothing filter at high speed hardware updates
      const alpha = settings.alphaLowPass;
      filteredSensorBuffer.current = {
        ax: applyLowPass(calibratedAx, filteredSensorBuffer.current.ax, alpha),
        ay: applyLowPass(calibratedAy, filteredSensorBuffer.current.ay, alpha),
        az: applyLowPass(calibratedAz, filteredSensorBuffer.current.az, alpha),
        gx: applyLowPass(calibratedGx, filteredSensorBuffer.current.gx, alpha),
        gy: applyLowPass(calibratedGy, filteredSensorBuffer.current.gy, alpha),
        gz: applyLowPass(calibratedGz, filteredSensorBuffer.current.gz, alpha)
      };
    };

    window.addEventListener("devicemotion", handleDeviceMotion);
    return () => {
      window.removeEventListener("devicemotion", handleDeviceMotion);
    };
  };

  // Listen to GPS positioning changes
  useEffect(() => {
    if (recordingState !== "recording" || settings.simulatedMode) return;

    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const alt = pos.coords.altitude;
          const rawSpeed = pos.coords.speed;
          const now = Date.now();

          // Calculate calculated GPS speed if direct coordinates speed not provided
          let speed = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed : 0;
          let distanceStep = 0;

          if (lastGpsCoords.current) {
            distanceStep = getHaversineDistance(
              lastGpsCoords.current.lat,
              lastGpsCoords.current.lon,
              lat,
              lon
            );

            // Filter out minor GPS drift jumps under 1m
            if (distanceStep > 0.8) {
              accumulatedGpsDistance.current += distanceStep;
              if (speed === 0 && lastGpsTime.current > 0) {
                const dtSeconds = (now - lastGpsTime.current) / 1000;
                speed = distanceStep / (dtSeconds || 1);
              }
            }
          }

          // Fetch weather temperature dynamically when coords lock
          if (!lastGpsCoords.current) {
            fetchLocalWeather(lat, lon);
          }

          lastGpsCoords.current = { lat, lon };
          lastGpsTime.current = now;

          gpsBuffer.current = {
            lat,
            lon,
            alt: alt !== null ? alt : (gpsBuffer.current.alt || 150),
            speed,
            accuracy: pos.coords.accuracy
          };
        },
        (err) => console.warn("GPS tracking error:", err.message),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [recordingState, settings.simulatedMode]);

  // Calibrate Gyro and Accelerometer offsets
  const handleCalibrate = () => {
    // Record current raw buffer averages to eliminate ambient drift gravity offsets
    setOffsetCalib({
      accelOffsetX: rawSensorBuffer.current.ax,
      accelOffsetY: rawSensorBuffer.current.ay,
      accelOffsetZ: rawSensorBuffer.current.az,
      gyroOffsetX: rawSensorBuffer.current.gx,
      gyroOffsetY: rawSensorBuffer.current.gy,
      gyroOffsetZ: rawSensorBuffer.current.gz
    });
  };

  const handleResetCalibration = () => {
    setOffsetCalib({
      accelOffsetX: 0,
      accelOffsetY: 0,
      accelOffsetZ: 0,
      gyroOffsetX: 0,
      gyroOffsetY: 0,
      gyroOffsetZ: 0
    });
  };

  // Start High frequency ticks logger loop (10Hz or 20Hz configuration)
  const handleStartRecording = async () => {
    await requestPermissions();
    await requestWakeLock();

    if (recordingState === "idle") {
      recordsRef.current = [];
      setDurationMs(0);
      accumulatedGpsDistance.current = 0;
      lastGpsCoords.current = null;
      lastGpsTime.current = 0;
      lastGpsSpeed.current = 0;
      integratedImuVelocity.current = 0;
      integratedImuDistance.current = 0;

      // Start geo simulation indices
      simLatRef.current = KYIV_LAT;
      simLonRef.current = KYIV_LON;
      simAltRef.current = 175.4;
      simAngleRef.current = 0;
    }

    lastTickTimeRef.current = Date.now();
    setRecordingState("recording");
  };

  const handleStopAndSave = () => {
    setRecordingState("idle");
    releaseWakeLock();

    // Do not save completely empty records session
    if (recordsRef.current.length === 0) return;

    const currentRecords = [...recordsRef.current];
    const ts = getNumericTimestampFilename(new Date());
    const sessionId = `Session_${ts}`;
    const formattedDate = new Date().toLocaleString("uk-UA");
    const sessionComment = recordingComment;
    
    const newSession: SavedSession = {
      id: sessionId,
      date: formattedDate,
      filename: `${ts}.csv`,
      count: currentRecords.length,
      name: `${ts}.csv`,
      comment: sessionComment
    };

    // Store in localStorage
    try {
      const stored = localStorage.getItem("telemetry_sessions");
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newSession);
      localStorage.setItem("telemetry_sessions", JSON.stringify(list));

      // Save records body as specific file storage key
      localStorage.setItem(`records_${sessionId}`, JSON.stringify(currentRecords));
      setSavedSessions(list);
    } catch (e) {
      console.error("Браузер не зміг зберегти сесію локально (недостатньо пам'яті): ", e);
    }

    // Automatically trigger file download of CSV
    try {
      const csvStr = convertToCSV(currentRecords, sessionComment);
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${ts}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Помилка при автоматичному завантаженні CSV: ", err);
    }

    // Clear comment, buffers & live tracking values
    setRecordingComment("");
    recordsRef.current = [];
    setRecordsCount(0);
    setDurationMs(0);
    integratedImuVelocity.current = 0;
    integratedImuDistance.current = 0;
    setCurrentGPS({ lat: null, lon: null, alt: null, speed: 0, distance: 0, accel: 0 });
    setCurrentIMU({
      accelX: 0,
      accelY: 0,
      accelZ: 0,
      accelRawMag: 0,
      gyroX: 0,
      gyroY: 0,
      gyroZ: 0,
      speedIMU: 0,
      distIMU: 0,
      accelIMU: 0
    });
  };

  // Tick generator core
  useEffect(() => {
    if (recordingState !== "recording") {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      return;
    }

    const intervalTimeMs =Math.round(1000 / settings.targetFrequencyHz);

    trackingIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const dtSeconds = (now - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = now;

      setDurationMs((prev) => prev + dtSeconds * 1000);

      // ---------------------------------------------
      // CORE LOGIC: PROCESS & INTERPOLATE DATA
      // ---------------------------------------------
      let lat = 0;
      let lon = 0;
      let alt = 0;
      let speedGps = 0;
      let distanceGps = 0;
      let accelGps = 0;

      let axFiltered = 0;
      let ayFiltered = 0;
      let azFiltered = 0;
      let axRaw = 0;
      let ayRaw = 0;
      let azRaw = 0;

      let gxFiltered = 0;
      let gyFiltered = 0;
      let gzFiltered = 0;
      let gxRaw = 0;
      let gyRaw = 0;
      let gzRaw = 0;

      let ambientTemp = currentTemp;

      // SIMULATED LOG MODE
      if (settings.simulatedMode) {
        // Generate winding trajectory at ~10-20Hz logs rate
        simAngleRef.current += 0.015 * Math.sin(now / 5000); // minor turns
        // Walking/driving speed in simulated mode
        const simSpeed = 8.5 + 4.0 * Math.sin(now / 15000); // wave-like speed in m/s (approx 30 km/h)
        const displacement = simSpeed * dtSeconds; // meters traveled in this step

        // Earth coords translation (111111 meters is ~1 deg)
        simLatRef.current += (displacement * Math.cos(simAngleRef.current)) / 111111;
        simLonRef.current += (displacement * Math.sin(simAngleRef.current)) / (111111 * Math.cos((simLatRef.current * Math.PI) / 180));
        simAltRef.current += 0.1 * Math.sin(now / 8000) * dtSeconds; // slow altitude shifts

        // Coordinate locks
        lat = simLatRef.current;
        lon = simLonRef.current;
        alt = simAltRef.current;
        speedGps = simSpeed;

        // Cumulative GPS distance simulated
        accumulatedGpsDistance.current += displacement;
        distanceGps = accumulatedGpsDistance.current;

        // Derived GPS Acceleration
        accelGps = (simSpeed - lastGpsSpeed.current) / (dtSeconds || 1);
        lastGpsSpeed.current = simSpeed;

        // FAKE SIMULATED IMU: gait / engine vibration waveforms
        const gaitFreq = 1.8; // 1.8 Hz foot strikes / vibrations
        const wave = Math.sin(gaitFreq * 2 * Math.PI * (now / 1000));
        axRaw = (0.6 * wave + (Math.random() - 0.5) * 0.4);
        ayRaw = (0.4 * Math.cos(gaitFreq * 2 * Math.PI * (now / 1000)) + (Math.random() - 0.5) * 0.3);
        azRaw = (9.81 + 1.2 * wave + (Math.random() - 0.5) * 0.5); // contains simulated gravity offset

        // Gyroscope yaw/pitch shifts
        gxRaw = 0.02 * Math.sin(now / 1000) + (Math.random() - 0.5) * 0.05;
        gyRaw = 0.02 * Math.cos(now / 1000) + (Math.random() - 0.5) * 0.05;
        gzRaw = 0.12 * Math.cos(simAngleRef.current) + (Math.random() - 0.5) * 0.05;

        // Filter readings
        const alpha = settings.alphaLowPass;
        filteredSensorBuffer.current.ax = applyLowPass(axRaw, filteredSensorBuffer.current.ax, alpha);
        filteredSensorBuffer.current.ay = applyLowPass(ayRaw, filteredSensorBuffer.current.ay, alpha);
        filteredSensorBuffer.current.az = applyLowPass(azRaw, filteredSensorBuffer.current.az, alpha);
        filteredSensorBuffer.current.gx = applyLowPass(gxRaw, filteredSensorBuffer.current.gx, alpha);
        filteredSensorBuffer.current.gy = applyLowPass(gyRaw, filteredSensorBuffer.current.gy, alpha);
        filteredSensorBuffer.current.gz = applyLowPass(gzRaw, filteredSensorBuffer.current.gz, alpha);

        axFiltered = filteredSensorBuffer.current.ax;
        ayFiltered = filteredSensorBuffer.current.ay;
        azFiltered = filteredSensorBuffer.current.az;

        gxFiltered = filteredSensorBuffer.current.gx;
        gyFiltered = filteredSensorBuffer.current.gy;
        gzFiltered = filteredSensorBuffer.current.gz;

        // Mild temperature fluctuating drift
        ambientTemp = 21.8 + 0.4 * Math.sin(now / 20000) + (Math.random() - 0.5) * 0.05;

      } else {
        // REAL PHONE SENSOR MODE
        lat = gpsBuffer.current.lat || 0;
        lon = gpsBuffer.current.lon || 0;
        alt = gpsBuffer.current.alt || 0;
        speedGps = gpsBuffer.current.speed;
        distanceGps = accumulatedGpsDistance.current;

        // Acceleration from GPS
        accelGps = (speedGps - lastGpsSpeed.current) / (dtSeconds || 1);
        lastGpsSpeed.current = speedGps;

        // Populate Raw IMU values
        axFiltered = filteredSensorBuffer.current.ax;
        ayFiltered = filteredSensorBuffer.current.ay;
        azFiltered = filteredSensorBuffer.current.az;

        axRaw = rawSensorBuffer.current.ax;
        ayRaw = rawSensorBuffer.current.ay;
        azRaw = rawSensorBuffer.current.az;

        gxFiltered = filteredSensorBuffer.current.gx;
        gyFiltered = filteredSensorBuffer.current.gy;
        gzFiltered = filteredSensorBuffer.current.gz;

        gxRaw = rawSensorBuffer.current.gx;
        gyRaw = rawSensorBuffer.current.gy;
        gzRaw = rawSensorBuffer.current.gz;
      }

      // --- CALCULATE INDEPENDENT IMU Integration Speed & Distance ---
      // 1. Dynamic motion acceleration (removing standard gravity components)
      // Standard Android acceleration event.acceleration provides dynamic vector directly.
      // If gravity-included, we exclude the 9.81 on Z-axis contextually.
      const dynamicMotionMag = Math.sqrt(
        axFiltered * axFiltered +
        ayFiltered * ayFiltered +
        (Math.abs(azFiltered) > 4 ? azFiltered : 0) * (Math.abs(azFiltered) > 4 ? azFiltered : 0)
      );

      // Low cutoff offset to minimize drift resting creep
      const thresholdMotion = 0.12; // m/s2
      const activeAccel = dynamicMotionMag > thresholdMotion ? dynamicMotionMag : 0;

      // speedIMU = speedIMU + accel * dt
      integratedImuVelocity.current += activeAccel * dtSeconds;

      // Friction damping factor to bound infinite dead reckoning drift creep while standing still
      if (activeAccel === 0) {
        integratedImuVelocity.current *= 0.94; // decelerate drift
        if (integratedImuVelocity.current < 0.05) {
          integratedImuVelocity.current = 0;
        }
      }

      // bound max speed to reasonable driving speeds
      if (integratedImuVelocity.current > 45) {
        integratedImuVelocity.current = 45; 
      }

      // distIMU = distIMU + speed * dt
      integratedImuDistance.current += integratedImuVelocity.current * dtSeconds;

      // ---------------------------------------------
      // COMMIT THE PERIODIC SNAPSHOT TO THE DATABASE RECORDS BUFFER
      // ---------------------------------------------
      const absoluteNow = Date.now();
      const relativeMs = durationMs + dtSeconds * 1000;

      // Hourly/minute update check (60-second limit)
      const secondsPassed = Math.floor(relativeMs / 1000);
      const prevSecondsPassed = Math.floor(durationMs / 1000);
      const isNewMinute = Math.floor(secondsPassed / 60) > Math.floor(prevSecondsPassed / 60) || recordsRef.current.length === 0;

      if (isNewMinute) {
        if (!settings.simulatedMode && gpsBuffer.current.lat !== null && gpsBuffer.current.lon !== null) {
          fetchLocalWeather(gpsBuffer.current.lat, gpsBuffer.current.lon);
        } else if (settings.simulatedMode) {
          const tempVal = parseFloat((21.8 + Math.sin(now / 30000) * 1.5 + (Math.random() - 0.5) * 0.4).toFixed(2));
          const pressureVal = parseFloat((1011.0 + Math.cos(now / 50000) * 6 + (Math.random() - 0.5) * 0.5).toFixed(2));
          const humidityVal = Math.round(59 + Math.sin(now / 40000) * 10 + (Math.random() - 0.5) * 2);
          const windSpeedVal = parseFloat((2.8 + Math.sin(now / 25000) * 1.4 + (Math.random() - 0.5) * 0.5).toFixed(2));
          const windDirVal = Math.round((180 + Math.cos(now / 60000) * 45 + Math.random() * 10) % 360);

          weatherDataRef.current = {
            temp: tempVal,
            pressure: pressureVal,
            humidity: humidityVal,
            windSpeed: windSpeedVal,
            windDir: windDirVal
          };

          setCurrentTemp(tempVal);
          setLiveWeather(weatherDataRef.current);
          setWeatherStatus(`Дані оновлено за симуляцією (${new Date().toLocaleTimeString("uk-UA")})`);
        }
      } else {
        // Continue gently fluctuating simulation temperatures if offline
        if (settings.simulatedMode) {
          const rawTemp = weatherDataRef.current.temp + (Math.random() - 0.5) * 0.005;
          weatherDataRef.current.temp = parseFloat(rawTemp.toFixed(3));
          setCurrentTemp(weatherDataRef.current.temp);
        }
      }

      // ---------------------------------------------
      // CALCULATE OBD TELEMETRY METRICS
      // ---------------------------------------------
      let activeObdConnected = false;
      let obdRPM: number | null = null;
      let obdSpeedHex: number | null = null;
      let obdGearVal: string | null = null;
      let obdFuelFlowVal: number | null = null;
      let obdFuelEconomyVal: number | null = null;
      let obdCoolantTempVal: number | null = null;
      let obdOilTempVal: number | null = null;
      let obdTotalFuelUsedVal: number | null = null;
      let obdElectricPowerVal: number | null = null;
      let obdEnergyConsumptionVal: number | null = null;
      let obdBatterySOCVal: number | null = null;
      let obdRecuperationVal: number | null = null;

      if (obdConnected === "real") {
        activeObdConnected = true;
        obdRPM = obdDataRef.current.rpm;
        obdSpeedHex = obdDataRef.current.speed;
        obdGearVal = obdDataRef.current.gear;
        obdFuelFlowVal = obdDataRef.current.fuelFlow;
        obdFuelEconomyVal = obdDataRef.current.fuelEconomy;
        obdCoolantTempVal = obdDataRef.current.coolantTemp;
        obdOilTempVal = obdDataRef.current.oilTemp;
        obdTotalFuelUsedVal = obdDataRef.current.totalFuelUsed;
        obdElectricPowerVal = obdDataRef.current.electricPower;
        obdEnergyConsumptionVal = obdDataRef.current.energyConsumption;
        obdBatterySOCVal = obdDataRef.current.batterySOC;
        obdRecuperationVal = obdDataRef.current.recuperation;
      } else if (obdConnected === "simulated") {
        activeObdConnected = true;
        
        const spdKmh = speedGps * 3.6;
        obdSpeedHex = parseFloat(spdKmh.toFixed(1));
        
        let mGear = "N";
        let mRpm = 800;
        
        if (spdKmh < 1.0) {
          mGear = "N";
          mRpm = 800 + Math.random() * 20;
        } else if (spdKmh < 20) {
          mGear = "1";
          mRpm = Math.min(5800, spdKmh * 180 + 850);
        } else if (spdKmh < 42) {
          mGear = "2";
          mRpm = Math.min(5800, (spdKmh - 16) * 110 + 1150);
        } else if (spdKmh < 65) {
          mGear = "3";
          mRpm = Math.min(5800, (spdKmh - 38) * 80 + 1300);
        } else if (spdKmh < 90) {
          mGear = "4";
          mRpm = Math.min(5800, (spdKmh - 62) * 60 + 1450);
        } else if (spdKmh < 118) {
          mGear = "5";
          mRpm = Math.min(5800, (spdKmh - 86) * 45 + 1550);
        } else {
          mGear = "6";
          mRpm = Math.min(5800, (spdKmh - 114) * 35 + 1700);
        }
        
        if (accelGps > 0.1 && mGear !== "N") {
          mRpm += accelGps * 340;
        }
        obdRPM = Math.round(mRpm);
        obdGearVal = mGear;
        
        const recordingSeconds = (durationMs + dtSeconds * 1000) / 1000;
        const coolantBase = 45.0 + Math.min(46.0, recordingSeconds * 0.12);
        obdCoolantTempVal = parseFloat((coolantBase + Math.sin(now / 15000) * 0.4).toFixed(1));
        
        const oilBase = 38.0 + Math.min(57.0, recordingSeconds * 0.08);
        obdOilTempVal = parseFloat((oilBase + Math.cos(now / 18000) * 0.3).toFixed(1));
        
        let flowIce = 0.0;
        if (spdKmh < 1.0) {
          flowIce = 0.75 + Math.random() * 0.05;
        } else {
          const loadFactor = 1.0 + Math.max(0, accelGps) * 1.5;
          flowIce = (mRpm * 0.0016) * loadFactor;
          if (accelGps < -0.3) {
            flowIce = 0.04 + Math.random() * 0.04;
          }
        }
        obdFuelFlowVal = parseFloat(flowIce.toFixed(3));
        
        if (flowIce > 0.05) {
          obdFuelEconomyVal = parseFloat((spdKmh / flowIce).toFixed(2));
        } else {
          obdFuelEconomyVal = 99.9;
        }
        
        obdDataRef.current.totalFuelUsed += (flowIce / 3600) * dtSeconds;
        obdTotalFuelUsedVal = parseFloat(obdDataRef.current.totalFuelUsed.toFixed(4));
        
        if (obdDataRef.current.batterySOC === null) {
          obdDataRef.current.batterySOC = 74.5;
        }
        
        let elW = 0.0;
        if (spdKmh < 1.0) {
          elW = 420 + Math.random() * 30;
        } else {
          if (accelGps >= 0) {
            elW = (accelGps * 13000) * (speedGps + 1.2) + 550;
          } else {
            elW = (accelGps * 21000) * (speedGps + 0.5) + 320;
          }
        }
        if (elW > 120000) elW = 120000;
        if (elW < -65000) elW = -65000;
        
        obdElectricPowerVal = parseFloat(elW.toFixed(1));
        
        const whChargedOrSpent = elW * (dtSeconds / 3600);
        const socDelta = (whChargedOrSpent / 12000) * 100;
        obdDataRef.current.batterySOC = Math.max(10, Math.min(100, obdDataRef.current.batterySOC - socDelta));
        obdBatterySOCVal = parseFloat(obdDataRef.current.batterySOC.toFixed(2));
        
        obdRecuperationVal = elW < 0 ? parseFloat((-elW).toFixed(1)) : 0.0;
        
        if (spdKmh > 1.5) {
          obdEnergyConsumptionVal = parseFloat((elW / spdKmh).toFixed(1));
        } else {
          obdEnergyConsumptionVal = 0.0;
        }

        // Set references in real-time
        obdDataRef.current.rpm = obdRPM;
        obdDataRef.current.speed = obdSpeedHex;
        obdDataRef.current.gear = obdGearVal;
        obdDataRef.current.fuelFlow = obdFuelFlowVal;
        obdDataRef.current.fuelEconomy = obdFuelEconomyVal;
        obdDataRef.current.coolantTemp = obdCoolantTempVal;
        obdDataRef.current.oilTemp = obdOilTempVal;
        obdDataRef.current.electricPower = obdElectricPowerVal;
        obdDataRef.current.energyConsumption = obdEnergyConsumptionVal;
        obdDataRef.current.batterySOC = obdBatterySOCVal;
        obdDataRef.current.recuperation = obdRecuperationVal;

        // update react state throttled so we don't choke the UI thread
        if (recordsRef.current.length % 5 === 0) {
          setObdData({
            rpm: obdRPM,
            speed: obdSpeedHex,
            gear: obdGearVal,
            fuelFlow: obdFuelFlowVal,
            fuelEconomy: obdFuelEconomyVal,
            coolantTemp: obdCoolantTempVal,
            oilTemp: obdOilTempVal,
            totalFuelUsed: obdTotalFuelUsedVal,
            electricPower: obdElectricPowerVal,
            energyConsumption: obdEnergyConsumptionVal,
            batterySOC: obdBatterySOCVal,
            recuperation: obdRecuperationVal
          });
        }
      }

      const hours = Math.floor(relativeMs / 3600000).toString().padStart(2, "0");
      const minutes = Math.floor((relativeMs % 3600000) / 60000).toString().padStart(2, "0");
      const seconds = Math.floor((relativeMs % 60000) / 1000).toString().padStart(2, "0");
      const ms = Math.floor(relativeMs % 1000).toString().padStart(3, "0");
      const timeStr = `${hours}:${minutes}:${seconds}.${ms}`;

      const snapshot: TelemetryRecord = {
        timestamp: Math.round(relativeMs),
        absTime: absoluteNow,
        formattedTime: timeStr,
        gpsLat: lat !== 0 ? lat : null,
        gpsLon: lon !== 0 ? lon : null,
        gpsAlt: alt !== 0 ? alt : null,
        gpsSpeed: speedGps,
        gpsDistance: distanceGps,
        gpsAccel: accelGps,
        accelX: axFiltered,
        accelY: ayFiltered,
        accelZ: azFiltered,
        accelXRaw: axRaw,
        accelYRaw: ayRaw,
        accelZRaw: azRaw,
        accelRawMag: dynamicMotionMag,
        gyroX: gxFiltered,
        gyroY: gyFiltered,
        gyroZ: gzFiltered,
        gyroXRaw: gxRaw,
        gyroYRaw: gyRaw,
        gyroZRaw: gzRaw,
        temp: weatherDataRef.current.temp,
        pressure: weatherDataRef.current.pressure,
        humidity: weatherDataRef.current.humidity,
        windSpeed: weatherDataRef.current.windSpeed,
        windDir: weatherDataRef.current.windDir,
        calcSpeedIMU: integratedImuVelocity.current,
        calcDistIMU: integratedImuDistance.current,
        calcAccelIMU: activeAccel,
        // OBD fields
        obdConnected: activeObdConnected,
        obdRPM,
        obdSpeed: obdSpeedHex,
        obdGear: obdGearVal,
        obdFuelFlow: obdFuelFlowVal,
        obdFuelEconomy: obdFuelEconomyVal,
        obdCoolantTemp: obdCoolantTempVal,
        obdOilTemp: obdOilTempVal,
        obdTotalFuelUsed: obdTotalFuelUsedVal,
        obdElectricPower: obdElectricPowerVal,
        obdEnergyConsumption: obdEnergyConsumptionVal,
        obdBatterySOC: obdBatterySOCVal,
        obdRecuperation: obdRecuperationVal
      };

      recordsRef.current.push(snapshot);

      // Throttled UI State refreshes to save precious CPU & GPU cycles
      if (recordsRef.current.length % 2 === 0) {
        setRecordsCount(recordsRef.current.length);
        setCurrentGPS({
          lat: snapshot.gpsLat,
          lon: snapshot.gpsLon,
          alt: snapshot.gpsAlt,
          speed: snapshot.gpsSpeed,
          distance: snapshot.gpsDistance,
          accel: snapshot.gpsAccel
        });
        setCurrentIMU({
          accelX: snapshot.accelX,
          accelY: snapshot.accelY,
          accelZ: snapshot.accelZ,
          accelRawMag: dynamicMotionMag,
          gyroX: snapshot.gyroX,
          gyroY: snapshot.gyroY,
          gyroZ: snapshot.gyroZ,
          speedIMU: snapshot.calcSpeedIMU,
          distIMU: snapshot.calcDistIMU,
          accelIMU: snapshot.calcAccelIMU
        });
        setCurrentTemp(snapshot.temp);
      }

    }, intervalTimeMs);

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [recordingState, settings.targetFrequencyHz, currentTemp, settings.alphaLowPass, settings.simulatedMode, obdConnected]);

  // Clean whole storage databases
  const handleSessionDelete = (id: string) => {
    try {
      localStorage.removeItem(`records_${id}`);
      const updated = savedSessions.filter((s) => s.id !== id);
      localStorage.setItem("telemetry_sessions", JSON.stringify(updated));
      setSavedSessions(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadSessionCSV = (id: string, name: string, comment?: string) => {
    try {
      const stored = localStorage.getItem(`records_${id}`);
      if (!stored) {
        alert("Помилка: Дані цієї сесії не знайдено");
        return;
      }
      const parsedRecords = JSON.parse(stored);
      const csvStr = convertToCSV(parsedRecords, comment);

      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", name.endsWith(".csv") ? name : `${name}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareSessionFile = async (id: string, name: string, comment?: string) => {
    try {
      const stored = localStorage.getItem(`records_${id}`);
      if (!stored) {
        alert("Помилка: Дані цієї сесії не знайдено");
        return;
      }
      const parsedRecords = JSON.parse(stored);
      const csvStr = convertToCSV(parsedRecords, comment);
      
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const cleanFilename = name.endsWith(".csv") ? name : `${name}.csv`;
      const file = new File([blob], cleanFilename, { type: "text/csv" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Телеметрія: ${cleanFilename}`,
          text: comment || "Лог телеметрії гео-інерціальних датчиків"
        });
      } else {
        const emailBody = encodeURIComponent(
          `Привіт! Надсилаю лог телеметрії ${cleanFilename}.\nКоментар до треку: ${comment || "відсутній"}\n\nБудь ласка, завантажте CSV-файл із сервісу.\n\n`
        );
        window.location.href = `mailto:?subject=${encodeURIComponent("Телеметрія - " + cleanFilename)}&body=${emailBody}`;
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Помилка відправки файлу", e);
        alert(`Не вдалося поділитися файлом: ${e.message}`);
      }
    }
  };

  const parseOBDResponse = (text: string) => {
    const clean = text.replace(/[\r\n\t >]/g, "").toUpperCase();
    console.log("OBD Parse: matching", clean);

    if (clean.includes("410C")) {
      const idx = clean.indexOf("410C");
      const hexVal = clean.slice(idx + 4, idx + 8);
      if (hexVal.length === 4) {
        const a = parseInt(hexVal.slice(0, 2), 16);
        const b = parseInt(hexVal.slice(2, 4), 16);
        if (!isNaN(a) && !isNaN(b)) {
          obdDataRef.current.rpm = Math.round(((a * 256) + b) / 4);
        }
      }
    }

    if (clean.includes("410D")) {
      const idx = clean.indexOf("410D");
      const hexVal = clean.slice(idx + 4, idx + 6);
      if (hexVal.length === 2) {
        const speedVal = parseInt(hexVal, 16);
        if (!isNaN(speedVal)) {
          obdDataRef.current.speed = speedVal;
          
          const rpm = obdDataRef.current.rpm || 900;
          let estimatedGear = "N";
          if (speedVal > 2) {
            const ratio = rpm / speedVal;
            if (ratio > 110) estimatedGear = "1";
            else if (ratio > 70) estimatedGear = "2";
            else if (ratio > 50) estimatedGear = "3";
            else if (ratio > 40) estimatedGear = "4";
            else if (ratio > 30) estimatedGear = "5";
            else estimatedGear = "6";
          }
          obdDataRef.current.gear = estimatedGear;
        }
      }
    }

    if (clean.includes("4105")) {
      const idx = clean.indexOf("4105");
      const hexVal = clean.slice(idx + 4, idx + 6);
      if (hexVal.length === 2) {
        const val = parseInt(hexVal, 16);
        if (!isNaN(val)) {
          obdDataRef.current.coolantTemp = val - 40;
        }
      }
    }

    if (clean.includes("415C")) {
      const idx = clean.indexOf("415C");
      const hexVal = clean.slice(idx + 4, idx + 6);
      if (hexVal.length === 2) {
        const val = parseInt(hexVal, 16);
        if (!isNaN(val)) {
          obdDataRef.current.oilTemp = val - 40;
        }
      }
    }

    if (clean.includes("415E")) {
      const idx = clean.indexOf("415E");
      const hexVal = clean.slice(idx + 4, idx + 8);
      if (hexVal.length === 4) {
        const a = parseInt(hexVal.slice(0, 2), 16);
        const b = parseInt(hexVal.slice(2, 4), 16);
        if (!isNaN(a) && !isNaN(b)) {
          const lPerHour = ((a * 256) + b) * 0.05;
          obdDataRef.current.fuelFlow = lPerHour;

          const spd = obdDataRef.current.speed || 0;
          if (lPerHour > 0.1) {
            obdDataRef.current.fuelEconomy = spd / lPerHour;
          } else {
            obdDataRef.current.fuelEconomy = 99.9;
          }
        }
      }
    }

    if (clean.includes("415B")) {
      const idx = clean.indexOf("415B");
      const hexVal = clean.slice(idx + 4, idx + 6);
      if (hexVal.length === 2) {
        const val = parseInt(hexVal, 16);
        if (!isNaN(val)) {
          obdDataRef.current.batterySOC = (val / 255) * 100;
        }
      }
    }

    if (obdDataRef.current.batterySOC !== null) {
      const rpm = obdDataRef.current.rpm || 800;
      const speedKmh = obdDataRef.current.speed || 0;
      
      let powerW = 450;
      if (speedKmh > 0) {
        if (rpm > 3000) {
          powerW = 12000 + (rpm - 3000) * 12;
        } else {
          powerW = 3000 + rpm * 1.5;
        }
      }
      obdDataRef.current.electricPower = powerW;
      
      if (speedKmh > 2) {
        obdDataRef.current.energyConsumption = powerW / speedKmh;
      } else {
        obdDataRef.current.energyConsumption = 0;
      }
      obdDataRef.current.recuperation = 0;
    }

    setObdData({
      rpm: obdDataRef.current.rpm,
      speed: obdDataRef.current.speed,
      gear: obdDataRef.current.gear,
      fuelFlow: obdDataRef.current.fuelFlow,
      fuelEconomy: obdDataRef.current.fuelEconomy,
      coolantTemp: obdDataRef.current.coolantTemp,
      oilTemp: obdDataRef.current.oilTemp,
      totalFuelUsed: obdDataRef.current.totalFuelUsed,
      electricPower: obdDataRef.current.electricPower,
      energyConsumption: obdDataRef.current.energyConsumption,
      batterySOC: obdDataRef.current.batterySOC,
      recuperation: obdDataRef.current.recuperation
    });
  };

  const handleConnectOBDReal = async () => {
    if (!("bluetooth" in navigator)) {
      alert("⚠️ Ваш веб-браузер або пристрій не підтримує Web Bluetooth API. На iOS Safari та багатьох браузерах Web Bluetooth заблоковано Apple. Будь ласка, запустіть Емуляцію OBD-II датчиків для повноцінного тестування!");
      return;
    }

    try {
      setObdConnected("connecting");
      obdDataRef.current.connectedState = "connecting";

      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: "OBD" },
          { namePrefix: "ELM" },
          { namePrefix: "V-LINK" },
          { namePrefix: "LE" },
          { namePrefix: "BT" },
          { namePrefix: "Car" },
          { namePrefix: "IOS" }
        ],
        optionalServices: [
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART service
          "0000fff0-0000-1000-8000-00805f9b34fb"  // General Serial Pass-through service
        ]
      });

      console.log("BLE device paired:", device.name);
      
      const server = await device.gatt.connect();
      console.log("GATT Connected successfully");

      let txCharacteristic: any = null;
      let rxCharacteristic: any = null;

      const services = await server.getPrimaryServices();
      for (const s of services) {
        console.log("Primary BLE service:", s.uuid);
        try {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              txCharacteristic = c;
            }
            if (c.properties.notify || c.properties.indicate) {
              rxCharacteristic = c;
            }
          }
        } catch (charError) {
          console.warn("Could not retrieve characteristics for service: ", s.uuid, charError);
        }
        if (txCharacteristic && rxCharacteristic) break;
      }

      if (!txCharacteristic || !rxCharacteristic) {
        try {
          const service = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
          txCharacteristic = await service.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
          rxCharacteristic = await service.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
        } catch (errFallback) {
          throw new Error("Не вдалося ідентифікувати UART сервіс прийому/передачі даних. Перевірте сумісність вашого BLE адаптера.");
        }
      }

      await rxCharacteristic.startNotifications();
      let incomingBuffer = "";
      let lastActivityTime = Date.now();

      rxCharacteristic.addEventListener("characteristicvaluechanged", (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const str = decoder.decode(value);
        incomingBuffer += str;
        
        if (incomingBuffer.includes(">")) {
          parseOBDResponse(incomingBuffer);
          incomingBuffer = "";
          lastActivityTime = Date.now();
        }
      });

      const writeCommand = async (cmd: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(cmd + "\r");
        if (txCharacteristic.properties.writeWithoutResponse) {
          await txCharacteristic.writeValueWithoutResponse(data);
        } else {
          await txCharacteristic.writeValueWithResponse(data);
        }
        await new Promise(res => setTimeout(res, 80));
      };

      await writeCommand("ATZ");
      await writeCommand("ATE0");
      await writeCommand("ATL0");
      await writeCommand("ATS0");
      await writeCommand("ATSP0");

      setObdConnected("real");
      obdDataRef.current.connectedState = "real";

      let activeIndex = 0;
      const queries = ["010C", "010D", "0105", "015C", "015E", "015B"];

      const queryInterval = setInterval(async () => {
        if (obdDataRef.current.connectedState !== "real") {
          clearInterval(queryInterval);
          return;
        }

        if (Date.now() - lastActivityTime > 9000) {
          console.warn("OBD communication timed out.");
          handleDisconnectOBD();
          alert("Зв'язок з OBD-II модулем втрачено (перевищено таймаут відповіді).");
          return;
        }

        try {
          const pid = queries[activeIndex];
          activeIndex = (activeIndex + 1) % queries.length;
          await writeCommand(pid);
        } catch (writeErr) {
          console.error("Failed to write query:", writeErr);
        }
      }, 350);

      (device as any)._obdInterval = queryInterval;
      (device as any)._gattServer = server;
      (device as any)._rxChar = rxCharacteristic;
      activeBtDeviceRef.current = device;

    } catch (e: any) {
      console.error("BLE connection error:", e);
      setObdConnected("disconnected");
      obdDataRef.current.connectedState = "disconnected";
      alert(`Помилка підключення: ${e.message || e}`);
    }
  };

  const handleConnectOBDSimulated = () => {
    if (obdConnected === "real") {
      handleDisconnectOBD();
    }
    
    setObdConnected("simulated");
    obdDataRef.current.connectedState = "simulated";
    
    const baseData = {
      rpm: 800,
      speed: 0,
      gear: "N",
      fuelFlow: 0.75,
      fuelEconomy: 0.0,
      coolantTemp: 45.0,
      oilTemp: 38.0,
      totalFuelUsed: 0.0,
      electricPower: 450,
      energyConsumption: 0.0,
      batterySOC: 74.5,
      recuperation: 0.0
    };
    
    setObdData(baseData);
    obdDataRef.current = {
      ...baseData,
      connectedState: "simulated"
    };
  };

  const handleDisconnectOBD = () => {
    try {
      obdDataRef.current.connectedState = "disconnected";
      setObdConnected("disconnected");
      
      const device = activeBtDeviceRef.current;
      if (device) {
        if (device._obdInterval) {
          clearInterval(device._obdInterval);
        }
        if (device._rxChar) {
          try {
            device._rxChar.removeEventListener("characteristicvaluechanged");
          } catch (evErr) {}
        }
        if (device._gattServer && device._gattServer.connected) {
          device._gattServer.disconnect();
        }
      }
      activeBtDeviceRef.current = null;

      const emptyData = {
        rpm: null,
        speed: null,
        gear: null,
        fuelFlow: null,
        fuelEconomy: null,
        coolantTemp: null,
        oilTemp: null,
        totalFuelUsed: 0.0,
        electricPower: null,
        energyConsumption: null,
        batterySOC: null,
        recuperation: null
      };

      setObdData(emptyData);
      obdDataRef.current = {
        ...emptyData,
        connectedState: "disconnected"
      };
    } catch (e) {
      console.error("Disconnect error:", e);
    }
  };

  const handleClearLive = () => {
    recordsRef.current = [];
    setRecordsCount(0);
    setDurationMs(0);
    integratedImuVelocity.current = 0;
    integratedImuDistance.current = 0;
    setCurrentGPS({ lat: null, lon: null, alt: null, speed: 0, distance: 0, accel: 0 });
    setCurrentIMU({
      accelX: 0, accelY: 0, accelZ: 0, accelRawMag: 0,
      gyroX: 0, gyroY: 0, gyroZ: 0, speedIMU: 0, distIMU: 0, accelIMU: 0
    });
  };

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
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono font-normal py-0.5 px-2 rounded-full border border-slate-700">
                  v1.0
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Високоточний логер GPS (10-20Гц) та інерціальних датчиків з фільтрацією
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <span className={settings.simulatedMode ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {settings.simulatedMode ? "Симуляція" : "Реальні сенсори"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* TABS SLIDES NAVIGATOR (MOBILE OPTIMIZED SLEEK SLIDER) */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-[69px] z-30 px-3 py-2 flex justify-center shadow-lg">
        <div className="max-w-6xl w-full flex bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: "control", label: "Запис & Керування", icon: Flame },
            { id: "metrics", label: "Показники & Сенсори", icon: Compass },
            { id: "charts", label: "Графіки Онлайн", icon: Activity },
            { id: "history", label: "Архів сесій логів", icon: FileSpreadsheet }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSlide === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSlide(tab.id as any)}
                className={`flex-1 min-w-[120px] sm:min-w-0 py-2 px-3.5 rounded-lg text-xs font-semibold font-sans cursor-pointer transition-all flex items-center justify-center gap-2.5 whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 lg:py-6 flex flex-col gap-6">

        {/* SLIDE 1: CONTROL & RECORDER SETUP */}
        {activeSlide === "control" && (
          <div className="space-y-6">
            
            {/* TOP STATUS CONTROL DECK */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                {/* Recording Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {recordingState !== "recording" ? (
                    <button
                      id="btn_start"
                      onClick={handleStartRecording}
                      className="px-6 py-3.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 hover:shadow-emerald-950/45 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2.5 text-sm"
                    >
                      <Play className="w-4 h-4 fill-current animate-pulse text-emerald-100" />
                      Почати запис
                    </button>
                  ) : (
                    <button
                      id="btn_stop"
                      onClick={handleStopAndSave}
                      className="px-6 py-3.5 rounded-xl font-bold bg-red-650 hover:bg-red-600 text-white shadow-md shadow-red-950/20 hover:shadow-red-950/45 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2.5 text-sm"
                    >
                      <Square className="w-4 h-4 fill-current text-red-105" />
                      Зупинити запис (Автозбереження)
                    </button>
                  )}
                </div>

                {/* Live Timer & Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex-1 lg:max-w-xl">
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
            </section>

            {/* RECORDER COMMENT FIELD */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
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
                />
              </div>
            </section>

            {/* EXTERNAL OBD-II INTEGRATION DECK */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
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
                      >
                        ДВЗ (Бензин)
                      </button>
                      <button 
                        onClick={() => setActiveCarEngineType("electric")}
                        className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${activeCarEngineType === "electric" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        Гібрид / EV
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {obdConnected === "disconnected" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleConnectOBDReal}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer border border-emerald-500/10 transition-all active:scale-[0.98]"
                  >
                    <Bluetooth className="w-4 h-4 text-emerald-200" />
                    Підключити адаптер Bluetooth BLE
                  </button>
                  <button
                    onClick={handleConnectOBDSimulated}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4 text-amber-500" />
                    Емуляція OBD-II датчиків
                  </button>
                </div>
              )}

              {obdConnected === "connecting" && (
                <div className="flex flex-col items-center justify-center py-6 bg-slate-950/45 rounded-xl border border-slate-850 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-t-emerald-500 border-r-transparent border-slate-800 animate-spin" />
                  <p className="text-xs text-slate-300 font-medium">Шукаємо пристрої &quot;OBD&quot;, &quot;ELM&quot; чи &quot;V-LINK&quot;...</p>
                  <button
                    onClick={handleDisconnectOBD}
                    className="text-[10px] text-red-400 hover:underline cursor-pointer font-bold"
                  >
                    Скасувати
                  </button>
                </div>
              )}

              {obdConnected !== "disconnected" && obdConnected !== "connecting" && (
                <div className="space-y-4">
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
                          <span className="font-bold text-emerald-400 block">
                            {obdData.fuelEconomy !== null && obdData.fuelEconomy > 0 ? `${obdData.fuelEconomy.toFixed(1)} км/л` : "—"}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-mono block">Сумарні витрати:</span>
                          <span className="font-bold text-emerald-400 block">
                            {obdData.totalFuelUsed.toFixed(4)} л
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-mono block">ККД EV (км/кВт·год):</span>
                          <span className="font-bold text-emerald-400 block">
                            {obdData.energyConsumption !== null && obdData.energyConsumption > 0 ? `${(1000 / obdData.energyConsumption).toFixed(1)} км/кВт·год` : "—"}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-mono block">Термо-режим батареї:</span>
                          <span className="font-bold text-slate-300 block">АКТИВНИЙ ПАСИВНИЙ</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* CONFIGURATION PANEL & SYSTEM SETTINGS */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800/85">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold font-sans text-slate-200">Параметри фільтрації та джерела даних</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 text-sm">

                {/* Low pass slider */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 font-mono flex justify-between">
                    <span>Коефіцієнт згладжування (Alpha)</span>
                    <span className="text-emerald-400 font-bold">{settings.alphaLowPass}</span>
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.80"
                    step="0.01"
                    value={settings.alphaLowPass}
                    onChange={(e) => setSettings({ ...settings, alphaLowPass: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 leading-normal">
                    Менше значення (0.05) дає ідеальне згладжування шумів, але додає затримку реакції. Більше (0.3) працює чутливіше.
                  </span>
                </div>

                {/* Rate checklist toggle */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 font-mono">Частота запису даних</label>
                  <div className="flex gap-2">
                    {[10, 20].map((hz) => (
                      <button
                        key={hz}
                        onClick={() => {
                          setSettings({ ...settings, targetFrequencyHz: hz });
                          if (recordingState === "recording") {
                            handleStartRecording();
                          }
                        }}
                        className={`flex-1 py-1.5 text-center text-xs font-bold font-mono rounded-lg border cursor-pointer transition-colors ${
                          settings.targetFrequencyHz === hz
                            ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-705"
                        }`}
                      >
                        {hz} Гц
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Надає дискретизацію {settings.targetFrequencyHz} Гц (запис кожні {Math.round(1000/settings.targetFrequencyHz)} мс).
                  </span>
                </div>

                {/* Source Mode Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 font-mono">Доступне Джерело Даних</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSettings({ ...settings, simulatedMode: true });
                        handleClearLive();
                      }}
                      className={`flex-1 py-1.5 text-center text-xs font-bold font-mono rounded-lg border cursor-pointer transition-all ${
                        settings.simulatedMode
                          ? "bg-amber-600/20 border-amber-500 text-amber-400"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      Симуляція
                    </button>
                    <button
                      onClick={() => {
                        setSettings({ ...settings, simulatedMode: false });
                        handleClearLive();
                        requestPermissions();
                      }}
                      className={`flex-1 py-1.5 text-center text-xs font-bold font-mono rounded-lg border cursor-pointer transition-all ${
                        !settings.simulatedMode
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      Пристрій
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    На комп'ютері тримайте режим Симуляції, яка показує ходьбу у Києві, вібрації автомобіля та погоду.
                  </span>
                </div>

                {/* Technical sensors status checks */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2.5">
                  <h4 className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Перевірка сумісності</h4>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Датчик руху:</span>
                      <span className={window.DeviceMotionEvent ? "text-emerald-400 font-bold" : "text-slate-550"}>
                        {window.DeviceMotionEvent ? "ПІДТРИМУЄТЬСЯ" : "ВІДСУТНІЙ"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Локація (GPS):</span>
                      <span className={"geolocation" in navigator ? "text-emerald-400 font-bold" : "text-amber-500"}>
                        {"geolocation" in navigator ? "ДОСТУПНО" : "ОБМЕЖЕНО"}
                      </span>
                    </div>
                    <div className="flex justify-between">
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
        )}

        {/* SLIDE 2: FULL METRICS & COMPLEX ENVIRONMENTAL METRICS */}
        {activeSlide === "metrics" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* LARGE GRID: GPS + IMU */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* GPS METRICS BOARD */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
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
                        {currentGPS.distance.toFixed(1)}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">метрів</span>
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
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
                <div className="grid grid-cols-3 gap-3">
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
                        {currentIMU.distIMU.toFixed(1)}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">метрів</span>
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
                    >
                      Калібрувати нуль
                    </button>
                    {(offsetCalib.accelOffsetX !== 0 || offsetCalib.gyroOffsetX !== 0) && (
                      <button
                        onClick={handleResetCalibration}
                        className="px-1.5 py-1 bg-rose-950/60 text-rose-450 border border-rose-900 rounded text-[9px] cursor-pointer"
                      >
                        Скинути
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* EXPANDED METEOROLOGICAL / WEATHER METRICS MODULE */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <Thermometer className="w-4.5 h-4.5 text-orange-405 text-orange-400" />
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
                      {liveWeather.pressure.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400">hPa</span>
                  </div>
                </div>

                {/* Humidity */}
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
                  <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Вологість</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold font-mono text-blue-400">
                      {liveWeather.humidity}
                    </span>
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                </div>

                {/* Wind Speed */}
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
                  <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Швидкість вітру</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {liveWeather.windSpeed.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-400">м/с</span>
                  </div>
                </div>

                {/* Wind Dir */}
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
                  <span className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Напрям вітру</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold font-mono text-amber-400">
                      {liveWeather.windDir}
                    </span>
                    <span className="text-[10px] text-slate-400">°</span>
                  </div>
                </div>

              </div>

              {/* Ambient manual sensor override */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850 mt-1">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Звіт стану погоди</span>
                  <p className="text-[11px] text-slate-355 mt-0.5 text-slate-300">{weatherStatus}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-mono whitespace-nowrap">Уставка температури:</span>
                  <input
                    type="range"
                    min="-10"
                    max="50"
                    step="0.5"
                    value={currentTemp}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCurrentTemp(val);
                      weatherDataRef.current.temp = val;
                      setLiveWeather((prev) => ({ ...prev, temp: val }));
                      setWeatherStatus("Кориговано користувачем вручну");
                    }}
                    className="w-28 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold font-mono text-orange-400 w-12 text-right">
                    {currentTemp.toFixed(1)}°C
                  </span>
                </div>
              </div>

            </section>

            {/* FULL COMPREHENSIVE OBD STATUS VIEW */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
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
                              ? `${obdData.totalFuelUsed.toFixed(4)} л`
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
        )}

        {/* SLIDE 3: REAL-TIME CHARTS CANVAS PLOT MODULES */}
        {activeSlide === "charts" && (
          <section className="flex flex-col gap-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold font-sans text-slate-200">
                Візуалізація Телеметрії (Останні 100 вимірювань за 10-20Гц)
              </h3>
              
              <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 self-start sm:self-auto">
                {[
                  { id: "imu", label: "Сенсори IMU" },
                  { id: "speed", label: "Швидкість & Шляхи" },
                  { id: "altitude", label: "Траєкторія Висот" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedChartTab(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                      selectedChartTab === tab.id
                        ? "bg-slate-800 text-slate-200"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
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
                    records={recordsRef.current}
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
                    records={recordsRef.current}
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
                    records={recordsRef.current}
                    title="Швидкість: GPS з супутника VS Інерційне Інтегрування IMU"
                    unit=" км/год"
                    selectedFields={[
                      { label: "Швидкість GPS", key: "gpsSpeed", color: "#10b981", scale: 3.6 },
                      { label: "Швидкість її IMU", key: "calcSpeedIMU", color: "#a855f7", scale: 3.6 }
                    ]}
                  />
                  <TelemetryCanvasChart
                    records={recordsRef.current}
                    title="Дистанція: Накопичена за супутниками VS Мертвий Відлік IMU"
                    unit=" м"
                    selectedFields={[
                      { label: "Дистанція GPS", key: "gpsDistance", color: "#10b981" },
                      { label: "Дистанція IMU", key: "calcDistIMU", color: "#6366f1" }
                    ]}
                  />
                </div>
              )}

              {selectedChartTab === "altitude" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TelemetryCanvasChart
                    records={recordsRef.current}
                    title="Профіль висоти над рівнем моря"
                    unit=" м"
                    selectedFields={[
                      { label: "Висота GPS WGS84", key: "gpsAlt", color: "#3b82f6" }
                    ]}
                  />
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <h3 className="text-xs font-mono tracking-wider text-slate-400 uppercase">Показники екстраполяції</h3>
                      <p className="text-[12px] text-slate-300 leading-relaxed">
                        Прискорення з низькочастотним фільтром наведено в лівій панелі, а швидкість наведена у вкладці "Швидкість & Шляхи".
                        Зверніть увагу на відсутність дрейфу, оскільки інерційний вектор гаситься при затиханні коливань до нуля за допомогою алгоритму загасання. Це надзвичайно стабілізує похибки.
                      </p>
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                          <span className="text-[10px] text-slate-500 font-mono block">Кути дрейфу</span>
                          <span className="text-xs font-bold font-mono text-slate-300">Стабільний (+/-0.02)</span>
                        </div>
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                          <span className="text-[10px] text-slate-500 font-mono block">GPS Похибка</span>
                          <span className="text-xs font-bold font-mono text-emerald-400">+/- 3.2м (Locked)</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 text-[10px] text-slate-500 border-t border-slate-850/80 mt-4 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Для реальних випробовувань на відкритому просторі використовуйте смартфон у русі.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SLIDE 4: SAVED SESSIONS MANAGEMENT & SYSTEM ADVICES */}
        {activeSlide === "history" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* SAVED HISTORICAL LOG TRACK SESSIONS LIST */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
                  <h2 className="text-sm font-semibold font-sans text-slate-200">Архів та Історія Сесій Збережених Логів</h2>
                </div>
                <span className="text-[10px] font-mono text-slate-450 bg-slate-950 px-2 py-0.5 rounded">HTML5 сховище</span>
              </div>

              {savedSessions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-3 border border-dashed border-slate-800 rounded-xl">
                  <FileSpreadsheet className="w-10 h-10 text-slate-700" />
                  <div>
                    <p className="font-semibold text-slate-450 text-slate-400">Поки немає збережених сесій.</p>
                    <p className="mt-1 text-[11px] text-slate-500">Розпочніть запис у першому модулі, пройдіть дистанцію та натисніть "Зберегти & Зупинити".</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-305 text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-mono text-[10px] uppercase">
                        <th className="py-3 px-2">Файл (Р_М_Д_Г_Х_С)</th>
                        <th className="py-3 px-2 text-center">Дата сесії</th>
                        <th className="py-3 px-2 text-right">Точок</th>
                        <th className="py-3 px-2 text-center">Опції передачі</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {savedSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-950/40 transition-colors">
                          <td className="py-3.5 px-2">
                            <div className="font-bold text-slate-200 font-mono">{session.name}</div>
                            {session.comment && (
                              <div className="text-[11px] text-emerald-450 mt-1 italic max-w-[200px] truncate" title={session.comment}>
                                💬 {session.comment}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-center text-slate-400">{session.date}</td>
                          <td className="py-3.5 px-2 text-right font-mono font-bold text-emerald-400">
                            {session.count}
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Download CSV button */}
                              <button
                                onClick={() => handleDownloadSessionCSV(session.id, session.name, session.comment)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 cursor-pointer text-[12px] font-semibold flex items-center gap-1"
                                title="Скачати CSV файл на накопичувач"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>CSV</span>
                              </button>

                              {/* Share/Send via BT or Email button */}
                              <button
                                onClick={() => handleShareSessionFile(session.id, session.name, session.comment)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/10 cursor-pointer text-[12px] font-semibold flex items-center gap-1.5"
                                title="Поділитися файлом по Bluetooth, Email, Месенджери (Share API)"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <Mail className="w-3.5 h-3.5 text-blue-450/80" />
                                <span>Відправити</span>
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => handleSessionDelete(session.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 hover:text-rose-400 border border-rose-500/10 cursor-pointer"
                                title="Видалити сесію"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ANDROID COMPATIBILITY GUIDE */}
            <AndroidGuide />

          </div>
        )}

      </main>

      {/* FOOTER METADATA */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-xs font-mono space-y-1">
          <p>© 2026 Geo-Inertial Telemetry Suite. Спеціально для високочастотного аналізу на Android.</p>
          <p className="text-[10px] text-slate-600">Сенсори: Векторне інтегрування з затуханням нульового зміщення для запобігання похибкам.</p>
        </div>
      </footer>

    </div>
  );
}
