import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type BodyModelMeasurements = {
  height: string;
  shoulder: string;
  chest: string;
  waist: string;
  hip: string;
  inseam: string;
  arm: string;
};

type BodyModel3DProps = {
  measurements: BodyModelMeasurements;
  garmentColor: string;
  garmentCategory: 'Top' | 'Bottom' | 'Outer';
  faceImageUri?: string | null;
  bodyImageUri?: string | null;
};

type BodyTextureResult = {
  matchedFace: boolean;
  matchedBody: boolean;
};

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

function cm(value: string, fallback: number) {
  return toNumber(value) || fallback;
}

const BASE_MESH_URL = '/male-base-mesh.glb';
const REMOTE_FALLBACK_BODY_MODEL_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb';
const ENV_MESH_URL =
  (globalThis as { process?: { env?: { EXPO_PUBLIC_BODY_MODEL_URL?: string } } }).process?.env
    ?.EXPO_PUBLIC_BODY_MODEL_URL;
const MODEL_CANDIDATE_URLS = [
  ENV_MESH_URL,
  BASE_MESH_URL,
  '/fitme/male-base-mesh.glb',
  './male-base-mesh.glb',
  REMOTE_FALLBACK_BODY_MODEL_URL,
] as const;
const baseModelCache = new Map<string, Promise<THREE.Group>>();

function getBaseMeshCandidates() {
  const runtimeUrls: string[] = [];
  if (typeof window !== 'undefined') {
    runtimeUrls.push(new URL('male-base-mesh.glb', window.location.href).toString());
  }

  const seen = new Set<string>();
  const urls = [...runtimeUrls, ...MODEL_CANDIDATE_URLS.filter(Boolean)] as string[];
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function loadBaseMeshByUrl(url: string) {
  const cached = baseModelCache.get(url);
  if (cached) return cached;

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const base = gltf.scene;
        base.name = 'body-mesh-base';
        resolve(base);
      },
      undefined,
      (error) => {
        baseModelCache.delete(url);
        reject(error);
      },
    );
  });

  baseModelCache.set(url, promise);
  return promise;
}

async function loadBaseMeshWithFallback() {
  const candidates = getBaseMeshCandidates();
  for (const candidate of candidates) {
    try {
      return await loadBaseMeshByUrl(candidate);
    } catch (error) {
      console.warn('[BodyModel3D] GLTF load 실패', candidate, error);
    }
  }
  return null;
}

function taperedLimb(
  start: THREE.Vector3,
  end: THREE.Vector3,
  topRadius: number,
  bottomRadius: number,
  material: THREE.Material,
  radialSegments = 20,
) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(topRadius, bottomRadius, Math.max(0.01, length), radialSegments, 1),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function addJoint(parent: THREE.Group, position: THREE.Vector3, radius: number, material: THREE.Material) {
  const joint = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
  joint.position.copy(position);
  joint.castShadow = true;
  joint.receiveShadow = true;
  parent.add(joint);
}

function createPhotoTexture(uri?: string | null) {
  if (!uri) return undefined;
  const texture = new THREE.TextureLoader().load(uri);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function hasTargetName(name: string, targets: RegExp[]) {
  const key = (name || '').toLowerCase();
  return targets.some((target) => target.test(key));
}

function setMaterialTexture(material: THREE.Material, texture: THREE.Texture) {
  const apply = (item: THREE.Material) => {
    if (
      item instanceof THREE.MeshStandardMaterial ||
      item instanceof THREE.MeshPhysicalMaterial ||
      item instanceof THREE.MeshPhongMaterial ||
      item instanceof THREE.MeshLambertMaterial ||
      item instanceof THREE.MeshToonMaterial
    ) {
      item.map = texture;
      if ('roughness' in item && typeof item.roughness === 'number') {
        item.roughness = Math.max(0.35, item.roughness);
      }
      if ('metalness' in item && typeof item.metalness === 'number') {
        item.metalness = 0;
      }
      if (item instanceof THREE.MeshPhongMaterial) {
        item.shininess = 20;
        item.specular = new THREE.Color('#222222');
      }
      item.needsUpdate = true;
    }
  };
  if (Array.isArray(material)) material.forEach(apply);
  else apply(material);
}

function applyPhotoMaterialToNamedNodes(root: THREE.Object3D, texture: THREE.Texture | undefined, targets: RegExp[]) {
  if (!texture) return 0;
  let matched = 0;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.material) return;
    if (!hasTargetName(obj.name, targets)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => setMaterialTexture(material, texture));
    matched += 1;
  });
  return matched;
}

