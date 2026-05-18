"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bluetooth, X, Zap, Wifi } from "lucide-react"

// BLE Constants
const SVC = "4d6f7469-6f6e-4951-5631-000000000001"
const NTFY = "4d6f7469-6f6e-4951-5631-000000000002"
const CFG = "4d6f7469-6f6e-4951-5631-000000000003"
const WAVE = "4d6f7469-6f6e-4951-5631-000000000004"

const CMD = {
  SET_PERIOD: 0x01,
  SET_ODR: 0x02,
  SET_FS: 0x03,
  SET_FIFO_WM: 0x04,
  SET_OFFSET: 0x05,
  WAVE_START: 0x06,
  WAVE_STOP: 0x07,
  CALIBRATE: 0x08,
  REBOOT: 0x09,
  SET_LPF2: 0x0a,
  SET_HPF: 0x0b,
  SET_TMAG_AVG: 0x0c,
  SET_TMAG_RNG: 0x0d,
  SET_TMAG_CH: 0x0e,
}

const FS_NAMES = ["±2g", "±4g", "±8g", "±16g"]
const FS_SCALE = [19.62, 39.24, 78.48, 156.96]

interface ConnectedDevice {
  id: string
  name: string
  device: BluetoothDevice
  server: BluetoothRemoteGATTServer | null
  notifyChar: BluetoothRemoteGATTCharacteristic | null
  cfgChar: BluetoothRemoteGATTCharacteristic | null
  waveChar: BluetoothRemoteGATTCharacteristic | null
  rssi: number
  batMv: number
  batPct: number
  rmsX: number
  rmsY: number
  rmsZ: number
  peakX: number
  peakY: number
  peakZ: number
}

interface AvailableDevice {
  id: string
  name: string
  device: BluetoothDevice
}

