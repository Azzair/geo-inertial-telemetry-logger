import React, { useState, useRef, useEffect } from "react";

export interface ObdData {
  rpm: number | null;
  speed: number | null; // km/h
  gear: string | null;
  fuelFlow: number | null; // L/h
  fuelEconomy: number | null; // km/L
  coolantTemp: number | null;
  oilTemp: number | null;
  totalFuelUsed: number;
  electricPower: number | null; // Watts
  energyConsumption: number | null; // Wh/km
  batterySOC: number | null; // %
  recuperation: number | null; // Watts
}

export interface ObdHook {
  obdConnected: "disconnected" | "connecting" | "real" | "simulated";
  obdData: ObdData;
  setObdData: React.Dispatch<React.SetStateAction<ObdData>>;
  handleConnectOBDReal: (preSelectedDevice?: any) => Promise<void>;
  handleConnectOBDSimulated: () => void;
  handleDisconnectOBD: () => void;
  obdDataRef: React.MutableRefObject<{
    rpm: number | null;
    speed: number | null;
    gear: string | null;
    fuelFlow: number | null;
    fuelEconomy: number | null;
    coolantTemp: number | null;
    oilTemp: number | null;
    totalFuelUsed: number;
    electricPower: number | null;
    energyConsumption: number | null;
    batterySOC: number | null;
    recuperation: number | null;
    connectedState: "disconnected" | "connecting" | "real" | "simulated";
  }>;
  authorizedDevices: any[];
  fetchAuthorizedDevices: () => Promise<void>;
}

