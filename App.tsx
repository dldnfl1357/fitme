import { StatusBar } from 'expo-status-bar';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BodyModel3D from './BodyModel3D';

type Measurements = {
  height: string;
  weight: string;
  shoulder: string;
  chest: string;
  waist: string;
  hip: string;
  inseam: string;
  arm: string;
};

type MeasurementKey = keyof Measurements;
type PhotoRole = 'face' | 'body';

type BodyType = '슬림' | '균형' | '하체 발달' | '상체 발달';

type FaceAnalysis = {
  confidence: number;
  ratio: number;
  fullness: number;
  widthAtForehead: number;
  widthAtJaw: number;
  jawSharpness: number;
};

type BodyProfile = {
  bodyType: BodyType;
  confidence: number;
  faceAnalysis: FaceAnalysis;
};

type Garment = {
  id: string;
  brand: string;
  name: string;
  price: string;
  category: 'Top' | 'Bottom' | 'Outer';
  color: string;
  accent: string;
  imageTone: string;
  sizes: {
    label: string;
    chest?: number;
    shoulder?: number;
    waist?: number;
    hip?: number;
    length: number;
  }[];
};

const initialMeasurements: Measurements = {
  height: '168',
  weight: '58',
  shoulder: '',
  chest: '',
  waist: '',
  hip: '',
  inseam: '',
  arm: '',
};

const garments: Garment[] = [
  {
    id: 'novel-shirt',
    brand: 'Aderline',
    name: 'Crisp Poplin Shirt',
    price: 'KRW 129,000',
    category: 'Top',
    color: '#0F172A',
    accent: '#69D2C8',
    imageTone: '#E9F8F6',
    sizes: [
      { label: 'XS', chest: 88, shoulder: 38, length: 62 },
      { label: 'S', chest: 94, shoulder: 40, length: 65 },
      { label: 'M', chest: 100, shoulder: 42, length: 68 },
      { label: 'L', chest: 106, shoulder: 44, length: 71 },
    ],
  },
  {
    id: 'curve-denim',
    brand: 'Nohant Fit',
    name: 'Curve Straight Denim',
    price: 'KRW 158,000',
    category: 'Bottom',
    color: '#1D4ED8',
    accent: '#FFB84D',
    imageTone: '#EDF4FF',
    sizes: [
      { label: '24', waist: 66, hip: 90, length: 98 },
      { label: '26', waist: 70, hip: 94, length: 100 },
      { label: '28', waist: 74, hip: 98, length: 101 },
      { label: '30', waist: 78, hip: 102, length: 103 },
    ],
  },
  {
    id: 'city-blazer',
    brand: 'Mitte',
    name: 'Soft Structure Blazer',
    price: 'KRW 248,000',
    category: 'Outer',
    color: '#3B2F2F',
    accent: '#F45D48',
    imageTone: '#FFF1EE',
    sizes: [
      { label: 'S', chest: 96, shoulder: 40, length: 67 },
      { label: 'M', chest: 102, shoulder: 42, length: 70 },
      { label: 'L', chest: 108, shoulder: 44, length: 73 },
    ],
  },
];

const fields: {
  key: MeasurementKey;
  label: string;
  unit: string;
  required?: boolean;
  guide: string;
}[] = [
  {
    key: 'height',
    label: '키',
    unit: 'cm',
    required: true,
    guide: '신발을 벗고 벽에 등을 붙인 상태에서 정수리부터 바닥까지 잽니다.',
  },
  {
    key: 'weight',
    label: '몸무게',
    unit: 'kg',
    required: true,
    guide: '가벼운 옷차림으로 체중계에 올라 현재 몸무게를 입력합니다.',
  },
  {
    key: 'shoulder',
    label: '어깨',
    unit: 'cm',
    guide: '왼쪽 어깨 끝 뼈부터 오른쪽 어깨 끝 뼈까지 등을 따라 수평으로 잽니다.',
  },
  {
    key: 'chest',
    label: '가슴',
    unit: 'cm',
    guide: '겨드랑이 아래를 지나 가슴의 가장 넓은 부분을 한 바퀴 둘러 잽니다.',
  },
  {
    key: 'waist',
    label: '허리',
    unit: 'cm',
    guide: '허리에서 가장 잘록한 지점을 숨을 편하게 쉰 상태로 한 바퀴 잽니다.',
  },
  {
    key: 'hip',
    label: '엉덩이',
    unit: 'cm',
    guide: '엉덩이에서 가장 넓게 튀어나온 지점을 수평으로 한 바퀴 잽니다.',
  },
  {
    key: 'inseam',
    label: '인심',
    unit: 'cm',
    guide: '다리 안쪽 시작점부터 발목 복숭아뼈 아래까지 안쪽 라인을 따라 잽니다.',
  },
  {
    key: 'arm',
    label: '팔길이',
    unit: 'cm',
    guide: '어깨 끝에서 팔꿈치를 지나 손목뼈까지 팔 바깥 라인을 따라 잽니다.',
  },
];

