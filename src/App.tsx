"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Sparkles, PointerLockControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

interface Repo {
    id: number;
    name: string;
    description: string;
    html_url: string;
    language: string;
    size: number;
    pushed_at?: string;
}

const getLanguageLabel = (lang: string | null) => {
    if (!lang || lang === "Unknown") return "Multi-Language / Core";
    return lang;
};

const getLanguageColor = (lang: string | null) => {
    switch (lang) {
        case "Java": return "#fbbf24";
        case "Python": return "#00f0ff";
        case "C#":
        case "C++": return "#00ff41";
        case "JavaScript":
        case "TypeScript": return "#facc15";
        default: return "#d946ef";
    }
};

const vertexShaderSource = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
        vUv = uv;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShaderSource = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uHover;
    uniform float uHeight;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    
    float random(vec2 p) {
        return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
        vec3 normal = normalize(vNormal);
        bool isTopFace = abs(normal.y) > 0.9;
        
        vec2 st = vUv;
        st.x *= 8.0;
        st.y *= uHeight * 2.5; 
        
        float col = floor(st.x);
        float speed = 1.0 + random(vec2(col, 0.0)) * 2.5; 
        float offset = random(vec2(col, 10.0)) * 100.0;
        
        float y = st.y + uTime * speed + offset;
        float cellIndex = floor(y);
        float randChar = random(vec2(col, cellIndex));
        float tail = fract(y);
        
        float activeCol = step(0.2, random(vec2(col, 20.0)));
        float intensity = step(0.3, randChar) * pow(tail, 3.5) * activeCol;
        
        float brightness = mix(1.0, 3.0, uHover);
        vec3 finalCodeColor = uColor * intensity * brightness;
        
        vec3 outputColor = vec3(0.015, 0.015, 0.02);
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(normal, lightDir), 0.0);
        outputColor += vec3(0.02) * diff * (1.0 - uHover * 0.5);
        
        if (!isTopFace) {
            outputColor += finalCodeColor; 
        } else {
            float gridX = step(0.85, fract(st.x));
            float gridY = step(0.85, fract(st.y));
            float edge = max(gridX, gridY);
            outputColor += uColor * edge * 0.4 * brightness;
            outputColor += uColor * 0.15 * brightness; 
        }
        
        gl_FragColor = vec4(outputColor, 1.0);
    }
