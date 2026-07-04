import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

function cm(value: string, fallback: number) {
  return toNumber(value) || fallback;
}

function capsuleBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 18,
) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), radialSegments, 8), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createTorsoGeometry(shoulder: number, chest: number, waist: number, hip: number, torsoHeight: number) {
  const rings = [
    { y: -torsoHeight * 0.5, width: hip * 0.0085, depth: hip * 0.0043 },
    { y: -torsoHeight * 0.15, width: waist * 0.0068, depth: waist * 0.0038 },
    { y: torsoHeight * 0.2, width: chest * 0.0073, depth: chest * 0.0042 },
    { y: torsoHeight * 0.5, width: shoulder * 0.014, depth: chest * 0.0037 },
  ];
  const segments = 48;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  rings.forEach((ring) => {
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * ring.width;
      const z = Math.sin(angle) * ring.depth;
      positions.push(x, ring.y, z);
      normals.push(Math.cos(angle), 0.18, Math.sin(angle));
    }
  });

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      const current = ring * segments + i;
      const currentNext = ring * segments + next;
      const upper = (ring + 1) * segments + i;
      const upperNext = (ring + 1) * segments + next;
      indices.push(current, upper, currentNext, currentNext, upper, upperNext);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createPhotoTexture(uri?: string | null) {
  if (!uri) return undefined;
  const texture = new THREE.TextureLoader().load(uri);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createModel({
  measurements,
  garmentColor,
  garmentCategory,
  faceImageUri,
  bodyImageUri,
}: BodyModel3DProps) {
  const group = new THREE.Group();
  const height = cm(measurements.height, 168);
  const shoulder = cm(measurements.shoulder, 39);
  const chest = cm(measurements.chest, 87);
  const waist = cm(measurements.waist, 70);
  const hip = cm(measurements.hip, 94);
  const inseam = cm(measurements.inseam, 74);
  const arm = cm(measurements.arm, 57);
  const bodyScale = THREE.MathUtils.clamp(height / 168, 0.82, 1.2);
  const torsoHeight = bodyScale * 1.48;
  const legLength = THREE.MathUtils.clamp(inseam / 74, 0.82, 1.18) * 1.35;
  const armLength = THREE.MathUtils.clamp(arm / 57, 0.82, 1.2) * 1.08;
  const shoulderHalf = shoulder * 0.014;
  const hipHalf = hip * 0.0047;
  const faceTexture = createPhotoTexture(faceImageUri);
  const bodyTexture = createPhotoTexture(bodyImageUri);

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
    color: garmentColor,
    roughness: 0.52,
    metalness: 0.04,
    transparent: true,
    opacity: garmentCategory === 'Outer' ? 0.86 : 0.78,
  });
  const contour = new THREE.MeshStandardMaterial({
    color: '#B9765D',
    roughness: 0.82,
    transparent: true,
    opacity: 0.34,
  });

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

  const torso = new THREE.Mesh(createTorsoGeometry(shoulder, chest, waist, hip, torsoHeight), skin);
  torso.position.y = 0.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * bodyScale, 0.12 * bodyScale, 20, 8), skin);
  neck.position.y = torsoHeight * 0.5 + 0.22;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25 * bodyScale, 32, 24), skin);
  head.scale.set(0.82, 1.05, 0.78);
  head.position.y = torsoHeight * 0.5 + 0.58;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.255 * bodyScale, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.76 }),
  );
  hair.scale.set(0.84, 0.64, 0.8);
  hair.position.set(0, torsoHeight * 0.5 + 0.72, 0.015);
  group.add(hair);

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
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.018 * bodyScale, 12, 8), eyeMaterial);
    leftEye.position.set(-0.07 * bodyScale, torsoHeight * 0.5 + 0.6, 0.19 * bodyScale);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.07 * bodyScale;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1 * bodyScale, 0.014 * bodyScale, 0.012 * bodyScale), mouthMaterial);
    mouth.position.set(0, torsoHeight * 0.5 + 0.5, 0.205 * bodyScale);
    group.add(leftEye, rightEye, mouth);
  }

  const shoulderY = torsoHeight * 0.5;
  const wristY = shoulderY - armLength;
  const armRadius = 0.065 * bodyScale;
  group.add(capsuleBetween(new THREE.Vector3(-shoulderHalf, shoulderY, 0), new THREE.Vector3(-shoulderHalf - 0.18, wristY, 0.04), armRadius, skin));
  group.add(capsuleBetween(new THREE.Vector3(shoulderHalf, shoulderY, 0), new THREE.Vector3(shoulderHalf + 0.18, wristY, 0.04), armRadius, skin));
  group.add(capsuleBetween(new THREE.Vector3(-shoulderHalf * 0.76, shoulderY - 0.05, 0.02), new THREE.Vector3(shoulderHalf * 0.76, shoulderY - 0.05, 0.02), 0.026 * bodyScale, contour, 24));

  const hipY = -torsoHeight * 0.5;
  const ankleY = hipY - legLength;
  const thighRadius = 0.11 * bodyScale;
  group.add(capsuleBetween(new THREE.Vector3(-hipHalf, hipY, 0), new THREE.Vector3(-hipHalf - 0.03, ankleY, 0.02), thighRadius, softShadow));
  group.add(capsuleBetween(new THREE.Vector3(hipHalf, hipY, 0), new THREE.Vector3(hipHalf + 0.03, ankleY, 0.02), thighRadius, softShadow));

  const footLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.38), softShadow);
  footLeft.position.set(-hipHalf - 0.03, ankleY - 0.08, 0.1);
  const footRight = footLeft.clone();
  footRight.position.x = hipHalf + 0.03;
  group.add(footLeft, footRight);

  if (garmentCategory !== 'Bottom') {
    const top = new THREE.Mesh(createTorsoGeometry(shoulder + 3, chest + 8, waist + 6, hip + 3, torsoHeight * 0.9), garment);
    top.position.y = 0.16;
    top.scale.set(1.03, 0.92, 1.08);
    group.add(top);

    const fitLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, torsoHeight * 0.62, 0.018),
      new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.45 }),
    );
    fitLine.position.set(shoulderHalf * 0.32, 0.2, chest * 0.0045);
    group.add(fitLine);

    const garmentHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(shoulderHalf * 0.92, torsoHeight * 0.58),
      new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.12, depthWrite: false }),
    );
    garmentHighlight.position.set(-shoulderHalf * 0.16, 0.2, chest * 0.0049);
    group.add(garmentHighlight);
  }

  if (garmentCategory !== 'Top') {
    const pantsMaterial = garmentCategory === 'Bottom' ? garment : new THREE.MeshStandardMaterial({ color: '#2E3747', roughness: 0.62 });
    group.add(
      capsuleBetween(
        new THREE.Vector3(-hipHalf, hipY + 0.05, 0),
        new THREE.Vector3(-hipHalf - 0.03, ankleY + 0.1, 0.02),
        thighRadius * 1.12,
        pantsMaterial,
      ),
    );
    group.add(
      capsuleBetween(
        new THREE.Vector3(hipHalf, hipY + 0.05, 0),
        new THREE.Vector3(hipHalf + 0.03, ankleY + 0.1, 0.02),
        thighRadius * 1.12,
        pantsMaterial,
      ),
    );
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
    scene.background = new THREE.Color('#E9F8F6');

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.32, 7.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 2.4);
    keyLight.position.set(2.3, 3.4, 3.8);
    keyLight.castShadow = true;
    scene.add(keyLight);
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#9DB5B2', 1.35));

    const model = createModel(props);
    modelRef.current = model;
    scene.add(model);

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
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      disposeModel(scene);
      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const current = modelRef.current;
    if (!current || !current.parent) return;
    const parent = current.parent;
    parent.remove(current);
    disposeModel(current);
    const next = createModel(props);
    next.rotation.y = current.rotation.y;
    modelRef.current = next;
    parent.add(next);
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