function addFaceTextureDecal(group: THREE.Group, texture: THREE.Texture | undefined, modelBounds: THREE.Box3) {
  if (!texture) return;
  const size = modelBounds.getSize(new THREE.Vector3());
  const center = modelBounds.getCenter(new THREE.Vector3());
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(0.11, size.x * 0.18), 64),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  face.position.set(center.x, center.y + size.y * 0.16, modelBounds.max.z + size.z * 0.55);
  face.rotation.y = Math.PI;
  group.add(face);
}

function addBodyTextureDecal(group: THREE.Group, texture: THREE.Texture | undefined, modelBounds: THREE.Box3) {
  if (!texture) return;
  const size = modelBounds.getSize(new THREE.Vector3());
  const center = modelBounds.getCenter(new THREE.Vector3());
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 0.9, size.y * 0.5),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  body.position.set(center.x, center.y, modelBounds.max.z + size.z * 0.52);
  body.rotation.y = Math.PI;
  group.add(body);
}

function applyPhotoTextureTargets(root: THREE.Object3D, faceTexture?: THREE.Texture, bodyTexture?: THREE.Texture) {
  const result: BodyTextureResult = {
    matchedFace: false,
    matchedBody: false,
  };

  if (faceTexture) {
    const matched = applyPhotoMaterialToNamedNodes(
      root,
      faceTexture,
      [/head/i, /face/i, /skinhead/i, /jaw/i, /forehead/i, /cheek/i, /nose/i, /eye/i],
    );
    result.matchedFace = matched > 0;
  }

  if (bodyTexture) {
    const matched = applyPhotoMaterialToNamedNodes(
      root,
      bodyTexture,
      [/body/i, /torso/i, /chest/i, /waist/i, /abdomen/i, /hip/i, /mesh/i],
    );
    result.matchedBody = matched > 0;
  }

  return result;
}

function buildFittedMeshScale({
  mesh,
  height,
  shoulder,
  hip,
  inseam,
  measurements,
}: {
  mesh: THREE.Object3D;
  height: number;
  shoulder: number;
  hip: number;
  inseam: number;
  measurements: BodyModelMeasurements;
}) {
  const bounds = new THREE.Box3().setFromObject(mesh);
  const size = bounds.getSize(new THREE.Vector3());

  const heightScale = THREE.MathUtils.clamp((height / 168) * (1.68 / Math.max(0.01, size.y)), 0.72, 1.36);
  const widthScale = THREE.MathUtils.clamp(((shoulder / 39) * 0.78 + (hip / 94) * 0.22), 0.74, 1.28);
  const legScale = THREE.MathUtils.clamp(inseam / 74, 0.82, 1.18);
  const finalHeightScale = Math.max(0.42, heightScale);

  mesh.scale.set(widthScale, finalHeightScale, widthScale * 0.95);
  const fitted = new THREE.Box3().setFromObject(mesh);
  const fittedCenter = fitted.getCenter(new THREE.Vector3());
  const fittedMin = fitted.min;
  mesh.position.set(-fittedCenter.x, -fittedMin.y, -fittedCenter.z);
  mesh.position.y += 0.05 * finalHeightScale;

  return {
    bounds: new THREE.Box3().setFromObject(mesh),
    widthScale,
    heightScale: finalHeightScale,
    legScale,
    shoulder,
    hip,
    chest: cm(measurements.chest, 87),
    waist: cm(measurements.waist, 70),
    arm: cm(measurements.arm, 57),
  };
}

function addFallbackFloor(parent: THREE.Group, bounds: THREE.Box3, tint = '#EEF7FF') {
  const size = bounds.getSize(new THREE.Vector3());
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(0.9, size.x * 1.55), 48),
    new THREE.MeshStandardMaterial({ color: tint, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, bounds.min.y - 0.03, 0);
  floor.receiveShadow = true;
  parent.add(floor);
}

