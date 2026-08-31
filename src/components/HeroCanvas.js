import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text, MeshDistortMaterial } from '@react-three/drei';

const AbstractShape = () => {
  const meshRef = useRef();

  // Rotate the shape continuously
  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.1;
  });

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={1}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <torusKnotGeometry args={[1.6, 0.4, 128, 32]} />
        <MeshDistortMaterial
          color="#000000"
          envMapIntensity={2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={1}
          roughness={0.2}
          distort={0.3}
          speed={1.5}
        />
      </mesh>
    </Float>
  );
};

const HeroCanvas = () => {
  return (
    <div className="hero-canvas-container">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        shadows
        dpr={[1, 2]}
      >
        <color attach="background" args={['#ffffff']} />

        {/* Stark lighting to enhance extreme contrast */}
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={2}
          castShadow
        />
        <pointLight position={[-10, -10, -10]} color="#ffffff" intensity={0.5} />
        <spotLight position={[0, 5, 5]} angle={0.4} penumbra={0} intensity={3} color="#ffffff" castShadow />

        <React.Suspense fallback={null}>
          <AbstractShape />

          <Text
            position={[-4, 2, -2]}
            color="#000000"
            fontSize={1}
            maxWidth={300}
            lineHeight={1}
            letterSpacing={0.1}
            font="https://fonts.gstatic.com/s/bodonimoda/v18/aFTU7PxzjH8Lof3gXUu2W88Y1ZqXm9R_9_X0I80kR7n0.woff"
            anchorX="left"
            anchorY="middle"
          >
            ILLYRIAN
          </Text>
          <Text
            position={[-4, 0.8, -2]}
            color="#000000"
            fontSize={1.5}
            maxWidth={300}
            lineHeight={1}
            letterSpacing={0.05}
            font="https://fonts.gstatic.com/s/bodonimoda/v18/aFTU7PxzjH8Lof3gXUu2W88Y1ZqXm9R_9_X0I80kR7n0.woff"
            anchorX="left"
            anchorY="middle"
          >
            BLOODLINE
          </Text>
        </React.Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
};

export default HeroCanvas;
