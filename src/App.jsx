import React, { useEffect, useMemo, useRef, useState } from "react";

// === Utility functions ===
function hsvToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v; g = t; b = p; break;
    case 1:
      r = q; g = v; b = p; break;
    case 2:
      r = p; g = v; b = t; break;
    case 3:
      r = p; g = q; b = v; break;
    case 4:
      r = t; g = p; b = v; break;
    case 5:
      r = v; g = p; b = q; break;
    default:
      r = g = b = 0;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r, g, b) {
  return (
    "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
  );
}

function hexToRgb(hex) {
  const parsed = hex.replace("#", "");
  const bigint = parseInt(parsed, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h, s, v];
}

function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function hsvToHex(h, s, v) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

function polarToCartesian(angle, radius) {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

// === ColorWheel Component ===
function ColorWheel({ size = 320, value, onChange }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const [isDragging, setDragging] = useState(false);

  const radius = size / 2 - 8;

  // draw color wheel (hue-saturation wheel, fixed value = 1)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const d = canvas.width;
    const img = ctx.createImageData(d, d);
    const data = img.data;
    const cx = d / 2, cy = d / 2;
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < d; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * d + x) * 4;
        if (dist <= radius) {
          let angle = Math.atan2(dy, dx); // -PI..PI
          if (angle < 0) angle += Math.PI * 2;
          const h = angle / (Math.PI * 2);
          const s = Math.min(1, dist / radius);
          const [r, g, b] = hsvToRgb(h, s, 1);
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0; // transparent
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // ring border
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = "#e5e7eb"; // slate-200
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [size]);

  const handlePointer = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const r = Math.min(dist, radius);
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    const h = angle / (Math.PI * 2);
    const s = Math.min(1, r / radius);
    onChange({ h, s, v: 1 });
  };

  const onMouseDown = (e) => { setDragging(true); handlePointer(e.clientX, e.clientY); };
  const onMouseMove = (e) => { if (isDragging) handlePointer(e.clientX, e.clientY); };
  const onMouseUp = () => setDragging(false);
  const onTouchStart = (e) => { setDragging(true); const t = e.touches[0]; handlePointer(t.clientX, t.clientY); };
  const onTouchMove = (e) => { if (!isDragging) return; const t = e.touches[0]; handlePointer(t.clientX, t.clientY); };
  const onTouchEnd = () => setDragging(false);

  // draw pointer
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const d = canvas.width;
    const cx = d / 2, cy = d / 2;

    // redraw pointer overlay
    // ctx.clearRect(0, 0, d, d);

    // redraw wheel bitmap was already put once; so we draw it again from saved image
    // For performance, keep a separate static layer would be ideal; here we redraw the wheel image by triggering once above.
    // So here we only draw the selection indicator on top using globalCompositeOperation.
  }, [value]);

  // Use a separate overlay canvas for pointer to avoid regenerating wheel. Simpler: absolutely position an SVG circle.
  const pointerPos = useMemo(() => {
    const angle = (value?.h ?? 0) * Math.PI * 2;
    const r = (value?.s ?? 0) * radius;
    const { x, y } = polarToCartesian(angle, r);
    return { x: x + size / 2, y: y + size / 2 };
  }, [value, size]);

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-full cursor-crosshair touch-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      {/* Pointer */}
      <svg className="pointer-events-none absolute inset-0" width={size} height={size}>
        <circle
          cx={pointerPos.x}
          cy={pointerPos.y}
          r={8}
          stroke="#111827"
          strokeWidth={2}
          fill="white"
        />
      </svg>
    </div>
  );
}

// === Data helpers ===
const STORAGE_KEY = "odorColorResponses";

