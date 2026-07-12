import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const ACCENT = '#5e6ad2';
const NODE = '#8a8f98';
const HOVER = '#c8cce0';
const LINK_DIM = '#3a3d47';

const nodes = [
  { id: 0,  x: 0,    y: 90,   z: -10,  accent: true },
  { id: 1,  x: -100, y: 50,   z: 40 },
  { id: 2,  x: 90,   y: 60,   z: -50 },
  { id: 3,  x: -50,  y: -30,  z: 60,  accent: true },
  { id: 4,  x: -140, y: 10,   z: -20 },
  { id: 5,  x: -60,  y: 30,   z: 70 },
  { id: 6,  x: 50,   y: -20,  z: 30 },
  { id: 7,  x: 130,  y: 10,   z: -10 },
  { id: 8,  x: 80,   y: -60,  z: -40 },
  { id: 9,  x: -30,  y: -70,  z: 50,  accent: true },
  { id: 10, x: -110, y: -50,  z: -30 },
  { id: 11, x: 120,  y: -50,  z: 20 },
  { id: 12, x: -70,  y: -100, z: 10 },
  { id: 13, x: 30,   y: -110, z: -50 },
  { id: 14, x: 100,  y: -90,  z: 40 },
  { id: 15, x: -150, y: -80,  z: 30 },
  { id: 16, x: -20,  y: 120,  z: -30 },
  { id: 17, x: 140,  y: 70,   z: 20 },
  { id: 18, x: -90,  y: 80,   z: -50 },
  { id: 19, x: 60,   y: 100,  z: 60 },
  { id: 20, x: -40,  y: -130, z: -20 },
  { id: 21, x: 110,  y: -120, z: -30 },
];

const links = [
  { source: 0, target: 1 },
  { source: 0, target: 2 },
  { source: 0, target: 16 },
  { source: 0, target: 18 },
  { source: 0, target: 19 },
  { source: 0, target: 9, accent: true },
  { source: 1, target: 4 },
  { source: 1, target: 5 },
  { source: 1, target: 18 },
  { source: 2, target: 6 },
  { source: 2, target: 7 },
  { source: 2, target: 17 },
  { source: 3, target: 5 },
  { source: 3, target: 6 },
  { source: 3, target: 9 },
  { source: 3, target: 12 },
  { source: 4, target: 10 },
  { source: 4, target: 15 },
  { source: 5, target: 12 },
  { source: 6, target: 8 },
  { source: 6, target: 11 },
  { source: 7, target: 11 },
  { source: 7, target: 17 },
  { source: 8, target: 13 },
  { source: 8, target: 14 },
  { source: 9, target: 12 },
  { source: 9, target: 13 },
  { source: 10, target: 15 },
  { source: 11, target: 14 },
  { source: 12, target: 20 },
  { source: 13, target: 21 },
  { source: 14, target: 21 },
  { source: 16, target: 19 },
  { source: 18, target: 16 },
];

const SIZE = 540;

// Ponytail: custom Three.js node meshes — emissive icosahedrons for glow.
const makeNode = (node) => {
  const r = node.accent ? 7 : 4;
  const color = node.accent ? ACCENT : NODE;
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: node.accent ? 0.5 : 0.1,
    roughness: 0.6,
    metalness: 0.3,
    transparent: true,
    opacity: 0.95,
  });
  return new THREE.Mesh(geo, mat);
};

export default function FrontierIllustration({ className }) {
  const containerRef = useRef();
  const fgRef = useRef();
  const lightsRef = useRef(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dims, setDims] = useState({ w: SIZE, h: SIZE });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      if (w > 0 && h > 0) setDims({ w: Math.round(w), h: Math.round(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const ctrl = fg.cameraControls;
    if (ctrl) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.4;
      ctrl.enableZoom = false;
      ctrl.enablePan = false;
      ctrl.minDistance = 180;
      ctrl.maxDistance = 400;
    }
    // Add lights once for emissive materials
    if (!lightsRef.current) {
      lightsRef.current = true;
      const scene = fg.scene();
      if (scene) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const p1 = new THREE.PointLight(0x5e6ad2, 2.5, 700);
        p1.position.set(0, 150, 250);
        scene.add(p1);
        const p2 = new THREE.PointLight(0x8a8f98, 0.8, 500);
        p2.position.set(-120, -60, -120);
        scene.add(p2);
      }
    }
  }, []);

  const nodeVal = useCallback((n) => (n.accent ? 6 : 3), []);

  const nodeColor = useCallback((n) => {
    if (n.accent) return ACCENT;
    return hoveredNode === n.id ? HOVER : NODE;
  }, [hoveredNode]);

  const linkColor = useCallback((l) => {
    if (l.accent) return ACCENT;
    return hoveredNode != null && (l.source?.id === hoveredNode || l.target?.id === hoveredNode)
      ? HOVER
      : LINK_DIM;
  }, [hoveredNode]);

  const linkWidth = useCallback((l) => {
    if (l.accent) return 2.5;
    return hoveredNode != null && (l.source?.id === hoveredNode || l.target?.id === hoveredNode)
      ? 1.4
      : 0.6;
  }, [hoveredNode]);

  const onNodeHover = useCallback((node) => {
    setHoveredNode(node?.id ?? null);
  }, []);

  const onNodeClick = useCallback((node) => {
    const fg = fgRef.current;
    if (!fg) return;
    const d = 140;
    const a = Math.PI / 5;
    fg.cameraPosition(
      { x: node.x + d, y: node.y + d * Math.sin(a), z: node.z + d },
      { x: node.x, y: node.y, z: node.z },
      900,
    );
  }, []);

  return (
    <div ref={containerRef} className={`frontier-graph ${className ?? ''}`}>
      <ForceGraph3D
        ref={fgRef}
        width={dims.w}
        height={dims.h}
        graphData={{ nodes, links }}
        nodeThreeObject={makeNode}
        nodeVal={nodeVal}
        nodeColor={nodeColor}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.7}
        linkCurvature={(l) => (l.accent ? 0.2 : 0.05)}
        linkDirectionalParticles={(l) => (l.accent ? 8 : hoveredNode != null && (l.source?.id === hoveredNode || l.target?.id === hoveredNode) ? 3 : 0)}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleSpeed={0.012}
        linkDirectionalParticleColor={() => ACCENT}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        enablePointerInteraction={true}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
        warmupTicks={40}
        cooldownTicks={0}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