const preferences = ['타이트', '정핏', '여유', '오버핏'];
const optionalMeasurementKeys: MeasurementKey[] = ['shoulder', 'chest', 'waist', 'hip', 'inseam', 'arm'];
const BODY_TYPE_FACTORS: Record<
  string,
  { shoulder: number; chest: number; waist: number; hip: number; inseam: number; arm: number }
> = {
  슬림: { shoulder: -1.2, chest: -2.8, waist: -4.2, hip: -3.0, inseam: -0.8, arm: -1.0 },
  균형: { shoulder: 0, chest: 0, waist: 0, hip: 0, inseam: 0, arm: 0 },
  '하체 발달': { shoulder: -0.6, chest: 1.0, waist: 3.2, hip: 5.2, inseam: 0.9, arm: 0 },
  '상체 발달': { shoulder: 1.4, chest: 3.2, waist: 2.0, hip: 1.3, inseam: -0.4, arm: 0.4 },
};

const DEFAULT_FACE_ANALYSIS: FaceAnalysis = {
  confidence: 0.2,
  ratio: 1.08,
  fullness: 0.5,
  widthAtForehead: 1,
  widthAtJaw: 1,
  jawSharpness: 0,
};

const DEFAULT_BODY_PROFILE: BodyProfile = {
  bodyType: '균형',
  confidence: 0,
  faceAnalysis: DEFAULT_FACE_ANALYSIS,
};

const FACE_SIGNAL_BASELINE = {
  ratio: 1.08,
  fullness: 0.5,
  jawSharpness: 0,
};

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MEDIAPIPE_FACE_LANDMARKER_TASK_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type FaceLandmarkerInstance = FaceLandmarker | null;

let faceLandmarkerPromise: Promise<FaceLandmarkerInstance> | null = null;

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
}

function normalize01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getCanvasImage(uri: string): Promise<HTMLImageElement> {
  if (typeof window === 'undefined') return Promise.reject(new Error('not-web'));

  const env = globalThis as any;
  const ImageCtor = env.Image;
  if (!ImageCtor) return Promise.reject(new Error('no-image'));

  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image-load-failed'));
    image.crossOrigin = 'anonymous';
    image.src = uri;
  });
}

function spreadForYBand(points: { x: number; y: number; z: number }[], minY: number, maxY: number) {
  const rows = points.filter((point) => point.y >= minY && point.y <= maxY);
  if (!rows.length) return 0;
  let minX = 1;
  let maxX = 0;
  for (const point of rows) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
  }
  return Math.max(0, maxX - minX);
}

function clampLandmarkSpan(span: number, fallback: number) {
  return span > 0 && Number.isFinite(span) ? span : fallback;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function getFaceBodyBias(faceAnalysis: FaceAnalysis) {
  const influence = clampNumber((faceAnalysis.confidence - 0.3) / 0.6, 0, 1);
  const ratioBias = clampNumber((faceAnalysis.ratio - FACE_SIGNAL_BASELINE.ratio) / 0.32, -1, 1) * influence;
  const fullnessBias = clampNumber((faceAnalysis.fullness - FACE_SIGNAL_BASELINE.fullness) * 2, -1, 1) * influence;
  const jawBias = clampNumber(faceAnalysis.jawSharpness - FACE_SIGNAL_BASELINE.jawSharpness, -1, 1) * influence;

  return {
    influence,
    ratioBias,
    fullnessBias,
    jawBias,
  };
}

async function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_TASK_URL,
            delegate: 'CPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'IMAGE',
          minFaceDetectionConfidence: 0.6,
          minTrackingConfidence: 0.45,
          numFaces: 1,
        } as any) as Promise<FaceLandmarker>;
      } catch (error) {
        faceLandmarkerPromise = null;
        return null;
      }
    })();
  }

  return faceLandmarkerPromise;
}

