"use client";

import { BALL_DIAMETER, BALL_RADIUS } from "@/lib/sticky/constants";
import { STICKY_COLOR_HEX } from "@/lib/sticky/colors";
import { findInvalidBallIds } from "@/lib/sticky/validateSpacing";
import { useEditorStore } from "@/state/editorStore";
import { Grid, OrbitControls, Outlines } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Box3, Vector3 } from "three";

function BallMesh({
  id,
  position,
  color,
  selected,
  invalid,
}: {
  id: string;
  position: [number, number, number];
  color: string;
  selected: boolean;
  invalid: boolean;
}) {
  const setSelectedId = useEditorStore((state) => state.setSelectedId);

  return (
    <mesh
      position={position}
      scale={selected ? 1.06 : 1}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedId(id);
      }}
    >
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={invalid ? "#ff2a2a" : "#000000"}
        emissiveIntensity={invalid ? 0.55 : 0}
        roughness={0.35}
        metalness={0.05}
      />
      {selected ? <Outlines thickness={3} color="#ffffff" /> : null}
      {invalid && !selected ? <Outlines thickness={2.5} color="#ff4d4d" /> : null}
    </mesh>
  );
}

function FitCamera({ nonce }: { nonce: number }) {
  const balls = useEditorStore((state) => state.document.payload.balls);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);

  useEffect(() => {
    if (nonce === 0) {
      return;
    }
    const box = new Box3();
    if (balls.length === 0) {
      box.setFromCenterAndSize(
        new Vector3(0, BALL_RADIUS, 0),
        new Vector3(BALL_DIAMETER * 4, BALL_DIAMETER * 4, BALL_DIAMETER * 4),
      );
    } else {
      for (const ball of balls) {
        box.expandByPoint(new Vector3(ball.position.x, ball.position.y, ball.position.z));
      }
      box.expandByScalar(BALL_RADIUS * 2);
    }
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const radius = Math.max(size.x, size.y, size.z, BALL_DIAMETER * 2);
    camera.position.set(center.x + radius * 1.4, center.y + radius * 1.1, center.z + radius * 1.4);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    if (controls && "target" in controls) {
      (controls as { target: Vector3 }).target.copy(center);
      if ("update" in controls && typeof controls.update === "function") {
        controls.update();
      }
    }
  }, [balls, camera, controls, nonce]);

  return null;
}

function SceneContents() {
  const balls = useEditorStore((state) => state.document.payload.balls);
  const selectedId = useEditorStore((state) => state.selectedId);
  const cameraFitNonce = useEditorStore((state) => state.cameraFitNonce);
  const spacingTolerance = useEditorStore((state) => state.spacingTolerance);
  const invalidIds = useMemo(
    () => findInvalidBallIds(balls, spacingTolerance),
    [balls, spacingTolerance],
  );

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 12, 6]} intensity={1.15} />
      <directionalLight position={[-6, 4, -8]} intensity={0.35} />
      <Grid
        args={[12, 12]}
        cellSize={BALL_DIAMETER}
        cellThickness={0.6}
        sectionSize={BALL_DIAMETER * 5}
        sectionThickness={1}
        fadeDistance={24}
        infiniteGrid
        position={[0, 0, 0]}
      />
      {balls.map((ball) => (
        <BallMesh
          key={ball.id}
          id={ball.id}
          position={[ball.position.x, ball.position.y, ball.position.z]}
          color={STICKY_COLOR_HEX[ball.color]}
          selected={ball.id === selectedId}
          invalid={invalidIds.has(ball.id)}
        />
      ))}
      <FitCamera nonce={cameraFitNonce} />
      <OrbitControls makeDefault enablePan enableRotate enableZoom />
    </>
  );
}

export function Viewport() {
  const setSelectedId = useEditorStore((state) => state.setSelectedId);

  return (
    <Canvas
      className="viewport-canvas"
      camera={{ position: [2.6, 2, 3.4], fov: 50, near: 0.05 }}
      onPointerMissed={() => setSelectedId(null)}
    >
      <color attach="background" args={["#12141a"]} />
      <SceneContents />
    </Canvas>
  );
}

export default Viewport;