`;

const Building = ({ repo, position, languageCache, setLanguageCache, audioEnabled, easterEgg, handleTargetLock }: {
    repo: Repo,
    position: [number, number, number],
    languageCache: Record<string, Record<string, number>>,
    setLanguageCache: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>,
    audioEnabled: boolean,
    easterEgg: boolean,
    handleTargetLock: (isLocked: boolean, name?: string) => void // SİSTEM MİMARİSİ: Parametre tanımlandı
}) => {
    const buildingRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const beepSrc = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExEAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
        audioRef.current = new Audio(beepSrc);
        audioRef.current.volume = 0.2;
    }, []);

    useEffect(() => {
        if (hovered && !easterEgg && !languageCache[repo.name]) {
            fetch(`https://api.github.com/repos/SuhanArda/${repo.name}/languages`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.message) {
                        setLanguageCache(prev => ({ ...prev, [repo.name]: data }));
                    }
                })
                .catch(err => console.error(err));
        }
    }, [hovered, repo.name, languageCache, setLanguageCache, easterEgg]);

    useEffect(() => {
        if (easterEgg && hovered) setHovered(false);
    }, [easterEgg, hovered]);

    const height = Math.max(1, Math.log2(Math.max(2, repo.size)) * 0.8);
    const langLabel = getLanguageLabel(repo.language);
    const colorHex = getLanguageColor(repo.language);

    const isActive = useMemo(() => {
        if (!repo.pushed_at) return false;
        const pushedDate = new Date(repo.pushed_at).getTime();
        const daysSincePush = (Date.now() - pushedDate) / (1000 * 60 * 60 * 24);
        return daysSincePush <= 14;
    }, [repo.pushed_at]);

    const threeColor = useMemo(() => new THREE.Color(colorHex), [colorHex]);
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColor: { value: threeColor },
        uHover: { value: 0 },
        uHeight: { value: height }
    }), [threeColor, height]);

    useFrame((state, delta) => {
        if (buildingRef.current) {
            const targetY = easterEgg ? -height : height / 2;
            buildingRef.current.position.y = THREE.MathUtils.lerp(
                buildingRef.current.position.y,
                targetY,
                0.05
            );
        }

        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            const targetHover = hovered ? 1 : 0;
            materialRef.current.uniforms.uHover.value = THREE.MathUtils.lerp(
                materialRef.current.uniforms.uHover.value, targetHover, 0.15
            );
        }

        if (ringRef.current && ringMaterialRef.current) {
            if (hovered) {
                ringRef.current.scale.x += delta * 6;
                ringRef.current.scale.y += delta * 6;
                ringMaterialRef.current.opacity -= delta * 1.5;
                if (ringMaterialRef.current.opacity <= 0) {
                    ringRef.current.scale.set(1, 1, 1);
                    ringMaterialRef.current.opacity = 1;
                }
            } else {
                ringRef.current.scale.set(1, 1, 1);
                ringMaterialRef.current.opacity = 0;
            }
        }
    });

    return (
        <mesh
            ref={buildingRef}
            position={[position[0], height / 2, position[2]]}
            onPointerOver={(e) => {
                if (easterEgg) return;
                e.stopPropagation();
                setHovered(true);
                handleTargetLock(true, repo.name); // SİSTEM MİMARİSİ: Hedef kilitlendi sinyali!

                if (audioEnabled && audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(() => { });
                }
            }}
            onPointerOut={() => {
                setHovered(false);
                handleTargetLock(false); // SİSTEM MİMARİSİ: Hedef kaybedildi sinyali!
            }}
        >
            <boxGeometry args={[1.5, height, 1.5]} />
            <shaderMaterial
                ref={materialRef} uniforms={uniforms}
                vertexShader={vertexShaderSource} fragmentShader={fragmentShaderSource}
                toneMapped={false}
            />
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -height / 2 + 0.1, 0]}>
                <ringGeometry args={[0.8, 1.2, 32]} />
                <meshBasicMaterial ref={ringMaterialRef} color={colorHex} transparent opacity={0} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>

            {isActive && (
                <mesh position={[0, 50, 0]}>
                    <cylinderGeometry args={[0.08, 0.08, 100, 8]} />
                    <meshBasicMaterial color={colorHex} toneMapped={false} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
                </mesh>
            )}

            {hovered && !easterEgg && (
                <Html position={[0, height / 2 + 0.5, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="bg-black/90 backdrop-blur-md border p-4 rounded-lg w-64 text-left pointer-events-auto transition-all"
                        style={{ borderColor: `${colorHex}80`, boxShadow: `0 0 20px ${colorHex}40` }}>
                        <h3 className="font-bold text-lg mb-1 truncate" style={{ color: colorHex }} title={repo.name}>{repo.name}</h3>
                        <p className="text-gray-300 text-sm mb-3">Primary: <span style={{ color: colorHex }}>{langLabel}</span></p>

                        {languageCache[repo.name] && Object.keys(languageCache[repo.name]).length > 0 && (
                            <div className="mb-4">
                                <div className="flex w-full h-1.5 rounded overflow-hidden bg-white/10 mb-2">
                                    {(() => {
                                        const langs = languageCache[repo.name];
                                        const total = Object.values(langs).reduce((acc, val) => acc + val, 0);
                                        return Object.entries(langs).map(([lang, bytes]) => (
                                            <div key={lang} style={{ width: `${(bytes / total) * 100}%`, backgroundColor: getLanguageColor(lang) }} title={`${lang}: ${((bytes / total) * 100).toFixed(1)}%`} />
                                        ));
                                    })()}
                                </div>
                                <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                                    {(() => {
                                        const langs = languageCache[repo.name];
                                        const total = Object.values(langs).reduce((acc, val) => acc + val, 0);
                                        return Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([lang, bytes]) => (
                                            <span key={lang} className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getLanguageColor(lang) }} />
                                                {lang} {((bytes / total) * 100).toFixed(0)}%
                                            </span>
                                        ));
                                    })()}
                                </div>
                            </div>
                        )}

                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer"
                            className="inline-block text-xs uppercase tracking-wider px-3 py-1.5 rounded border transition-colors mt-1"
                            style={{ backgroundColor: `${colorHex}22`, color: colorHex, borderColor: `${colorHex}80` }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colorHex}55`}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${colorHex}22`}
                        >
                            Access Repository
                        </a>
                    </div>
                </Html>
            )}
        </mesh>
    );
};