function saveRecord(record) {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  existing.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

function loadAllRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function toCSV(records) {
  const header = [
    "timestamp",
    "odor1_hex","odor1_h","odor1_s","odor1_v",
    "odor2_hex","odor2_h","odor2_s","odor2_v",
    "odor3_hex","odor3_h","odor3_s","odor3_v",
  ];
  const rows = records.map((r) => [
    r.timestamp,
    r.colors[0].hex, r.colors[0].h.toFixed(6), r.colors[0].s.toFixed(6), r.colors[0].v.toFixed(6),
    r.colors[1].hex, r.colors[1].h.toFixed(6), r.colors[1].s.toFixed(6), r.colors[1].v.toFixed(6),
    r.colors[2].hex, r.colors[2].h.toFixed(6), r.colors[2].s.toFixed(6), r.colors[2].v.toFixed(6),
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// === Results plot (aggregate points on color wheel) ===
function ResultsPlot({ size = 360, records }) {
  const canvasRef = useRef(null);
  const radius = size / 2 - 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const d = canvas.width;
    const cx = d / 2, cy = d / 2;

    // draw wheel background (same as ColorWheel but with lower alpha)
    const img = ctx.createImageData(d, d);
    const data = img.data;
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < d; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * d + x) * 4;
        if (dist <= radius) {
          let angle = Math.atan2(dy, dx); if (angle < 0) angle += Math.PI * 2;
          const h = angle / (Math.PI * 2);
          const s = Math.min(1, dist / radius);
          const [r, g, b] = hsvToRgb(h, s, 1);
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 60; // faint
        } else {
          data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // radial grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let r = radius; r > 0; r -= radius / 4) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }

    // axis lines
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(radius, 0); ctx.stroke();
    }
    ctx.restore();

    // plot points
    const points = [];
    records.forEach((rec) => {
      rec.colors.forEach((c, idx) => {
        points.push({ h: c.h, s: c.s, v: c.v, hex: c.hex, label: `#${idx + 1}` });
      });
    });

    points.forEach((p) => {
      const angle = p.h * Math.PI * 2;
      const r = p.s * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      // outline circle to ensure visibility on any background
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.hex;
      ctx.fill();
      ctx.strokeStyle = "#111827"; // slate-900
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [records, size]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} width={size} height={size} className="rounded-xl shadow" />
    </div>
  );
}

// === Main App ===
export default function App() {
  const [screen, setScreen] = useState("welcome"); // welcome | trial | review | done | results
  const [trialIndex, setTrialIndex] = useState(0);
  const [colors, setColors] = useState([
    { h: 0, s: 0.8, v: 1, hex: hsvToHex(0, 0.8, 1) },
    { h: 0.33, s: 0.8, v: 1, hex: hsvToHex(0.33, 0.8, 1) },
    { h: 0.66, s: 0.8, v: 1, hex: hsvToHex(0.66, 0.8, 1) },
  ]);

  const odorLabels = ["Odor A", "Odor B", "Odor C"]; // customize as needed

  const current = colors[trialIndex];

  // const updateCurrent = (hsv) => {
  //   const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  //   const next = colors.slice();
  //   next[trialIndex] = { ...hsv, hex };
  //   setColors(next);
  // };
  const updateCurrent = (hsv) => {
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v ?? 1); // ensure v=1
  setColors(prev => {
    const next = prev.slice();
    next[trialIndex] = { ...hsv, v: hsv.v ?? 1, hex };
    return next;
  });
};

  const goNext = () => {
    if (trialIndex < 2) setTrialIndex(trialIndex + 1);
    else setScreen("review");
  };

  const goBack = () => {
    if (trialIndex > 0) setTrialIndex(trialIndex - 1);
    else setScreen("welcome");
  };

  const start = () => { setTrialIndex(0); setScreen("trial"); };

  // const submit = () => {
  //   const record = {
  //     timestamp: new Date().toISOString(),
  //     colors: colors.map(c => ({ h: c.h, s: c.s, v: c.v, hex: c.hex }))
  //   };
  //   saveRecord(record);
  //   setScreen("done");
  // };

  const submit = async () => {
  const record = {
    timestamp: new Date().toISOString(),
    colors: colors.map(c => ({ h: c.h, s: c.s, v: c.v, hex: c.hex })),
  };

  try {
    await fetch("https://your-api.example/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch (e) {
    console.error("Failed to send to server, falling back to local save.", e);
  }

  saveRecord(record); // keep this if you still want local copy
  setScreen("done");
};

  const goResults = () => setScreen("results");

  // navbar
  const Nav = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
      <div className="text-xl font-semibold">Odor → Color</div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={goResults}>
          Results
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Nav />

      {screen === "welcome" && (
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-3xl font-bold mb-2">Welcome! 👃🎨</h1>
            <p className="text-slate-600 mb-6">
              You'll smell <b>three odors</b>. For each odor, pick the color that best matches your perception using the color wheel. You can go back anytime before the final submission.
            </p>
            <ul className="list-disc pl-5 text-slate-700 mb-6">
              <li>Move your mouse (or finger) over the wheel to select a color (hue = angle, saturation = distance).</li>
              <li>The preview circle shows the exact color you picked.</li>
              <li>Click <b>Next</b> after each odor. Use <b>Back</b> to revise.</li>
            </ul>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 rounded-xl bg-black text-white" onClick={start}>Start</button>
              <button className="px-5 py-2.5 rounded-xl border" onClick={goResults}>View Results</button>
            </div>
          </div>
        </div>
      )}

      {screen === "trial" && (
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">{odorLabels[trialIndex]}</h2>
                <span className="text-slate-500">{trialIndex + 1} / 3</span>
              </div>
              <ColorWheel value={current} onChange={updateCurrent} />
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-medium text-slate-700 mb-3">Selected Color</h3>
              <div className="flex items-center gap-6">
                <div
                  className="w-28 h-28 rounded-full border shadow"
                  style={{ backgroundColor: current.hex }}
                  aria-label="Selected color preview"
                />
                <div className="text-sm">
                  <div><span className="text-slate-500">HEX:</span> <span className="font-mono">{current.hex}</span></div>
                  <div><span className="text-slate-500">H:</span> {(current.h * 360).toFixed(1)}°</div>
                  <div><span className="text-slate-500">S:</span> {(current.s * 100).toFixed(1)}%</div>
                  <div><span className="text-slate-500">V:</span> {(current.v * 100).toFixed(1)}%</div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="px-4 py-2 rounded-lg border" onClick={goBack}>Back</button>
                <button className="px-4 py-2 rounded-lg bg-black text-white" onClick={goNext}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "review" && (
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Review Your Choices</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {colors.map((c, i) => (
                <div key={i} className="p-4 rounded-xl border">
                  <div className="mb-2 text-slate-700 font-medium">{odorLabels[i]}</div>
                  <div className="w-full aspect-square rounded-xl border shadow" style={{ backgroundColor: c.hex }} />
                  <div className="mt-2 text-xs text-slate-600 font-mono">{c.hex}</div>
                  <button className="mt-3 text-sm underline" onClick={() => { setTrialIndex(i); setScreen("trial"); }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setScreen("trial")}>Back</button>
              <button className="px-4 py-2 rounded-lg bg-black text-white" onClick={submit}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {screen === "done" && (
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <h2 className="text-3xl font-bold mb-2">Thanks! 🎉</h2>
            <p className="text-slate-600">Your responses have been recorded on this device.</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button className="px-4 py-2 rounded-lg border" onClick={() => { setColors(colors); setScreen("welcome"); }}>Home</button>
              <button className="px-4 py-2 rounded-lg bg-black text-white" onClick={goResults}>View Results</button>
            </div>
          </div>
        </div>
      )}

      {screen === "results" && (
        <ResultsPage onHome={() => setScreen("welcome")} />
      )}
    </div>
  );
}

function ResultsPage({ onHome }) {
  const [records, setRecords] = useState(loadAllRecords());

  const refresh = () => setRecords(loadAllRecords());

  const clearAll = () => {
    if (confirm("This will delete all locally stored responses on this device. Continue?")) {
      localStorage.removeItem(STORAGE_KEY);
      refresh();
    }
  };

  const csv = useMemo(() => toCSV(records), [records]);

  const downloadCSV = () => download(`odor-color-responses-${new Date().toISOString().slice(0,10)}.csv`, csv);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Aggregated Results</h2>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-lg border" onClick={refresh}>Refresh</button>
          <button className="px-3 py-1.5 rounded-lg border" onClick={downloadCSV}>Download CSV</button>
          <button className="px-3 py-1.5 rounded-lg border text-red-600" onClick={clearAll}>Clear All</button>
          <button className="px-3 py-1.5 rounded-lg bg-black text-white" onClick={onHome}>Home</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <ResultsPlot records={records} />
          <p className="text-slate-600 text-sm mt-3">
            Points represent chosen colors as polar coordinates (angle = hue, radius = saturation). Background wheel shows the hue–saturation space; brightness/value is fixed.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 overflow-hidden">
          <h3 className="font-medium mb-3">Responses</h3>
          <div className="max-h-[420px] overflow-auto pr-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">Timestamp</th>
                  <th>Odor A</th>
                  <th>Odor B</th>
                  <th>Odor C</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td className="py-8 text-center text-slate-500" colSpan={4}>No data yet.</td></tr>
                )}
                {records.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 align-top whitespace-nowrap font-mono text-xs">{new Date(r.timestamp).toLocaleString()}</td>
                    {r.colors.map((c, j) => (
                      <td key={j} className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-5 h-5 rounded-full border" style={{ backgroundColor: c.hex }} />
                          <span className="font-mono">{c.hex}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">H {(c.h * 360).toFixed(1)}°, S {(c.s * 100).toFixed(0)}%</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 text-slate-600 text-sm">
        <p><b>Note:</b> Data are stored in the browser's <i>localStorage</i>. To aggregate across multiple devices, use the CSV export and merge later, or deploy with a simple backend endpoint to collect submissions.</p>
      </div>
    </div>
  );
}
