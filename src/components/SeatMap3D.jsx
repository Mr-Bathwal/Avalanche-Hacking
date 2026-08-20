import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A tiered 3D arena of seats rendered in WebGL. Seats are colored by tier and
 * availability, glow on hover, and lift when selected. Clicking an available
 * seat calls onSelect(seat) — the same state the 2D grid drives, so both stay
 * in sync. Purely presentational: no wallet / tx logic lives here.
 *
 * props:
 *   seats: [{ number, isVIP, isMinted, price }]
 *   selectedNumber: number | null
 *   onSelect: (seat) => void
 */
export default function SeatMap3D({ seats = [], selectedNumber = null, onSelect }) {
  const mountRef = useRef(null);
  const selectedRef = useRef(selectedNumber);
  const onSelectRef = useRef(onSelect);
  selectedRef.current = selectedNumber;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || seats.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 440;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);

    scene.add(new THREE.AmbientLight(0x415174, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 8, 6);
    scene.add(key);
    const p1 = new THREE.PointLight(0xa78bfa, 40, 60, 2); p1.position.set(-6, 5, 4); scene.add(p1);
    const p2 = new THREE.PointLight(0x5eead4, 30, 60, 2); p2.position.set(6, 4, -4); scene.add(p2);

    // ── Colors per state ──
    const C = {
      reg: new THREE.Color(0x3b82f6),
      vip: new THREE.Color(0xf5b342),
      taken: new THREE.Color(0x6b2740),
      selected: new THREE.Color(0x2dd4bf),
    };

    const COLS = 10;
    const GAP = 0.98;
    const seatGeo = new THREE.BoxGeometry(0.72, 0.16, 0.72);
    const group = new THREE.Group();
    const meshes = [];

    seats.forEach((seat, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const base = seat.isMinted ? C.taken : seat.isVIP ? C.vip : C.reg;
      const mat = new THREE.MeshStandardMaterial({
        color: base,
        metalness: 0.5,
        roughness: 0.45,
        emissive: base,
        emissiveIntensity: seat.isMinted ? 0.04 : seat.isVIP ? 0.28 : 0.16,
      });
      const m = new THREE.Mesh(seatGeo, mat);
      m.position.set((col - (COLS - 1) / 2) * GAP, row * 0.2, -row * GAP);
      m.userData = { seat, base, baseEmissive: mat.emissiveIntensity, y: m.position.y };
      group.add(m);
      meshes.push(m);
    });
    scene.add(group);

    // ── Stage (glowing bar in front) ──
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(COLS * GAP * 0.9, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x7c5cff, emissive: 0x7c5cff, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.3 })
    );
    stage.position.set(0, -0.1, GAP * 1.4);
    scene.add(stage);

    // ── Fit camera to the whole arena ──
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z, size.y);
    const dist = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.15;
    camera.position.set(center.x, center.y + maxDim * 0.62, center.z + dist + 1.5);
    camera.lookAt(center.x, center.y, center.z);

    // ── Interaction (raycast for hover + click) ──
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovered = null;
    const pick = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit ? hit.object : null;
    };
    const onMove = (e) => {
      const obj = pick(e.clientX, e.clientY);
      hovered = obj && !obj.userData.seat.isMinted ? obj : null;
      renderer.domElement.style.cursor = hovered ? "pointer" : "default";
    };
    const onClick = (e) => {
      const obj = pick(e.clientX, e.clientY);
      if (obj && !obj.userData.seat.isMinted) onSelectRef.current?.(obj.userData.seat);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const draw = () => {
      const t = clock.getElapsedTime();
      for (const m of meshes) {
        const isSel = m.userData.seat.number === selectedRef.current;
        const isHover = m === hovered;
        const targetE = m.userData.seat.isMinted
          ? 0.04
          : isSel ? 1.1 : isHover ? 0.7 : m.userData.baseEmissive;
        m.material.emissiveIntensity += (targetE - m.material.emissiveIntensity) * 0.2;
        m.material.color.copy(isSel ? C.selected : m.userData.base);
        m.material.emissive.copy(isSel ? C.selected : m.userData.base);
        const targetY = m.userData.y + (isSel ? 0.35 : 0);
        m.position.y += (targetY - m.position.y) * 0.2;
      }
      stage.material.emissiveIntensity = 0.55 + Math.sin(t * 2) * 0.15;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };
    if (reduce) renderer.render(scene, camera);
    else draw();

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      seatGeo.dispose();
      meshes.forEach((m) => m.material.dispose());
      stage.geometry.dispose();
      stage.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [seats]);

  return <div ref={mountRef} className="seat3d" />;
}
