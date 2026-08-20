import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A single holographic 3D ticket rendered with real weight — the hero's one
 * "hard idea". Vanilla three.js (no heavy React wrappers): an extruded, rounded
 * ticket with a punch-hole, glowing neon edges, colored key lights, and a soft
 * particle field. Rotates gently, reacts to the pointer, and drifts with scroll.
 * Gracefully no-ops if WebGL is unavailable or the user prefers reduced motion.
 */
export default function TicketHero3D() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL — the CSS gradient behind us is the fallback
    }

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || 600;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    // --- Ticket geometry: rounded rectangle with a punch-hole ---
    const W = 3.4;
    const H = 1.9;
    const r = 0.22;
    const shape = new THREE.Shape();
    const x = -W / 2;
    const y = -H / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + W - r, y);
    shape.quadraticCurveTo(x + W, y, x + W, y + r);
    shape.lineTo(x + W, y + H - r);
    shape.quadraticCurveTo(x + W, y + H, x + W - r, y + H);
    shape.lineTo(x + r, y + H);
    shape.quadraticCurveTo(x, y + H, x, y + H - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    const hole = new THREE.Path();
    hole.absarc(W / 2 - 0.62, 0, 0.14, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 4,
      curveSegments: 32,
    });
    geo.center();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x121a38,
      metalness: 0.9,
      roughness: 0.22,
      emissive: 0x0b1030,
      emissiveIntensity: 0.5,
    });
    const ticket = new THREE.Mesh(geo, mat);

    // Neon edge outline (self-lit, always visible)
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 25),
      new THREE.LineBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.85 })
    );

    const group = new THREE.Group();
    group.add(ticket, edges);
    group.rotation.set(-0.15, -0.5, 0.05);
    scene.add(group);

    // --- Lights (violet / blue / teal accents + soft key) ---
    scene.add(new THREE.AmbientLight(0x33406a, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 5);
    scene.add(key);
    const mkPoint = (color, pos) => {
      const l = new THREE.PointLight(color, 70, 40, 2);
      l.position.set(...pos);
      scene.add(l);
      return l;
    };
    mkPoint(0xa78bfa, [4, 2.5, 3]);
    mkPoint(0x60a5fa, [-4.5, -2, 3]);
    mkPoint(0x5eead4, [0, 3.5, -3]);

    // --- Particle field ---
    const COUNT = 320;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0x9db4ff, size: 0.03, transparent: true, opacity: 0.55, depthWrite: false })
    );
    scene.add(particles);

    // --- Interaction state ---
    const pointer = { x: 0, y: 0 };
    let scrollN = 0;
    const onPointer = (e) => {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      scrollN = Math.min(window.scrollY / (window.innerHeight || 800), 1.4);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const render = () => {
      const t = clock.getElapsedTime();
      const targetY = -0.5 + pointer.x * 0.5 + scrollN * 0.6;
      const targetX = -0.15 + pointer.y * 0.35 + scrollN * 0.25;
      group.rotation.y += (targetY - group.rotation.y) * 0.06 + 0.0016;
      group.rotation.x += (targetX - group.rotation.x) * 0.06;
      group.position.y = Math.sin(t * 0.8) * 0.08 - scrollN * 0.6;
      particles.rotation.y = t * 0.02;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    if (reduce) {
      renderer.render(scene, camera); // single static frame
    } else {
      render();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
      edges.geometry.dispose();
      edges.material.dispose();
      pGeo.dispose();
      particles.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="lp-canvas" aria-hidden="true" />;
}
