"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  GridHelper,
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const WORLD_RADIUS = 40;
const PLAYER_HEIGHT = 1.6;
const MAX_HP = 3;
const FLOOR_Y = 0;

const PLAYER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", 
  "#9b59b6", "#1abc9c", "#e91e63", "#00bcd4"
];

function createPlayerModel(color: string) {
  const root = new Group();
  const add = (
    geo: BoxGeometry,
    hex: string,
    position: [number, number, number],
    scale?: [number, number, number],
  ) => {
    const mat = new MeshLambertMaterial({ color: hex });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    root.add(mesh);
  };

  const body = new BoxGeometry(1.2, 1.6, 0.7);
  const limb = new BoxGeometry(0.35, 1.2, 0.35);
  const head = new BoxGeometry(0.85, 0.9, 0.8);
  const shoulder = new BoxGeometry(1.6, 0.25, 0.5);
  const hair = new BoxGeometry(0.9, 0.3, 0.85);

  add(body, color, [0, 1.5, 0]);
  add(head, "#f7d8a6", [0, 2.65, 0]);
  add(hair, "#2f2a28", [0, 3.05, 0]);
  add(shoulder, "#304666", [0, 2.2, 0]);
  add(limb, "#304666", [-0.45, 1.0, 0.05]);
  add(limb, "#304666", [0.45, 1.0, 0.05]);
  add(limb, "#2e5d53", [-0.3, 0.2, 0]);
  add(limb, "#2e5d53", [0.3, 0.2, 0]);
  return root;
}

function buildPlayerGun() {
  const group = new Group();
  const addPiece = (
    geo: BoxGeometry,
    color: string,
    position: [number, number, number],
    scale?: [number, number, number],
  ) => {
    const mat = new MeshLambertMaterial({ color });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    group.add(mesh);
  };
  addPiece(new BoxGeometry(0.2, 0.6, 0.2), "#0d1b2f", [0, -0.2, 0]);
  addPiece(new BoxGeometry(0.7, 0.4, 0.4), "#1a2f4a", [0.2, 0.2, 0]);
  addPiece(new BoxGeometry(0.6, 0.2, 0.2), "#8fb0d8", [0.55, 0.35, 0]);
  addPiece(new BoxGeometry(0.4, 0.18, 0.18), "#c5d8f1", [0.8, 0.2, 0]);
  addPiece(new BoxGeometry(0.12, 0.12, 0.3), "#0f1724", [-0.05, 0, -0.2]);
  addPiece(new BoxGeometry(0.12, 0.12, 0.3), "#0f1724", [-0.05, 0, 0.2]);
  addPiece(new BoxGeometry(0.15, 0.08, 0.08), "#f5c05c", [0.25, 0.5, 0]);
  return group;
}

