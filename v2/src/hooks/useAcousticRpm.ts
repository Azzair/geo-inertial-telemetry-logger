import React, { useState, useRef, useEffect } from "react";

export interface AcousticRpmHook {
  acousticRpmEnabled: boolean;
  acousticRpm: number | null;
  acousticFreq: number | null;
  acousticNoisy: boolean;
  acousticCylinders: number;
  setAcousticCylinders: (val: number) => void;
  handleStartAcousticRpm: (cyls: number) => void;
  handleStopAcousticRpm: () => void;
  acousticRpmRef: React.MutableRefObject<number | null>;
  acousticCylindersRef: React.MutableRefObject<number>;
}

export function useAcousticRpm(): AcousticRpmHook {
  const [acousticRpmEnabled, setAcousticRpmEnabled] = useState<boolean>(false);
  const [acousticRpm, setAcousticRpm] = useState<number | null>(null);
  const [acousticFreq, setAcousticFreq] = useState<number | null>(null);
  const [acousticNoisy, setAcousticNoisy] = useState<boolean>(false);
  const [acousticCylinders, setAcousticCylinders] = useState<number>(4);

  const acousticRpmRef = useRef<number | null>(null);
  const acousticCylindersRef = useRef<number>(4);
  const acousticAudioContextRef = useRef<AudioContext | null>(null);
  const acousticAudioStreamRef = useRef<MediaStream | null>(null);
  const acousticAudioAnalyserRef = useRef<AnalyserNode | null>(null);
  const acousticAudioIntervalRef = useRef<any>(null);

  const handleStopAcousticRpm = () => {
    if (acousticAudioIntervalRef.current) {
      clearInterval(acousticAudioIntervalRef.current);
      acousticAudioIntervalRef.current = null;
    }
    if (acousticAudioStreamRef.current) {
      acousticAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      acousticAudioStreamRef.current = null;
    }
    if (acousticAudioContextRef.current) {
      if (acousticAudioContextRef.current.state !== "closed") {
        acousticAudioContextRef.current.close().catch(() => {});
      }
      acousticAudioContextRef.current = null;
    }
    acousticAudioAnalyserRef.current = null;
    setAcousticRpmEnabled(false);
    setAcousticRpm(null);
    setAcousticFreq(null);
    acousticRpmRef.current = null;
  };

  const handleStartAcousticRpm = async (cyls: number) => {
    try {
      // Clean up previous runs
      if (acousticAudioIntervalRef.current) {
        clearInterval(acousticAudioIntervalRef.current);
        acousticAudioIntervalRef.current = null;
      }
      if (acousticAudioStreamRef.current) {
        acousticAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        acousticAudioStreamRef.current = null;
      }
      if (acousticAudioContextRef.current) {
        if (acousticAudioContextRef.current.state !== "closed") {
          await acousticAudioContextRef.current.close().catch(() => {});
        }
        acousticAudioContextRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      acousticAudioStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      acousticAudioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.45;
      acousticAudioAnalyserRef.current = analyser;

      source.connect(analyser);

      setAcousticRpmEnabled(true);
      acousticCylindersRef.current = cyls;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);

      acousticAudioIntervalRef.current = setInterval(() => {
        if (!acousticAudioAnalyserRef.current || !acousticAudioContextRef.current) return;
        analyser.getFloatFrequencyData(dataArray);

        const sampleRate = ctx.sampleRate;
        const binHz = sampleRate / analyser.fftSize;

        // Custom search ranges for car engine sounds supporting up to 22000 RPM
        const minFreq = 10;
        const maxFreq = Math.max(250, Math.round((22000 * acousticCylindersRef.current) / 120) + 100);

        let maxVal = -Infinity;
        let maxIdx = -1;

        for (let i = 0; i < bufferLength; i++) {
          const f = i * binHz;
          if (f >= minFreq && f <= maxFreq) {
            if (dataArray[i] > maxVal) {
              maxVal = dataArray[i];
              maxIdx = i;
            }
          }
        }

        const noiseFloor = -85;

        if (maxIdx !== -1 && maxVal > noiseFloor) {
          // Parabolic interpolation around the peak bin
          const y1 = maxIdx > 0 ? dataArray[maxIdx - 1] : dataArray[maxIdx];
          const y2 = dataArray[maxIdx];
          const y3 = maxIdx < bufferLength - 1 ? dataArray[maxIdx + 1] : dataArray[maxIdx];

          const denom = y1 - 2 * y2 + y3;
          let offset = 0;
          if (Math.abs(denom) > 1e-5) {
            offset = 0.5 * (y1 - y3) / denom;
          }

          const preciseIdx = maxIdx + offset;
          const preciseFreq = preciseIdx * binHz;

          // Harmonic calculation for RPM: RPM = Freq * 120 / Cylinders
          const rawRpm = (preciseFreq * 120) / acousticCylindersRef.current;

          const smoothAlpha = 0.15;
          const lastVal = acousticRpmRef.current !== null ? acousticRpmRef.current : rawRpm;
          const smoothedRpm = smoothAlpha * rawRpm + (1 - smoothAlpha) * lastVal;

          const finalRpm = Math.max(500, Math.min(22000, smoothedRpm));

          acousticRpmRef.current = finalRpm;
          setAcousticRpm(Math.round(finalRpm));
          setAcousticFreq(parseFloat(preciseFreq.toFixed(1)));
          setAcousticNoisy(false);
        } else {
          setAcousticNoisy(true);
          if (acousticRpmRef.current !== null) {
            const decayed = acousticRpmRef.current * 0.85;
            if (decayed < 450) {
              acousticRpmRef.current = null;
              setAcousticRpm(null);
              setAcousticFreq(null);
            } else {
              acousticRpmRef.current = decayed;
              setAcousticRpm(Math.round(decayed));
            }
          }
        }
      }, 100);

    } catch (err: any) {
      console.error("Acoustic Audio Mic Setup failed:", err);
      alert(`Не вдалося увімкнути аналізатор звуку: ${err.message || err}`);
      setAcousticRpmEnabled(false);
    }
  };

  useEffect(() => {
    return () => {
      if (acousticAudioIntervalRef.current) {
        clearInterval(acousticAudioIntervalRef.current);
      }
      if (acousticAudioStreamRef.current) {
        acousticAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
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
  };
}
