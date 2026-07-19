import { inkFromLuminance, luminanceFromRgb, type InkMode } from "@/lib/ink-scheme";

const DB_NAME = "asin-lens-bg";
const STORE = "images";
const KEY = "custom-bg";
const META_KEY = "asin-lens-custom-bg-meta";

export type CustomBgMeta = {
  ink: InkMode;
  name: string;
  updatedAt: number;
  luma: number;
};

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const MAX_BYTES = 1_200_000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbPut(blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
    tx.objectStore(STORE).put(blob, KEY);
  });
  db.close();
}

async function idbGet(): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("idb get failed"));
  });
  db.close();
  return blob;
}

async function idbDelete() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb delete failed"));
    tx.objectStore(STORE).delete(KEY);
  });
  db.close();
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    img.src = url;
  });
}

/** Compress + sample upper band luminance for ink. */
export async function processCustomBackground(file: File): Promise<{
  blob: Blob;
  meta: CustomBgMeta;
  objectUrl: string;
}> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片文件（JPG / PNG / WEBP）");
  }
  if (file.size > 12_000_000) {
    throw new Error("图片过大，请选择 12MB 以内的文件");
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("浏览器不支持画布分析");

  ctx.drawImage(img, 0, 0, w, h);

  // Sample top 40% (where titles/quotes sit) for contrast decision
  const sampleH = Math.max(1, Math.floor(h * 0.4));
  const data = ctx.getImageData(0, 0, w, sampleH).data;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  const step = 16 * 4;
  for (let i = 0; i < data.length; i += step) {
    rSum += data[i]!;
    gSum += data[i + 1]!;
    bSum += data[i + 2]!;
    count += 1;
  }
  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;
  const luma = luminanceFromRgb(r, g, b);
  const ink = inkFromLuminance(luma);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("图片压缩失败"));
          return;
        }
        if (result.size > MAX_BYTES) {
          canvas.toBlob(
            (retry) => {
              if (!retry) reject(new Error("图片过大，请换一张"));
              else resolve(retry);
            },
            "image/jpeg",
            0.55,
          );
          return;
        }
        resolve(result);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const meta: CustomBgMeta = {
    ink,
    name: file.name.slice(0, 80),
    updatedAt: Date.now(),
    luma: Math.round(luma * 1000) / 1000,
  };

  await idbPut(blob);
  writeCustomBgMeta(meta);
  const objectUrl = URL.createObjectURL(blob);
  return { blob, meta, objectUrl };
}

export function writeCustomBgMeta(meta: CustomBgMeta | null) {
  if (!meta) {
    localStorage.removeItem(META_KEY);
    return;
  }
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function readCustomBgMeta(): CustomBgMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomBgMeta>;
    if (parsed.ink !== "light" && parsed.ink !== "dark") return null;
    if (typeof parsed.name !== "string") return null;
    return {
      ink: parsed.ink,
      name: parsed.name,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      luma: typeof parsed.luma === "number" ? parsed.luma : 0.5,
    };
  } catch {
    return null;
  }
}

export async function loadCustomBackgroundUrl(): Promise<string | null> {
  const blob = await idbGet();
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function clearCustomBackground() {
  await idbDelete();
  writeCustomBgMeta(null);
}

/** Paint custom image onto document CSS hooks. */
export function applyCustomBackgroundUrl(url: string | null) {
  const root = document.documentElement;
  if (!url) {
    root.dataset.bgSource = "builtin";
    root.style.removeProperty("--camp-image");
    root.style.removeProperty("--custom-full-bg");
    return;
  }
  root.dataset.bgSource = "custom";
  root.style.setProperty("--camp-image", `url("${url}")`);
  root.style.setProperty("--custom-full-bg", `url("${url}")`);
}