function addGarmentBlocksForBounds(
  parent: THREE.Group,
  garmentCategory: 'Top' | 'Bottom' | 'Outer',
  garmentColor: string,
  bounds: THREE.Box3,
  measurementData: { shoulder: number; hip: number; waist: number; chest: number; arm: number },
) {
  const size = bounds.getSize(new THREE.Vector3());
  const min = bounds.min;
  const max = bounds.max;
  const garmentMaterial = new THREE.MeshStandardMaterial({
    color: garmentColor,
    roughness: 0.5,
    metalness: 0.02,
    transparent: true,
    opacity: garmentCategory === 'Outer' ? 0.84 : 0.74,
  });

  if (garmentCategory !== 'Bottom') {
    const shoulderRadius = Math.max(0.18, (measurementData.shoulder * 0.0075));
    const chestRadius = Math.max(0.16, (measurementData.chest * 0.0063));
    const waistRadius = Math.max(0.13, (measurementData.waist * 0.0058));
    const topY = max.y - size.y * 0.08;

    const topFit = new THREE.Mesh(
      new THREE.CylinderGeometry(shoulderRadius, chestRadius, size.y * 0.31, 40, 1),
      garmentMaterial,
    );
    topFit.position.set(0, topY, 0);
    topFit.rotation.z = 0.01;
    topFit.scale.z = 0.96;
    parent.add(topFit);

    const middleFit = new THREE.Mesh(
      new THREE.CylinderGeometry(chestRadius, waistRadius, size.y * 0.32, 40, 1),
      garmentMaterial,
    );
    middleFit.position.set(0, max.y - size.y * 0.35, 0);
    parent.add(middleFit);
  }

  if (garmentCategory !== 'Top') {
    const legTopY = max.y - size.y * 0.45;
    const legBottomY = min.y + size.y * 0.02;
    const hipX = Math.max(size.x * 0.28, measurementData.hip * 0.0044 * 0.8);
    const upper = Math.max(0.1, hipX * 0.58);
    const lower = Math.max(0.09, hipX * 0.49);

    const leftTop = new THREE.Vector3(-hipX, legTopY, 0);
    const leftKnee = new THREE.Vector3(-hipX * 0.8, legBottomY + (legBottomY - legTopY) * 0.55, size.z * 0.1);
    const leftAnkle = new THREE.Vector3(-hipX * 0.82, legBottomY, size.z * 0.22);
    const rightTop = new THREE.Vector3(hipX, legTopY, 0);
    const rightKnee = new THREE.Vector3(hipX * 0.8, legBottomY + (legBottomY - legTopY) * 0.55, size.z * 0.1);
    const rightAnkle = new THREE.Vector3(hipX * 0.82, legBottomY, size.z * 0.22);

    const leftUpper = taperedLimb(leftTop, leftKnee, upper, upper * 0.92, garmentMaterial);
    const leftLower = taperedLimb(leftKnee, leftAnkle, upper * 0.92, lower, garmentMaterial);
    const rightUpper = taperedLimb(rightTop, rightKnee, upper, upper * 0.92, garmentMaterial);
    const rightLower = taperedLimb(rightKnee, rightAnkle, upper * 0.92, lower, garmentMaterial);
    [leftUpper, leftLower, rightUpper, rightLower].forEach((segment) => {
      segment.castShadow = true;
      parent.add(segment);
    });
  }
}

