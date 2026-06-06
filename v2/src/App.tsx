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
  Gauge,
  Magnet,
  Volume2,
  Sun,
  BatteryCharging,
  Battery
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

import SlideControl from "./components/SlideControl";
import SlideMetrics from "./components/SlideMetrics";
import SlideCharts from "./components/SlideCharts";
import SlideHistory from "./components/SlideHistory";

import { useAcousticRpm } from "./hooks/useAcousticRpm";
import { useObd } from "./hooks/useObd";

const KYIV_LAT = 50.4501;
const KYIV_LON = 30.5234;

export default function App() {
  // --- UI and Settings State ---
  const [settings, setSettings] = useState<FilterSettings>({
    alphaLowPass: 0.15,
    enableKalman: true,
    targetFrequencyHz: 10,
    simulatedMode: false // set to false - default to real device sensors and gps
  });

  const [activeSlide, setActiveSlide] = useState<"control" | "metrics" | "charts" | "history">("control");
  const [recordingComment, setRecordingComment] = useState<string>("");
  const commentRef = useRef<string>("");
  commentRef.current = recordingComment;

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
    heightIMU: number;
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
    accelIMU: 0,
    heightIMU: 0
  });

  const [currentExtraSensors, setCurrentExtraSensors] = useState<{
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
  }>({
    magX: 0,
    magY: 0,
    magZ: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    baroPressure: 1013.25,
    calcHeightBaro: 0,
    noiseLevelDb: 35,
    lightLux: 50,
    batteryLevel: 100,
    batteryCharging: 0
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
    pressure: 101.33,
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
  const [selectedChartTab, setSelectedChartTab] = useState<"imu" | "speed">("imu");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  // --- OBD & Acoustic Custom Hooks ---
  const {
    obdConnected,
    obdData,
    setObdData,
    handleConnectOBDReal,
    handleConnectOBDSimulated,
    handleDisconnectOBD,
    obdDataRef
  } = useObd(setRecordingComment, setRecoveryNotice);

  const {
    acousticRpmEnabled,
    acousticRpm,
    acousticFreq,
    acousticNoisy,
    acousticCylinders,
    setAcousticCylinders,
    handleStartAcousticRpm,
    handleStopAcousticRpm,
    acousticRpmRef,
    acousticCylindersRef
  } = useAcousticRpm();

  const [activeCarEngineType, setActiveCarEngineType] = useState<"ice" | "electric">("ice");

  // --- Refs — Needed to run high-speed logging loop smoothly without triggering rendering bottlenecks ---
  const recordsRef = useRef<TelemetryRecord[]>([]);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);

  const weatherDataRef = useRef<{
    temp: number;
    pressure: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windDir: number | null;
  }>({
    temp: 22.4,
    pressure: 101.33,
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
  const integratedImuAltitude = useRef<number>(0);
  const imuVx = useRef<number>(0);
  const imuVy = useRef<number>(0);
  const imuVz = useRef<number>(0);
  const vibrationLevelRef = useRef<number>(0);

  // Points 1, 2, 3 Extra Telemetry Sensors buffers
  const magnetometerField = useRef({ x: 0, y: 0, z: 0 });
  const deviceOrientation = useRef({ alpha: 0, beta: 0, gamma: 0 }); // yaw (heading), pitch, roll
  const devicePressure = useRef<number | null>(null);
  const startBaroPressure = useRef<number | null>(null);
  const ambientLightLux = useRef<number>(50); // Default to reasonable indoor room lux
  const microphoneSoundDb = useRef<number>(35); // Default ambient decibels
  const batteryInfo = useRef({ level: 100, charging: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sensorsCleanupRef = useRef<(() => void) | null>(null);

  // Simulated path variables
  const simAngleRef = useRef<number>(0);
  const simLatRef = useRef<number>(KYIV_LAT);
  const simLonRef = useRef<number>(KYIV_LON);
  const simAltRef = useRef<number>(179.3);

  // --- Initialize Session List & Crash Recovery / Auto-Resume ---
  useEffect(() => {
    loadSessions();
    checkSensorAPI();

    return () => {
      if (sensorsCleanupRef.current) {
        sensorsCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {

    // Recover or Auto-resume session from unexpected shutdown / crash / refresh
    try {
      const recordingOngoing = localStorage.getItem("recording_state_ongoing");
      const backupInfoStr = localStorage.getItem("recording_backup_info");
      const backupRecordsStr = localStorage.getItem("recording_backup_records");

      if (recordingOngoing === "recording" && backupInfoStr && backupRecordsStr) {
        const backupInfo = JSON.parse(backupInfoStr);
        const backupRecords = JSON.parse(backupRecordsStr);

        if (Array.isArray(backupRecords) && backupRecords.length > 0) {
          // Restore records ref
          recordsRef.current = backupRecords;
          setRecordsCount(backupRecords.length);

          // Restore duration and comment
          const duration = backupInfo.durationMs || 0;
          setDurationMs(duration);

          if (backupInfo.sessionComment) {
            setRecordingComment(backupInfo.sessionComment);
          }

          // Restore continuous integration variables from the last snapshot record
          const lastSnap = backupRecords[backupRecords.length - 1];
          if (lastSnap) {
            integratedImuVelocity.current = lastSnap.calcSpeedIMU ?? 0;
            integratedImuDistance.current = lastSnap.calcDistIMU ?? 0;
            integratedImuAltitude.current = lastSnap.calcHeightIMU ?? 0;

            // Also restore current GPS and IMU states
            setCurrentGPS({
              lat: lastSnap.gpsLat,
              lon: lastSnap.gpsLon,
              alt: lastSnap.gpsAlt,
              speed: lastSnap.gpsSpeed,
              distance: lastSnap.gpsDistance,
              accel: lastSnap.gpsAccel
            });
            setCurrentIMU({
              accelX: lastSnap.accelX,
              accelY: lastSnap.accelY,
              accelZ: lastSnap.accelZ,
              accelRawMag: lastSnap.accelRawMag ?? 0,
              gyroX: lastSnap.gyroX,
              gyroY: lastSnap.gyroY,
              gyroZ: lastSnap.gyroZ,
              speedIMU: lastSnap.calcSpeedIMU ?? 0,
              distIMU: lastSnap.calcDistIMU ?? 0,
              accelIMU: lastSnap.calcAccelIMU ?? 0,
              heightIMU: lastSnap.calcHeightIMU ?? 0
            });
          }

          // Restore tracking timer starting reference
          lastTickTimeRef.current = Date.now();

          // Request permissions and wake lock
          requestPermissions();
          requestWakeLock();

          // Direct state resumption
          setRecordingState("recording");

          setRecoveryNotice(`⚡ Попередній сеанс запису телеметрії автоматично ВІДНОВЛЕНО ТА ПРОДОВЖЕНО! Дані (${backupRecords.length} точок, тривалість ${formatMilliseconds(duration)}) успішно завантажено в оперативну пам'ять.`);
        }
      } else if (backupInfoStr && backupRecordsStr) {
        // Fallback: standard recovery if recording was not marked as active
        const backupInfo = JSON.parse(backupInfoStr);
        const backupRecords = JSON.parse(backupRecordsStr);
        if (Array.isArray(backupRecords) && backupRecords.length > 0) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const hr = String(now.getHours()).padStart(2, "0");
          const min = String(now.getMinutes()).padStart(2, "0");
          const sec = String(now.getSeconds()).padStart(2, "0");
          const ts = `${year}_${month}_${day}_${hr}_${min}_${sec}`;

          const recoveredId = `Session_Recovered_${ts}`;
          const currentComment = backupInfo.sessionComment || "";
          const recoveredComment = currentComment
            ? `${currentComment} (Відновлено після збою, записано: ${backupRecords.length} точок)`
            : `Відновлено після збою (записано: ${backupRecords.length} точок)`;

          const recoveredSession: SavedSession = {
            id: recoveredId,
            date: backupInfo.date || now.toLocaleString("uk-UA"),
            filename: `${ts}_recovered.csv`,
            count: backupRecords.length,
            name: `${ts}_recovered.csv`,
            comment: recoveredComment
          };

          const stored = localStorage.getItem("telemetry_sessions");
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(recoveredSession);
          localStorage.setItem("telemetry_sessions", JSON.stringify(list));
          localStorage.setItem(`records_${recoveredId}`, JSON.stringify(backupRecords));

          setSavedSessions(list);
          setRecoveryNotice(`⚠️ Виявлено інерційний запис, що перервався! Дані (${backupRecords.length} точок) успішно відновлено та автозбережено в архіві як файл «${ts}_recovered.csv»`);

          // Clear backups so it does not trigger multiple times
          localStorage.removeItem("recording_backup_info");
          localStorage.removeItem("recording_backup_records");
        }
      }
    } catch (e) {
      console.error("Помилка автоматичного відновлення після збою:", e);
    }
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
        const tempVal = parseFloat((data.current.temperature_2m ?? 22.4).toFixed(1));
        const pressureVal = parseFloat(((data.current.surface_pressure ?? 1013.25) / 10).toFixed(2)); // convert hPa to kPa
        const humidityVal = parseFloat((data.current.relative_humidity_2m ?? 60.0).toFixed(1));
        const windSpeedVal = parseFloat((data.current.wind_speed_10m ?? 2.5).toFixed(1));
        const windDirVal = Math.round(data.current.wind_direction_10m ?? 180.0);

        weatherDataRef.current = {
          temp: tempVal,
          pressure: pressureVal,
          humidity: humidityVal,
          windSpeed: windSpeedVal,
          windDir: windDirVal
        };

        setCurrentTemp(tempVal);
        setLiveWeather(weatherDataRef.current);
        setWeatherStatus(`Дані оновлено з Open-Meteo (${tempVal.toFixed(1)}°C, ${pressureVal.toFixed(2)} кПа, ${humidityVal.toFixed(1)}%, ${windSpeedVal.toFixed(1)} м/с, ${windDirVal}°)`);
      }
    } catch (err) {
      setWeatherStatus("Помилка API погоди. Використовується барометрична модель");
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

  // Bind Hardware Listeners (accelerometer, gyroscope, orientation, magnetometer, barometer, and mic DB analyzer)
  const listenToDeviceSensors = () => {
    // 1. Clean up any previous listeners to prevent duplicates
    if (sensorsCleanupRef.current) {
      try {
        sensorsCleanupRef.current();
      } catch (e) {
        console.error("Error during pre-existing sensors cleanup:", e);
      }
      sensorsCleanupRef.current = null;
    }

    // 2. Motion (Acceleration & Angular Rotation Rate)
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

    // 3. Orientation (Yaw / Pitch / Roll) Listener for point 1 telemetry
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      deviceOrientation.current = {
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0
      };

      // If native Magnetometer sensor is offline, generate a drift-corrected synthesized magnetometer coordinate strength profile
      const alphaRad = (event.alpha ?? 0) * (Math.PI / 180);
      const betaRad = (event.beta ?? 0) * (Math.PI / 180);
      const gammaRad = (event.gamma ?? 0) * (Math.PI / 180);
      magnetometerField.current = {
        x: 38.5 * Math.cos(alphaRad) * Math.cos(betaRad),
        y: 38.5 * Math.sin(alphaRad) * Math.cos(gammaRad),
        z: -41.2 * Math.sin(betaRad)
      };
    };

    window.addEventListener("deviceorientation", handleDeviceOrientation);

    // 4. Native Magnetometer (Generic Sensor API)
    let magSensor: any = null;
    try {
      if ("Magnetometer" in window) {
        magSensor = new (window as any).Magnetometer({ frequency: 10 });
        magSensor.addEventListener("reading", () => {
          magnetometerField.current = {
            x: magSensor.x ?? 0,
            y: magSensor.y ?? 0,
            z: magSensor.z ?? 0
          };
        });
        magSensor.start();
      }
    } catch (err) {
      console.warn("Native Magnetometer sensor is not supported, using deviceorientation fallback:", err);
    }

    // 5. Native Barometer Pressure Sensor (Generic Sensor API) for point 2 telemetry
    let pressureSensor: any = null;
    try {
      if ("PressureSensor" in window) {
        pressureSensor = new (window as any).PressureSensor({ frequency: 5 });
        pressureSensor.addEventListener("reading", () => {
          devicePressure.current = pressureSensor.value ?? 1013.25; // hPa
        });
        pressureSensor.start();
      }
    } catch (err) {
      console.warn("Native PressureSensor is not supported, using GPS altitude-based barometric estimation:", err);
    }

    // 6. Native Ambient Light Sensor (Generic Sensor API) for point 3 telemetry
    let lightSensor: any = null;
    try {
      if ("AmbientLightSensor" in window) {
        lightSensor = new (window as any).AmbientLightSensor();
        lightSensor.addEventListener("reading", () => {
          ambientLightLux.current = lightSensor.illuminance ?? 50;
        });
        lightSensor.start();
      }
    } catch (e) {
      console.warn("AmbientLightSensor is not supported, simulating default cabin values:", e);
    }

    // 7. Battery Status (Discharging / Charging rate) for point 3 diagnostics
    try {
      if ("getBattery" in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          batteryInfo.current = {
            level: Math.round(battery.level * 100),
            charging: battery.charging ? 1 : 0
          };
          battery.addEventListener("levelchange", () => {
            batteryInfo.current.level = Math.round(battery.level * 100);
          });
          battery.addEventListener("chargingchange", () => {
            batteryInfo.current.charging = battery.charging ? 1 : 0;
          });
        });
      }
    } catch (e) {
      console.warn("Battery Status API not available:", e);
    }

    // 8. Microphone dB Noise Level Cabin Analysis for point 3 acoustics
    let streamRef: MediaStream | null = null;
    let audioActx: AudioContext | null = null;
    let keepSampling = true;

    const initMicrophoneStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!keepSampling) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef = stream;
        micStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioActx = new AudioCtx();
        audioContextRef.current = audioActx;

        const analyser = audioActx.createAnalyser();
        analyser.fftSize = 256;
        audioAnalyserRef.current = analyser;

        const source = audioActx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const sampleNoiseLevel = () => {
          if (!keepSampling || !audioAnalyserRef.current) return;
          audioAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Map 0..255 average sound amplitude to reasonable cabin decibels (35..90 dB)
          microphoneSoundDb.current = Math.round(35 + (average / 255) * 55);
          requestAnimationFrame(sampleNoiseLevel);
        };
        sampleNoiseLevel();
      } catch (err) {
        console.warn("Microphone access denied or audio channel blocked, using acoustic noise mapping formulas:", err);
      }
    };
    initMicrophoneStream();

    // 9. Return Unified Teardown Hook to prevent duplicate loops or browser thread leaking
    const cleanAndTeardown = () => {
      keepSampling = false;
      window.removeEventListener("devicemotion", handleDeviceMotion);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      if (magSensor) {
        try { magSensor.stop(); } catch (e) {}
      }
      if (pressureSensor) {
        try { pressureSensor.stop(); } catch (e) {}
      }
      if (lightSensor) {
        try { lightSensor.stop(); } catch (e) {}
      }
      if (streamRef) {
        try { streamRef.getTracks().forEach((t) => t.stop()); } catch (e) {}
      }
      if (audioActx) {
        try { audioActx.close(); } catch (e) {}
      }
      audioContextRef.current = null;
      audioAnalyserRef.current = null;
      micStreamRef.current = null;
    };

    sensorsCleanupRef.current = cleanAndTeardown;
    return cleanAndTeardown;
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
      integratedImuAltitude.current = 0;
      imuVx.current = 0;
      imuVy.current = 0;
      imuVz.current = 0;

      // Start geo simulation indices
      simLatRef.current = KYIV_LAT;
      simLonRef.current = KYIV_LON;
      simAltRef.current = 175.4;
      simAngleRef.current = 0;
    }

    lastTickTimeRef.current = Date.now();
    setRecordingState("recording");
    
    // Set active persistence flags
    localStorage.setItem("recording_state_ongoing", "recording");
    localStorage.setItem("recording_backup_info", JSON.stringify({
      sessionComment: commentRef.current || "",
      durationMs: 0,
      date: new Date().toLocaleString("uk-UA")
    }));
    localStorage.setItem("recording_backup_records", "[]");
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

    // Clear backups on normal session finish
    localStorage.removeItem("recording_state_ongoing");
    localStorage.removeItem("recording_backup_info");
    localStorage.removeItem("recording_backup_records");

    // Clear comment, buffers & live tracking values
    setRecordingComment("");
    recordsRef.current = [];
    setRecordsCount(0);
    setDurationMs(0);
    integratedImuVelocity.current = 0;
    integratedImuDistance.current = 0;
    integratedImuAltitude.current = 0;
    imuVx.current = 0;
    imuVy.current = 0;
    imuVz.current = 0;
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
      accelIMU: 0,
      heightIMU: 0
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

      // --- CALCULATE INDEPENDENT IMU Integration Speed & Distance (Tilt Corrected & Vibration Resistant) ---
      // --- POINTS 1, 2, 3 SECONDARY SENSORS DEFINITIONS & RAW DATA ---
      let nowMagX = 0;
      let nowMagY = 0;
      let nowMagZ = 0;
      let nowHeading = 0;
      let nowPitch = 0;
      let nowRoll = 0;
      let nowPressure: number | null = null;
      let nowHeightBaro = 0;
      let nowNoiseDb = 35;
      let nowLightLux = 120;
      let nowBatteryLvl = 100;
      let nowBatteryChg = 0;

      const relativeMs = durationMs + dtSeconds * 1000;

      if (settings.simulatedMode) {
        // Point 1: Magnetometer X/Y/Z simulation and Yaw/Pitch/Roll
        nowHeading = Math.round((simAngleRef.current * (180 / Math.PI)) % 360);
        if (nowHeading < 0) nowHeading += 360;
        nowPitch = parseFloat((2.5 * Math.sin(now / 4000)).toFixed(2));
        nowRoll = parseFloat((1.2 * Math.cos(now / 5000)).toFixed(2));

        nowMagX = parseFloat((22.1 + 4.2 * Math.cos(simAngleRef.current)).toFixed(3));
        nowMagY = parseFloat((31.4 - 3.8 * Math.sin(simAngleRef.current)).toFixed(3));
        nowMagZ = parseFloat((-38.5 + 2.0 * Math.sin(now / 15000)).toFixed(3));

        // Point 2: Barometric pressure
        nowPressure = 1013.25 * Math.pow(1 - (alt || 178) / 44330, 5.255);
        nowPressure = parseFloat((nowPressure + 0.15 * Math.sin(now / 8000) + (Math.random() - 0.5) * 0.05).toFixed(2));

        // Point 3: Noise dB, light lux, battery level
        nowNoiseDb = Math.round(38.0 + 1.2 * (speedGps * 3.6) + Math.random() * 3);
        if (nowNoiseDb > 85) nowNoiseDb = 85;

        nowLightLux = Math.round(200 + 40 * Math.sin(now / 45000) + Math.random() * 10);
        
        const hoursRecorded = relativeMs / 3600000;
        nowBatteryLvl = Math.max(1, Math.round(98 - hoursRecorded * 8.0));
        nowBatteryChg = 0;

      } else {
        // Real Sensors Mapping
        nowHeading = parseFloat(deviceOrientation.current.alpha.toFixed(1));
        nowPitch = parseFloat(deviceOrientation.current.beta.toFixed(1));
        nowRoll = parseFloat(deviceOrientation.current.gamma.toFixed(1));

        nowMagX = parseFloat(magnetometerField.current.x.toFixed(3));
        nowMagY = parseFloat(magnetometerField.current.y.toFixed(3));
        nowMagZ = parseFloat(magnetometerField.current.z.toFixed(3));

        nowPressure = devicePressure.current;
        if (nowPressure === null) {
          nowPressure = 1013.25 * Math.pow(1 - (alt || 145) / 44330, 5.255);
        }
        nowPressure = parseFloat(nowPressure.toFixed(2));

        nowNoiseDb = microphoneSoundDb.current;
        nowLightLux = ambientLightLux.current;
        nowBatteryLvl = batteryInfo.current.level;
        nowBatteryChg = batteryInfo.current.charging;
      }

      // Track session-start reference pressure to calculate precise relative barometer elevation starting at exactly 0.0
      if (startBaroPressure.current === null) {
        startBaroPressure.current = nowPressure;
      }
      if (nowPressure && startBaroPressure.current) {
        nowHeightBaro = 44330 * (1 - Math.pow(nowPressure / startBaroPressure.current, 1 / 5.255));
      }

      // 1. Calculate high-frequency mechanical vibration noise level
      const vibX = axRaw - axFiltered;
      const vibY = ayRaw - ayFiltered;
      const vibZ = azRaw - azFiltered;
      const instVibration = Math.sqrt(vibX * vibX + vibY * vibY + vibZ * vibZ);
      
      // Update running smoothed vibration level (low-pass)
      vibrationLevelRef.current = 0.95 * vibrationLevelRef.current + 0.05 * instVibration;

      // 2. Set dynamic noise integration threshold to suppress engine/road vibration creep
      const dynamicThreshold = Math.max(0.28, 1.4 * vibrationLevelRef.current);

      // 3. Mathematical Tilt Correction (Complementary / Orientation-aided Filtering):
      // Rotate accelerometer vectors from smartphone coordinates into horizontal/vertical plane based on gyro & orientation tilt angles
      const pRad = nowPitch * Math.PI / 180;
      const rRad = nowRoll * Math.PI / 180;

      // Gravity-compensated horizontal and vertical accelerations
      const axCorr = axFiltered * Math.cos(pRad) - azFiltered * Math.sin(pRad);
      const ayCorr = ayFiltered * Math.cos(rRad) + azFiltered * Math.sin(rRad);
      const azCorr = axFiltered * Math.sin(pRad) + azFiltered * Math.cos(pRad); // Vertical acceleration in Earth frame

      // Clean horizontal acceleration
      const cpX = Math.abs(axCorr) > dynamicThreshold ? axCorr : 0;
      const cpY = Math.abs(ayCorr) > dynamicThreshold ? ayCorr : 0;
      const cpZ = Math.abs(azCorr) > (dynamicThreshold * 1.5) ? azCorr : 0;

      // 4. Direct integration in the rotated Earth Frame
      imuVx.current += cpX * dtSeconds;
      imuVy.current += cpY * dtSeconds;
      imuVz.current += cpZ * dtSeconds;

      // Use friction damping / leak factor to bleed off sensor drift
      const isMoving = (cpX !== 0 || cpY !== 0 || cpZ !== 0);
      const dampingFactor = isMoving ? 0.985 : 0.82; // bleed much faster when stationary to prevent drift crawl
      imuVx.current *= dampingFactor;
      imuVy.current *= dampingFactor;
      imuVz.current *= dampingFactor;

      // Resulting horizontal velocity from combining components
      let rawSpeedIMU = Math.sqrt(
        imuVx.current * imuVx.current +
        imuVy.current * imuVy.current
      );

      // 5. Zero-Velocity Update (ZUPT)
      let stationaryZupt = false;
      if (!settings.simulatedMode) {
        // If GPS connected and speed is very small/zero
        if (gpsBuffer.current.speed !== null && gpsBuffer.current.speed < 0.25) {
          stationaryZupt = true;
        }
        // If OBD connected and speed is 0
        if (obdConnected === "real" && obdDataRef.current && obdDataRef.current.speed === 0) {
          stationaryZupt = true;
        }
      }

      const activeAccel = isMoving ? Math.sqrt(cpX * cpX + cpY * cpY + cpZ * cpZ) : 0;

      if (stationaryZupt) {
        imuVx.current = 0;
        imuVy.current = 0;
        imuVz.current = 0;
        rawSpeedIMU = 0;
      }

      integratedImuVelocity.current = rawSpeedIMU;

      // Bound max integrated speed to realistic driving speeds (45 m/s = 162 km/h)
      if (integratedImuVelocity.current > 45) {
        integratedImuVelocity.current = 45;
      }

      // distIMU = distIMU + speed * dt
      integratedImuDistance.current += integratedImuVelocity.current * dtSeconds;

      // Calculate relative altitude from phone sensors
      if (settings.simulatedMode) {
        integratedImuAltitude.current += 0.08 * Math.sin(now / 8000) * dtSeconds;
      } else {
        // Integrate the vertical linear velocity component to get relative altitude
        integratedImuAltitude.current += imuVz.current * dtSeconds;
      }

      // ---------------------------------------------
      // COMMIT THE PERIODIC SNAPSHOT TO THE DATABASE RECORDS BUFFER
      // ---------------------------------------------
      const absoluteNow = Date.now();

      // Hourly/minute update check (60-second limit)
      const secondsPassed = Math.floor(relativeMs / 1000);
      const prevSecondsPassed = Math.floor(durationMs / 1000);
      const isNewMinute = Math.floor(secondsPassed / 60) > Math.floor(prevSecondsPassed / 60) || recordsRef.current.length === 0;

      if (isNewMinute) {
        if (!settings.simulatedMode && gpsBuffer.current.lat !== null && gpsBuffer.current.lon !== null) {
          fetchLocalWeather(gpsBuffer.current.lat, gpsBuffer.current.lon);
        } else if (settings.simulatedMode) {
          const tempVal = parseFloat((21.8 + Math.sin(now / 30000) * 1.5 + (Math.random() - 0.5) * 0.4).toFixed(1));
          const pressureVal = parseFloat(((1011.0 + Math.cos(now / 50000) * 6 + (Math.random() - 0.5) * 0.5) / 10).toFixed(2)); // convert hPa to kPa
          const humidityVal = parseFloat((59 + Math.sin(now / 40000) * 10 + (Math.random() - 0.5) * 2).toFixed(1));
          const windSpeedVal = parseFloat((2.8 + Math.sin(now / 25000) * 1.4 + (Math.random() - 0.5) * 0.5).toFixed(1));
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
      } else if (acousticRpmEnabled) {
        activeObdConnected = true;
        obdRPM = acousticRpmRef.current !== null ? Math.round(acousticRpmRef.current) : null;
        const spdKmh = speedGps * 3.6;
        if (spdKmh < 1.5) {
          obdGearVal = "N";
        } else if (obdRPM && obdRPM > 0) {
          const ratio = spdKmh / obdRPM;
          if (ratio < 0.012) obdGearVal = "1";
          else if (ratio < 0.024) obdGearVal = "2";
          else if (ratio < 0.038) obdGearVal = "3";
          else if (ratio < 0.052) obdGearVal = "4";
          else if (ratio < 0.075) obdGearVal = "5";
          else obdGearVal = "6";
        } else {
          obdGearVal = "—";
        }

        obdDataRef.current.rpm = obdRPM;
        obdDataRef.current.gear = obdGearVal;
        
        // Push state update so it shows in real time
        setTimeout(() => {
          setObdData((prev) => ({
            ...prev,
            rpm: obdRPM,
            gear: obdGearVal
          }));
        }, 0);
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

      const rawAccelMag = Math.sqrt(axRaw * axRaw + ayRaw * ayRaw + azRaw * azRaw);

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
        accelRawMag: rawAccelMag,
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
        calcHeightIMU: integratedImuAltitude.current,
        // Points 1, 2, 3 Extra Telemetry Sensors mapping
        magX: nowMagX,
        magY: nowMagY,
        magZ: nowMagZ,
        heading: nowHeading,
        pitch: nowPitch,
        roll: nowRoll,
        baroPressure: nowPressure,
        calcHeightBaro: nowHeightBaro,
        noiseLevelDb: nowNoiseDb,
        lightLux: nowLightLux,
        batteryLevel: nowBatteryLvl,
        batteryCharging: nowBatteryChg,
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

      // Periodic backup saving to localStorage to prevent any accidental session/crash data loss
      if (recordsRef.current.length % 3 === 0) {
        try {
          const timestampStr = new Date().toLocaleString("uk-UA");
          localStorage.setItem("recording_backup_info", JSON.stringify({
            sessionComment: commentRef.current || "",
            durationMs: relativeMs,
            date: timestampStr
          }));
          localStorage.setItem("recording_backup_records", JSON.stringify(recordsRef.current));
        } catch (err) {
          console.error("Помилка запису резервної копії:", err);
        }
      }

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
          accelRawMag: rawAccelMag,
          gyroX: snapshot.gyroX,
          gyroY: snapshot.gyroY,
          gyroZ: snapshot.gyroZ,
          speedIMU: snapshot.calcSpeedIMU,
          distIMU: snapshot.calcDistIMU,
          accelIMU: snapshot.calcAccelIMU,
          heightIMU: snapshot.calcHeightIMU
        });
        setCurrentExtraSensors({
          magX: snapshot.magX ?? 0,
          magY: snapshot.magY ?? 0,
          magZ: snapshot.magZ ?? 0,
          heading: snapshot.heading ?? 0,
          pitch: snapshot.pitch ?? 0,
          roll: snapshot.roll ?? 0,
          baroPressure: snapshot.baroPressure ?? 1013.25,
          calcHeightBaro: snapshot.calcHeightBaro ?? 0,
          noiseLevelDb: snapshot.noiseLevelDb ?? 35,
          lightLux: snapshot.lightLux ?? 50,
          batteryLevel: snapshot.batteryLevel ?? 100,
          batteryCharging: snapshot.batteryCharging ?? 0
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







  const handleClearLive = () => {
    // Clear backups on user request
    localStorage.removeItem("recording_state_ongoing");
    localStorage.removeItem("recording_backup_info");
    localStorage.removeItem("recording_backup_records");

    recordsRef.current = [];
    setRecordsCount(0);
    setDurationMs(0);
    integratedImuVelocity.current = 0;
    integratedImuDistance.current = 0;
    integratedImuAltitude.current = 0;
    imuVx.current = 0;
    imuVy.current = 0;
    imuVz.current = 0;
    setCurrentGPS({ lat: null, lon: null, alt: null, speed: 0, distance: 0, accel: 0 });
    setCurrentIMU({
      accelX: 0, accelY: 0, accelZ: 0, accelRawMag: 0,
      gyroX: 0, gyroY: 0, gyroZ: 0, speedIMU: 0, distIMU: 0, accelIMU: 0, heightIMU: 0
    });
  };

  const handlePauseRecording = () => {
    setRecordingState("paused");
    releaseWakeLock();
  };

  const handleResumeRecording = () => {
    setRecordingState("recording");
    requestWakeLock();
  };

  const handleResetRecording = () => {
    setRecordingState("idle");
    handleClearLive();
  };

  const handleSaveAndResetRecording = () => {
    handleStopAndSave();
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
                <span className="text-[10px] bg-indigo-900/30 text-indigo-300 font-mono font-bold py-0.5 px-2 rounded-full border border-indigo-500/20">
                  v1.0.0
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
              <span className="text-emerald-400 font-bold">
                Реальні сенсори
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
            acousticRpmEnabled={acousticRpmEnabled}
            acousticRpm={acousticRpm}
            acousticFreq={acousticFreq}
            acousticNoisy={acousticNoisy}
            acousticCylinders={acousticCylinders}
            setAcousticCylinders={setAcousticCylinders}
            handleStartAcousticRpm={handleStartAcousticRpm}
            handleStopAcousticRpm={handleStopAcousticRpm}
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
