import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type TeslaModelKey = "model_3" | "model_y" | "model_x" | "cybertruck" | "semi";

export interface ModelOption {
  key: TeslaModelKey;
  label: string;
  files: string[];
}

export const TESLA_MODELS: ModelOption[] = [
  { key: "model_3", label: "Model 3", files: ["/models/tesla_model_3.glb", "/models/tesla_model_3_fast.glb"] },
  { key: "model_y", label: "Model Y", files: ["/models/tesla_model_y.glb", "/models/tesla_model_3.glb"] },
  { key: "model_x", label: "Model X", files: ["/models/tesla_model_x.glb", "/models/tesla_model_3.glb"] },
  { key: "cybertruck", label: "Cybertruck", files: ["/models/tesla_cybertruck.glb"] },
  { key: "semi", label: "Semi", files: ["/models/tesla_semi.glb"] },
];

function resolveModelKey(modelStr?: string | null): TeslaModelKey {
  if (!modelStr) return "model_3";
  const m = modelStr.toLowerCase();
  if (m.includes("cyber") || m.includes("truck")) return "cybertruck";
  if (m.includes("model y") || m.includes("modely") || m === "y") return "model_y";
  if (m.includes("model x") || m.includes("modelx") || m === "x") return "model_x";
  if (m.includes("semi")) return "semi";
  return "model_3";
}

interface Tesla3DViewerProps {
  colorHex?: string;
  colorName?: string;
  modelName?: string;
  isPreconditioning?: boolean;
  chargingState?: string | null;
  locked?: boolean | null;
}