export default function MotionIQPage() {
  const router = useRouter()

  // Multi-device state
  const [connectedDevices, setConnectedDevices] = useState<Map<string, ConnectedDevice>>(new Map())
  const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>([])
  const [scanning, setScanning] = useState(false)
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([])

  const connectDeviceTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  const notifyListenersRef = useRef<Record<string, (e: Event) => void>>({})

  const log = useCallback((msg: string) => {
    const t = new Date().toISOString().substr(11, 8)
    setLogs(prev => [...prev.slice(-50), { time: t, msg }])
  }, [])

  // Scan for available devices
  const handleScan = async () => {
    try {
      setScanning(true)
      log("Scanning for MotionIQ devices...")

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "MotionIQ" }],
        optionalServices: [SVC]
      })

      if (device) {
        setAvailableDevices(prev => {
          const exists = prev.find(d => d.id === device.id)
          if (exists) return prev
          return [...prev, { id: device.id, name: device.name || "Unknown", device }]
        })
        log(`Found: ${device.name || "Unknown"}`)
      }
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        log(`Scan error: ${err.message}`)
      }
    } finally {
      setScanning(false)
    }
  }

  // Connect to a specific device
  const handleConnect = async (availDevice: AvailableDevice) => {
    try {
      log(`Connecting to ${availDevice.name}...`)

      const server = await availDevice.device.gatt?.connect()
      if (!server) {
        log("Failed to connect to GATT server")
        return
      }

      const service = await server.getPrimaryService(SVC)
      const notifyChar = await service.getCharacteristic(NTFY)
      const cfgChar = await service.getCharacteristic(CFG)
      const waveChar = await service.getCharacteristic(WAVE)

      // Set up notification listener
      const listener = (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic
        const dv = new DataView(char.value!.buffer)
        
        // Parse sensor data (simplified)
        const rssi = dv.getInt8(0)
        const batPct = dv.getUint8(1)
        const batMv = dv.getUint16(2, true)
        const rmsX = dv.getFloat32(4, true)
        const rmsY = dv.getFloat32(8, true)
        const rmsZ = dv.getFloat32(12, true)

        setConnectedDevices(prev => {
          const updated = new Map(prev)
          const device = updated.get(availDevice.id)
          if (device) {
            updated.set(availDevice.id, {
              ...device,
              rssi,
              batPct,
              batMv,
              rmsX,
              rmsY,
              rmsZ,
              peakX: Math.max(device.peakX, rmsX),
              peakY: Math.max(device.peakY, rmsY),
              peakZ: Math.max(device.peakZ, rmsZ),
            })
          }
          return updated
        })
      }

      notifyListenersRef.current[availDevice.id] = listener
      await notifyChar.startNotifications()
      notifyChar.addEventListener("characteristicvaluechanged", listener)

      // Add to connected devices
      const connDevice: ConnectedDevice = {
        id: availDevice.id,
        name: availDevice.name,
        device: availDevice.device,
        server,
        notifyChar,
        cfgChar,
        waveChar,
        rssi: 0,
        batMv: 0,
        batPct: 0,
        rmsX: 0,
        rmsY: 0,
        rmsZ: 0,
        peakX: 0,
        peakY: 0,
        peakZ: 0,
      }

      setConnectedDevices(prev => new Map(prev).set(availDevice.id, connDevice))
      setAvailableDevices(prev => prev.filter(d => d.id !== availDevice.id))
      log(`Connected: ${availDevice.name}`)
    } catch (err: any) {
      log(`Connection failed: ${err.message}`)
    }
  }

  // Disconnect a device
  const handleDisconnect = async (deviceId: string) => {
    try {
      const device = connectedDevices.get(deviceId)
      if (!device) return

      // Stop notifications
      if (device.notifyChar) {
        const listener = notifyListenersRef.current[deviceId]
        if (listener) {
          device.notifyChar.removeEventListener("characteristicvaluechanged", listener)
          delete notifyListenersRef.current[deviceId]
        }
        await device.notifyChar.stopNotifications()
      }

      // Disconnect GATT
      if (device.server) {
        device.server.disconnect()
      }

      // Move back to available
      setAvailableDevices(prev => [...prev, {
        id: device.id,
        name: device.name,
        device: device.device
      }])

      setConnectedDevices(prev => {
        const updated = new Map(prev)
        updated.delete(deviceId)
        return updated
      })

      log(`Disconnected: ${device.name}`)
    } catch (err: any) {
      log(`Disconnect error: ${err.message}`)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-7 rounded-sm px-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kiln OS
          </Button>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-12 items-center justify-center rounded-sm border border-[var(--factory-cyan)]/40 bg-[var(--factory-panel)] font-mono text-[10px] font-bold text-[var(--factory-cyan)]">
              BLE
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground">MotionIQ</span>
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Multi-Device</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
            {connectedDevices.size} Connected
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left sidebar — device list */}
        <div className="w-64 bg-card border-r border-border flex flex-col overflow-hidden">
          {/* Available devices */}
          <div className="flex-1 overflow-y-auto border-b border-border">
            <div className="p-3 border-b border-border">
              <div className="text-[9px] text-muted-foreground px-3 py-1 font-mono tracking-widest">AVAILABLE</div>
              <Button
                onClick={handleScan}
                disabled={scanning}
                size="sm"
                className="w-full mt-2 h-7 rounded-sm bg-[var(--factory-cyan)]/10 border border-[var(--factory-cyan)]/40 text-[var(--factory-cyan)] text-[9px] tracking-widest uppercase hover:bg-[var(--factory-cyan)]/20 font-semibold"
              >
                <Bluetooth className="h-3 w-3 mr-1" />
                {scanning ? "Scanning..." : "Scan"}
              </Button>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {availableDevices.map(dev => (
                <li key={dev.id} className="p-3 flex flex-col gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">{dev.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground truncate">{dev.id.slice(0, 12)}...</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleConnect(dev)}
                    className="h-6 w-full rounded-sm bg-[var(--factory-green)]/10 border border-[var(--factory-green)]/40 text-[var(--factory-green)] text-[9px] tracking-widest uppercase hover:bg-[var(--factory-green)]/20 font-semibold"
                  >
                    Connect
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* Connected devices */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 border-b border-border sticky top-0 bg-card">
              <div className="text-[9px] text-muted-foreground px-3 py-1 font-mono tracking-widest">CONNECTED</div>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {Array.from(connectedDevices.values()).map(dev => (
                <li key={dev.id} className="p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{dev.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <Wifi className="h-2.5 w-2.5 text-[var(--factory-cyan)]" />
                        <span className="text-[9px] font-mono text-muted-foreground">{dev.rssi} dBm</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Zap className="h-2.5 w-2.5 text-[var(--factory-amber)]" />
                        <span className="text-[9px] font-mono text-muted-foreground">{dev.batPct}%</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-[var(--factory-orange)]/10 shrink-0"
                      onClick={() => handleDisconnect(dev.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right panel — telemetry grid */}
        <div className="flex-1 overflow-auto">
          {connectedDevices.size === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-center">
                <Bluetooth className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <span className="text-sm text-muted-foreground">No devices connected</span>
                  <p className="text-xs text-muted-foreground mt-1">Scan and connect devices from the left panel</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 p-4">
              {Array.from(connectedDevices.values()).map(dev => (
                <div key={dev.id} className="rounded-sm border border-border bg-[var(--factory-panel)] flex flex-col overflow-hidden">
                  {/* Device header */}
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-foreground">{dev.name}</span>
                      <div className="flex items-center gap-1">
                        <Wifi className="h-3 w-3 text-[var(--factory-cyan)]" />
                        <span className="text-[9px] font-mono text-muted-foreground">{dev.rssi} dBm</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-[var(--factory-amber)]" />
                      <span className="text-[9px] font-mono text-muted-foreground">{dev.batPct}% ({dev.batMv} mV)</span>
                    </div>
                  </div>

                  {/* Sensor data */}
                  <div className="p-4 flex flex-col gap-4">
                    <div>
                      <span className="text-[9px] tracking-widest uppercase text-muted-foreground">RMS Acceleration</span>
                      <div className="mt-2 flex items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--factory-cyan)]">X</span>
                          <span className="text-sm font-bold text-foreground">{dev.rmsX.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--factory-orange)]">Y</span>
                          <span className="text-sm font-bold text-foreground">{dev.rmsY.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--factory-green)]">Z</span>
                          <span className="text-sm font-bold text-foreground">{dev.rmsZ.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Peak Values</span>
                      <div className="mt-2 flex items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--factory-cyan)]">X</span>
                          <span className="text-sm font-bold text-foreground">{dev.peakX.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--factory-orange)]">Y</span>
                          <span className="text-sm font-bold text-foreground">{dev.peakY.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--factory-green)]">Z</span>
                          <span className="text-sm font-bold text-foreground">{dev.peakZ.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Logs footer */}
      <div className="h-24 bg-card border-t border-border overflow-y-auto">
        <div className="p-3 text-[9px] font-mono text-muted-foreground leading-relaxed">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground/60">[{log.time}]</span>
              <span>{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