const DataTraffic = () => {
    const count = 40;
    const particlesRef = useRef<(THREE.Mesh | null)[]>([]);
    const particlesData = useMemo(() => {
        return Array.from({ length: count }).map(() => ({
            initialX: (Math.random() - 0.5) * 100,
            initialZ: (Math.random() - 0.5) * 100,
            speed: 15 + Math.random() * 25,
            axis: Math.random() > 0.5 ? 'x' : 'z',
            dir: Math.random() > 0.5 ? 1 : -1,
            color: new THREE.Color(Math.random() > 0.8 ? '#ffffff' : '#00f0ff').multiplyScalar(3)
        }));
    }, []);

    useFrame((state, delta) => {
        particlesRef.current.forEach((mesh, i) => {
            if (!mesh) return;
            const p = particlesData[i];
            if (p.axis === 'x') {
                mesh.position.x += p.speed * p.dir * delta;
                if (mesh.position.x > 50) mesh.position.x = -50;
                if (mesh.position.x < -50) mesh.position.x = 50;
            } else {
                mesh.position.z += p.speed * p.dir * delta;
                if (mesh.position.z > 50) mesh.position.z = -50;
                if (mesh.position.z < -50) mesh.position.z = 50;
            }
        });
    });

    return (
        <group>
            {particlesData.map((p, i) => (
                <mesh key={i} ref={(el) => { particlesRef.current[i] = el; }} position={[p.initialX, 0.2, p.initialZ]} scale={[p.axis === 'x' ? 3 : 0.2, 0.2, p.axis === 'z' ? 3 : 0.2]}>
                    <boxGeometry />
                    <meshBasicMaterial color={p.color} toneMapped={false} />
                </mesh>
            ))}
        </group>
    );
};

