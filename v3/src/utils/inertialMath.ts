/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates high-frequency mechanical vibration noise magnitude
 */
export function calculateVibrationNoise(
  raw: { ax: number; ay: number; az: number },
  filtered: { ax: number; ay: number; az: number }
): number {
  const vibX = raw.ax - filtered.ax;
  const vibY = raw.ay - filtered.ay;
  const vibZ = raw.az - filtered.az;
  return Math.sqrt(vibX * vibX + vibY * vibY + vibZ * vibZ);
}

/**
 * Mathematical Tilt Correction (Complementary / Orientation-aided Filtering):
 * Rotates accelerometer vectors from smartphone coordinates into stable horizontal/vertical frames
 * based on angular pitch & roll orientations in degrees.
 */
export function rotateAccelerometerToEarthFrame(
  filtered: { ax: number; ay: number; az: number },
  pitchDeg: number,
  rollDeg: number
): { axCorr: number; ayCorr: number; azCorr: number } {
  const pRad = (pitchDeg * Math.PI) / 180;
  const rRad = (rollDeg * Math.PI) / 180;

  // Gravity-compensated horizontal and vertical accelerations
  const axCorr = filtered.ax * Math.cos(pRad) - filtered.az * Math.sin(pRad);
  const ayCorr = filtered.ay * Math.cos(rRad) + filtered.az * Math.sin(rRad);
  const azCorr = filtered.ax * Math.sin(pRad) + filtered.az * Math.cos(pRad); // Vertical component

  return { axCorr, ayCorr, azCorr };
}

/**
 * Integrates linear acceleration to velocity components with leakage damping
 * to limit accumulation drift errors.
 */
export function integrateInertialVelocityStep(
  currentVelX: number,
  currentVelY: number,
  currentVelZ: number,
  accCorr: { axCorr: number; ayCorr: number; azCorr: number },
  dtSeconds: number,
  vibrationLevel: number,
  stationaryZupt: boolean
): { vx: number; vy: number; vz: number; speed: number; activeAccel: number } {
  // Set dynamic noise integration threshold based on ongoing mechanical vibration factors
  // Use a highly responsive threshold (down to 0.02) to capture subtle but real vehicle acceleration
  const dynamicThreshold = Math.max(0.02, 1.1 * vibrationLevel);

  const isMovingX = Math.abs(accCorr.axCorr) > dynamicThreshold;
  const isMovingY = Math.abs(accCorr.ayCorr) > dynamicThreshold;
  const isMovingZ = Math.abs(accCorr.azCorr) > (dynamicThreshold * 1.3);

  const cpX = isMovingX ? accCorr.axCorr : 0;
  const cpY = isMovingY ? accCorr.ayCorr : 0;
  const cpZ = isMovingZ ? accCorr.azCorr : 0;

  // Stationary Zero-Velocity Update (ZUPT)
  if (stationaryZupt) {
    return { vx: 0, vy: 0, vz: 0, speed: 0, activeAccel: 0 };
  }

  // Linear integration
  let vx = currentVelX + cpX * dtSeconds;
  let vy = currentVelY + cpY * dtSeconds;
  let vz = currentVelZ + cpZ * dtSeconds;

  // Damping leak to bleed integration drift when motion stops
  // 0.999 keeps the velocity integrated smoothly, 0.95 acts as rapid mitigation if no motion is sensed
  const isAnyMoving = isMovingX || isMovingY || isMovingZ;
  const dampingFactor = isAnyMoving ? 0.999 : 0.95;

  vx *= dampingFactor;
  vy *= dampingFactor;
  vz *= dampingFactor;

  let speedResult = Math.sqrt(vx * vx + vy * vy);
  
  // Bound max integrated speed to realistic limits (45 m/s = 162 km/h)
  if (speedResult > 45) {
    speedResult = 45;
  }

  const activeAccel = isAnyMoving ? Math.sqrt(cpX * cpX + cpY * cpY + cpZ * cpZ) : 0;

  return { vx, vy, vz, speed: speedResult, activeAccel };
}