function createProceduralModel(props: BodyModel3DProps) {
  const group = new THREE.Group();
  const height = cm(props.measurements.height, 168);
  const shoulder = cm(props.measurements.shoulder, 39);
  const chest = cm(props.measurements.chest, 87);
  const waist = cm(props.measurements.waist, 70);
  const hip = cm(props.measurements.hip, 94);
  const inseam = cm(props.measurements.inseam, 74);
  const arm = cm(props.measurements.arm, 57);
  const bodyScale = THREE.MathUtils.clamp(height / 168, 0.82, 1.2);
  const torsoHeight = bodyScale * 1.48;
  const legLength = THREE.MathUtils.clamp(inseam / 74, 0.82, 1.18) * 1.35;
  const armLength = THREE.MathUtils.clamp(arm / 57, 0.82, 1.2) * 1.08;
  const upperArmLength = armLength * 0.54;
  const lowerArmLength = armLength * 0.46;
  const upperLegLength = legLength * 0.58;
  const lowerLegLength = legLength * 0.42;
  const shoulderHalf = shoulder * 0.014;
  const hipHalf = hip * 0.0047;
  const faceTexture = createPhotoTexture(props.faceImageUri);
  const bodyTexture = createPhotoTexture(props.bodyImageUri);
  const topShoulderRadius = Math.max(0.42, shoulder * 0.0071 * bodyScale);
  const chestRadius = Math.max(0.39, chest * 0.0065 * bodyScale);
  const waistRadius = Math.max(0.34, waist * 0.0058 * bodyScale);
  const hipRadius = Math.max(0.34, hip * 0.0054 * bodyScale);

  const skin = new THREE.MeshStandardMaterial({
    color: '#D8A17F',
    roughness: 0.72,
    metalness: 0.02,
  });
  const softShadow = new THREE.MeshStandardMaterial({
    color: '#C98F70',
    roughness: 0.8,
  });
  const garment = new THREE.MeshStandardMaterial({
    color: props.garmentColor,
    roughness: 0.52,
    metalness: 0.04,
    transparent: true,
    opacity: props.garmentCategory === 'Outer' ? 0.86 : 0.78,
  });
  const contour = new THREE.MeshStandardMaterial({
    color: '#B9765D',
    roughness: 0.82,
    transparent: true,
    opacity: 0.34,
  });

  const torsoUpper = new THREE.Mesh(
    new THREE.CylinderGeometry(topShoulderRadius, chestRadius, torsoHeight * 0.4, 42, 1),
    skin,
  );
  torsoUpper.position.y = 0.48;
  torsoUpper.scale.z = 0.95;
  torsoUpper.castShadow = true;
  torsoUpper.receiveShadow = true;
  group.add(torsoUpper);

  const torsoMiddle = new THREE.Mesh(
    new THREE.CylinderGeometry(chestRadius, waistRadius, torsoHeight * 0.35, 42, 1),
    skin,
  );
  torsoMiddle.position.y = 0.07;
  torsoMiddle.scale.z = 0.95;
  torsoMiddle.castShadow = true;
  group.add(torsoMiddle);

  const torsoLower = new THREE.Mesh(
    new THREE.CylinderGeometry(waistRadius, hipRadius, torsoHeight * 0.33, 42, 1),
    skin,
  );
  torsoLower.position.y = -0.34;
  torsoLower.scale.z = 1;
  torsoLower.castShadow = true;
  group.add(torsoLower);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.44 * topShoulderRadius, 0.01, 12, 36),
    new THREE.MeshStandardMaterial({ color: '#D8B39B', roughness: 0.56, metalness: 0.01 }),
  );
  collar.position.set(0, 0.92, 0.18);
  collar.rotation.x = Math.PI * 0.55;
  group.add(collar);

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.095 * bodyScale, 0.06 * bodyScale, 20, 8), skin);
  neck.position.y = 0.9;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25 * bodyScale, 32, 24), skin);
  head.scale.set(0.82, 1.05, 0.78);
  head.position.y = 1.06;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.245 * bodyScale, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.76 }),
  );
  hair.scale.set(0.84, 0.64, 0.8);
  hair.position.set(0, torsoHeight * 0.5 + 0.74, 0.006);
  group.add(hair);

  if (bodyTexture) {
    const bodyPhoto = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18 * bodyScale, 2.65 * bodyScale),
      new THREE.MeshBasicMaterial({
        map: bodyTexture,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    bodyPhoto.position.set(0, -0.28, -0.28);
    bodyPhoto.renderOrder = 0;
    group.add(bodyPhoto);
  }

  if (faceTexture) {
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.205 * bodyScale, 64),
      new THREE.MeshBasicMaterial({
        map: faceTexture,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    face.scale.set(0.9, 1.08, 1);
    face.position.set(0, torsoHeight * 0.5 + 0.57, 0.205 * bodyScale);
    face.renderOrder = 3;
    group.add(face);
  } else {
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.55 });
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#8A4A43', roughness: 0.7 });
    const cheekMaterial = new THREE.MeshStandardMaterial({
      color: '#D9A78A',
      roughness: 0.65,
      transparent: true,
      opacity: 0.16,
    });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.018 * bodyScale, 12, 8), eyeMaterial);
    leftEye.position.set(-0.07 * bodyScale, torsoHeight * 0.5 + 0.6, 0.19 * bodyScale);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.07 * bodyScale;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012 * bodyScale, 0.06 * bodyScale, 8), mouthMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, torsoHeight * 0.5 + 0.57, 0.21 * bodyScale);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1 * bodyScale, 0.014 * bodyScale, 0.012 * bodyScale), mouthMaterial);
    mouth.position.set(0, torsoHeight * 0.5 + 0.5, 0.205 * bodyScale);
    const cheekLeft = new THREE.Mesh(new THREE.SphereGeometry(0.028 * bodyScale, 8, 6), cheekMaterial);
    const cheekRight = cheekLeft.clone();
    cheekLeft.position.set(-0.11 * bodyScale, torsoHeight * 0.5 + 0.47, 0.16 * bodyScale);
    cheekRight.position.set(0.11 * bodyScale, torsoHeight * 0.5 + 0.47, 0.16 * bodyScale);
    group.add(leftEye, rightEye, nose, mouth, cheekLeft, cheekRight);
  }

  const shoulderY = torsoHeight * 0.5;
  const shoulderRadius = 0.065 * bodyScale;
  const forearmRadius = 0.052 * bodyScale;
  const legRadius = 0.105 * bodyScale;
  const shinRadius = 0.078 * bodyScale;
  const hipY = -torsoHeight * 0.5 + 0.01;
  const kneeY = hipY - upperLegLength;
  const ankleY = kneeY - lowerLegLength;
  const pelvisLineY = hipY + 0.03;

  const buildArm = (side: number) => {
    const sign = side;
    const shoulder = new THREE.Vector3(sign * shoulderHalf * 0.98, shoulderY, 0.01);
    const elbow = new THREE.Vector3(sign * shoulderHalf * 1.16, shoulderY - upperArmLength * 0.94, 0.06 * sign);
    const wrist = new THREE.Vector3(sign * shoulderHalf * 1.24, shoulderY - upperArmLength - lowerArmLength * 0.96, 0.09 * sign);

    const upper = taperedLimb(shoulder, elbow, shoulderRadius, shoulderRadius * 0.72, skin);
    const lower = taperedLimb(elbow, wrist, shoulderRadius * 0.72, forearmRadius, skin);
    addJoint(group, elbow, shoulderRadius * 0.72, contour);
    addJoint(group, wrist, forearmRadius, contour);

    upper.castShadow = true;
    lower.castShadow = true;
    group.add(upper, lower);

    const hand = new THREE.Mesh(
      new THREE.CapsuleGeometry(forearmRadius * 0.85, forearmRadius * 0.42, 8, 10),
      skin,
    );
    hand.position.copy(wrist);
    hand.position.z += 0.015 * sign;
    hand.rotation.z = sign * 0.06;
    hand.castShadow = true;
    group.add(hand);
  };

  const buildLeg = (side: number) => {
    const sign = side;
    const hip = new THREE.Vector3(sign * hipHalf * 0.82, hipY, 0);
    const knee = new THREE.Vector3(sign * hipHalf * 0.95, kneeY + 0.01, 0.05 * sign);
    const ankle = new THREE.Vector3(sign * hipHalf * 0.76, ankleY + 0.02, 0.12 * sign);
    const hipCap = taperedLimb(hip, knee, legRadius * 1.03, legRadius * 0.92, softShadow, 20);
    const calf = taperedLimb(knee, ankle, legRadius * 0.92, shinRadius * 0.96, softShadow, 20);
    addJoint(group, hip, legRadius * 0.84, contour);
    addJoint(group, knee, legRadius * 0.56, contour);
    addJoint(group, ankle, shinRadius * 0.62, contour);
    hipCap.castShadow = true;
    calf.castShadow = true;
    group.add(hipCap, calf);
  };

  buildArm(-1);
  buildArm(1);
  buildLeg(-1);
  buildLeg(1);
  addJoint(group, new THREE.Vector3(-shoulderHalf * 0.8, shoulderY - 0.04, 0.01), 0.026 * bodyScale, contour);
  addJoint(group, new THREE.Vector3(shoulderHalf * 0.8, shoulderY - 0.04, 0.01), 0.026 * bodyScale, contour);
  addJoint(group, new THREE.Vector3(0, pelvisLineY, 0), 0.03 * bodyScale, contour);

  const footY = ankleY + 0.02;
  const footMaterial = new THREE.MeshStandardMaterial({
    color: '#2F3E4A',
    roughness: 0.8,
    metalness: 0.03,
  });
  const footLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * bodyScale, 0.11 * bodyScale, 6, 10), footMaterial);
  footLeft.position.set(-hipHalf * 0.76, footY, 0.17);
  footLeft.rotation.z = -0.18;
  footLeft.castShadow = true;
  const footRight = footLeft.clone();
  footRight.position.x = hipHalf * 0.76;
  footRight.position.z = 0.2;
  footRight.rotation.z = 0.18;
  group.add(footLeft, footRight);

  if (props.garmentCategory !== 'Bottom') {
    const topFit = new THREE.Mesh(
      new THREE.CylinderGeometry(topShoulderRadius * 0.98, chestRadius * 1.02, torsoHeight * 0.35, 40, 1),
      garment,
    );
    topFit.position.y = 0.45;
    topFit.scale.z = 0.98;
    topFit.rotation.z = 0.02;
    group.add(topFit);

    const topWaist = new THREE.Mesh(
      new THREE.CylinderGeometry(chestRadius * 0.98, waistRadius * 0.94, torsoHeight * 0.34, 40, 1),
      garment,
    );
    topWaist.position.y = 0.1;
    topWaist.scale.z = 1.02;
    topWaist.rotation.z = 0.02;
    group.add(topWaist);

    const topSail = new THREE.Mesh(
      new THREE.CylinderGeometry(waistRadius * 0.84, waistRadius * 0.82, torsoHeight * 0.2, 36, 1),
      garment,
    );
    topSail.position.y = -0.28;
    topSail.scale.z = 0.96;
    group.add(topSail);
  }

  if (props.garmentCategory !== 'Top') {
    const pantMaterial = props.garmentCategory === 'Bottom'
      ? garment
      : new THREE.MeshStandardMaterial({ color: '#252F3F', roughness: 0.6 });
    const waistband = new THREE.Mesh(
      new THREE.TorusGeometry(hipRadius * 0.72, 0.02 * bodyScale, 8, 24),
      new THREE.MeshStandardMaterial({ color: '#1B2635', roughness: 0.7 }),
    );
    waistband.position.set(0, hipY + 0.02, 0.04);
    waistband.rotation.x = Math.PI / 2;
    group.add(waistband);

    const buildPantsLeg = (side: number) => {
      const sign = side;
      const top = new THREE.Vector3(sign * hipHalf * 0.8, hipY + 0.02, 0.01);
      const knee = new THREE.Vector3(sign * hipHalf * 0.95, kneeY + 0.04, 0.07 * sign);
      const ankle = new THREE.Vector3(sign * hipHalf * 0.78, ankleY + 0.03, 0.14 * sign);
      const upper = taperedLimb(top, knee, legRadius * 1.08, legRadius * 0.94, pantMaterial);
      const lower = taperedLimb(knee, ankle, legRadius * 0.94, shinRadius * 0.95, pantMaterial);
      upper.castShadow = true;
      lower.castShadow = true;
      group.add(upper, lower);
    };

    buildPantsLeg(-1);
    buildPantsLeg(1);
  }

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 48),
    new THREE.MeshStandardMaterial({ color: '#E9F8F6', roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = ankleY - 0.14;
  floor.receiveShadow = true;
  group.add(floor);

  group.position.x = 0;
  group.position.y = 0.2;
  group.scale.setScalar(0.92);
  return group;
}

async function createGltfModel(props: BodyModel3DProps): Promise<THREE.Group> {
  const group = new THREE.Group();
  const base = await loadBaseMeshWithFallback();
  if (!base) throw new Error('Cannot load base model mesh');
  const mesh = base.clone(true) as THREE.Group;

  const height = cm(props.measurements.height, 168);
  const shoulder = cm(props.measurements.shoulder, 39);
  const chest = cm(props.measurements.chest, 87);
  const waist = cm(props.measurements.waist, 70);
  const hip = cm(props.measurements.hip, 94);
  const inseam = cm(props.measurements.inseam, 74);

  const bodyTexture = createPhotoTexture(props.bodyImageUri);
  const faceTexture = createPhotoTexture(props.faceImageUri);

  mesh.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  buildFittedMeshScale({
    mesh,
    height,
    shoulder,
    hip,
    inseam,
    measurements: props.measurements,
  });
  const textureMatch = applyPhotoTextureTargets(mesh, faceTexture, bodyTexture);
  const bounds = new THREE.Box3().setFromObject(mesh);

  if (faceTexture && !textureMatch.matchedFace) {
    addFaceTextureDecal(group, faceTexture, bounds);
  }
  if (bodyTexture && !textureMatch.matchedBody) {
    addBodyTextureDecal(group, bodyTexture, bounds);
  }

  addGarmentBlocksForBounds(group, props.garmentCategory, props.garmentColor, bounds, {
    shoulder,
    hip,
    chest,
    waist,
    arm: cm(props.measurements.arm, 57),
  });
  addFallbackFloor(group, bounds, '#EEF7FF');

  group.add(mesh);
  group.position.y = 0.2;
  return group;
}

async function createModel(props: BodyModel3DProps): Promise<THREE.Group> {
  try {
    const gltfModel = await createGltfModel(props);
    if (gltfModel.children.length) return gltfModel;
  } catch (error) {
    console.warn('[BodyModel3D] GLTF load failed, fallback model enabled.', error);
  }
  return createProceduralModel(props);
}

function disposeModel(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const material = object.material;
      const disposeMaterial = (item: THREE.Material) => {
        const mapped = item as THREE.Material & { map?: THREE.Texture };
        mapped.map?.dispose();
        item.dispose();
      };
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else disposeMaterial(material);
    }
  });
}

