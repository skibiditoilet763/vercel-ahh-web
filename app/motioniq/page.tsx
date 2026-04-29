"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

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
const RAW_TO_UT = 1.31072
const TREND_MAX = 120
const ODR = 26700

interface ZoomState {
  off: number
  sc: number
}

interface LogEntry {
  time: string
  msg: string
  type: string
}

export default function MotionIQPage() {
  const router = useRouter()

  // State
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"off" | "blink" | "on">("off")
  const [activePage, setActivePage] = useState("connect")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pktCount, setPktCount] = useState(0)

  // Refs for BLE
  const deviceRef = useRef<BluetoothDevice | null>(null)
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null)
  const notifyChrRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const cfgChrRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const waveChrRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)

  // Data state
  const [dashData, setDashData] = useState({
    ts: 0,
    rmsX: 0, rmsY: 0, rmsZ: 0,
    peakX: 0, peakY: 0, peakZ: 0,
    cfX: 0, cfY: 0, cfZ: 0,
    mxT: 0, myT: 0, mzT: 0,
    batMv: 0, batPct: 0, rssi: 0, period: 0, fsCode: 0
  })

  const [sidebarData, setSidebarData] = useState({
    rssi: "—", bat: "—", per: "—", fs: "—", pkt: "0"
  })

  // Trend data
  const trendXRef = useRef<number[]>([])
  const trendYRef = useRef<number[]>([])
  const trendZRef = useRef<number[]>([])
  const magXRef = useRef<number[]>([])
  const magYRef = useRef<number[]>([])
  const magZRef = useRef<number[]>([])

  // Wave state
  const [waveAxis, setWaveAxis] = useState(0)
  const [waveStatus, setWaveStatus] = useState("Ready")
  const [waveCapturing, setWaveCapturing] = useState(false)
  const waveSamplesRef = useRef<number[]>([])
  const fftDataRef = useRef<number[]>([])
  const waveExpectedSeqRef = useRef(0)
  const waveMissedPktsRef = useRef(0)
  const waveTotalExpectedRef = useRef(0)
  const waveDrainingRef = useRef(false)
  const waveNotifyActiveRef = useRef(false)

  // Config state
  const [configFs, setConfigFs] = useState("0")
  const [configFwm, setConfigFwm] = useState("32")
  const [configLpf, setConfigLpf] = useState("0")
  const [configHpf, setConfigHpf] = useState("0")
  const [configAvg, setConfigAvg] = useState("3")
  const [configRng, setConfigRng] = useState("1")
  const [configCh, setConfigCh] = useState("7")
  const [configPer, setConfigPer] = useState("5000")
  const [rawPkt, setRawPkt] = useState("—")

  // Calibration state
  const [calX, setCalX] = useState("0")
  const [calY, setCalY] = useState("0")
  const [calZ, setCalZ] = useState("0")
  const [calRX, setCalRX] = useState("—")
  const [calRY, setCalRY] = useState("—")
  const [calRZ, setCalRZ] = useState("—")

  // Feedback messages
  const [fbAcc, setFbAcc] = useState("")
  const [fbTmag, setFbTmag] = useState("")
  const [fbBle, setFbBle] = useState("")
  const [fbDev, setFbDev] = useState("")
  const [fbCal, setFbCal] = useState("")

  // Zoom state
  const [zoom] = useState<Record<string, ZoomState>>({
    trend: { off: 0, sc: 1 },
    mag: { off: 0, sc: 1 },
    wave: { off: 0, sc: 1 },
    fft: { off: 0, sc: 1 }
  })

  // Canvas refs
  const trendCanvasRef = useRef<HTMLCanvasElement>(null)
  const magCanvasRef = useRef<HTMLCanvasElement>(null)
  const waveCanvasRef = useRef<HTMLCanvasElement>(null)
  const fftCanvasRef = useRef<HTMLCanvasElement>(null)

  // Wave stats
  const [waveStats, setWaveStats] = useState({ samples: 0, min: "—", max: "—", rms: "—" })
  const [fftStats, setFftStats] = useState({ peak: "—", amp: "—" })

  // Trend max values
  const [trendMax, setTrendMax] = useState({ x: "—", y: "—", z: "—" })

  // Helper functions
  const f2 = (v: number) => isNaN(v) ? "—" : v.toFixed(2)
  const f1 = (v: number) => isNaN(v) ? "—" : v.toFixed(1)
  const fHz = (hz: number) => hz >= 1000 ? (hz / 1000).toFixed(2) + " kHz" : hz.toFixed(0) + " Hz"

  const log = useCallback((msg: string, type = "") => {
    const t = new Date().toISOString().substr(11, 8)
    setLogs(prev => [...prev.slice(-50), { time: t, msg, type }])
  }, [])

  const showFeedback = (setter: React.Dispatch<React.SetStateAction<string>>, msg: string) => {
    setter(msg)
    setTimeout(() => setter(""), 4000)
  }

  // Drawing functions
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, cols = 8, rows = 4) => {
    ctx.strokeStyle = "#111820"
    ctx.lineWidth = 1
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * H / rows)
      ctx.lineTo(W, y * H / rows)
      ctx.stroke()
    }
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * W / cols, 0)
      ctx.lineTo(x * W / cols, H)
      ctx.stroke()
    }
  }, [])

  const drawTrend = useCallback(() => {
    const canvas = trendCanvasRef.current
    if (!canvas || trendXRef.current.length < 2) return

    const W = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 20 : 400
    const H = 110
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#08090c"
    ctx.fillRect(0, 0, W, H)
    drawGrid(ctx, W, H)

    const data = [trendXRef.current, trendYRef.current, trendZRef.current]
    const colors = ["#00d4ff", "#ff6b35", "#39ff14"]

    const allVals = data.flatMap(d => d)
    const mn = Math.min(...allVals)
    const mx = Math.max(...allVals, 0.001)
    const range = mx - mn || 0.001
    const z = zoom.trend
    const span = Math.floor(data[0].length / z.sc)
    const start = Math.floor(z.off * data[0].length)

    // Y axis labels
    ctx.font = "8px monospace"
    ctx.fillStyle = "#3d5068"
    for (let i = 0; i <= 4; i++) {
      const v = mn + range * (1 - i / 4)
      ctx.fillText(v.toFixed(2), 2, i * H / 4 + 10)
    }

    // Draw lines
    data.forEach((arr, di) => {
      ctx.strokeStyle = colors[di]
      ctx.lineWidth = 1.5
      ctx.shadowColor = colors[di]
      ctx.shadowBlur = 2
      ctx.beginPath()
      for (let i = 0; i < span; i++) {
        const si = start + i
        if (si >= arr.length) break
        const x = i / span * W
        const y = H - (arr[si] - mn) / range * (H - 12) + 6
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    })

    setTrendMax({
      x: f2(Math.max(...trendXRef.current)),
      y: f2(Math.max(...trendYRef.current)),
      z: f2(Math.max(...trendZRef.current))
    })
  }, [drawGrid, zoom.trend])

  const drawMagTrend = useCallback(() => {
    const canvas = magCanvasRef.current
    if (!canvas || magXRef.current.length < 2) return

    const W = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 20 : 400
    const H = 90
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#08090c"
    ctx.fillRect(0, 0, W, H)
    drawGrid(ctx, W, H)

    const data = [magXRef.current, magYRef.current, magZRef.current]
    const colors = ["#b388ff", "#ff80ab", "#ffd740"]

    const allVals = data.flatMap(d => d)
    const mn = Math.min(...allVals)
    const mx = Math.max(...allVals, 0.001)
    const range = mx - mn || 0.001
    const z = zoom.mag
    const span = Math.floor(data[0].length / z.sc)
    const start = Math.floor(z.off * data[0].length)

    data.forEach((arr, di) => {
      ctx.strokeStyle = colors[di]
      ctx.lineWidth = 1.5
      ctx.shadowColor = colors[di]
      ctx.shadowBlur = 2
      ctx.beginPath()
      for (let i = 0; i < span; i++) {
        const si = start + i
        if (si >= arr.length) break
        const x = i / span * W
        const y = H - (arr[si] - mn) / range * (H - 12) + 6
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    })
  }, [drawGrid, zoom.mag])

  const drawWave = useCallback(() => {
    const canvas = waveCanvasRef.current
    if (!canvas) return

    const W = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 20 : 400
    const H = 150
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#08090c"
    ctx.fillRect(0, 0, W, H)
    drawGrid(ctx, W, H)

    // Zero line
    ctx.strokeStyle = "#1c2530"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()

    if (waveSamplesRef.current.length < 2) {
      setWaveStatus("No data — press CAPTURE")
      return
    }

    const colors = ["#00d4ff", "#ff6b35", "#39ff14"]
    const z = zoom.wave
    const span = Math.floor(waveSamplesRef.current.length / z.sc)
    const start = Math.floor(z.off * waveSamplesRef.current.length)
    const vis = waveSamplesRef.current.slice(start, start + span)
    const mx = Math.max(...vis.map(Math.abs), 1)

    ctx.strokeStyle = colors[waveAxis]
    ctx.lineWidth = 1.5
    ctx.shadowColor = colors[waveAxis]
    ctx.shadowBlur = 3
    ctx.beginPath()

    let penDown = false
    vis.forEach((sv, i) => {
      if (isNaN(sv)) {
        penDown = false
        return
      }
      const x = i / (vis.length - 1) * W
      const y = H / 2 - (sv / mx) * (H / 2 - 6)
      if (!penDown) {
        ctx.moveTo(x, y)
        penDown = true
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
    ctx.shadowBlur = 0

    // Time axis labels
    ctx.font = "8px monospace"
    ctx.fillStyle = "#3d5068"
    for (let i = 0; i <= 4; i++) {
      const si = start + Math.floor(i / 4 * span)
      const t_ms = (si / ODR * 1000).toFixed(1)
      ctx.fillText(t_ms + "ms", i * W / 4, H - 2)
    }

    const mn = Math.min(...vis.filter(v => !isNaN(v)))
    const mxv = Math.max(...vis.filter(v => !isNaN(v)))
    const rm = Math.sqrt(vis.filter(v => !isNaN(v)).reduce((a, v) => a + v * v, 0) / vis.filter(v => !isNaN(v)).length)

    setWaveStats({
      samples: waveSamplesRef.current.length,
      min: String(mn),
      max: String(mxv),
      rms: rm.toFixed(0)
    })
  }, [drawGrid, zoom.wave, waveAxis])

  const computeFFT = useCallback((samples: number[]) => {
    let N = 1
    while (N < samples.length) N <<= 1
    const re = new Float32Array(N)
    const im = new Float32Array(N)

    // Hann window + zero-pad
    for (let i = 0; i < samples.length; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples.length - 1)))
      re[i] = samples[i] * w
    }

    // Bit-reversal
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1
      for (; j & bit; bit >>= 1) j ^= bit
      j ^= bit
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]]
      }
    }

    // FFT butterfly
    for (let len = 2; len <= N; len <<= 1) {
      const ang = -2 * Math.PI / len
      const wRe = Math.cos(ang)
      const wIm = Math.sin(ang)
      for (let i = 0; i < N; i += len) {
        let cr = 1, ci = 0
        for (let j = 0; j < len / 2; j++) {
          const ur = re[i + j], ui = im[i + j]
          const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci
          const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr
          re[i + j] = ur + vr
          im[i + j] = ui + vi
          re[i + j + len / 2] = ur - vr
          im[i + j + len / 2] = ui - vi
          const ncr = cr * wRe - ci * wIm
          ci = cr * wIm + ci * wRe
          cr = ncr
        }
      }
    }

    // Magnitude, one-sided
    const mag = new Float32Array(N / 2)
    for (let i = 0; i < N / 2; i++) {
      mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (N / 2)
    }
    return Array.from(mag)
  }, [])

  const drawFFT = useCallback(() => {
    const canvas = fftCanvasRef.current
    if (!canvas || waveSamplesRef.current.length < 8) return

    fftDataRef.current = computeFFT(waveSamplesRef.current.filter(v => !isNaN(v)))

    const W = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 20 : 400
    const H = 140
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#08090c"
    ctx.fillRect(0, 0, W, H)
    drawGrid(ctx, W, H, 10, 4)

    const z = zoom.fft
    const span = Math.floor(fftDataRef.current.length / z.sc)
    const start = Math.floor(z.off * fftDataRef.current.length)
    const vis = fftDataRef.current.slice(start, start + span)
    const mx = Math.max(...vis, 0.001)
    const colors = ["#00d4ff", "#ff6b35", "#39ff14"]
    const col = colors[waveAxis]

    // Filled spectrum
    ctx.fillStyle = col + "22"
    ctx.beginPath()
    ctx.moveTo(0, H)
    vis.forEach((v, i) => {
      const x = i / (vis.length - 1) * W
      const y = H - (v / mx) * (H - 8)
      i === 0 ? ctx.lineTo(x, H) : ctx.lineTo(x, y)
    })
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fill()

    // Line
    ctx.strokeStyle = col
    ctx.lineWidth = 1.5
    ctx.shadowColor = col
    ctx.shadowBlur = 3
    ctx.beginPath()
    vis.forEach((v, i) => {
      const x = i / (vis.length - 1) * W
      const y = H - (v / mx) * (H - 8)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.shadowBlur = 0

    // Freq labels
    ctx.font = "8px monospace"
    ctx.fillStyle = "#3d5068"
    for (let i = 0; i <= 5; i++) {
      const fi = start + Math.floor(i / 5 * span)
      const hz = fi / fftDataRef.current.length * (ODR / 2)
      ctx.fillText(fHz(hz), i * W / 5, H - 2)
    }

    // Peak
    const peakIdx = vis.indexOf(Math.max(...vis))
    const absIdx = start + peakIdx
    const peakHz = absIdx / fftDataRef.current.length * (ODR / 2)

    setFftStats({
      peak: fHz(peakHz),
      amp: vis[peakIdx].toFixed(2)
    })
  }, [computeFFT, drawGrid, zoom.fft, waveAxis])

  const redrawAll = useCallback(() => {
    drawTrend()
    drawMagTrend()
    drawWave()
    drawFFT()
  }, [drawTrend, drawMagTrend, drawWave, drawFFT])

  // BLE handlers
  const onData = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const d = target.value
    if (!d || d.byteLength < 40) return

    setPktCount(prev => prev + 1)

    const ts = d.getUint32(0, true)
    const mRawX = d.getInt16(4, true)
    const mRawY = d.getInt16(6, true)
    const mRawZ = d.getInt16(8, true)
    const rmsX = d.getUint32(12, true) / 1000
    const rmsY = d.getUint32(16, true) / 1000
    const rmsZ = d.getUint32(20, true) / 1000
    const peakX = d.getUint32(24, true) / 1000
    const peakY = d.getUint32(28, true) / 1000
    const peakZ = d.getUint32(32, true) / 1000

    let cfX = 0, cfY = 0, cfZ = 0, batMv = 0, batPct = 0, rssi = 0, period = 0, fsCode = 0

    if (d.byteLength >= 56) {
      cfX = d.getUint32(36, true) / 1000
      cfY = d.getUint32(40, true) / 1000
      cfZ = d.getUint32(44, true) / 1000
      batMv = d.getUint16(48, true)
      batPct = d.getUint8(50)
      rssi = d.getInt8(51)
      period = d.getUint16(52, true) * 100
      fsCode = d.getUint8(55)
    } else {
      batMv = d.getUint16(34, true)
      batPct = d.getUint8(36)
      rssi = d.getInt8(37)
    }

    const mxT = mRawX / RAW_TO_UT
    const myT = mRawY / RAW_TO_UT
    const mzT = mRawZ / RAW_TO_UT

    setDashData({
      ts, rmsX, rmsY, rmsZ, peakX, peakY, peakZ,
      cfX, cfY, cfZ, mxT, myT, mzT,
      batMv, batPct, rssi, period, fsCode
    })

    // Update raw packet display
    const bytes = new Uint8Array(d.buffer)
    const hex = Array.from(bytes).map((b, i) =>
      (i > 0 && i % 8 === 0 ? "<br/>" : "") + b.toString(16).padStart(2, "0").toUpperCase()
    ).join(" ")
    setRawPkt(hex)

    // Trend accumulate
    trendXRef.current.push(rmsX)
    trendYRef.current.push(rmsY)
    trendZRef.current.push(rmsZ)
    magXRef.current.push(mxT)
    magYRef.current.push(myT)
    magZRef.current.push(mzT)

    if (trendXRef.current.length > TREND_MAX) {
      trendXRef.current.shift()
      trendYRef.current.shift()
      trendZRef.current.shift()
    }
    if (magXRef.current.length > TREND_MAX) {
      magXRef.current.shift()
      magYRef.current.shift()
      magZRef.current.shift()
    }

    // Sidebar
    setSidebarData({
      rssi: rssi ? rssi + " dBm" : "—",
      bat: batMv ? batMv + "mV " + batPct + "%" : "—",
      per: period ? (period / 1000).toFixed(1) + "s" : "—",
      fs: FS_NAMES[fsCode] || "—",
      pkt: String(pktCount + 1)
    })

    if (period) setConfigPer(String(period))
    if (fsCode !== undefined) setConfigFs(String(fsCode))

    setCalRX(f2(rmsX))
    setCalRY(f2(rmsY))
    setCalRZ(f2(rmsZ))

    redrawAll()
  }, [pktCount, redrawAll])

  const onWaveData = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const d = target.value
    if (!d || d.byteLength < 4) return

    const seq = d.getUint8(0)
    const rate = d.getUint16(2, true)

    // Done sentinel
    if (rate === 0xFFFF && seq === 0xFF) {
      const lo = d.getInt16(4, true)
      const hi = d.getInt16(6, true)
      waveTotalExpectedRef.current = (hi << 16) | (lo & 0xFFFF)
      waveDrainingRef.current = false

      const pct = waveTotalExpectedRef.current > 0
        ? Math.round(waveSamplesRef.current.length / waveTotalExpectedRef.current * 100)
        : 100
      const ms = (waveSamplesRef.current.length / 26700 * 1000).toFixed(0)

      setWaveStatus(`Complete: ${waveSamplesRef.current.length} samples (${ms}ms) — ${pct}% received`)
      setWaveCapturing(false)
      drawWave()
      drawFFT()
      log(`Wave complete: ${waveSamplesRef.current.length}/${waveTotalExpectedRef.current} samples, ${waveMissedPktsRef.current} gaps`, "ok")
      return
    }

    // Sequence gap detection
    const expectedSeq = waveExpectedSeqRef.current & 0xFF
    if (waveSamplesRef.current.length > 0 && seq !== expectedSeq && seq !== 0xFF) {
      const gap = (seq - expectedSeq + 255) % 255
      if (gap < 200) {
        waveMissedPktsRef.current += gap
        for (let g = 0; g < Math.min(gap, 50); g++) {
          for (let i = 0; i < 14; i++) waveSamplesRef.current.push(NaN)
        }
      }
    }
    waveExpectedSeqRef.current = (seq + 1) % 255

    // Accumulate samples
    for (let i = 4; i + 1 < d.byteLength; i += 2) {
      waveSamplesRef.current.push(d.getInt16(i, true))
    }

    const n = waveSamplesRef.current.length
    const dur_ms = (n / 26700 * 1000).toFixed(0)
    const gapTxt = waveMissedPktsRef.current > 0 ? ` (${waveMissedPktsRef.current} gaps)` : ""
    setWaveStatus(`Draining... ${n} samples (${dur_ms}ms)${gapTxt}`)

    // Throttle redraws
    if (n % 100 === 0 || n < 100) drawWave()
    if (n >= 256 && n % 500 === 0) drawFFT()
  }, [drawWave, drawFFT, log])

  const onDisconnect = useCallback(() => {
    setConnected(false)
    setConnectionStatus("off")
    notifyChrRef.current = null
    cfgChrRef.current = null
    waveChrRef.current = null
    waveNotifyActiveRef.current = false
    log("Disconnected", "w")
  }, [log])

  const connectBLE = async () => {
    if (!navigator.bluetooth) {
      log("Web Bluetooth not supported. Use Chrome/Edge.", "e")
      return
    }

    if (connected) {
      await deviceRef.current?.gatt?.disconnect()
      return
    }

    setConnectionStatus("blink")
    log("Scanning for MotionIQ_VS1...")

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "MotionIQ_VS1" }, { services: [SVC] }],
        optionalServices: [SVC]
      })

      deviceRef.current = device
      device.addEventListener("gattserverdisconnected", onDisconnect)

      log("Found: " + device.name)

      const server = await device.gatt!.connect()
      serverRef.current = server

      const svc = await server.getPrimaryService(SVC)
      const notifyChr = await svc.getCharacteristic(NTFY)
      const cfgChr = await svc.getCharacteristic(CFG)

      notifyChrRef.current = notifyChr
      cfgChrRef.current = cfgChr

      try {
        const waveChr = await svc.getCharacteristic(WAVE)
        waveChrRef.current = waveChr
        await waveChr.startNotifications()
        waveChr.addEventListener("characteristicvaluechanged", onWaveData)
        log("Waveform char found", "ok")
      } catch {
        waveChrRef.current = null
        log("No waveform char (update firmware)", "w")
      }

      await notifyChr.startNotifications()
      notifyChr.addEventListener("characteristicvaluechanged", onData)

      // Read current period
      try {
        const v = await cfgChr.readValue()
        if (v.byteLength >= 4) {
          setConfigPer(String(v.getUint32(0, true)))
        }
      } catch {
        // Ignore
      }

      setConnected(true)
      setConnectionStatus("on")
      log("Ready", "ok")
    } catch (e) {
      log("Error: " + (e as Error).message, "e")
      setConnectionStatus("off")
    }
  }

  // Config write functions
  const writeCmd = async (bytes: Uint8Array, delayMs = 80): Promise<boolean> => {
    if (!connected || !cfgChrRef.current) {
      log("Not connected — cannot write config", "w")
      return false
    }
    try {
      await cfgChrRef.current.writeValue(bytes.buffer)
      if (delayMs) await new Promise(r => setTimeout(r, delayMs))
      return true
    } catch (e) {
      log("Write error: " + (e as Error).message, "e")
      return false
    }
  }

  const applyAccel = async () => {
    const fs = parseInt(configFs)
    const wm = Math.max(1, Math.min(127, parseInt(configFwm) || 32))
    const lpf = parseInt(configLpf)
    const hpf = parseInt(configHpf)
    let ok = true

    let c = new Uint8Array(12)
    c[0] = CMD.SET_FS
    c[4] = fs
    ok = ok && await writeCmd(c)

    c = new Uint8Array(12)
    c[0] = CMD.SET_FIFO_WM
    c[4] = wm
    ok = ok && await writeCmd(c)

    c = new Uint8Array(12)
    c[0] = CMD.SET_LPF2
    c[4] = lpf
    ok = ok && await writeCmd(c)

    c = new Uint8Array(12)
    c[0] = CMD.SET_HPF
    c[4] = hpf
    ok = ok && await writeCmd(c)

    showFeedback(setFbAcc, ok ? `FS=${FS_NAMES[fs]} WM=${wm} LPF=${lpf}` : "Error — check connection")
    if (ok) log(`Accel: FS=${FS_NAMES[fs]} WM=${wm} LPF=${lpf} HPF=${hpf}`, "ok")
  }

  const applyTmag = async () => {
    const avg = parseInt(configAvg)
    const rng = parseInt(configRng)
    const ch = parseInt(configCh)
    let ok = true

    let c = new Uint8Array(12)
    c[0] = CMD.SET_TMAG_AVG
    c[4] = avg
    ok = ok && await writeCmd(c)

    c = new Uint8Array(12)
    c[0] = CMD.SET_TMAG_RNG
    c[4] = rng
    ok = ok && await writeCmd(c)

    c = new Uint8Array(12)
    c[0] = CMD.SET_TMAG_CH
    c[4] = ch
    ok = ok && await writeCmd(c)

    const avgN = ["1x", "2x", "4x", "8x", "16x", "32x"]
    const rngN = ["+/-50mT", "+/-25mT", "+/-100mT"]
    showFeedback(setFbTmag, ok ? `AVG=${avgN[avg]} Rng=${rngN[rng]}` : "Error")
    if (ok) log(`TMAG: AVG=${avgN[avg]}`, "ok")
  }

  const applyBle = async () => {
    const ms = Math.max(100, parseInt(configPer) || 5000)
    const c = new Uint8Array(12)
    c[0] = CMD.SET_PERIOD
    new DataView(c.buffer).setUint32(4, ms, true)

    if (await writeCmd(c, 0)) {
      showFeedback(setFbBle, `Period -> ${ms}ms`)
      log(`Period -> ${ms}ms`, "ok")
    }
  }

  const doReboot = async () => {
    if (!confirm("Reboot the sensor device?")) return
    const c = new Uint8Array(12)
    c[0] = CMD.REBOOT
    await writeCmd(c, 0)
    showFeedback(setFbDev, "Reboot command sent")
    log("Reboot sent", "w")
  }

  const sendOffsets = async () => {
    const x = parseInt(calX) || 0
    const y = parseInt(calY) || 0
    const z = parseInt(calZ) || 0
    const c = new Uint8Array(12)
    c[0] = CMD.SET_OFFSET
    c[4] = x & 0xFF
    c[5] = y & 0xFF
    c[6] = z & 0xFF

    if (await writeCmd(c)) {
      showFeedback(setFbCal, `Offsets X=${x} Y=${y} Z=${z}`)
      log("Offsets applied", "ok")
    }
  }

  const autoCal = async () => {
    showFeedback(setFbCal, "Hold sensor still... 3s")
    await new Promise(r => setTimeout(r, 3000))
    const c = new Uint8Array(12)
    c[0] = CMD.CALIBRATE
    if (await writeCmd(c)) {
      showFeedback(setFbCal, "Auto-zero sent")
      log("Auto-cal triggered", "ok")
    }
  }

  const capWave = async () => {
    if (!connected || !cfgChrRef.current) {
      log("Not connected — cannot capture", "w")
      return
    }
    if (!waveChrRef.current) {
      log("Wave characteristic not found — update firmware", "w")
      return
    }

    waveSamplesRef.current = []
    fftDataRef.current = []
    waveExpectedSeqRef.current = 0
    waveMissedPktsRef.current = 0
    waveTotalExpectedRef.current = 0
    waveDrainingRef.current = true
    setWaveCapturing(true)
    setWaveStatus("Waiting for capture...")

    try {
      if (!waveNotifyActiveRef.current) {
        await waveChrRef.current.startNotifications()
        waveNotifyActiveRef.current = true
        await new Promise(r => setTimeout(r, 300))
        log("Wave notifications subscribed", "ok")
      }
    } catch (e) {
      log("Wave notify failed: " + (e as Error).message, "e")
    }

    const durMs = 3000
    const cmd = new Uint8Array(12)
    cmd[0] = CMD.WAVE_START
    cmd[4] = waveAxis
    new DataView(cmd.buffer).setUint16(5, durMs, true)

    try {
      await cfgChrRef.current.writeValue(cmd.buffer)
      log(`Wave capture started — axis ${["X", "Y", "Z"][waveAxis]} dur=${durMs}ms`, "ok")
      setWaveStatus(`Capturing ${durMs}ms — will drain ${Math.round(durMs / 1000 * 26700).toLocaleString()} samples over BLE`)
    } catch (e) {
      log("WAVE_START write failed: " + (e as Error).message, "e")
      setWaveCapturing(false)
    }
  }

  const stopWave = async () => {
    if (!connected || !cfgChrRef.current) return
    const cmd = new Uint8Array(12)
    cmd[0] = CMD.WAVE_STOP
    try {
      await cfgChrRef.current.writeValue(cmd.buffer)
    } catch {
      // Ignore
    }
    setWaveCapturing(false)
    setWaveStatus("Stopped. Waiting for remaining drain...")
    setTimeout(() => {
      setWaveStatus(`${waveSamplesRef.current.length} samples total`)
      drawWave()
      drawFFT()
    }, 2000)
  }

  // Resize handler
  useEffect(() => {
    const handleResize = () => redrawAll()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [redrawAll])

  // Initial draw
  useEffect(() => {
    redrawAll()
  }, [activePage, redrawAll])

  const NavButton = ({ id, icon, label }: { id: string; icon: React.ReactNode; label: string }) => (
    <button
      className={`flex items-center gap-2 px-3 py-2 text-left text-sm border-l-2 transition-colors w-full
        ${activePage === id
          ? "text-cyan-400 border-cyan-400 bg-cyan-400/5"
          : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-cyan-400/5"
        }`}
      onClick={() => setActivePage(id)}
    >
      <span className={activePage === id ? "opacity-100" : "opacity-50"}>{icon}</span>
      {label}
    </button>
  )

  return (
    <div className="flex flex-col h-screen bg-[#08090c] text-[#c8d4e0] font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-[#1c2530]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="w-px h-6 bg-[#1c2530]" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border border-cyan-400 rounded flex items-center justify-center text-cyan-400 text-xs font-mono">
              VS1
            </div>
            <div>
              <div className="font-bold text-sm tracking-wider">MOTIONIQ</div>
              <div className="text-[9px] text-gray-500 font-mono tracking-wider">COMMISSIONING</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 border border-[#1c2530] rounded-full text-xs font-mono text-gray-500">
            <div className={`w-2 h-2 rounded-full transition-all ${
              connectionStatus === "on" ? "bg-green-400 shadow-[0_0_6px_#39ff14]" :
              connectionStatus === "blink" ? "bg-yellow-400 animate-pulse" :
              "bg-gray-600"
            }`} />
            <span>{connectionStatus === "on" ? "CONNECTED" : connectionStatus === "blink" ? "SCANNING..." : "DISCONNECTED"}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-52 bg-[#0d1117] border-r border-[#1c2530] flex flex-col overflow-y-auto">
          <div className="border-b border-[#1c2530] py-1">
            <div className="text-[8px] text-gray-600 px-3 py-1 font-mono tracking-widest">LINK</div>
            <NavButton id="connect" icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.81-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>} label="Connect" />
          </div>
          <div className="border-b border-[#1c2530] py-1">
            <div className="text-[8px] text-gray-600 px-3 py-1 font-mono tracking-widest">MONITOR</div>
            <NavButton id="dash" icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>} label="Dashboard" />
            <NavButton id="wave" icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} label="Waveform" />
          </div>
          <div className="border-b border-[#1c2530] py-1">
            <div className="text-[8px] text-gray-600 px-3 py-1 font-mono tracking-widest">SETUP</div>
            <NavButton id="config" icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>} label="Configuration" />
            <NavButton id="cal" icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>} label="Calibration" />
          </div>

          {/* Sidebar status */}
          <div className="mt-auto p-3 border-t border-[#1c2530] text-[9px] font-mono">
            <div className="flex justify-between py-0.5"><span className="text-gray-600">RSSI</span><span className="text-green-400">{sidebarData.rssi}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-600">BAT</span><span className="text-green-400">{sidebarData.bat}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-600">PERIOD</span><span className="text-green-400">{sidebarData.per}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-600">FS</span><span className="text-green-400">{sidebarData.fs}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-600">ODR</span><span className="text-green-400">26.7 kHz</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-600">PKTS</span><span className="text-green-400">{sidebarData.pkt}</span></div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Connect Page */}
          {activePage === "connect" && (
            <div className="flex flex-col items-center justify-center min-h-[55vh] gap-5">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="absolute inset-0" width="120" height="120" viewBox="0 0 120 120">
                  <circle className="fill-none stroke-[#1c2530]" cx="60" cy="60" r="45" strokeWidth="2" />
                  <circle
                    className={`fill-none stroke-2 transition-all duration-1000 ${connected ? "stroke-green-400" : "stroke-cyan-400"}`}
                    cx="60" cy="60" r="45"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset={connected ? 0 : 283}
                    style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
                  />
                </svg>
                <span className={`text-3xl font-mono z-10 ${connected ? "text-green-400" : "text-gray-600"}`}>
                  {connected ? "✓" : "⬡"}
                </span>
              </div>

              <button
                className="bg-cyan-400 text-black px-9 py-3 font-bold tracking-widest text-sm rounded hover:bg-cyan-300 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                onClick={connectBLE}
                disabled={connectionStatus === "blink"}
              >
                {connected ? "DISCONNECT" : connectionStatus === "blink" ? "SCANNING..." : "SCAN & CONNECT"}
              </button>

              <div className="text-center text-xs font-mono text-gray-500 leading-relaxed">
                Looking for <span className="text-cyan-400">MotionIQ_VS1</span>
                <br />Chrome or Edge required (Web Bluetooth)
              </div>

              {/* Log */}
              <div className="w-full max-w-md bg-[#111820] border border-[#1c2530] rounded p-2 max-h-24 overflow-y-auto font-mono text-[9px] text-gray-500 mt-4">
                {logs.map((l, i) => (
                  <div key={i} className={`py-0.5 ${l.type === "ok" ? "text-green-400" : l.type === "w" ? "text-yellow-400" : l.type === "e" ? "text-red-400" : ""}`}>
                    <span className="text-gray-600 mr-2">{l.time}</span>{l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard Page */}
          {activePage === "dash" && (
            <div>
              <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 tracking-widest border-b border-[#1c2530] pb-2 mb-3">
                <span>LIVE SENSOR DATA</span>
                <span>t={(dashData.ts / 1000).toFixed(1)}s</span>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "RMS · X", value: f2(dashData.rmsX), peak: f2(dashData.peakX), cf: f1(dashData.cfX), color: "#00d4ff" },
                  { label: "RMS · Y", value: f2(dashData.rmsY), peak: f2(dashData.peakY), cf: f1(dashData.cfY), color: "#ff6b35" },
                  { label: "RMS · Z", value: f2(dashData.rmsZ), peak: f2(dashData.peakZ), cf: f1(dashData.cfZ), color: "#39ff14" },
                ].map((k, i) => (
                  <div key={i} className="bg-[#0d1117] border border-[#1c2530] rounded p-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
                    <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">{k.label}</div>
                    <div className="text-xl font-mono" style={{ color: k.color }}>{k.value}</div>
                    <div className="text-[9px] font-mono text-gray-500">m/s²</div>
                    <div className="text-[9px] font-mono text-gray-500 mt-1">PEAK {k.peak} · CF {k.cf}</div>
                  </div>
                ))}
              </div>

              {/* Vibration bars */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-3 mb-2">
                <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-2">VIBRATION — RMS · PEAK · CREST FACTOR</div>
                {[
                  { axis: "X", color: "#00d4ff", rms: dashData.rmsX, peak: dashData.peakX, cf: dashData.cfX },
                  { axis: "Y", color: "#ff6b35", rms: dashData.rmsY, peak: dashData.peakY, cf: dashData.cfY },
                  { axis: "Z", color: "#39ff14", rms: dashData.rmsZ, peak: dashData.peakZ, cf: dashData.cfZ },
                ].map((v, i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr_75px_70px_60px] items-center gap-2 my-1">
                    <div className="font-mono text-xs font-bold" style={{ color: v.color }}>{v.axis}</div>
                    <div className="bg-[#0a0f15] h-1.5 rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ background: v.color, width: `${Math.min(100, v.rms / (FS_SCALE[dashData.fsCode] || 19.62) * 100)}%` }} />
                    </div>
                    <div className="font-mono text-xs text-right" style={{ color: v.color }}>{f2(v.rms)}</div>
                    <div className="font-mono text-[10px] text-gray-500 text-right">{f2(v.peak)}</div>
                    <div className="font-mono text-[9px] text-gray-500 text-right">CF {f1(v.cf)}</div>
                  </div>
                ))}
              </div>

              {/* Magnetic bars */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-3 mb-2">
                <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-2">MAGNETIC FIELD — TMAG5170A01</div>
                {[
                  { axis: "X", color: "#b388ff", value: dashData.mxT },
                  { axis: "Y", color: "#ff80ab", value: dashData.myT },
                  { axis: "Z", color: "#ffd740", value: dashData.mzT },
                ].map((m, i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr_75px] items-center gap-2 my-1">
                    <div className="font-mono text-xs font-bold" style={{ color: m.color }}>{m.axis}</div>
                    <div className="bg-[#0a0f15] h-1.5 rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ background: m.color, width: `${Math.min(100, Math.abs(m.value) / 500 * 100)}%` }} />
                    </div>
                    <div className="font-mono text-xs text-right" style={{ color: m.color }}>{f1(m.value)} µT</div>
                  </div>
                ))}
              </div>

              {/* Trend chart */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-3 mb-2">
                <div className="flex items-center justify-between text-[8px] font-mono text-gray-500 tracking-widest mb-2">
                  <span>RMS TREND</span>
                  <span>
                    <span className="text-cyan-400 mr-2">X max {trendMax.x}</span>
                    <span className="text-orange-400 mr-2">Y max {trendMax.y}</span>
                    <span className="text-green-400">Z max {trendMax.z}</span>
                  </span>
                </div>
                <canvas ref={trendCanvasRef} className="w-full" />
              </div>

              {/* Mag trend chart */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-3">
                <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-2">MAGNETIC TREND</div>
                <canvas ref={magCanvasRef} className="w-full" />
              </div>
            </div>
          )}

          {/* Waveform Page */}
          {activePage === "wave" && (
            <div>
              <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 tracking-widest border-b border-[#1c2530] pb-2 mb-3">
                <span>WAVEFORM CAPTURE & FFT</span>
                <span>{waveStatus}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-500">AXIS:</span>
                  {["X", "Y", "Z"].map((a, i) => (
                    <button
                      key={a}
                      className={`px-3 py-1 text-xs font-mono rounded transition-colors ${waveAxis === i ? "bg-cyan-400 text-black" : "bg-[#1c2530] text-gray-400 hover:bg-[#2a3545]"}`}
                      onClick={() => setWaveAxis(i)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <button
                  className="px-4 py-1.5 text-xs font-mono bg-cyan-400 text-black rounded hover:bg-cyan-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  onClick={capWave}
                  disabled={waveCapturing || !connected}
                >
                  {waveCapturing ? "CAPTURING..." : "CAPTURE"}
                </button>
                <button
                  className="px-4 py-1.5 text-xs font-mono bg-red-500 text-white rounded hover:bg-red-400 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  onClick={stopWave}
                  disabled={!waveCapturing}
                >
                  STOP
                </button>
              </div>

              {/* Waveform chart */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-3 mb-3">
                <div className="flex items-center justify-between text-[8px] font-mono text-gray-500 tracking-widest mb-2">
                  <span>TIME DOMAIN</span>
                  <span>{waveStats.samples} samples · min {waveStats.min} · max {waveStats.max} · rms {waveStats.rms}</span>
                </div>
                <canvas ref={waveCanvasRef} className="w-full" />
              </div>

              {/* FFT chart */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-3">
                <div className="flex items-center justify-between text-[8px] font-mono text-gray-500 tracking-widest mb-2">
                  <span>FREQUENCY SPECTRUM (FFT)</span>
                  <span>Peak: {fftStats.peak} @ {fftStats.amp}</span>
                </div>
                <canvas ref={fftCanvasRef} className="w-full" />
              </div>
            </div>
          )}

          {/* Configuration Page */}
          {activePage === "config" && (
            <div className="grid grid-cols-2 gap-4">
              {/* Accelerometer */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-4">
                <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-3">ACCELEROMETER — IIS3DWB</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-mono text-gray-500 block mb-1">Full-Scale</label>
                    <select
                      className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                      value={configFs}
                      onChange={(e) => setConfigFs(e.target.value)}
                    >
                      {FS_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-gray-500 block mb-1">FIFO Watermark</label>
                    <input
                      type="number"
                      className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                      value={configFwm}
                      onChange={(e) => setConfigFwm(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-mono text-gray-500 block mb-1">LPF2</label>
                      <select
                        className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                        value={configLpf}
                        onChange={(e) => setConfigLpf(e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="1">ODR/4</option>
                        <option value="2">ODR/10</option>
                        <option value="3">ODR/20</option>
                        <option value="4">ODR/45</option>
                        <option value="5">ODR/100</option>
                        <option value="6">ODR/200</option>
                        <option value="7">ODR/400</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-gray-500 block mb-1">HPF</label>
                      <select
                        className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                        value={configHpf}
                        onChange={(e) => setConfigHpf(e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="1">ODR/800</option>
                        <option value="2">ODR/100</option>
                        <option value="3">ODR/9</option>
                        <option value="4">ODR/400</option>
                      </select>
                    </div>
                  </div>
                  <button
                    className="w-full bg-cyan-400 text-black py-2 text-xs font-mono rounded hover:bg-cyan-300"
                    onClick={applyAccel}
                  >
                    APPLY
                  </button>
                  {fbAcc && <div className="text-[9px] font-mono text-green-400">{fbAcc}</div>}
                </div>
              </div>

              {/* Hall Effect */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-4">
                <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-3">HALL EFFECT — TMAG5170A01</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-mono text-gray-500 block mb-1">Averaging</label>
                    <select
                      className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                      value={configAvg}
                      onChange={(e) => setConfigAvg(e.target.value)}
                    >
                      <option value="0">1x</option>
                      <option value="1">2x</option>
                      <option value="2">4x</option>
                      <option value="3">8x</option>
                      <option value="4">16x</option>
                      <option value="5">32x</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-gray-500 block mb-1">Range</label>
                    <select
                      className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                      value={configRng}
                      onChange={(e) => setConfigRng(e.target.value)}
                    >
                      <option value="0">+/-50mT</option>
                      <option value="1">+/-25mT</option>
                      <option value="2">+/-100mT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-gray-500 block mb-1">Channels</label>
                    <select
                      className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                      value={configCh}
                      onChange={(e) => setConfigCh(e.target.value)}
                    >
                      <option value="7">XYZ</option>
                      <option value="4">X only</option>
                      <option value="5">Y only</option>
                      <option value="6">Z only</option>
                    </select>
                  </div>
                  <button
                    className="w-full bg-cyan-400 text-black py-2 text-xs font-mono rounded hover:bg-cyan-300"
                    onClick={applyTmag}
                  >
                    APPLY
                  </button>
                  {fbTmag && <div className="text-[9px] font-mono text-green-400">{fbTmag}</div>}
                </div>
              </div>

              {/* BLE Reporting */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-4">
                <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-3">BLE REPORTING</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-mono text-gray-500 block mb-1">Period (ms)</label>
                    <input
                      type="number"
                      className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                      value={configPer}
                      onChange={(e) => setConfigPer(e.target.value)}
                    />
                  </div>
                  <button
                    className="w-full bg-cyan-400 text-black py-2 text-xs font-mono rounded hover:bg-cyan-300"
                    onClick={applyBle}
                  >
                    SET PERIOD
                  </button>
                  {fbBle && <div className="text-[9px] font-mono text-green-400">{fbBle}</div>}
                </div>
              </div>

              {/* Device */}
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-4">
                <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-3">DEVICE</div>
                <div className="space-y-3">
                  <button
                    className="w-full bg-red-500 text-white py-2 text-xs font-mono rounded hover:bg-red-400"
                    onClick={doReboot}
                  >
                    REBOOT DEVICE
                  </button>
                  {fbDev && <div className="text-[9px] font-mono text-yellow-400">{fbDev}</div>}
                  <div className="mt-3">
                    <div className="text-[8px] font-mono text-gray-500 mb-1">RAW PACKET</div>
                    <div
                      className="bg-[#111820] border border-[#1c2530] rounded p-2 text-[8px] font-mono text-gray-400 break-all max-h-20 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: rawPkt }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calibration Page */}
          {activePage === "cal" && (
            <div className="max-w-md">
              <div className="bg-[#0d1117] border border-[#1c2530] rounded p-4">
                <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-3">OFFSET CALIBRATION</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "X", value: calX, setter: setCalX, live: calRX },
                      { label: "Y", value: calY, setter: setCalY, live: calRY },
                      { label: "Z", value: calZ, setter: setCalZ, live: calRZ },
                    ].map((c) => (
                      <div key={c.label}>
                        <label className="text-[9px] font-mono text-gray-500 block mb-1">{c.label} offset</label>
                        <input
                          type="number"
                          className="w-full bg-[#111820] border border-[#1c2530] rounded px-2 py-1.5 text-xs font-mono text-cyan-400"
                          value={c.value}
                          onChange={(e) => c.setter(e.target.value)}
                        />
                        <div className="text-[8px] font-mono text-gray-500 mt-1">Live: {c.live}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 bg-cyan-400 text-black py-2 text-xs font-mono rounded hover:bg-cyan-300"
                      onClick={sendOffsets}
                    >
                      SEND OFFSETS
                    </button>
                    <button
                      className="flex-1 bg-orange-500 text-black py-2 text-xs font-mono rounded hover:bg-orange-400"
                      onClick={autoCal}
                    >
                      AUTO-ZERO
                    </button>
                  </div>
                  {fbCal && <div className="text-[9px] font-mono text-green-400">{fbCal}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