export default function FPSGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const remoteMeshesRef = useRef<Group[]>([]);
  const animationRef = useRef<number | null>(null);
  const gunRef = useRef<Group | null>(null);
  const recoilRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const targetsRef = useRef<Group[]>([]);
  const projectileRef = useRef<Group | null>(null);
  
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [isDead, setIsDead] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const playerColor = useMemo(() => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)], []);

  useEffect(() => {
    if (!mountRef.current || !gameStarted) return;

    const scene = new Scene();
    scene.background = new Color("#1a1a2e");

    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, PLAYER_HEIGHT, 10);
    scene.add(camera);

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    audioRef.current = new AudioContext();

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Lighting
    const hemi = new HemisphereLight("#e7f3ff", "#9bb5d3", 1.1);
    hemi.position.set(0, 20, 0);
    scene.add(hemi);

    const ambient = new DirectionalLight("#ffffff", 0.9);
    ambient.position.set(12, 18, 10);
    scene.add(ambient);

    const keyLight = new DirectionalLight("#f7d046", 0.6);
    keyLight.position.set(-6, 10, -6);
    scene.add(keyLight);

    // Floor
    const floorGeo = new PlaneGeometry(200, 200);
    const floorMat = new MeshLambertMaterial({ color: "#16213e" });
    const floor = new Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    scene.add(floor);

    const grid = new GridHelper(200, 40, "#0f3460", "#1a4a7a");
    (grid.material as any).opacity = 0.3;
    (grid.material as any).transparent = true;
    grid.position.y = FLOOR_Y + 0.02;
    scene.add(grid);

    // Walls
    const wallGeo = new BoxGeometry(200, 8, 2);
    const wallMat = new MeshLambertMaterial({ color: "#0f3460" });
    const makeWall = (x: number, z: number, rotY: number) => {
      const wall = new Mesh(wallGeo, wallMat);
      wall.position.set(x, 4, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      scene.add(wall);
    };
    makeWall(0, -WORLD_RADIUS, 0);
    makeWall(0, WORLD_RADIUS, 0);
    makeWall(-WORLD_RADIUS, 0, Math.PI / 2);
    makeWall(WORLD_RADIUS, 0, Math.PI / 2);

    // Obstacles
    for (let i = 0; i < 12; i++) {
      const w = 2 + Math.random() * 6;
      const h = 1 + Math.random() * 4;
      const d = 2 + Math.random() * 8;
      const geo = new BoxGeometry(w, h, d);
      const mat = new MeshLambertMaterial({
        color: new Color().setHSL(0.6 + Math.random() * 0.15, 0.5, 0.4),
      });
      const box = new Mesh(geo, mat);
      box.position.set(
        (Math.random() - 0.5) * (WORLD_RADIUS * 1.2),
        FLOOR_Y + h / 2,
        (Math.random() - 0.5) * (WORLD_RADIUS * 1.2),
      );
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
    }

    // Add some targets
    const spawnTarget = () => {
      const group = new Group();
      const geo = new BoxGeometry(1.5, 2, 1.5);
      const mat = new MeshLambertMaterial({ color: "#e74c3c" });
      const mesh = new Mesh(geo, mat);
      mesh.position.y = 1;
      group.add(mesh);
      
      // Eye
      const eyeGeo = new BoxGeometry(0.3, 0.3, 0.1);
      const eyeMat = new MeshLambertMaterial({ color: "#000" });
      const eye1 = new Mesh(eyeGeo, eyeMat);
      eye1.position.set(-0.3, 1.5, 0.7);
      const eye2 = new Mesh(eyeGeo, eyeMat);
      eye2.position.set(0.3, 1.5, 0.7);
      group.add(eye1, eye2);
      
      group.position.set(
        (Math.random() - 0.5) * WORLD_RADIUS,
        FLOOR_Y,
        (Math.random() - 0.5) * WORLD_RADIUS,
      );
      scene.add(group);
      targetsRef.current.push(group);
      return group;
    };

    // Initial targets
    for (let i = 0; i < 5; i++) spawnTarget();

    // Gun
    const gunBasePosition = new Vector3(0.6, -0.55, -1.05);
    const gun = buildPlayerGun();
    gun.position.copy(gunBasePosition);
    gun.rotation.y = -0.2;
    gunRef.current = gun;
    camera.add(gun);

    // Player movement
    const pressed = { forward: false, backward: false, left: false, right: false };
    const velocity = new Vector3();
    const direction = new Vector3();
    const raycaster = new Raycaster();

    const randomSpawn = () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 10;
      return new Vector3(Math.cos(angle) * dist, PLAYER_HEIGHT, Math.sin(angle) * dist);
    };

    controls.object.position.copy(randomSpawn());

    const playShotSound = () => {
      const ctx = audioRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": pressed.forward = true; break;
        case "KeyS": case "ArrowDown": pressed.backward = true; break;
        case "KeyA": case "ArrowLeft": pressed.left = true; break;
        case "KeyD": case "ArrowRight": pressed.right = true; break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": pressed.forward = false; break;
        case "KeyS": case "ArrowDown": pressed.backward = false; break;
        case "KeyA": case "ArrowLeft": pressed.left = false; break;
        case "KeyD": case "ArrowRight": pressed.right = false; break;
      }
    };

    const handleClick = () => {
      if (!controls.isLocked) controls.lock();
    };

    const handleShoot = () => {
      if (!controls.isLocked || isDead) return;
      recoilRef.current = 1;
      playShotSound();
      
      raycaster.setFromCamera(new Vector2(0, 0), camera);
      const hits = raycaster.intersectObjects(targetsRef.current, true);
      
      if (hits.length > 0) {
        const targetGroup = hits[0].object.parent as Group;
        if (targetGroup && targetsRef.current.includes(targetGroup)) {
          scene.remove(targetGroup);
          targetsRef.current = targetsRef.current.filter(t => t !== targetGroup);
          setScore(s => s + 100);
          
          // Respawn new target
          setTimeout(() => {
            if (targetsRef.current.length < 8) spawnTarget();
          }, 1000);
        }
      }
    };

    const animate = () => {
      const delta = 1 / 60;
      const speed = controls.isLocked ? 25.0 : 0;

      velocity.x -= velocity.x * 8.0 * delta;
      velocity.z -= velocity.z * 8.0 * delta;

      direction.z = Number(pressed.forward) - Number(pressed.backward);
      direction.x = Number(pressed.right) - Number(pressed.left);
      direction.normalize();

      if (pressed.forward || pressed.backward)
        velocity.z -= direction.z * speed * delta;
      if (pressed.left || pressed.right)
        velocity.x -= direction.x * speed * delta;

      controls.moveRight(-velocity.x * delta);
      controls.moveForward(-velocity.z * delta);

      // Gun animation
      if (gunRef.current) {
        recoilRef.current = Math.max(0, recoilRef.current - delta * 6);
        const targetPos = gunBasePosition.clone().add(
          new Vector3(0.05, -0.05, -0.2).multiplyScalar(recoilRef.current)
        );
        gunRef.current.position.lerp(targetPos, 0.25);
        gunRef.current.rotation.x = -0.2 * recoilRef.current;
      }

      // Clamp position
      const clamp = WORLD_RADIUS - 6;
      controls.object.position.set(
        Math.max(-clamp, Math.min(clamp, controls.object.position.x)),
        PLAYER_HEIGHT,
        Math.max(-clamp, Math.min(clamp, controls.object.position.z)),
      );

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", handleResize);
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("mousedown", handleShoot);

    // Damage timer (enemies shoot back!)
    const damageInterval = setInterval(() => {
      if (controls.isLocked && !isDead && targetsRef.current.length > 0) {
        // Random damage
        if (Math.random() < 0.01) {
          setHp(h => {
            const next = Math.max(0, h - 1);
            if (next <= 0) setIsDead(true);
            return next;
          });
        }
      }
    }, 500);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("mousedown", handleShoot);
      animationRef.current && cancelAnimationFrame(animationRef.current);
      clearInterval(damageInterval);
      
      targetsRef.current.forEach(t => scene.remove(t));
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
      controls.dispose();
    };
  }, [gameStarted, isDead]);

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setHp(MAX_HP);
    setIsDead(false);
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a3e] overflow-hidden">
      {!gameStarted ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-8">
              🎮 FPS Shooter
            </h1>
            <p className="text-gray-400 mb-8 text-lg">
              WASD 移动 · 鼠标瞄准 · 点击射击
            </p>
            <button
              onClick={startGame}
              className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xl font-bold rounded-full hover:scale-105 transition shadow-lg shadow-cyan-500/30"
            >
              开始游戏
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* HUD */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-lg">
              <div className="text-cyan-400 text-sm">SCORE</div>
              <div className="text-3xl font-bold text-white">{score}</div>
            </div>
          </div>
          
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-lg">
              <div className="text-red-400 text-sm">HP</div>
              <div className="flex gap-1">
                {[...Array(MAX_HP)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-4 rounded ${
                      i < hp ? "bg-green-500" : "bg-gray-600"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-10 text-gray-400 text-sm">
            <p>移动: WASD · 瞄准: 鼠标 · 射击: 点击</p>
            <p>击中红色敌人得分!</p>
          </div>

          {isDead && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
              <div className="text-center">
                <h2 className="text-5xl font-bold text-red-500 mb-4">游戏结束</h2>
                <p className="text-2xl text-white mb-8">得分: {score}</p>
                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xl font-bold rounded-full hover:scale-105 transition"
                >
                  重新开始
                </button>
              </div>
            </div>
          )}

          <div ref={mountRef} className="absolute inset-0" />
        </>
      )}
    </div>
  );
}