export default function BodyModel3D(props: BodyModel3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EEF7FF');

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.34, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 2.4);
    keyLight.position.set(2.3, 3.4, 3.8);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#DDE9FF', 1.05);
    rimLight.position.set(-2.6, 2.1, -3);
    scene.add(rimLight);
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#8FAAB8', 1.22));

    let alive = true;

    const load = async () => {
      const model = await createModel(props);
      if (!alive) {
        disposeModel(model);
        return;
      }
      modelRef.current = model;
      scene.add(model);
    };
    load();

    let frameId = 0;
    let pointerDown = false;
    let lastX = 0;
    let manualRotation = 0;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const activeModel = modelRef.current;
      if (activeModel) {
        activeModel.rotation.y += 0.01;
        activeModel.rotation.y += manualRotation;
      }
      manualRotation *= 0.82;
      renderer.render(scene, camera);
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true;
      lastX = event.clientX;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      manualRotation = (event.clientX - lastX) * 0.004;
      lastX = event.clientX;
    };
    const onPointerUp = () => {
      pointerDown = false;
    };

    host.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    animate();

    return () => {
      alive = false;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      if (modelRef.current) disposeModel(modelRef.current);
      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const host = modelRef.current?.parent;
    const current = modelRef.current;
    if (!host || !current) return;

    let alive = true;
    host.remove(current);
    disposeModel(current);
    modelRef.current = null;

    const reload = async () => {
      const next = await createModel(props);
      if (!alive) {
        disposeModel(next);
        return;
      }
      next.rotation.y = current.rotation.y;
      modelRef.current = next;
      host.add(next);
    };

    reload();

    return () => {
      alive = false;
    };
  }, [props.bodyImageUri, props.faceImageUri, props.garmentCategory, props.garmentColor, props.measurements]);

  return (
    <div style={domStyles.stage}>
      <div ref={hostRef} data-testid="body-model-3d" style={domStyles.host} />
    </div>
  );
}

const domStyles = {
  stage: {
    height: 420,
    maxHeight: 420,
    maxWidth: 330,
    minHeight: 420,
    minWidth: 300,
    overflow: 'hidden',
    width: 330,
  },
  host: {
    cursor: 'grab',
    height: 420,
    maxHeight: 420,
    maxWidth: 330,
    minHeight: 420,
    minWidth: 300,
    touchAction: 'none',
    width: 330,
  },
} satisfies Record<string, CSSProperties>;