async function analyzeFaceImageWithMediaPipe(uri: string): Promise<FaceAnalysis> {
  try {
    const landmarker = await getFaceLandmarker();
    if (!landmarker) return DEFAULT_FACE_ANALYSIS;

    const image = await getCanvasImage(uri);
    const result = (await landmarker.detect(image)) as {
      faceLandmarks?: { x: number; y: number; z: number }[][];
      faceDetections?: { categories?: { score: number }[] }[];
    };

    const landmarks = result?.faceLandmarks?.[0];
    if (!landmarks || !landmarks.length) return DEFAULT_FACE_ANALYSIS;

    const xs = landmarks.map((point) => point.x);
    const ys = landmarks.map((point) => point.y);
    const zs = landmarks.map((point) => point.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bboxWidth = maxX - minX;
    const bboxHeight = Math.max(0.0001, maxY - minY);
    const forehead = spreadForYBand(landmarks, 0.08, 0.22);
    const cheek = spreadForYBand(landmarks, 0.38, 0.58);
    const jaw = spreadForYBand(landmarks, 0.70, 0.90);

    const widthAtForehead = clampLandmarkSpan(forehead, bboxWidth * 0.65);
    const widthAtJaw = clampLandmarkSpan(jaw, Math.max(widthAtForehead * 0.4, bboxWidth * 0.32));
    const widthAtCheek = clampLandmarkSpan(cheek, (widthAtForehead + widthAtJaw) * 0.55);

    const widthRatio = clampNumber((bboxWidth / bboxHeight) * 1.35, 0.65, 1.8);
    const fullness = clampNumber(
      clampLandmarkSpan((widthAtCheek / Math.max(0.0001, widthAtForehead)) - 0.72, 0) * 1.6,
      0,
      1,
    );
    const jawSharpness = clampNumber((widthAtJaw / Math.max(0.0001, widthAtForehead) - 0.8) * 3.1, -1, 1);
    const depthEntropy = average(zs.map((value) => Math.abs(value)));
    const baseConfidence = result?.faceDetections?.[0]?.categories?.[0]?.score ?? 0.75;

    return {
      confidence: clampNumber(normalize01(baseConfidence) * 0.75 + normalize01(clampNumber(depthEntropy * 3.2, 0, 1)) * 0.25, 0, 1),
      ratio: widthRatio,
      fullness: clampNumber(fullness + Math.max(0, depthEntropy - 0.32) * 0.35, 0, 1),
      widthAtForehead: Math.max(1, Math.round(widthAtForehead * 1000)),
      widthAtJaw: Math.max(1, Math.round(widthAtJaw * 1000)),
      jawSharpness,
    };
  } catch {
    return DEFAULT_FACE_ANALYSIS;
  }
}

function isSkinPixel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  if (max < 45 || max > 250) return false;
  if (diff < 10) return false;
  if (r <= g || b > g + 22) return false;
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (cr < 130 || cr > 172) return false;
  if (cb < 77 || cb > 127) return false;
  return y > 55 && y < 240;
}

async function analyzeFaceImage(uri: string): Promise<FaceAnalysis> {
  if (typeof window === 'undefined') return DEFAULT_FACE_ANALYSIS;

  const mpAnalysis = await analyzeFaceImageWithMediaPipe(uri);
  if (mpAnalysis.confidence >= 0.35) {
    return mpAnalysis;
  }

  return analyzeFaceImageWithSkin(uri);
}

function analyzeFaceImageWithSkin(uri: string): Promise<FaceAnalysis> {
  if (typeof window === 'undefined') return Promise.resolve(DEFAULT_FACE_ANALYSIS);

  const env = globalThis as any;
  const ImageCtor = env.Image;
  if (!ImageCtor || !env.document) return Promise.resolve(DEFAULT_FACE_ANALYSIS);

  return new Promise((resolve) => {
    const image = new ImageCtor();
    image.onload = () => {
      try {
        const canvas = env.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(DEFAULT_FACE_ANALYSIS);
          return;
        }

        const width = Math.max(1, Number(image.naturalWidth || image.width || 0));
        const height = Math.max(1, Number(image.naturalHeight || image.height || 0));
        const side = Math.max(width, height);
        const scale = Math.min(1, 320 / side);
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const cropW = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) * 0.82));
        const cropH = Math.max(1, Math.floor(cropW * 1.18));
        const sx = Math.max(0, Math.floor((canvas.width - cropW) / 2));
        const sy = Math.max(0, Math.floor((canvas.height - cropH) / 3));

        if (sx + cropW > canvas.width || sy + cropH > canvas.height) {
          resolve(DEFAULT_FACE_ANALYSIS);
          return;
        }

        const imageData = context.getImageData(sx, sy, cropW, cropH);
        const pixels = imageData.data;
        const rowWidths = new Array(cropH).fill(0);
        let minX = cropW;
        let maxX = -1;
        let minY = cropH;
        let maxY = -1;
        let skinCount = 0;

        for (let y = 0; y < cropH; y += 1) {
          let left = cropW;
          let right = -1;
          for (let x = 0; x < cropW; x += 1) {
            const idx = (y * cropW + x) * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;
            if (isSkinPixel(r, g, b)) {
              skinCount += 1;
              left = Math.min(left, x);
              right = Math.max(right, x);
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
          rowWidths[y] = right >= left ? right - left + 1 : 0;
        }

        if (skinCount < Math.max(200, cropW * 0.04) || maxX < 0 || maxY < 0) {
          resolve(DEFAULT_FACE_ANALYSIS);
          return;
        }

        const rowDensity = rowWidths.filter((width) => width > 0).length / cropH;
        const bboxWidth = maxX - minX + 1;
        const bboxHeight = maxY - minY + 1;

        if (bboxWidth < 10 || bboxHeight < 8) {
          resolve(DEFAULT_FACE_ANALYSIS);
          return;
        }

        const widthAt = (ratio: number) => {
          const baseY = Math.max(0, Math.min(cropH - 1, Math.round(cropH * ratio)));
          const sampleRows = [baseY - 1, baseY, baseY + 1].map(
            (row) => rowWidths[Math.max(0, Math.min(cropH - 1, row))],
          );
          return Math.round(median(sampleRows.filter(Boolean)));
        };

        const forehead = widthAt(0.18);
        const jaw = widthAt(0.72);
        const cheek = widthAt(0.45);
        const faceCountDensity = skinCount / (cropW * cropH);
        const widthRatio = clampNumber(bboxWidth / Math.max(1, bboxHeight), 0.65, 1.8);
        const faceFullness = clampNumber((faceCountDensity - 0.065) * 2.8, 0, 1);
        const jawSharpness = forehead > 0 ? clampNumber((jaw / forehead - 0.85) * 2.8, -1, 1) : 0;
        const confidence = clampNumber(
          0.25 + rowDensity * 0.45 + faceFullness * 0.25 + Math.min(1, cheek / Math.max(1, widthRatio * cropW) * 1.3),
          0,
          1,
        );

        resolve({
          confidence,
          ratio: widthRatio,
          fullness: faceFullness,
          widthAtForehead: Math.max(1, forehead),
          widthAtJaw: Math.max(1, jaw),
          jawSharpness,
        });
      } catch {
        resolve(DEFAULT_FACE_ANALYSIS);
      }
    };

    image.onerror = () => resolve(DEFAULT_FACE_ANALYSIS);
    image.crossOrigin = 'anonymous';
    image.src = uri;
  });
}