const TopSecretTower = ({ active }: { active: boolean }) => {
    const towerRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (active && towerRef.current) {
            if (towerRef.current.position.y < 6) {
                towerRef.current.position.y += delta * 15;
            }
        }
    });

    if (!active) return null;

    return (
        <mesh
            ref={towerRef}
            position={[0, -20, 0]}
            onClick={(e) => {
                e.stopPropagation();
                window.open('/cv.pdf', '_blank');
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                setHovered(false);
                document.body.style.cursor = 'auto';
            }}
        >
            <boxGeometry args={[4, 12, 4]} />
            <meshStandardMaterial
                color="#ff0000"
                emissive="#ff0000"
                emissiveIntensity={hovered ? 3 : 2}
                toneMapped={false}
            />
            <Html position={[0, 7, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                <div className="bg-red-950/90 border-2 border-red-500 p-4 rounded text-center animate-pulse shadow-[0_0_30px_rgba(255,0,0,0.8)]">
                    <h1 className="text-red-500 font-bold text-3xl tracking-widest">TOP SECRET</h1>
                    <p className="text-red-300 mt-2">SUHAN PROTOCOL INITIATED</p>
                    <div className="mt-4 bg-red-900/50 p-2 rounded border border-red-500/50">
                        <p className="text-xs text-white font-bold">CLICK TO ACCESS CV</p>
                    </div>
                </div>
            </Html>
        </mesh>
    );
};

const DroneController = ({
    streetMode,
    keysRef,
    hudRefs
}: {
    streetMode: boolean,
    keysRef: React.MutableRefObject<any>,
    hudRefs: {
        alt: React.RefObject<HTMLSpanElement | null>,
        coord: React.RefObject<HTMLSpanElement | null>,
        pitch: React.RefObject<HTMLSpanElement | null>,
        yaw: React.RefObject<HTMLSpanElement | null>
    }
}) => {
    const controlsRef = useRef<any>(null);

    useFrame((state, delta) => {
        if (streetMode) {
            if (controlsRef.current && controlsRef.current.isLocked) {
                const speed = 25 * delta;

                if (keysRef.current.w) state.camera.translateZ(-speed);
                if (keysRef.current.s) state.camera.translateZ(speed);
                if (keysRef.current.a) state.camera.translateX(-speed);
                if (keysRef.current.d) state.camera.translateX(speed);

                if (keysRef.current.space) {
                    state.camera.position.y += speed;
                }

                if (state.camera.position.y < 0.5) {
                    state.camera.position.y = 0.5;
                }

                if (hudRefs.alt.current) {
                    hudRefs.alt.current.innerText = state.camera.position.y.toFixed(2);
                }
                if (hudRefs.coord.current) {
                    hudRefs.coord.current.innerText = `X: ${state.camera.position.x.toFixed(1)} | Z: ${state.camera.position.z.toFixed(1)}`;
                }
                if (hudRefs.pitch.current) {
                    const pitch = (state.camera.rotation.x * (180 / Math.PI)).toFixed(1);
                    hudRefs.pitch.current.innerText = pitch;
                }
                if (hudRefs.yaw.current) {
                    let heading = (state.camera.rotation.y * (180 / Math.PI)) % 360;
                    if (heading < 0) heading += 360;
                    hudRefs.yaw.current.innerText = Math.abs(heading).toFixed(0).padStart(3, '0');
                }
            }
        } else {
            if (state.camera.position.y < 14.5) {
                const homePos = new THREE.Vector3(20, 15, 20);
                state.camera.position.lerp(homePos, 0.05);
                state.camera.lookAt(0, 0, 0);
            }
        }
    });

    return streetMode ? <PointerLockControls ref={controlsRef} /> : null;
};

export default function GitHubCity() {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState<string>("");
    const [weather, setWeather] = useState<{ id: number; type: string; isDay: boolean }>({ id: 0, type: "Unknown", isDay: false });
    const [languageCache, setLanguageCache] = useState<Record<string, Record<string, number>>>({});

    const [audioEnabled, setAudioEnabled] = useState(false);
    const [streetMode, setStreetMode] = useState(false);
    const [bgAudio, setBgAudio] = useState<HTMLAudioElement | null>(null);

    const [easterEgg, setEasterEgg] = useState(false);
    const konamiBuffer = useRef("");

    const keysRef = useRef({ w: false, a: false, s: false, d: false, space: false });

    const hudAltRef = useRef<HTMLSpanElement>(null);
    const hudCoordRef = useRef<HTMLSpanElement>(null);
    const hudPitchRef = useRef<HTMLSpanElement>(null);
    const hudYawRef = useRef<HTMLSpanElement>(null);
    const hudCrosshairRef = useRef<HTMLDivElement>(null);
    const hudTargetTextRef = useRef<HTMLDivElement>(null);

    const handleTargetLock = (isLocked: boolean, targetName: string = "") => {
        if (hudTargetTextRef.current) {
            hudTargetTextRef.current.innerText = isLocked ? `[ TARGET LOCKED: ${targetName} ]` : "NO TARGET";
            hudTargetTextRef.current.style.color = isLocked ? "#ff0000" : "#00ff41";
            hudTargetTextRef.current.style.textShadow = isLocked ? "0 0 10px rgba(255,0,0,0.8)" : "0 0 5px rgba(0,255,65,0.8)";
        }
        if (hudCrosshairRef.current) {
            hudCrosshairRef.current.style.borderColor = isLocked ? "#ff0000" : "#00ff41";
            hudCrosshairRef.current.style.transform = isLocked ? "scale(1.5) rotate(45deg)" : "scale(1) rotate(0deg)";
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            switch (key) {
                case 'w': keysRef.current.w = true; break;
                case 'a': keysRef.current.a = true; break;
                case 's': keysRef.current.s = true; break;
                case 'd': keysRef.current.d = true; break;
            }

            konamiBuffer.current += key;
            if (konamiBuffer.current.length > 10) konamiBuffer.current = konamiBuffer.current.slice(-10);
            if (konamiBuffer.current.includes("suhan") && !easterEgg) {
                setEasterEgg(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'w': keysRef.current.w = false; break;
                case 'a': keysRef.current.a = false; break;
                case 's': keysRef.current.s = false; break;
                case 'd': keysRef.current.d = false; break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [easterEgg]);

    useEffect(() => {
        const audio = new Audio("/ambient.mp3");
        audio.loop = true;
        audio.volume = 0.4;
        setBgAudio(audio);

        return () => {
            audio.pause();
            audio.src = "";
        };
    }, []);

    useEffect(() => {
        if (bgAudio) {
            if (audioEnabled) {
                const playPromise = bgAudio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(err => {
                        console.warn("Tarayıcı otomatik sesi engelledi, etkileşim bekleniyor.", err);
                    });
                }
            } else {
                bgAudio.pause();
            }
        }
    }, [audioEnabled, bgAudio]);

    useEffect(() => {
        const updateTime = () => setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
        updateTime();
        const timeInterval = setInterval(updateTime, 1000);
        const hour = new Date().getHours();
        setWeather(prev => ({ ...prev, isDay: hour >= 6 && hour < 18 }));
        return () => clearInterval(timeInterval);
    }, []);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                    const data = await res.json();
                    if (data.current_weather) {
                        const code = data.current_weather.weathercode;
                        let type = "Clear/Cloudy";
                        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) type = "Rain";
                        else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) type = "Snow";
                        setWeather(prev => ({ ...prev, id: code, type }));
                    }
                } catch (error) {
                    console.error("Hava durumu çekilemedi", error);
                }
            }, () => console.warn("Konum izni reddedildi."));
        }
    }, []);

    useEffect(() => {
        const fetchRepos = async () => {
            try {
                const progressInterval = setInterval(() => setProgress((p) => (p >= 100 ? 100 : p + 12)), 200);
                const res = await fetch("https://api.github.com/users/SuhanArda/repos?per_page=100");
                const data = await res.json();

                if (Array.isArray(data)) {
                    setRepos(data.sort((a, b) => b.size - a.size));
                }

                clearInterval(progressInterval);
                setProgress(100);
                setTimeout(() => setLoading(false), 600);
            } catch (error) {
                console.error("Repo hatası:", error);
                setLoading(false);
            }
        };
        fetchRepos();
    }, []);

    const cols = Math.ceil(Math.sqrt(repos.length));
    const spacing = 3;
    const offsetX = (cols * spacing) / 2;
    const offsetZ = (Math.ceil(repos.length / cols) * spacing) / 2;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#00ff41] font-mono cursor-wait">
                <div className="text-2xl mb-4 animate-pulse">Initializing City Grid...</div>
                <div className="flex gap-1 text-xl">
                    [ {Array.from({ length: 10 }).map((_, i) => <span key={i} className={i < progress / 10 ? "opacity-100" : "opacity-30"}>■</span>)} ]
                </div>
                <div className="mt-4 text-sm opacity-50">{Math.min(100, Math.floor(progress))}% SYSTEM READY</div>
            </div>
        );
    }

    const bgColor = easterEgg ? "#200000" : (weather.isDay ? "#1e293b" : "#050505");

    return (
        <div className="force-cursor-visible w-screen h-screen relative overflow-hidden" style={{ backgroundColor: bgColor }}>

            {streetMode && (
                <div className="absolute inset-0 flex items-center justify-start mt-24 flex-col pointer-events-none z-40">
                    <div className="bg-black/70 backdrop-blur text-[#00ff41] border border-[#00ff41]/50 px-6 py-3 rounded-lg font-mono text-center animate-pulse">
                        <p>CLICK ANYWHERE TO LOCK MOUSE</p>
                        <p className="text-sm text-gray-400 mt-1">Use W A S D to fly • Press ESC to unlock</p>
                        {!easterEgg && <p className="text-xs text-[#00f0ff] mt-2 opacity-50">Hint: Type S-U-H-A-N for a surprise</p>}
                    </div>
                </div>
            )}

            <div className="absolute top-6 left-6 z-50 flex flex-col gap-3">
                <a href="/" className="flex items-center justify-center gap-2 bg-black/50 backdrop-blur border border-[#00ff41]/50 text-[#00ff41] px-4 py-2 rounded font-mono text-sm hover:bg-[#00ff41]/10 hover:shadow-[0_0_15px_rgba(0,255,65,0.4)] transition-all cursor-pointer w-48">
                    ← Disconnect (Core)
                </a>
                <button onClick={() => setStreetMode(!streetMode)} className="flex items-center justify-center gap-2 bg-black/50 backdrop-blur border border-[#fbbf24]/50 text-[#fbbf24] px-4 py-2 rounded font-mono text-xs hover:bg-[#fbbf24]/10 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all cursor-pointer w-48 uppercase">
                    {streetMode ? '⏏ Exit Street View' : '↓ Initiate Drone View'}
                </button>
                <button onClick={() => setAudioEnabled(!audioEnabled)} className={`flex items-center justify-center gap-2 bg-black/50 backdrop-blur border px-4 py-2 rounded font-mono text-xs transition-all cursor-pointer w-48 uppercase ${audioEnabled ? "border-[#00f0ff]/50 text-[#00f0ff] hover:bg-[#00f0ff]/10 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "border-gray-600 text-gray-400 hover:bg-gray-800"}`}>
                    {audioEnabled ? '🔊 Audio: ON' : '🔈 Audio: OFF'}
                </button>
            </div>

            <div className={`absolute top-6 right-6 z-50 flex flex-col gap-2 bg-black/60 backdrop-blur-md border p-4 rounded-lg font-mono text-xs text-right pointer-events-none transition-colors ${easterEgg ? 'border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.2)]'}`}>
                <div className={`font-bold tracking-widest mb-1 border-b pb-1 ${easterEgg ? 'text-red-500 border-red-500/20' : 'text-[#00f0ff] border-[#00f0ff]/20'}`}>SYSTEM SKYLINE</div>
                {easterEgg && <div><span className="text-gray-400">STATUS:</span> <span className="text-red-500 animate-pulse">COMPROMISED</span></div>}
                <div><span className="text-gray-400">TIME:</span> <span className="text-white">{currentTime}</span></div>
                <div><span className="text-gray-400">WEATHER:</span> <span className="text-[#fbbf24]">{weather.type}</span></div>
                <div><span className="text-gray-400">DATABANKS:</span> <span className="text-[#00ff41]">{repos.length} ACTIVE</span></div>
            </div>

            {/* TAKTİKSEL İHA (UAV) HUD ARAYÜZÜ */}
            <div className={`absolute inset-0 pointer-events-none z-40 transition-opacity duration-700 ${streetMode ? 'opacity-100' : 'opacity-0'}`}>

                {/* Kamera Lensi CRT Scanline Efekti */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

                {/* Merkez Nişangah (Crosshair) - SİSTEM MİMARİSİ: Dinamik Kilitlenme Eklendi */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center opacity-80 pointer-events-none">
                     <div className="relative flex items-center justify-center">
                         <div className="w-12 h-[1px] bg-[#00ff41] absolute -left-16 opacity-50" />
                         <div className="w-12 h-[1px] bg-[#00ff41] absolute -right-16 opacity-50" />
                         <div className="w-[1px] h-12 bg-[#00ff41] absolute -top-16 opacity-50" />
                         <div className="w-[1px] h-12 bg-[#00ff41] absolute -bottom-16 opacity-50" />
                         <div 
                            ref={hudCrosshairRef} 
                            className="w-8 h-8 border-2 border-[#00ff41] rounded-full transition-all duration-300 ease-out" 
                         />
                         <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse absolute" />
                     </div>
                     <div 
                        ref={hudTargetTextRef} 
                        className="absolute top-10 text-[#00ff41] font-mono text-[10px] tracking-[0.2em] font-bold transition-colors duration-300 whitespace-nowrap"
                     >
                         NO TARGET
                     </div>
                </div>

                {/* Sol Üst - Sistem Durumu */}
                <div className="absolute top-56 left-6 text-[#00ff41] font-mono text-xs drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]">
                    <div className="mb-2 border-b border-[#00ff41]/50 pb-1 w-40">UAV LINK: <span className="text-white animate-pulse">ACTIVE</span></div>
                    <div className="flex justify-between w-40"><span>SYS_MEM:</span> <span className="text-white">OPTIMAL</span></div>
                    <div className="flex justify-between w-40"><span>LATENCY:</span> <span className="text-white">12ms</span></div>
                </div>

                {/* Sağ Üst - Pusula (Heading) */}
                <div className="absolute top-10 right-10 text-[#00ff41] font-mono text-xs text-right drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]">
                    <div className="mb-2 border-b border-[#00ff41]/50 pb-1 w-40 flex justify-end gap-2">HDG: <span ref={hudYawRef} className="text-white text-base leading-none">000</span>°</div>
                    <div className="flex justify-end gap-2 w-40"><span>CAM:</span> <span className="text-white">OPTICAL</span></div>
                    <div className="flex justify-end gap-2 w-40"><span>REC:</span> <span className="text-red-500 animate-pulse">● REC</span></div>
                </div>

                {/* Sol Alt - Koordinat ve Eğim (Pitch) */}
                <div className="absolute bottom-10 left-10 text-[#00ff41] font-mono text-xs border-l-2 border-[#00ff41] pl-3 drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]">
                    <div className="mb-1">POS: <span ref={hudCoordRef} className="text-white ml-2">X: 00.0 | Z: 00.0</span></div>
                    <div>PITCH: <span ref={hudPitchRef} className="text-white ml-2">00.0</span>°</div>
                </div>

                {/* Sağ Alt - Rakım (Altitude) */}
                <div className="absolute bottom-10 right-10 text-[#00ff41] font-mono text-xs border-r-2 border-[#00ff41] pr-3 text-right drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]">
                    <div className="tracking-widest opacity-80">ALTITUDE</div>
                    <div className="text-3xl font-bold text-white mt-1"><span ref={hudAltRef}>0.00</span><span className="text-[#00ff41] text-sm ml-1">M</span></div>
                    <div className="text-[10px] mt-2 text-red-500 animate-pulse border border-red-500/50 bg-red-500/10 px-2 py-1 inline-block">TERRAIN AVOIDANCE OFF</div>
                </div>

                {/* Taktiksel Köşe Braketleri */}
                <div className="absolute top-6 left-6 w-12 h-12 border-t-2 border-l-2 border-[#00ff41]/60" />
                <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-[#00ff41]/60" />
                <div className="absolute bottom-6 left-6 w-12 h-12 border-b-2 border-l-2 border-[#00ff41]/60" />
                <div className="absolute bottom-6 right-6 w-12 h-12 border-b-2 border-r-2 border-[#00ff41]/60" />
            </div>

            <Canvas camera={{ position: [20, 15, 20], fov: 50 }}>
                <color attach="background" args={[bgColor]} />
                <fog attach="fog" args={[bgColor, 15, 80]} />

                {!easterEgg && weather.type === "Rain" && <Sparkles count={1500} scale={100} size={8} speed={0.8} color="#00f0ff" opacity={0.6} noise={0} />}
                {!easterEgg && weather.type === "Snow" && <Sparkles count={2000} scale={100} size={5} speed={0.2} color="#ffffff" opacity={0.8} noise={10} />}

                <EffectComposer><Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={2.5} mipmapBlur /></EffectComposer>

                <ambientLight intensity={easterEgg ? 0.5 : (weather.isDay ? 0.3 : 0.15)} color={easterEgg ? "#ff0000" : "#ffffff"} />
                {weather.isDay && !easterEgg && <directionalLight position={[10, 50, -20]} intensity={1.5} color="#e2e8f0" />}
                <pointLight position={[10, 20, 10]} intensity={2} color={easterEgg ? "#ff0000" : "#00ff41"} distance={60} />
                <pointLight position={[-10, 15, -10]} intensity={1.5} color={easterEgg ? "#ff0000" : "#00f0ff"} distance={60} />
                <spotLight position={[0, 40, 0]} intensity={1} color={easterEgg ? "#ff0000" : "#fbbf24"} angle={0.5} penumbra={1} castShadow />

                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                    <planeGeometry args={[200, 200]} />
                    <meshStandardMaterial color={easterEgg ? "#200000" : "#020202"} roughness={0.9} metalness={0.1} />
                </mesh>

                <gridHelper args={[100, 100, easterEgg ? "#ff0000" : "#00ff41", easterEgg ? "#550000" : "#002200"]} position={[0, 0, 0]} />

                <group position={[0, 0, 0]}>
                    {repos.map((repo, idx) => {
                        const x = (idx % cols) * spacing - offsetX;
                        const z = Math.floor(idx / cols) * spacing - offsetZ;
                        return <Building key={repo.id} repo={repo} position={[x, 0, z]} languageCache={languageCache} setLanguageCache={setLanguageCache} audioEnabled={audioEnabled} easterEgg={easterEgg} handleTargetLock={handleTargetLock} />; // SİSTEM MİMARİSİ: Parametre buraya bağlandı
                    })}
                </group>

                <TopSecretTower active={easterEgg} />

                <DataTraffic />

                <DroneController streetMode={streetMode} keysRef={keysRef} hudRefs={{ alt: hudAltRef, coord: hudCoordRef, pitch: hudPitchRef, yaw: hudYawRef }} />

                {!streetMode && (
                    <OrbitControls maxPolarAngle={Math.PI / 2 - 0.05} minDistance={5} maxDistance={60} enableDamping dampingFactor={0.05} />
                )}
            </Canvas>
        </div>
    );
}