export function Tesla3DViewer({
  colorHex = "#4B5563",
  colorName = "Midnatssølv metallisk",
  modelName = "Tesla Model 3",
  chargingState,
  locked,
}: Tesla3DViewerProps) {
  const containerRef = useRef<any>(null);
  const [selectedModel, setSelectedModel] = useState<TeslaModelKey>(() => resolveModelKey(modelName));
  const [loading, setLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [cameraView, setCameraView] = useState<"front" | "side" | "rear" | "iso">("iso");

  // Keep selected model in sync if prop changes
  useEffect(() => {
    setSelectedModel(resolveModelKey(modelName));
  }, [modelName]);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const bodyMaterialsRef = useRef<THREE.Material[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Apply paint color dynamically whenever colorHex changes
  useEffect(() => {
    const targetColor = new THREE.Color(colorHex);
    bodyMaterialsRef.current.forEach((mat: any) => {
      if (mat.color) {
        mat.color.set(targetColor);
        mat.needsUpdate = true;
      }
    });
  }, [colorHex]);

  // Handle auto-rotate toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Set preset camera angles (always respecting maxPolarAngle so it cannot be viewed from underneath)
  const setPresetAngle = (view: "front" | "side" | "rear" | "iso") => {
    setCameraView(view);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.autoRotate = false;
    setAutoRotate(false);

    const dist = 5.6;
    switch (view) {
      case "front":
        camera.position.set(0, 1.3, dist);
        break;
      case "side":
        camera.position.set(dist, 1.2, 0);
        break;
      case "rear":
        camera.position.set(0, 1.3, -dist);
        break;
      case "iso":
      default:
        camera.position.set(4.2, 2.1, 3.8);
        break;
    }
    controls.target.set(0, 0.75, 0);
    controls.update();
  };

  // Helper to load GLB model with DRACO fallback
  const loadCarModel = (modelKey: TeslaModelKey) => {
    const carGroup = carGroupRef.current;
    if (!carGroup) return;

    setLoading(true);
    carGroup.clear();
    bodyMaterialsRef.current = [];

    // Body Paint Material with realistic metallic automotive finish
    const bodyPaint = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorHex),
      metalness: 0.86,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
    });
    bodyMaterialsRef.current.push(bodyPaint);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x091419,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x14181a,
      roughness: 0.6,
      metalness: 0.3,
    });

    const tireRubberMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.85,
      metalness: 0.05,
    });

    const wheelRimMat = new THREE.MeshStandardMaterial({
      color: 0x3a4043,
      metalness: 0.85,
      roughness: 0.25,
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const modelConfig = TESLA_MODELS.find((m) => m.key === modelKey) ?? TESLA_MODELS[0];
    const candidateFiles = modelConfig?.files ?? ["/models/tesla_model_3.glb"];

    const tryLoadFile = (index: number) => {
      if (index >= candidateFiles.length) {
        // Build procedural 3D model if all files fail
        buildProceduralTesla(carGroup, {
          bodyPaint,
          glassMat,
          darkTrimMat,
          tireRubberMat,
          wheelRimMat,
          headlightMat,
          taillightMat,
        });
        setLoading(false);
        return;
      }

      const fileUrl = candidateFiles[index];
      if (!fileUrl) {
        setLoading(false);
        return;
      }

      gltfLoader.load(
        fileUrl,
        (gltf) => {
          carGroup.clear();
          bodyMaterialsRef.current = [];

          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const meshName = (mesh.name || "").toLowerCase();
              const mat = mesh.material as any;
              const matName = (mat?.name || "").toLowerCase();

              const isCarPaint =
                matName.includes("paint") ||
                matName.includes("carpaint") ||
                matName.includes("car_paint") ||
                matName.includes("body") ||
                matName.includes("exterior") ||
                matName === "white.002" ||
                matName === "material.001" ||
                matName === "tt_bake_node" ||
                meshName.includes("body") ||
                meshName.includes("paint") ||
                meshName.includes("hood") ||
                meshName.includes("door") ||
                meshName.includes("bumper") ||
                meshName.includes("trunk");

              const isExcluded =
                matName.includes("glass") ||
                matName.includes("window") ||
                matName.includes("tire") ||
                matName.includes("rubber") ||
                matName.includes("rim") ||
                matName.includes("light") ||
                matName.includes("chrome") ||
                matName.includes("interior") ||
                meshName.includes("glass") ||
                meshName.includes("wheel") ||
                meshName.includes("tire");

              if (isCarPaint && !isExcluded) {
                // If existing material has metallic/roughness properties, update its color
                if (mat && mat.color) {
                  mat.color.set(new THREE.Color(colorHex));
                  if ("metalness" in mat) mat.metalness = 0.85;
                  if ("roughness" in mat) mat.roughness = 0.2;
                  bodyMaterialsRef.current.push(mat);
                } else {
                  mesh.material = bodyPaint;
                  bodyMaterialsRef.current.push(bodyPaint);
                }
              }
            }
          });

          // Compute bounding box and normalize scale & ground positioning
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxAxis = Math.max(size.x, size.y, size.z);
          const targetSize = modelKey === "semi" ? 4.8 : 4.0;
          const scale = targetSize / maxAxis;

          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.x = -center.x * scale;
          gltf.scene.position.z = -center.z * scale;
          gltf.scene.position.y = -box.min.y * scale;

          carGroup.add(gltf.scene);
          setLoading(false);
        },
        undefined,
        () => {
          tryLoadFile(index + 1);
        }
      );
    };

    tryLoadFile(0);
  };

  // Switch 3D model when user clicks a model pill or prop changes
  useEffect(() => {
    if (Platform.OS !== "web") return;
    loadCarModel(selectedModel);
  }, [selectedModel]);

  // Main Three.js Scene Setup
  useEffect(() => {
    if (Platform.OS !== "web") {
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = Math.min(380, Math.max(260, container.clientHeight || 320));

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(4.4, 2.2, 4.0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. OrbitControls - Crucial: maxPolarAngle prevents viewing from underneath!
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 3.0;
    controls.maxDistance = 9.0;
    // Limit polar angle: Cannot dip below floor horizon (Math.PI / 2 = 90 deg = ground level)
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    // Allow viewing from high angles up to almost top-down
    controls.minPolarAngle = 0.15;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.target.set(0, 0.72, 0);
    controlsRef.current = controls;

    // 5. Lighting Setup (Automotive Studio setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainKeyLight.position.set(6, 9, 7);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    mainKeyLight.shadow.bias = -0.0005;
    scene.add(mainKeyLight);

    const softFillLight = new THREE.DirectionalLight(0xdce9dc, 1.2);
    softFillLight.position.set(-6, 6, -5);
    scene.add(softFillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(-5, 4, 6);
    scene.add(rimLight);

    const underGlow = new THREE.PointLight(0x10b981, 0.8, 4);
    underGlow.position.set(0, 0.2, 0);
    scene.add(underGlow);

    // 6. Ground Shadow / Floor plane
    const shadowGeo = new THREE.PlaneGeometry(8, 8);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 110);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.75)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.35)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.01;
    scene.add(shadowMesh);

    // Subtle studio floor circular ring
    const ringGeo = new THREE.RingGeometry(2.3, 2.33, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1e423a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.005;
    scene.add(ringMesh);

    // 7. Car Root Group
    const carGroup = new THREE.Group();
    scene.add(carGroup);
    carGroupRef.current = carGroup;

    // Load initial car model
    loadCarModel(selectedModel);

    // 8. Resize listener
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth || 360;
      const newH = Math.min(380, Math.max(260, containerRef.current.clientHeight || 320));
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    // 9. Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <View style={styles.viewerCard}>
      {/* 3D Canvas Container */}
      <View style={styles.canvasContainer} ref={containerRef}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.loaderText}>Henter 3D {TESLA_MODELS.find((m) => m.key === selectedModel)?.label}...</Text>
          </View>
        ) : null}

        {/* Floating Top Controls Overlay */}
        <View style={styles.topOverlayRow}>
          {/* Model Selector Pills */}
          <View style={styles.modelSelectorPills}>
            {TESLA_MODELS.map((m) => {
              const isSelected = selectedModel === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setSelectedModel(m.key)}
                  style={[styles.modelPill, isSelected && styles.modelPillActive]}
                >
                  {isSelected ? <View style={[styles.colorDot, { backgroundColor: colorHex }]} /> : null}
                  <Text style={[styles.modelPillText, isSelected && styles.modelPillTextActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setAutoRotate(!autoRotate)}
            accessibilityLabel={autoRotate ? "Slå auto-rotation fra" : "Slå auto-rotation til"}
            style={[styles.glassPillButton, autoRotate && styles.glassPillButtonActive]}
          >
            <Feather name="rotate-cw" size={13} color={autoRotate ? "#10B981" : "#8DA89F"} />
            <Text style={[styles.glassPillText, autoRotate && styles.glassPillTextActive]}>
              {autoRotate ? "Rotation" : "Manuel"}
            </Text>
          </Pressable>
        </View>

        {/* View Angle Presets */}
        <View style={styles.angleSelector}>
          {(["iso", "front", "side", "rear"] as const).map((view) => {
            const labels = { iso: "3D", front: "Front", side: "Side", rear: "Bag" };
            const isActive = cameraView === view;
            return (
              <Pressable
                key={view}
                onPress={() => setPresetAngle(view)}
                style={[styles.angleBtn, isActive && styles.angleBtnActive]}
              >
                <Text style={[styles.angleBtnText, isActive && styles.angleBtnTextActive]}>
                  {labels[view]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Drag Hint */}
        <View style={styles.dragHintRow}>
          <Feather name="move" size={12} color="#5C766E" />
          <Text style={styles.dragHintText}>Træk for at rotere 360° · Rul for zoom</Text>
        </View>
      </View>

      {/* Info bar below viewer */}
      <View style={styles.colorInfoRow}>
        <View style={styles.colorInfoLeft}>
          <View style={[styles.colorSwatchLarge, { backgroundColor: colorHex }]} />
          <View>
            <Text style={styles.colorNameTitle}>{colorName}</Text>
            <Text style={styles.colorSubTitle}>Dynamisk autolakering i realtid</Text>
          </View>
        </View>

        <View style={styles.statusChipsRow}>
          {chargingState === "Charging" ? (
            <View style={styles.statusChipEmerald}>
              <Feather name="zap" size={11} color="#10B981" />
              <Text style={styles.statusChipTextEmerald}>Lader aktiv</Text>
            </View>
          ) : null}
          {locked != null ? (
            <View style={locked ? styles.statusChipNeutral : styles.statusChipCoral}>
              <Feather name={locked ? "lock" : "unlock"} size={11} color={locked ? "#8DA89F" : "#E87555"} />
              <Text style={locked ? styles.statusChipTextNeutral : styles.statusChipTextCoral}>
                {locked ? "Låst" : "Ulåst"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// Helper to build a procedural high-quality aerodynamic Tesla Sedan
function buildProceduralTesla(
  carGroup: THREE.Group,
  materials: {
    bodyPaint: THREE.Material;
    glassMat: THREE.Material;
    darkTrimMat: THREE.Material;
    tireRubberMat: THREE.Material;
    wheelRimMat: THREE.Material;
    headlightMat: THREE.Material;
    taillightMat: THREE.Material;
  }
) {
  const {
    bodyPaint,
    glassMat,
    darkTrimMat,
    tireRubberMat,
    wheelRimMat,
    headlightMat,
    taillightMat,
  } = materials;

  const car = new THREE.Group();

  // 1. Lower chassis / underbody
  const lowerChassisGeo = new THREE.BoxGeometry(1.68, 0.28, 3.8);
  const lowerChassis = new THREE.Mesh(lowerChassisGeo, darkTrimMat);
  lowerChassis.position.y = 0.35;
  lowerChassis.castShadow = true;
  lowerChassis.receiveShadow = true;
  car.add(lowerChassis);

  // 2. Main aerodynamic body section
  const mainBodyGeo = new THREE.BoxGeometry(1.72, 0.38, 3.7);
  const mainBody = new THREE.Mesh(mainBodyGeo, bodyPaint);
  mainBody.position.y = 0.54;
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  car.add(mainBody);

  // 3. Front hood (sloping downward aerodynamically)
  const hoodGeo = new THREE.BoxGeometry(1.66, 0.24, 1.15);
  const hood = new THREE.Mesh(hoodGeo, bodyPaint);
  hood.position.set(0, 0.58, 1.25);
  hood.rotation.x = -0.09;
  hood.castShadow = true;
  car.add(hood);

  // Front nose cone (Tesla signature grille-less front)
  const noseGeo = new THREE.CylinderGeometry(0.81, 0.83, 0.3, 32, 1, false, 0, Math.PI);
  const nose = new THREE.Mesh(noseGeo, bodyPaint);
  nose.rotation.y = Math.PI / 2;
  nose.rotation.z = Math.PI / 2;
  nose.position.set(0, 0.46, 1.83);
  car.add(nose);

  // 4. Rear fastback trunk & decklid
  const trunkGeo = new THREE.BoxGeometry(1.64, 0.26, 0.85);
  const trunk = new THREE.Mesh(trunkGeo, bodyPaint);
  trunk.position.set(0, 0.65, -1.35);
  trunk.rotation.x = 0.08;
  trunk.castShadow = true;
  car.add(trunk);

  // 5. Cabin Greenhouse (Glass Panoramic Roof)
  const cabinGeo = new THREE.BoxGeometry(1.42, 0.46, 1.95);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.88, -0.05);
  cabin.castShadow = true;
  car.add(cabin);

  // Roof pillars (A-pillar and C-pillar fastback sweep)
  const roofTopGeo = new THREE.BoxGeometry(1.36, 0.04, 1.4);
  const roofTop = new THREE.Mesh(roofTopGeo, glassMat);
  roofTop.position.set(0, 1.12, -0.05);
  car.add(roofTop);

  // Windshield frame
  const windshieldGeo = new THREE.BoxGeometry(1.4, 0.04, 0.85);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, 0.86, 0.8);
  windshield.rotation.x = -0.58;
  car.add(windshield);

  // Rear fastback window
  const rearWindowGeo = new THREE.BoxGeometry(1.38, 0.04, 0.95);
  const rearWindow = new THREE.Mesh(rearWindowGeo, glassMat);
  rearWindow.position.set(0, 0.88, -0.95);
  rearWindow.rotation.x = 0.52;
  car.add(rearWindow);

  // 6. Side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.1);
  const leftMirror = new THREE.Mesh(mirrorGeo, bodyPaint);
  leftMirror.position.set(0.92, 0.78, 0.55);
  const rightMirror = new THREE.Mesh(mirrorGeo, bodyPaint);
  rightMirror.position.set(-0.92, 0.78, 0.55);
  car.add(leftMirror);
  car.add(rightMirror);

  // 7. Flush Door handles
  const handleGeo = new THREE.BoxGeometry(0.02, 0.03, 0.14);
  const handleFL = new THREE.Mesh(handleGeo, darkTrimMat);
  handleFL.position.set(0.87, 0.62, 0.35);
  const handleFR = new THREE.Mesh(handleGeo, darkTrimMat);
  handleFR.position.set(-0.87, 0.62, 0.35);
  const handleRL = new THREE.Mesh(handleGeo, darkTrimMat);
  handleRL.position.set(0.87, 0.62, -0.45);
  const handleRR = new THREE.Mesh(handleGeo, darkTrimMat);
  handleRR.position.set(-0.87, 0.62, -0.45);
  car.add(handleFL);
  car.add(handleFR);
  car.add(handleRL);
  car.add(handleRR);

  // 8. Headlights (Tesla LED eye shape)
  const headlightGeo = new THREE.BoxGeometry(0.32, 0.07, 0.16);
  const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  leftHeadlight.position.set(0.62, 0.54, 1.8);
  leftHeadlight.rotation.y = -0.25;
  const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  rightHeadlight.position.set(-0.62, 0.54, 1.8);
  rightHeadlight.rotation.y = 0.25;
  car.add(leftHeadlight);
  car.add(rightHeadlight);

  // 9. Full-width Rear Taillight blade
  const taillightGeo = new THREE.BoxGeometry(1.58, 0.06, 0.06);
  const taillight = new THREE.Mesh(taillightGeo, taillightMat);
  taillight.position.set(0, 0.64, -1.82);
  car.add(taillight);

  // 10. Wheels (4 corners: front-left, front-right, rear-left, rear-right)
  const wheelPositions = [
    { x: 0.84, z: 1.15 },
    { x: -0.84, z: 1.15 },
    { x: 0.84, z: -1.15 },
    { x: -0.84, z: -1.15 },
  ];

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos.x, 0.32, pos.z);

    // Tire (torus / cylinder)
    const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 24);
    const tire = new THREE.Mesh(tireGeo, tireRubberMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Aero Rim
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.21, 16);
    const rim = new THREE.Mesh(rimGeo, wheelRimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Rim center cap
    const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 16);
    const cap = new THREE.Mesh(capGeo, darkTrimMat);
    cap.rotation.z = Math.PI / 2;
    wheelGroup.add(cap);

    car.add(wheelGroup);
  });

  carGroup.add(car);
}

const styles = StyleSheet.create({
  viewerCard: {
    backgroundColor: "#0B1A17",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E423A",
    overflow: "hidden",
    marginBottom: 6,
  },
  canvasContainer: {
    width: "100%",
    height: 310,
    backgroundColor: "#081310",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderWrap: {
    position: "absolute",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
  },
  loaderText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: "#8DA89F",
  },
  topOverlayRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
    pointerEvents: "box-none",
    gap: 8,
  },
  modelSelectorPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    backgroundColor: "rgba(11, 26, 23, 0.85)",
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E423A",
  },
  modelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  modelPillActive: {
    backgroundColor: "#0B694F",
  },
  modelPillText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#8DA89F",
  },
  modelPillTextActive: {
    color: "#FFFFFF",
  },
  colorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  glassPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(11, 26, 23, 0.85)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E423A",
  },
  glassPillButtonActive: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  glassPillText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#8DA89F",
  },
  glassPillTextActive: {
    color: "#10B981",
  },
  angleSelector: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    gap: 6,
    zIndex: 10,
  },
  angleBtn: {
    backgroundColor: "rgba(17, 38, 34, 0.85)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E423A",
  },
  angleBtnActive: {
    backgroundColor: "#0B694F",
    borderColor: "#10B981",
  },
  angleBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#8DA89F",
  },
  angleBtnTextActive: {
    color: "#FFFFFF",
  },
  dragHintRow: {
    position: "absolute",
    bottom: 14,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(11, 26, 23, 0.75)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dragHintText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: "#5C766E",
  },
  colorInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#112622",
    borderTopWidth: 1,
    borderTopColor: "#1E423A",
  },
  colorInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colorSwatchLarge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  colorNameTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: "#F8FAF8",
  },
  colorSubTitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "#8DA89F",
    marginTop: 1,
  },
  statusChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusChipEmerald: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  statusChipTextEmerald: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#10B981",
  },
  statusChipCoral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(232, 117, 85, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 117, 85, 0.35)",
  },
  statusChipTextCoral: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#E87555",
  },
  statusChipNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  statusChipTextNeutral: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#8DA89F",
  },
});