export function useObd(
  setRecordingComment: React.Dispatch<React.SetStateAction<string>>,
  setRecoveryNotice?: React.Dispatch<React.SetStateAction<string | null>>
): ObdHook {
  const [obdConnected, setObdConnected] = useState<"disconnected" | "connecting" | "real" | "simulated">("disconnected");
  const [authorizedDevices, setAuthorizedDevices] = useState<any[]>([]);
  const [obdData, setObdData] = useState<ObdData>({
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

  const parseOBDResponse = (text: string) => {
    const clean = text.replace(/[\r\n\t >]/g, "").toUpperCase();
    console.log("OBD Parse: matching", clean);

    // VIN 0902 parsing first
    if (clean.includes("4902")) {
      const idx = clean.indexOf("4902");
      const remainingHex = clean.slice(idx + 4);
      let vinStr = "";
      for (let i = 0; i < remainingHex.length - 1; i += 2) {
        const hexPair = remainingHex.slice(i, i + 2);
        const code = parseInt(hexPair, 16);
        if (code >= 32 && code <= 126) {
          const char = String.fromCharCode(code);
          if (/^[A-HJ-NPR-Z0-9]$/i.test(char)) {
            vinStr += char;
          }
        }
      }

      if (vinStr.length >= 5) {
        const match = vinStr.match(/[A-Z0-9]{5,17}/i);
        if (match) {
          const detectedVin = match[0].toUpperCase();
          console.log("Detected VIN:", detectedVin);
          setRecordingComment((prev) => {
            if (prev.includes(detectedVin)) return prev;
            return prev ? `${prev} | VIN: ${detectedVin}` : `VIN: ${detectedVin}`;
          });
        }
      }
    }

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

  const handleDisconnectOBD = () => {
    try {
      if (activeBtDeviceRef.current) {
        const dev = activeBtDeviceRef.current;
        if (dev._obdInterval) {
          clearInterval(dev._obdInterval);
        }
        if (dev._rxChar) {
          try {
            dev._rxChar.removeEventListener("characteristicvaluechanged");
          } catch (evErr) {}
        }
        if (dev._gattServer && dev._gattServer.connected) {
          dev._gattServer.disconnect();
        }
        activeBtDeviceRef.current = null;
      }
    } catch (e) {
      console.warn("Disconnection warning:", e);
    }

    setObdConnected("disconnected");
    obdDataRef.current.connectedState = "disconnected";
    localStorage.removeItem("obd_connection_ongoing");
    
    setObdData({
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
  };

  const fetchAuthorizedDevices = async () => {
    if ("bluetooth" in navigator && (navigator as any).bluetooth.getDevices) {
      try {
        const devs = await (navigator as any).bluetooth.getDevices();
        setAuthorizedDevices(devs || []);
      } catch (err) {
        console.warn("Could not retrieve authorized Bluetooth devices:", err);
      }
    }
  };

  const handleConnectOBDReal = async (preSelectedDevice?: any) => {
    if (!("bluetooth" in navigator)) {
      alert("⚠️ Ваш веб-браузер або пристрій не підтримує Web Bluetooth API. На iOS Safari та багатьох браузерах Web Bluetooth заблоковано Apple. Будь ласка, запустіть Емуляцію OBD-II датчиків для повноцінного тестування!");
      return;
    }

    try {
      setObdConnected("connecting");
      obdDataRef.current.connectedState = "connecting";

      let device = preSelectedDevice;
      if (!device) {
        device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART service
            "0000fff0-0000-1000-8000-00805f9b34fb"  // General Serial Pass-through service
          ]
        });
      }

      console.log("BLE device selected:", device.name || "Unknown device");
      
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
      await writeCommand("0902"); // Зчитування VIN автомобіля при підключенні

      setObdConnected("real");
      obdDataRef.current.connectedState = "real";
      localStorage.setItem("obd_connection_ongoing", "real");

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
    localStorage.setItem("obd_connection_ongoing", "simulated");

    // Set simulated VIN in comment as the very first action
    const simVin = "VIN1YVDS18D47SIMULATED";
    setRecordingComment((prev) => {
      if (prev.includes("VIN")) return prev;
      return prev ? `${prev} | VIN: ${simVin}` : `VIN: ${simVin}`;
    });
    
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

  const autoReconnectOBD = async () => {
    const savedObd = localStorage.getItem("obd_connection_ongoing");
    if (savedObd === "simulated") {
      console.log("Auto-connecting to simulated OBD...");
      handleConnectOBDSimulated();
    } else if (savedObd === "real") {
      console.log("Checking previously paired Bluetooth OBD devices...");
      if ("bluetooth" in navigator && (navigator as any).bluetooth.getDevices) {
        try {
          const devices = await (navigator as any).bluetooth.getDevices();
          if (devices && devices.length > 0) {
            const device = devices[0];
            console.log("Attempting auto-reconnect to paired device:", device.name);
            setObdConnected("connecting");
            obdDataRef.current.connectedState = "connecting";
            
            const server = await device.gatt.connect();
            console.log("GATT Connected successfully via auto-reconnect");
            
            let txCharacteristic: any = null;
            let rxCharacteristic: any = null;
            
            const services = await server.getPrimaryServices();
            for (const s of services) {
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
              } catch (errChars) {}
              if (txCharacteristic && rxCharacteristic) break;
            }
            
            if (!txCharacteristic || !rxCharacteristic) {
              const service = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
              txCharacteristic = await service.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
              rxCharacteristic = await service.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
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
            await writeCommand("0902"); // Read VIN first thing
            
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
                clearInterval(queryInterval);
                handleDisconnectOBD();
                return;
              }
              try {
                await writeCommand(queries[activeIndex]);
                activeIndex = (activeIndex + 1) % queries.length;
              } catch (errWrite) {}
            }, 350);
            
            (device as any)._obdInterval = queryInterval;
            (device as any)._gattServer = server;
            (device as any)._rxChar = rxCharacteristic;
            activeBtDeviceRef.current = device;
            
            if (setRecoveryNotice) {
              setRecoveryNotice((prev) => 
                prev 
                  ? `${prev} (OBD-II Bluetooth успішно підключено повторно, розпочато зчитування VIN)`
                  : "⚡ Зв'язок з апаратним OBD-II модулем відновлено та зчитано VIN!"
              );
            }
          }
        } catch (e) {
          console.warn("Could not auto-reconnect OBD over BLE:", e);
          setObdConnected("disconnected");
          obdDataRef.current.connectedState = "disconnected";
        }
      }
    }
  };

  useEffect(() => {
    // Auto-reconnect on mount and search for permitted BT devices
    fetchAuthorizedDevices();

    const timer = setTimeout(() => {
      autoReconnectOBD();
    }, 1200);

    return () => {
      clearTimeout(timer);
      if (activeBtDeviceRef.current) {
        const dev = activeBtDeviceRef.current;
        if (dev._obdInterval) {
          clearInterval(dev._obdInterval);
        }
        if (dev._gattServer && dev._gattServer.connected) {
          dev._gattServer.disconnect();
        }
      }
    };
  }, []);

  return {
    obdConnected,
    obdData,
    setObdData,
    handleConnectOBDReal,
    handleConnectOBDSimulated,
    handleDisconnectOBD,
    obdDataRef,
    authorizedDevices,
    fetchAuthorizedDevices
  };
}