function inferBodyProfile(measurements: Measurements, faceAnalysis: FaceAnalysis): BodyProfile {
  const height = clampNumber(toNumber(measurements.height) || 168, 135, 205);
  const weight = clampNumber(toNumber(measurements.weight) || Math.round((height / 100) ** 2 * 21.4), 33, 160);
  const bmi = clampNumber(weight / (height / 100) ** 2, 13.5, 40);
  const bmiShift = (bmi - 21.4) / 14;
  const faceBias = getFaceBodyBias(faceAnalysis);

  const scores: Record<BodyType, number> = {
    슬림:
      1.55 -
      bmiShift * 1.18 -
      faceBias.fullnessBias * 0.48 -
      Math.max(0, faceBias.ratioBias) * 0.38 +
      Math.max(0, -faceBias.ratioBias) * 0.16,
    균형: 1.35 - Math.abs(bmiShift) * 1.28 + (1 - Math.abs(faceBias.fullnessBias)) * 0.16,
    '하체 발달':
      1.05 +
      Math.max(0, bmiShift) * 0.78 +
      faceBias.fullnessBias * 0.46 -
      Math.max(0, faceBias.ratioBias) * 0.18,
    '상체 발달':
      1.08 +
      Math.max(0, bmiShift) * 0.74 +
      faceBias.ratioBias * 0.56 +
      faceBias.jawBias * 0.28 +
      faceBias.fullnessBias * 0.16,
  };

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0]?.[0] as BodyType;
  const nextScore = sorted[1]?.[1] ?? sorted[0]?.[1] ?? 0;
  const confidence =
    clampNumber((sorted[0]?.[1] ?? 0) - nextScore, 0, 1) * 0.42 +
    faceAnalysis.confidence * 0.42 +
    faceBias.influence * 0.16;

  return {
    bodyType: winner ?? '균형',
    confidence: clampNumber(confidence, 0, 1),
    faceAnalysis,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateMeasurements(measurements: Measurements, profile: BodyProfile): Measurements {
  const height = clampNumber(toNumber(measurements.height) || 168, 135, 205);
  const weight = clampNumber(toNumber(measurements.weight) || Math.round((height / 100) ** 2 * 21.4), 33, 160);
  const bmi = clampNumber(weight / (height / 100) ** 2, 13.5, 40);
  const bmiShift = bmi - 21.4;
  const factors = BODY_TYPE_FACTORS[profile.bodyType] ?? BODY_TYPE_FACTORS.균형;
  const faceBias = getFaceBodyBias(profile.faceAnalysis);
  const softMassShift = faceBias.fullnessBias * 2.2;
  const upperFrameShift = faceBias.ratioBias * 1.55 + faceBias.jawBias * 0.45;

  const estimated = {
    height,
    weight,
    shoulder: clampNumber(
      height * 0.225 + bmiShift * 0.55 + factors.shoulder + upperFrameShift * 0.8 + softMassShift * 0.24,
      33,
      52,
    ),
    chest: clampNumber(
      height * 0.5 + weight * 0.05 + bmiShift * 0.95 + factors.chest + upperFrameShift * 0.95 + softMassShift * 0.48,
      74,
      132,
    ),
    waist: clampNumber(
      height * 0.362 + weight * 0.153 + bmiShift * 1.35 + factors.waist + upperFrameShift * 0.28 + softMassShift * 0.76,
      58,
      142,
    ),
    hip: clampNumber(
      height * 0.488 + weight * 0.198 + bmiShift * 1.12 + factors.hip + upperFrameShift * 0.16 + softMassShift * 0.9,
      76,
      148,
    ),
    inseam: clampNumber(height * 0.44 + bmiShift * 0.25 + factors.inseam + softMassShift * 0.08, 60, 112),
    arm: clampNumber(height * 0.34 + bmiShift * 0.18 + factors.arm + upperFrameShift * 0.1, 49, 78),
  };

  return {
    height: String(Math.round(estimated.height)),
    weight: String(Math.round(estimated.weight)),
    shoulder: String(Math.round(estimated.shoulder)),
    chest: String(Math.round(estimated.chest)),
    waist: String(Math.round(estimated.waist)),
    hip: String(Math.round(estimated.hip)),
    inseam: String(Math.round(estimated.inseam)),
    arm: String(Math.round(estimated.arm)),
  };
}

function getEffectiveMeasurements(measurements: Measurements, profile: BodyProfile): Measurements {
  const estimates = estimateMeasurements(measurements, profile);

  return fields.reduce((profile, field) => {
    const entered = toNumber(measurements[field.key]);
    return {
      ...profile,
      [field.key]: entered > 0 ? measurements[field.key] : estimates[field.key],
    };
  }, {} as Measurements);
}

function isEstimated(key: MeasurementKey, measurements: Measurements) {
  return optionalMeasurementKeys.includes(key) && toNumber(measurements[key]) === 0;
}

function getFitScore(effectiveMeasurements: Measurements, garment: Garment, preference: string) {
  const chest = toNumber(effectiveMeasurements.chest);
  const shoulder = toNumber(effectiveMeasurements.shoulder);
  const waist = toNumber(effectiveMeasurements.waist);
  const hip = toNumber(effectiveMeasurements.hip);
  const idealEase = preference === '타이트' ? 3 : preference === '정핏' ? 7 : preference === '여유' ? 11 : 16;

  const scored = garment.sizes.map((size) => {
    const checks = [
      size.chest ? Math.abs(size.chest - chest - idealEase) : null,
      size.shoulder ? Math.abs(size.shoulder - shoulder - 2) * 1.6 : null,
      size.waist ? Math.abs(size.waist - waist - (preference === '타이트' ? 1 : 3)) * 1.4 : null,
      size.hip ? Math.abs(size.hip - hip - (preference === '타이트' ? 2 : 5)) : null,
    ].filter((value): value is number => value !== null);

    const averageDelta = checks.reduce((sum, value) => sum + value, 0) / checks.length;
    return { ...size, score: Math.max(52, Math.round(99 - averageDelta * 7)) };
  });

  return scored.sort((a, b) => b.score - a.score)[0];
}

function fitStatus(delta: number) {
  if (delta < -4) return { label: '타이트', color: '#F45D48' };
  if (delta > 9) return { label: '여유', color: '#2F80ED' };
  return { label: '좋음', color: '#119C83' };
}

export default function App() {
  const [measurements, setMeasurements] = useState(initialMeasurements);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis>(DEFAULT_FACE_ANALYSIS);
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [preference, setPreference] = useState('정핏');
  const [selectedId, setSelectedId] = useState(garments[0].id);
  const [activeGuideKey, setActiveGuideKey] = useState<MeasurementKey>('shoulder');
  const [faceImageUri, setFaceImageUri] = useState<string | null>(null);
  const [bodyImageUri, setBodyImageUri] = useState<string | null>(null);

  const selected = garments.find((garment) => garment.id === selectedId) ?? garments[0];
  const hasCoreInput = toNumber(measurements.height) > 0 && toNumber(measurements.weight) > 0;
  const profile = useMemo(
    () => (hasCoreInput ? inferBodyProfile(measurements, faceAnalysis) : DEFAULT_BODY_PROFILE),
    [faceAnalysis, hasCoreInput, measurements],
  );
  const effectiveMeasurements = useMemo(
    () => getEffectiveMeasurements(measurements, profile),
    [measurements, profile],
  );
  const recommendation = useMemo(
    () => getFitScore(effectiveMeasurements, selected, preference),
    [effectiveMeasurements, selected, preference],
  );

  const chestEase = recommendation.chest ? recommendation.chest - toNumber(effectiveMeasurements.chest) : undefined;
  const waistEase = recommendation.waist ? recommendation.waist - toNumber(effectiveMeasurements.waist) : undefined;
  const hipEase = recommendation.hip ? recommendation.hip - toNumber(effectiveMeasurements.hip) : undefined;
  const shoulderEase = recommendation.shoulder
    ? recommendation.shoulder - toNumber(effectiveMeasurements.shoulder)
    : undefined;

  const measuredOptionalCount = optionalMeasurementKeys.filter((key) => toNumber(measurements[key]) > 0).length;
  const activeGuide = fields.find((field) => field.key === activeGuideKey) ?? fields[2];
  const bodyTypeLabel = !hasCoreInput
    ? '입력 대기'
    : isAnalyzingFace
    ? '얼굴 분석 중'
    : `${profile.bodyType} (${Math.round(profile.confidence * 100)}% 신뢰도)`;

  const updateMeasurement = (key: MeasurementKey, value: string) => {
    setMeasurements((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    if (!faceImageUri) {
      setFaceAnalysis(DEFAULT_FACE_ANALYSIS);
      return;
    }

    setIsAnalyzingFace(true);
    analyzeFaceImage(faceImageUri)
      .then((analysis) => {
        if (!cancelled) setFaceAnalysis(analysis);
      })
      .catch(() => {
        if (!cancelled) setFaceAnalysis(DEFAULT_FACE_ANALYSIS);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzingFace(false);
      });

    return () => {
      cancelled = true;
    };
  }, [faceImageUri]);

  const pickPhoto = async (role: PhotoRole) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('사진 접근 권한 필요', '내 실제 모델을 만들려면 사진 보관함 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: role === 'face' ? [1, 1] : [9, 16],
      quality: 0.92,
    });

    if (result.canceled || !result.assets[0]) return;
    if (role === 'face') setFaceImageUri(result.assets[0].uri);
    else setBodyImageUri(result.assets[0].uri);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>FitMe Studio</Text>
            <Text style={styles.title}>내 몸에 맞춰 입어보기</Text>
          </View>
          <View style={styles.scorePill}>
            <Text style={styles.scoreIcon}>AI</Text>
            <Text style={styles.scoreText}>
              {hasCoreInput ? `기준 입력 완료 (${measuredOptionalCount}/6 직접입력)` : '키·몸무게 입력 필요'}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroGlowSoft} />
          <View style={styles.heroRibbon} />
          <View style={styles.avatarStage}>
            <BodyModel3D
              measurements={effectiveMeasurements}
              garmentColor={selected.color}
              garmentCategory={selected.category}
              faceImageUri={faceImageUri}
              bodyImageUri={bodyImageUri}
            />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.heroLabelWrap}>
              <Text style={styles.heroLabel}>Personal 3D Avatar</Text>
            </View>
            <Text style={styles.heroTitle}>내 체형에 맞춰 입어보는, 사람처럼 보이는 3D 피팅 스튜디오</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{bodyTypeLabel}</Text>
                <Text style={styles.metaLabel}>체형</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{preference}</Text>
                <Text style={styles.metaLabel}>선호 핏</Text>
              </View>
            </View>
            <View style={styles.photoPanel}>
              <PhotoPickerCard
                label="얼굴"
                guide="정면 얼굴"
                imageUri={faceImageUri}
                onPick={() => pickPhoto('face')}
                onClear={() => setFaceImageUri(null)}
              />
              <PhotoPickerCard
                label="전신"
                guide="정면 전신"
                imageUri={bodyImageUri}
                onPick={() => pickPhoto('body')}
                onClear={() => setBodyImageUri(null)}
              />
            </View>
          </View>
        </View>

        <View style={styles.segment}>
          <View style={[styles.segmentButton, styles.segmentButtonActive, { alignItems: 'center', flex: 1 }]}>
            <Text style={styles.segmentTextActive}>핵심 입력 기반 체형 자동 판별</Text>
            <Text style={[styles.segmentTextActive, { color: '#FFFFFF', opacity: 0.95, fontSize: 13, marginTop: 3 }]}>{bodyTypeLabel}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>체형 자동 생성</Text>
          <Text style={styles.sectionHint}>{hasCoreInput ? '키·몸무게 + 얼굴로 자동 추정' : '키·몸무게 입력 필요'}</Text>
        </View>

        <View style={styles.measureGrid}>
          {fields.map((field) => {
            const estimated = isEstimated(field.key, measurements);
            return (
              <Pressable
                key={field.key}
                onPress={() => setActiveGuideKey(field.key)}
                style={[styles.inputCell, activeGuideKey === field.key && styles.inputCellActive]}
              >
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <Text style={[styles.inputBadge, estimated && styles.inputBadgeEstimated]}>
                    {field.required ? '필수' : estimated ? '추정' : '실측'}
                  </Text>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={measurements[field.key]}
                    onChangeText={(value) => updateMeasurement(field.key, value)}
                    onFocus={() => setActiveGuideKey(field.key)}
                    style={styles.input}
                    placeholder={estimated ? effectiveMeasurements[field.key] : ''}
                    placeholderTextColor="#A7ADA3"
                    maxLength={5}
                    selectionColor="#119C83"
                  />
                  <Text style={styles.unit}>{field.unit}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.guidePanel}>
          <View style={styles.guideHeader}>
            <Text style={styles.guideTitle}>{activeGuide.label} 재는 법</Text>
            {!activeGuide.required && <Text style={styles.guideTag}>비워두면 추정</Text>}
          </View>
          <Text style={styles.guideText}>{activeGuide.guide}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>선호 핏</Text>
          <Text style={styles.sectionHint}>추천 사이즈 반영</Text>
        </View>
        <View style={styles.preferenceRow}>
          {preferences.map((item) => (
            <Pressable
              key={item}
              onPress={() => setPreference(item)}
              style={[styles.preferenceButton, preference === item && styles.preferenceButtonActive]}
            >
              <Text style={[styles.preferenceText, preference === item && styles.preferenceTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>브랜드 아이템</Text>
          <Text style={styles.sectionHint}>탭해서 피팅</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productList}>
          {garments.map((garment) => {
            const isSelected = garment.id === selectedId;
            return (
              <Pressable
                key={garment.id}
                onPress={() => setSelectedId(garment.id)}
                style={[styles.productCard, isSelected && styles.productCardActive]}
              >
                <View style={[styles.productVisual, { backgroundColor: garment.imageTone }]}>
                  <View style={[styles.hanger, { backgroundColor: garment.accent }]} />
                  <View style={[styles.garmentShape, { backgroundColor: garment.color }]} />
                </View>
                <Text style={styles.brand}>{garment.brand}</Text>
                <Text style={styles.productName} numberOfLines={2}>
                  {garment.name}
                </Text>
                <Text style={styles.price}>{garment.price}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.fitPanel}>
          <View style={styles.fitHeader}>
            <View>
              <Text style={styles.fitLabel}>AI Fit preview</Text>
              <Text style={styles.fitTitle}>{selected.name}</Text>
            </View>
            <View style={styles.recommendBadge}>
              <Text style={styles.recommendLabel}>추천</Text>
              <Text style={styles.recommendSize}>{recommendation.label}</Text>
            </View>
          </View>

          <View style={styles.confidenceTrack}>
            <View style={[styles.confidenceFill, { width: `${recommendation.score}%` }]} />
          </View>
          <Text style={styles.confidenceText}>예상 만족도 {recommendation.score}%</Text>
            {measuredOptionalCount < optionalMeasurementKeys.length && (
              <Text style={styles.estimateNote}>
                * 표시된 부위는 키·몸무게·얼굴형(비율/윤곽) 기반으로 추정했습니다.
              </Text>
            )}

          <View style={styles.fitRows}>
            {[
              { label: '가슴', value: chestEase, estimated: isEstimated('chest', measurements) },
              { label: '어깨', value: shoulderEase, estimated: isEstimated('shoulder', measurements) },
              { label: '허리', value: waistEase, estimated: isEstimated('waist', measurements) },
              { label: '엉덩이', value: hipEase, estimated: isEstimated('hip', measurements) },
            ]
              .filter((row) => row.value !== undefined)
              .map((row) => {
                const status = fitStatus(row.value ?? 0);
                return (
                  <View key={row.label} style={styles.fitRow}>
                    <Text style={styles.fitPart}>{row.estimated ? `${row.label}*` : row.label}</Text>
                    <View style={styles.fitMeter}>
                      <View
                        style={[
                          styles.fitDot,
                          {
                            backgroundColor: status.color,
                            left: `${Math.min(88, Math.max(6, ((row.value ?? 0) + 8) * 5))}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.fitState, { color: status.color }]}>{status.label}</Text>
                  </View>
                );
              })}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>♡ 저장</Text>
            </Pressable>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>피팅룸에서 보기</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PhotoPickerCard({
  label,
  guide,
  imageUri,
  onPick,
  onClear,
}: {
  label: string;
  guide: string;
  imageUri: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.photoCard}>
      <Pressable onPress={onPick} style={styles.photoPreview}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoAdd}>+</Text>
        )}
      </Pressable>
      <View style={styles.photoTextBlock}>
        <Text style={styles.photoLabel}>{label} 사진</Text>
        <Text style={styles.photoGuide}>{imageUri ? '모델 반영 중' : guide}</Text>
      </View>
      {imageUri && (
        <Pressable onPress={onClear} style={styles.photoClear}>
          <Text style={styles.photoClearText}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F6FF',
  },
  screen: {
    paddingHorizontal: 18,
    paddingBottom: 34,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
    gap: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: {
    color: '#3E58BD',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 4,
  },
  title: {
    color: '#0F1730',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  scorePill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D1DFFF',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scoreIcon: {
    color: '#3E58BD',
    fontSize: 12,
    fontWeight: '900',
  },
  scoreText: {
    color: '#1A2140',
    fontSize: 13,
    fontWeight: '900',
  },
  hero: {
    backgroundColor: '#E9EEFF',
    borderColor: '#D5E3FF',
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 590,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    backgroundColor: '#D9E5FF',
    borderRadius: 140,
    height: 280,
    left: -70,
    opacity: 0.72,
    position: 'absolute',
    top: -56,
    width: 280,
  },
  heroGlowSoft: {
    backgroundColor: '#B8CCFF',
    borderRadius: 160,
    bottom: 6,
    height: 320,
    opacity: 0.26,
    position: 'absolute',
    right: -96,
    width: 260,
  },
  heroRibbon: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    height: 10,
    marginBottom: -6,
    opacity: 0.65,
    position: 'absolute',
    width: '100%',
    zIndex: 2,
  },
  heroCopy: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    marginTop: -1,
    zIndex: 3,
  },
  heroLabelWrap: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(91,101,214,0.12)',
    borderRadius: 999,
    marginBottom: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  heroLabel: {
    color: '#3E58BD',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#121A32',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 33,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  metaItem: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8FF',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  metaLabel: {
    color: '#667186',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  photoPanel: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  photoCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D3E1FF',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    minHeight: 62,
    padding: 8,
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: '#EEF1EA',
    borderRadius: 9,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  photoImage: {
    height: '100%',
    width: '100%',
  },
  photoAdd: {
    color: '#3E58BD',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  photoTextBlock: {
    flex: 1,
    paddingHorizontal: 10,
  },
  photoLabel: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  photoGuide: {
    color: '#72766D',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  photoClear: {
    alignItems: 'center',
    backgroundColor: '#5B65D6',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  photoClearText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  avatarStage: {
    alignItems: 'center',
    backgroundColor: '#E9F8F6',
    justifyContent: 'center',
    minHeight: 420,
    width: '100%',
  },
  shoulderLine: {
    backgroundColor: '#111827',
    borderRadius: 999,
    height: 12,
    marginBottom: 8,
  },
  torso: {
    alignItems: 'center',
    backgroundColor: '#69D2C8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 86,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  waistLine: {
    backgroundColor: '#119C83',
    borderRadius: 999,
    height: 11,
  },
  hipLine: {
    backgroundColor: '#FFB84D',
    borderRadius: 999,
    height: 15,
    marginTop: -2,
  },
  legs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 7,
  },
  leg: {
    backgroundColor: '#111827',
    borderRadius: 999,
    height: 50,
    width: 18,
  },
  segment: {
    backgroundColor: '#DBE6FF',
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 16,
    padding: 5,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmentButtonActive: {
    backgroundColor: '#5B65D6',
  },
  segmentText: {
    color: '#60665D',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#0F1730',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionHint: {
    color: '#72766D',
    fontSize: 12,
    fontWeight: '800',
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputCell: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E3FF',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    width: '48.5%',
  },
  inputCellActive: {
    borderColor: '#3E58BD',
    borderWidth: 2,
    padding: 11,
  },
  inputLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
    color: '#5F6888',
    fontSize: 12,
    fontWeight: '800',
  },
  inputBadge: {
    backgroundColor: '#EEF1EA',
    borderRadius: 999,
    color: '#60665D',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  inputBadgeEstimated: {
    backgroundColor: '#FFF1D8',
    color: '#A76700',
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  input: {
    color: '#111827',
    flex: 1,
    fontSize: 21,
    fontWeight: '900',
    padding: 0,
  },
  unit: {
    color: '#3E58BD',
    fontSize: 12,
    fontWeight: '900',
  },
  guidePanel: {
    backgroundColor: '#17254C',
    borderRadius: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    padding: 14,
  },
  guideHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 9,
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  guideTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  guideTag: {
    color: '#FFD166',
    fontSize: 11,
    fontWeight: '900',
  },
  guideText: {
    color: '#D8DEF3',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  preferenceRow: {
    flexDirection: 'row',
    gap: 9,
  },
  preferenceButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderColor: '#D7E2FF',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  preferenceButtonActive: {
    backgroundColor: '#5B65D6',
    borderColor: '#5B65D6',
  },
  preferenceText: {
    color: '#637195',
    fontSize: 13,
    fontWeight: '900',
  },
  preferenceTextActive: {
    color: '#FFFFFF',
  },
  productList: {
    gap: 12,
    paddingRight: 18,
  },
  productCard: {
    backgroundColor: '#F8FAFF',
    borderColor: '#D5E1FF',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    width: 156,
  },
  productCardActive: {
    borderColor: '#3E58BD',
    borderWidth: 2,
    padding: 9,
  },
  productVisual: {
    alignItems: 'center',
    borderRadius: 10,
    height: 118,
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  hanger: {
    borderRadius: 999,
    height: 8,
    marginBottom: -2,
    width: 54,
  },
  garmentShape: {
    borderRadius: 8,
    height: 74,
    width: 82,
  },
  brand: {
    color: '#3E58BD',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  productName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
    minHeight: 38,
  },
  price: {
    color: '#72766D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  fitPanel: {
    backgroundColor: '#16254D',
    borderRadius: 16,
    marginTop: 22,
    padding: 16,
  },
  fitHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fitLabel: {
    color: '#A5B2FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  fitTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
    maxWidth: 210,
  },
  recommendBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recommendLabel: {
    color: '#6A7393',
    fontSize: 11,
    fontWeight: '800',
  },
  recommendSize: {
    color: '#111827',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
  confidenceTrack: {
    backgroundColor: '#2E3B63',
    borderRadius: 999,
    height: 10,
    marginTop: 20,
    overflow: 'hidden',
  },
  confidenceFill: {
    backgroundColor: '#FFB84D',
    borderRadius: 999,
    height: '100%',
  },
  confidenceText: {
    color: '#DCE2EA',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  estimateNote: {
    color: '#AAB4C2',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 7,
  },
  fitRows: {
    gap: 12,
    marginTop: 18,
  },
  fitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  fitPart: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    width: 44,
  },
  fitMeter: {
    backgroundColor: '#2E3747',
    borderRadius: 999,
    flex: 1,
    height: 8,
    position: 'relative',
  },
  fitDot: {
    borderColor: '#111827',
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    position: 'absolute',
    top: -5,
    width: 18,
  },
  fitState: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    width: 40,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: '#6E79A7',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 15,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6A7AF8',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
