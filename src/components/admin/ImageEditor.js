"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { HiOutlineXMark, HiOutlineCheck, HiOutlineArrowUturnLeft } from "react-icons/hi2";
import styles from "./ImageEditor.module.css";

/**
 * Mini Image Editor with Crop + Background Removal
 * Opens as a modal when an image is selected for upload.
 */
export default function ImageEditor({ file, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [originalImg, setOriginalImg] = useState(null);
  const [mode, setMode] = useState("preview"); // preview | crop | removebg
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState([]);

  // Removebg state
  const [tolerance, setTolerance] = useState(30); // 0-100
  
  // Crop state
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI state
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [aiResult, setAiResult] = useState(null);

  // Load file
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImg(img);
        setImgSrc(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Consolidated draw effect
  useEffect(() => {
    if (!imgSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      // 1. Setup dimensions
      const maxW = Math.min(600, window.innerWidth - 80);
      const maxH = Math.min(450, window.innerHeight - 300);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      
      if (canvas.width !== img.width * scale || canvas.height !== img.height * scale) {
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 2. Draw crop overlay if in crop mode
      if (mode === "crop" && cropStart && cropEnd) {
        // Dark overlay
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Clear crop area
        const x = Math.min(cropStart.x, cropEnd.x);
        const y = Math.min(cropStart.y, cropEnd.y);
        const w = Math.abs(cropEnd.x - cropStart.x);
        const h = Math.abs(cropEnd.y - cropStart.y);
        
        if (w > 0 && h > 0) {
          ctx.clearRect(x, y, w, h);
          ctx.drawImage(img, (x / canvas.width) * img.width, (y / canvas.height) * img.height, (w / canvas.width) * img.width, (h / canvas.height) * img.height, x, y, w, h);
          
          // Border
          ctx.strokeStyle = "#A78BFA";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
        }
      }
    };
    img.src = imgSrc;
  }, [imgSrc, mode, cropStart, cropEnd]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: Math.max(0, Math.min(canvas.width, ((clientX - rect.left) / rect.width) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((clientY - rect.top) / rect.height) * canvas.height)),
    };
  };

  const handleMouseDown = (e) => {
    if (mode !== "crop") return;
    const coords = getCanvasCoords(e);
    setCropStart(coords);
    setCropEnd(coords);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || mode !== "crop") return;
    setCropEnd(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support
  const handleTouchStart = (e) => {
    if (mode !== "crop") return;
    const coords = getCanvasCoords(e);
    setCropStart(coords);
    setCropEnd(coords);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || mode !== "crop") return;
    setCropEnd(getCanvasCoords(e));
  };

  // Apply crop
  const applyCrop = useCallback(() => {
    if (!cropStart || !cropEnd || !imgSrc) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const scaleX = img.width / canvas.width;
      const scaleY = img.height / canvas.height;
      
      const x = Math.min(cropStart.x, cropEnd.x) * scaleX;
      const y = Math.min(cropStart.y, cropEnd.y) * scaleY;
      const w = Math.abs(cropEnd.x - cropStart.x) * scaleX;
      const h = Math.abs(cropEnd.y - cropStart.y) * scaleY;
      
      if (w < 10 || h < 10) return;
      
      setHistory((prev) => [...prev, imgSrc]);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tCtx = tempCanvas.getContext("2d");
      tCtx.drawImage(img, x, y, w, h, 0, 0, w, h);
      
      setImgSrc(tempCanvas.toDataURL("image/png"));
      setCropStart(null);
      setCropEnd(null);
      setMode("preview");
    };
    img.src = imgSrc;
  }, [cropStart, cropEnd, imgSrc]);

  // Remove background (client-side using canvas color analysis + flood-fill from edges)
  const removeBackground = useCallback(async () => {
    if (!imgSrc) return;
    setProcessing(true);
    setHistory((prev) => [...prev, imgSrc]);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = imgSrc;
      });

      const canvas = document.createElement("canvas");
      
      // Optimization: limit resolution for processing to avoid hanging
      const maxProcessingDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxProcessingDim || h > maxProcessingDim) {
        const pScale = Math.min(maxProcessingDim / w, maxProcessingDim / h);
        w = Math.round(w * pScale);
        h = Math.round(h * pScale);
      }
      
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

      // Step 1: Sample background color from corners
      const samples = [];
      const sampleSize = Math.max(5, Math.floor(Math.min(w, h) * 0.02));
      
      const cornerRanges = [
        // Top-left
        { xStart: 0, xEnd: sampleSize, yStart: 0, yEnd: sampleSize },
        // Top-right
        { xStart: w - sampleSize, xEnd: w, yStart: 0, yEnd: sampleSize },
        // Bottom-left
        { xStart: 0, xEnd: sampleSize, yStart: h - sampleSize, yEnd: h },
        // Bottom-right
        { xStart: w - sampleSize, xEnd: w, yStart: h - sampleSize, yEnd: h },
      ];

      for (const { xStart, xEnd, yStart, yEnd } of cornerRanges) {
        for (let y = yStart; y < yEnd; y++) {
          for (let x = xStart; x < xEnd; x++) {
            const i = (y * w + x) * 4;
            samples.push([data[i], data[i + 1], data[i + 2]]);
          }
        }
      }

      // Average background color
      const avgBg = samples.reduce(
        (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
        [0, 0, 0]
      ).map((v) => v / samples.length);

      // Calculate color standard deviation for adaptive threshold
      const stdDev = Math.sqrt(
        samples.reduce((acc, [r, g, b]) => {
          return acc + (r - avgBg[0]) ** 2 + (g - avgBg[1]) ** 2 + (b - avgBg[2]) ** 2;
        }, 0) / samples.length / 3
      );

      const threshold = Math.max(20, Math.min(80, stdDev * 3 + tolerance));

      // Helper: color distance from average background
      const colorDist = (idx) => {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        return Math.sqrt(
          (r - avgBg[0]) ** 2 + (g - avgBg[1]) ** 2 + (b - avgBg[2]) ** 2
        );
      };

      // Step 2: Flood-fill from all edge pixels to identify connected background
      const visited = new Uint8Array(w * h);
      const isBackground = new Uint8Array(w * h);
      const queue = [];
      const floodThreshold = threshold * 1.5; // Slightly more permissive for flood-fill

      // Seed from all edge pixels that match background color
      for (let x = 0; x < w; x++) {
        // Top edge
        if (colorDist(x * 4) < floodThreshold) {
          const pos = x;
          if (!visited[pos]) { visited[pos] = 1; queue.push(pos); }
        }
        // Bottom edge
        if (colorDist(((h - 1) * w + x) * 4) < floodThreshold) {
          const pos = (h - 1) * w + x;
          if (!visited[pos]) { visited[pos] = 1; queue.push(pos); }
        }
      }
      for (let y = 0; y < h; y++) {
        // Left edge
        if (colorDist((y * w) * 4) < floodThreshold) {
          const pos = y * w;
          if (!visited[pos]) { visited[pos] = 1; queue.push(pos); }
        }
        // Right edge
        if (colorDist((y * w + w - 1) * 4) < floodThreshold) {
          const pos = y * w + w - 1;
          if (!visited[pos]) { visited[pos] = 1; queue.push(pos); }
        }
      }

      // BFS flood-fill
      let head = 0;
      while (head < queue.length) {
        const pos = queue[head++];
        isBackground[pos] = 1;

        const x = pos % w;
        const y = (pos - x) / w;

        // 4-connected neighbors
        if (x > 0 && !visited[pos - 1]) {
          visited[pos - 1] = 1;
          if (colorDist((pos - 1) * 4) < floodThreshold) queue.push(pos - 1);
        }
        if (x < w - 1 && !visited[pos + 1]) {
          visited[pos + 1] = 1;
          if (colorDist((pos + 1) * 4) < floodThreshold) queue.push(pos + 1);
        }
        if (y > 0 && !visited[pos - w]) {
          visited[pos - w] = 1;
          if (colorDist((pos - w) * 4) < floodThreshold) queue.push(pos - w);
        }
        if (y < h - 1 && !visited[pos + w]) {
          visited[pos + w] = 1;
          if (colorDist((pos + w) * 4) < floodThreshold) queue.push(pos + w);
        }
      }

      // Step 3: Apply transparency with defringing
      const outerThreshold = threshold * 2.0;

      for (let pos = 0; pos < w * h; pos++) {
        const i = pos * 4;

        if (isBackground[pos]) {
          // Connected background — fully transparent
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        } else {
          // Check if this non-background pixel is near the background color (edge fringe)
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const dist = Math.sqrt(
            (r - avgBg[0]) ** 2 + (g - avgBg[1]) ** 2 + (b - avgBg[2]) ** 2
          );

          if (dist < outerThreshold) {
            // Edge pixel — defringe
            const t_raw = (dist - threshold) / (outerThreshold - threshold);
            const t = Math.pow(Math.max(0, t_raw), 0.8);
            const alpha = Math.round(t * 255);

            if (t > 0.1) {
              // Recover foreground color by un-premultiplying
              data[i]     = Math.max(0, Math.min(255, Math.round((r - avgBg[0] * (1 - t)) / t)));
              data[i + 1] = Math.max(0, Math.min(255, Math.round((g - avgBg[1] * (1 - t)) / t)));
              data[i + 2] = Math.max(0, Math.min(255, Math.round((b - avgBg[2] * (1 - t)) / t)));
            } else {
              // Very edge — make fully transparent to avoid dark fringe
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
            }
            data[i + 3] = alpha;
          }
          // else: foreground pixel — leave fully opaque
        }
      }

      // Step 4: Cleanup — any pixel with very low alpha becomes fully transparent
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i + 3] < 10) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setImgSrc(canvas.toDataURL("image/png"));
      setMode("preview");
    } catch (err) {
      console.error("Error removing background:", err);
    } finally {
      setProcessing(false);
    }
  }, [imgSrc, tolerance]);

  // Undo
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setImgSrc(prev);
    setMode("preview");
  };

  // Reset
  const reset = () => {
    if (!originalImg) return;
    setHistory((prev) => [...prev, imgSrc]);
    setImgSrc(originalImg.src);
    setMode("preview");
  };

  // ── AI UTILITY FUNCTIONS ──────────────────────────────────────────────────

  const applyWhiteBackground = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.src = src;
  });

  const autoCropToContent = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) { resolve(src); return; }
      const pad = Math.round(Math.min(c.width, c.height) * 0.04);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(c.width, maxX + pad); maxY = Math.min(c.height, maxY + pad);
      const w = maxX - minX, h = maxY - minY;
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      out.getContext("2d").drawImage(c, minX, minY, w, h, 0, 0, w, h);
      resolve(out.toDataURL("image/png"));
    };
    img.src = src;
  });

  const toSquare = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = Math.max(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (size - img.width) / 2, (size - img.height) / 2);
      resolve(c.toDataURL("image/png"));
    };
    img.src = src;
  });

  const adjustImage = (src, brightness = 0, contrast = 0) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.filter = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100})`;
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.src = src;
  });

  const removeBackgroundLocal = (src, tol = 30) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxD = 1200;
      let w = img.width, h = img.height;
      if (w > maxD || h > maxD) { const s = Math.min(maxD / w, maxD / h); w = Math.round(w * s); h = Math.round(h * s); }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const id = ctx.getImageData(0, 0, w, h);
      const data = id.data;
      const ss = Math.max(5, Math.floor(Math.min(w, h) * 0.02));
      const samples = [];
      [[0, ss, 0, ss], [w - ss, w, 0, ss], [0, ss, h - ss, h], [w - ss, w, h - ss, h]].forEach(([x0, x1, y0, y1]) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; samples.push([data[i], data[i + 1], data[i + 2]]); }
      });
      const avg = samples.reduce((a, [r, g, b]) => [a[0] + r, a[1] + g, a[2] + b], [0, 0, 0]).map(v => v / samples.length);
      const std = Math.sqrt(samples.reduce((a, [r, g, b]) => a + (r - avg[0]) ** 2 + (g - avg[1]) ** 2 + (b - avg[2]) ** 2, 0) / samples.length / 3);
      const threshold = Math.max(20, Math.min(80, std * 3 + tol));
      const floodT = threshold * 1.5;
      const dist = i => Math.sqrt((data[i] - avg[0]) ** 2 + (data[i + 1] - avg[1]) ** 2 + (data[i + 2] - avg[2]) ** 2);
      const visited = new Uint8Array(w * h), isBg = new Uint8Array(w * h), queue = [];
      for (let x = 0; x < w; x++) {
        [x, (h - 1) * w + x].forEach(p => { if (!visited[p] && dist(p * 4) < floodT) { visited[p] = 1; queue.push(p); } });
      }
      for (let y = 0; y < h; y++) {
        [y * w, y * w + w - 1].forEach(p => { if (!visited[p] && dist(p * 4) < floodT) { visited[p] = 1; queue.push(p); } });
      }
      let head = 0;
      while (head < queue.length) {
        const pos = queue[head++]; isBg[pos] = 1;
        const x = pos % w, y = (pos - x) / w;
        [[pos - 1, x > 0], [pos + 1, x < w - 1], [pos - w, y > 0], [pos + w, y < h - 1]].forEach(([n, ok]) => {
          if (ok && !visited[n]) { visited[n] = 1; if (dist(n * 4) < floodT) queue.push(n); }
        });
      }
      const outerT = threshold * 2;
      for (let pos = 0; pos < w * h; pos++) {
        const i = pos * 4;
        if (isBg[pos]) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; }
        else {
          const d = dist(i);
          if (d < outerT) {
            const t = Math.pow(Math.max(0, (d - threshold) / (outerT - threshold)), 0.8);
            data[i + 3] = Math.round(t * 255);
            if (t > 0.1) {
              data[i] = Math.max(0, Math.min(255, Math.round((data[i] - avg[0] * (1 - t)) / t)));
              data[i + 1] = Math.max(0, Math.min(255, Math.round((data[i + 1] - avg[1] * (1 - t)) / t)));
              data[i + 2] = Math.max(0, Math.min(255, Math.round((data[i + 2] - avg[2] * (1 - t)) / t)));
            } else { data[i] = data[i + 1] = data[i + 2] = 0; }
          }
        }
      }
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0 && data[i + 3] < 10) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; }
      ctx.putImageData(id, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

  const removeBackgroundHF = async (src, token) => {
    const blob = await (await fetch(src)).blob();
    const res = await fetch("https://api-inference.huggingface.co/models/briaai/RMBG-1.4", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: blob,
    });
    if (!res.ok) throw new Error(`HF ${res.status}`);
    const outBlob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(outBlob);
    });
  };

  const parsePrompt = (prompt) => {
    const p = prompt.toLowerCase();
    const ops = [];
    const hasBg = /quitar fondo|remove.?bg|eliminar fondo|sin fondo|transparent/.test(p);
    const hasWhite = /fondo blanco|white.?back|white.?bg|tienda|ecommerce|e-commerce|web|producto/.test(p);
    const hasCrop = /recort|crop|cortar/.test(p);
    const hasSquare = /cuadrad|square/.test(p);
    const hasCenter = /centr|center|padding/.test(p);
    const hasBright = /brill|bright/.test(p);
    const hasContrast = /contras/.test(p);
    if (hasBg || hasWhite) ops.push("removeBg");
    if (hasWhite) ops.push("whiteBg");
    if (hasCrop || hasWhite || hasCenter) ops.push("autoCrop");
    if (hasSquare || hasWhite) ops.push("toSquare");
    if (hasBright) ops.push("brightness");
    if (hasContrast) ops.push("contrast");
    return ops.length ? ops : ["removeBg", "whiteBg", "autoCrop", "toSquare"];
  };

  // ── STUDIO LIGHTING + SHADOW ──────────────────────────────────────────
  const applyStudioLighting = async () => {
    if (!imgSrc || aiProcessing) return;
    setAiProcessing(true);
    setAiResult(null);
    setHistory((prev) => [...prev, imgSrc]);
    try {
      // Step 1: Remove background with AI
      setAiProgress("Cargando modelo de IA...");
      const { removeBackground: removeBgPro } = await import("@imgly/background-removal");

      setAiProgress("Eliminando fondo con IA...");
      const blob = await (await fetch(imgSrc)).blob();
      const resultBlob = await removeBgPro(blob, {
        progress: (key) => {
          if (key === "compute:inference") setAiProgress("Procesando imagen con IA...");
        },
      });

      const noBgSrc = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(resultBlob);
      });

      // Step 2: Auto-crop to content
      setAiProgress("Recortando producto...");
      const cropped = await autoCropToContent(noBgSrc);

      // Step 3: Apply studio lighting, shadow, and pro background
      setAiProgress("Aplicando iluminación de estudio...");
      const final = await applyStudioEffect(cropped);

      setImgSrc(final);
      setMode("preview");
      setAiResult("success");
      setAiProgress("");
    } catch (err) {
      console.error("Studio lighting error:", err);
      setAiResult("error");
      setAiProgress("");
    } finally {
      setAiProcessing(false);
    }
  };

  const applyStudioEffect = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Target: square canvas with padding around the product
      const pad = 0.12; // 12% padding on each side
      const size = Math.round(Math.max(img.width, img.height) * (1 + pad * 2));
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");

      // ── Background: subtle gradient (light gray top → white bottom) ──
      const bgGrad = ctx.createLinearGradient(0, 0, 0, size);
      bgGrad.addColorStop(0, "#f0f0f2");
      bgGrad.addColorStop(0.5, "#f8f8fa");
      bgGrad.addColorStop(1, "#ffffff");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // ── Position product in center ──
      const prodX = (size - img.width) / 2;
      const prodY = (size - img.height) / 2;

      // ── Shadow: elliptical shadow beneath the product ──
      const shadowCenterX = size / 2;
      const shadowCenterY = prodY + img.height - img.height * 0.02; // At the bottom of the product
      const shadowWidth = img.width * 0.7;
      const shadowHeight = img.height * 0.06;

      ctx.save();
      ctx.translate(shadowCenterX, shadowCenterY);
      ctx.scale(shadowWidth / shadowHeight, 1);
      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowHeight);
      shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.18)");
      shadowGrad.addColorStop(0.5, "rgba(0, 0, 0, 0.08)");
      shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, shadowHeight, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Draw the product ──
      ctx.drawImage(img, prodX, prodY);

      // ── Lighting: top-down soft light overlay ──
      // Simulates a studio softbox from the top
      const lightGrad = ctx.createLinearGradient(0, prodY, 0, prodY + img.height);
      lightGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      lightGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.04)");
      lightGrad.addColorStop(0.7, "rgba(0, 0, 0, 0)");
      lightGrad.addColorStop(1, "rgba(0, 0, 0, 0.06)");

      // Apply the light only over the product pixels using destination-atop composite
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      // We need to re-draw product + overlay only on product area
      ctx.restore();

      // Instead, use a temp canvas to composite the lighting on the product only
      const tempC = document.createElement("canvas");
      tempC.width = img.width;
      tempC.height = img.height;
      const tCtx = tempC.getContext("2d");
      tCtx.drawImage(img, 0, 0);

      // Draw the lighting gradient only where the product is visible (alpha > 0)
      tCtx.globalCompositeOperation = "source-atop";
      const tGrad = tCtx.createLinearGradient(0, 0, 0, img.height);
      tGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      tGrad.addColorStop(0.3, "rgba(255, 255, 255, 0.05)");
      tGrad.addColorStop(0.65, "rgba(0, 0, 0, 0)");
      tGrad.addColorStop(1, "rgba(0, 0, 0, 0.07)");
      tCtx.fillStyle = tGrad;
      tCtx.fillRect(0, 0, img.width, img.height);

      // Add a very subtle side highlight (simulating rim light from top-right)
      const rimGrad = tCtx.createLinearGradient(img.width, 0, 0, img.height);
      rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      rimGrad.addColorStop(0.3, "rgba(255, 255, 255, 0.02)");
      rimGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      tCtx.fillStyle = rimGrad;
      tCtx.fillRect(0, 0, img.width, img.height);

      tCtx.globalCompositeOperation = "source-over";

      // Draw the lit product onto the main canvas (over the shadow)
      // Clear the original product area and redraw with lighting
      ctx.clearRect(prodX, prodY, img.width, img.height);
      // Redraw background in that area
      ctx.fillStyle = bgGrad;
      ctx.fillRect(prodX, prodY, img.width, img.height);
      // Redraw shadow (it's behind the product so we need to redo it)
      ctx.save();
      ctx.translate(shadowCenterX, shadowCenterY);
      ctx.scale(shadowWidth / shadowHeight, 1);
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, shadowHeight, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Draw lit product
      ctx.drawImage(tempC, prodX, prodY);

      // ── Floor reflection: very subtle ──
      const reflC = document.createElement("canvas");
      reflC.width = img.width;
      reflC.height = Math.round(img.height * 0.15);
      const rCtx = reflC.getContext("2d");
      rCtx.save();
      rCtx.translate(0, reflC.height);
      rCtx.scale(1, -1);
      rCtx.drawImage(tempC, 0, img.height - reflC.height, img.width, reflC.height, 0, 0, img.width, reflC.height);
      rCtx.restore();
      rCtx.globalCompositeOperation = "destination-in";
      const reflGrad = rCtx.createLinearGradient(0, 0, 0, reflC.height);
      reflGrad.addColorStop(0, "rgba(0,0,0,0.06)");
      reflGrad.addColorStop(1, "rgba(0,0,0,0)");
      rCtx.fillStyle = reflGrad;
      rCtx.fillRect(0, 0, reflC.width, reflC.height);

      const reflY = prodY + img.height;
      if (reflY + reflC.height <= size) {
        ctx.drawImage(reflC, prodX, reflY);
      }

      resolve(c.toDataURL("image/png"));
    };
    img.src = src;
  });

  // ── ONE-CLICK "FORMATO TIENDA" ─────────────────────────────────────────
  const formatoTienda = async () => {
    if (!imgSrc || aiProcessing) return;
    setAiProcessing(true);
    setAiResult(null);
    setHistory((prev) => [...prev, imgSrc]);
    try {
      // Step 1: Professional background removal with @imgly/background-removal
      setAiProgress("Cargando modelo de IA...");
      const { removeBackground: removeBgPro } = await import("@imgly/background-removal");

      setAiProgress("Eliminando fondo con IA profesional...");
      const blob = await (await fetch(imgSrc)).blob();
      const resultBlob = await removeBgPro(blob, {
        progress: (key, current, total) => {
          if (key === "compute:inference") {
            setAiProgress("Procesando imagen con IA...");
          }
        },
      });

      // Convert result blob to data URL
      const noBgSrc = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(resultBlob);
      });

      // Step 2: Auto-crop to content
      setAiProgress("Recortando producto...");
      const cropped = await autoCropToContent(noBgSrc);

      // Step 3: White background
      setAiProgress("Aplicando fondo blanco...");
      const withWhiteBg = await applyWhiteBackground(cropped);

      // Step 4: Square format centered
      setAiProgress("Formato cuadrado centrado...");
      const final = await toSquare(withWhiteBg);

      setImgSrc(final);
      setMode("preview");
      setAiResult("success");
      setAiProgress("");
    } catch (err) {
      console.error("Formato tienda error:", err);
      setAiResult("error");
      setAiProgress("");
    } finally {
      setAiProcessing(false);
    }
  };

  // Save result
  const handleSave = useCallback(async () => {
    if (!imgSrc) return;
    setProcessing(true);
    try {
      const response = await fetch(imgSrc);
      const blob = await response.blob();
      const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".png"), {
        type: "image/png",
      });
      onSave(editedFile);
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setProcessing(false);
    }
  }, [imgSrc, file, onSave]);

  if (!imgSrc) {
    return (
      <div className={styles.overlay}>
        <div className={styles.editor}>
          <div className={styles.loading}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <span>Cargando imagen...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.editor}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>Editor de Imagen</h3>
          <button className={styles.closeBtn} onClick={onCancel}>
            <HiOutlineXMark />
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button
            className={`${styles.toolBtn} ${mode === "crop" ? styles.toolActive : ""}`}
            onClick={() => {
              setMode(mode === "crop" ? "preview" : "crop");
              setCropStart(null);
              setCropEnd(null);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/></svg>
            Recortar
          </button>
          <button
            className={`${styles.toolBtn} ${mode === "removebg" ? styles.toolActive : ""}`}
            onClick={removeBackground}
            disabled={processing}
          >
            {processing ? (
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18" strokeDasharray="3 3"/></svg>
            )}
            Quitar Fondo
          </button>

          <div className={styles.toleranceControl}>
            <label className={styles.toleranceLabel}>Tolerancia: {tolerance}</label>
            <input 
              type="range" 
              min="5" 
              max="100" 
              value={tolerance} 
              onChange={(e) => setTolerance(parseInt(e.target.value))}
              className={styles.toleranceSlider}
              disabled={processing}
            />
          </div>
          <div className={styles.toolSeparator} />
          <button
            className={styles.toolBtn}
            onClick={reset}
            disabled={imgSrc === originalImg?.src}
          >
            <HiOutlineArrowUturnLeft />
            Reiniciar
          </button>
          <div className={styles.toolSeparator} />
          <button
            className={styles.toolBtn}
            onClick={undo}
            disabled={history.length === 0}
          >
            <HiOutlineArrowUturnLeft />
            Deshacer
          </button>
        </div>

        {/* AI Action Buttons */}
        <div className={styles.aiPanel}>
          <div className={styles.aiButtonsRow}>
            <button
              className={styles.formatoTiendaBtn}
              onClick={formatoTienda}
              disabled={aiProcessing || processing}
            >
              {aiProcessing ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  <span>{aiProgress || "Procesando..."}</span>
                </>
              ) : (
                <>
                  <span className={styles.formatoTiendaIcon}>✨</span>
                  <span>Formato Tienda</span>
                  <span className={styles.formatoTiendaSub}>IA · 1 clic</span>
                </>
              )}
            </button>
            <button
              className={styles.studioBtn}
              onClick={applyStudioLighting}
              disabled={aiProcessing || processing}
            >
              {aiProcessing ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  <span>{aiProgress || "Procesando..."}</span>
                </>
              ) : (
                <>
                  <span className={styles.formatoTiendaIcon}>💡</span>
                  <span>Iluminación Estudio</span>
                  <span className={styles.formatoTiendaSub}>IA + Sombra</span>
                </>
              )}
            </button>
          </div>
          {aiResult === "success" && <p className={styles.aiSuccess}>✅ ¡Imagen lista! Revisa el resultado.</p>}
          {aiResult === "error" && <p className={styles.aiError}>❌ Error al procesar. Intenta de nuevo.</p>}
        </div>

        {/* Canvas */}
        <div className={styles.canvasWrapper}>
          {mode === "crop" && (
            <p className={styles.hint}>Dibuja un rectángulo sobre la zona que deseas conservar</p>
          )}
          <div className={styles.checkerboard}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              style={{ cursor: mode === "crop" ? "crosshair" : "default" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          {mode === "crop" && cropStart && cropEnd && (
            <button className={styles.applyBtn} onClick={applyCrop}>
              <HiOutlineCheck /> Aplicar Recorte
            </button>
          )}
          <button className={styles.saveBtn} onClick={handleSave} disabled={processing}>
            {processing ? "Procesando..." : "Usar Imagen"}
          </button>
        </div>
      </div>
    </div>
  );
}
