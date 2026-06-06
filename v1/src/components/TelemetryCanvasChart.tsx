/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { TelemetryRecord } from "../types";

interface TelemetryCanvasChartProps {
  records: TelemetryRecord[];
  maxPoints?: number;
  selectedFields: {
    label: string;
    key: keyof TelemetryRecord;
    color: string;
    scale?: number;
  }[];
  title: string;
  unit?: string;
  height?: number;
}

export default function TelemetryCanvasChart({
  records,
  maxPoints = 80,
  selectedFields,
  title,
  unit = "",
  height = 140,
}: TelemetryCanvasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const heightLocal = rect.height;

    // Clear canvas with deep slate styling
    ctx.fillStyle = "#0c111d"; // Slate-950 dark
    ctx.fillRect(0, 0, width, heightLocal);

    // Draw background grid lines
    ctx.strokeStyle = "rgba(55, 65, 81, 0.3)"; // Gray-700
    ctx.lineWidth = 1;
    const gridCols = 8;
    const gridRows = 4;

    for (let i = 1; i < gridCols; i++) {
      const x = (width * i) / gridCols;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightLocal);
      ctx.stroke();
    }

    for (let i = 1; i < gridRows; i++) {
      const y = (heightLocal * i) / gridRows;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Capture recent data points
    const dataSlice = records.slice(-maxPoints);
    if (dataSlice.length < 2) {
      // Draw Empty placeholder text
      ctx.fillStyle = "#4b5563"; // Gray-600
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("Немає даних для графіка", width / 2, heightLocal / 2);
      return;
    }

    // Determine absolute boundaries among selected fields for scaling
    let minY = Infinity;
    let maxY = -Infinity;

    dataSlice.forEach((rec) => {
      selectedFields.forEach((field) => {
        let val = rec[field.key];
        if (typeof val === "number") {
          const scaledVal = val * (field.scale || 1);
          if (scaledVal < minY) minY = scaledVal;
          if (scaledVal > maxY) maxY = scaledVal;
        }
      });
    });

    // Handle flat lines elegantly
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    } else {
      // Add padding to range
      const diff = maxY - minY;
      minY -= diff * 0.15;
      maxY += diff * 0.15;
    }

    // Render data series lines
    selectedFields.forEach((field) => {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = field.color;
      ctx.lineJoin = "round";

      dataSlice.forEach((rec, idx) => {
        const val = rec[field.key] as number | null;
        if (val === null || isNaN(val)) return;

        const scaledVal = val * (field.scale || 1);
        const x = (width * idx) / (maxPoints - 1);
        // Correctly map value inverting the standard Y coordinate
        const y = heightLocal - ((scaledVal - minY) / (maxY - minY)) * heightLocal;

        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Add a subtle glow/underfill if there is only one field
      if (selectedFields.length === 1) {
        ctx.lineTo((width * (dataSlice.length - 1)) / (maxPoints - 1), heightLocal);
        ctx.lineTo(0, heightLocal);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, heightLocal);
        gradient.addColorStop(0, `${field.color}33`); // 20% opacity
        gradient.addColorStop(1, `${field.color}00`); // Transparent
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    });

    // Draw min / max numeric label indicators
    ctx.fillStyle = "#9ca3af"; // Gray-400
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${maxY.toFixed(2)}${unit}`, width - 6, 12);
    ctx.fillText(`${minY.toFixed(2)}${unit}`, width - 6, heightLocal - 6);

    // Current newest value tracking
    const lastRecord = dataSlice[dataSlice.length - 1];
    let legendText = "";
    selectedFields.forEach((field, i) => {
      const val = lastRecord[field.key] as number | null;
      const displayVal = val !== null ? (val * (field.scale || 1)).toFixed(2) : "N/A";
      legendText += `${field.label}: ${displayVal}${unit}  `;
    });

    ctx.fillStyle = "#e5e7eb"; // Gray-200
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(legendText, 10, 16);

  }, [records, maxPoints, selectedFields, height, unit]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-3 shadow-md">
      <div className="flex justify-between items-center mb-1.5 px-1">
        <h3 className="text-xs font-mono tracking-wider text-slate-400 uppercase">
          {title}
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">
          {records.length} точок
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: `${height}px` }}
        className="block"
      />
    </div>
  );
}
