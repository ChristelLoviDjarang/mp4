import React, { useRef, useEffect, useState, Suspense, useCallback } from "react";
import { useGLTF, useFBX, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from 'three';
import axios from 'axios';
import { VISEME_MAP, FACIAL_EXPRESSIONS } from "./constants";
import { useAvatarState } from "../Avatar/hooks/useAvatarState";
import { lerpMorphTarget } from "../../utils";
import { VoiceChatInterface } from "../VoiceChatInterface/VoiceChatInterface";
import { ChatBox } from "../ChatBox/ChatBox";
import { ChatToggle } from "../ChatToggle/ChatToggle";
import { ConversationDisplay } from "../ConversationDisplay/ConversationDisplay";


export function Avatar() {
    // Refs
    const audioRef = useRef(null);
    const groupRef = useRef();
    const mixerRef = useRef();
    const recognitionRef = useRef(null);
    const idleActionRef = useRef(null);
    const audioPlayOnceRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const smileTimerRef = useRef(null);

    // State
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [, setError] = useState('');
    const [blink, setBlink] = useState(false);
    const [facialExpression, setFacialExpression] = useState("bigSmile");
    const [smileIntensity, setSmileIntensity] = useState(1);
    const [answerText, setAnswerText] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Get avatar state from custom hook
    const {
        audioUrl,
        isPlaying,
        lipSyncData,
        conversation,
        setAudioUrl,
        setLipSyncData,
        setIsPlaying,
        setConversation
    } = useAvatarState();

    // Toggle chat interface
    const toggleChat = () => {
        setIsChatOpen(!isChatOpen);
    };

    // Load 3D models and animations
    const { nodes, materials } = useGLTF("/models/MP1.glb");
    const { animations: idleAnimations } = useFBX("/animations/id.fbx");

    // Dynamic smile effect
    useEffect(() => {
        const updateSmile = () => {
            // Randomly choose between big and small smile
            const newExpression = Math.random() > 0.5 ? "bigSmile" : "smallSmile";
            setFacialExpression(newExpression);

            // Random intensity variation
            setSmileIntensity(0.7 + Math.random() * 0.3);

            // Set next update interval (between 2-5 seconds)
            smileTimerRef.current = setTimeout(updateSmile, 2000 + Math.random() * 3000);
        };

        updateSmile();
        return () => clearTimeout(smileTimerRef.current);
    }, []);


    // Process audio and generate lip sync data
    const processAudioFile = useCallback((url) => {
        setAudioUrl(url);

        // Generate temporary lip sync data with moderate values
        const tempLipSyncData = Array.from({ length: 200 }, (_, i) => {
            const start = i * 0.15; // Overlapping starts by reducing the interval
            const end = (i + 1) * 0.25; // Longer end duration
            return {
                start: start,
                end: end,
                viseme: Object.keys(VISEME_MAP)[Math.floor(Math.random() * 8)],
                weight: 0.4 + Math.random() * 0.2 // Reduced weight range to 0.4-0.6 for more natural movement
            };
        });

        setLipSyncData(tempLipSyncData);
    }, [setAudioUrl, setLipSyncData]);

    // Add message to conversation
    const addToConversation = useCallback((role, message) => {
        setConversation(prev => [...prev, { role, message }]);
    }, [setConversation]);

    // Send query to backend
    const sendQueryToBackend = useCallback(async (query, audioBlob) => {
        setLoading(true);
        setAudioUrl('');
        setError('');
        setAnswerText('');
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://klaris.my.id/backend2';
            const response = await axios.post(`${backendUrl}/api/query`, {
                query,
                audio: audioBlob
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const answer = response.data.answer || 'No answer available.';
            addToConversation('assistant', answer);
            setAnswerText(answer);

            if (response.data.audio_file) {
                processAudioFile(`${backendUrl}/api/audio/${response.data.audio_file}`);
            }
        } catch (err) {
            console.error('Backend Error:', err);
            setError('Failed to connect to server. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [addToConversation, processAudioFile, setAudioUrl, setError]);

    // Handle text message submission
    const handleSendMessage = (message) => {
        addToConversation('user', message);
        sendQueryToBackend(message);
    };

    // Speech recognition handler
    const handleSpeechResult = useCallback((event) => {
        if (event.results?.[0]?.[0]) {
            const transcript = event.results[0][0].transcript;
            setIsListening(false);
            addToConversation('user', transcript);
            sendQueryToBackend(transcript);
        }
    }, [addToConversation, sendQueryToBackend]);

    // Initialize speech recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = 'id-ID';
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.onresult = handleSpeechResult;

            recognitionRef.current.onerror = (event) => {
                console.error('Speech Recognition Error:', event.error);
                setIsListening(false);
                setError(event.error === 'no-speech'
                    ? 'No speech detected. Please try again.'
                    : 'Speech recognition error. Please try again.');

                if (event.error === 'no-speech') {
                    recognitionRef.current?.stop();
                }
            };
        } else {
           setError('Speech recognition not supported in this browser.');
        }

        return () => recognitionRef.current?.stop();
    }, [handleSpeechResult, setError]);

    // Toggle listening state
    const toggleListening = async () => {
        if (isListening) {
            mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop();
            recognitionRef.current?.stop();
        } else {
            setError('');
            chunksRef.current = [];

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

                mediaRecorderRef.current.ondataavailable = (event) => {
                    event.data.size > 0 && chunksRef.current.push(event.data);
                };

                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    sendQueryToBackend('', audioBlob);
                };

                mediaRecorderRef.current.start();
                recognitionRef.current?.start();
            } catch (err) {
                console.error('Microphone Access Error:', err);
                setError('Failed to access microphone. Please check permissions.');
                setIsListening(false);
                return;
            }
        }

        setIsListening(!isListening);
    };

    // Setup animations and mixer
    useEffect(() => {
        if (groupRef.current && idleAnimations.length > 0) {
            mixerRef.current = new THREE.AnimationMixer(groupRef.current);

            idleActionRef.current = mixerRef.current.clipAction(idleAnimations[0]);
            idleActionRef.current.play();
        }

        return () => mixerRef.current?.stopAllAction();
    }, [idleAnimations]);

   // Setup lighting
    useEffect(() => {
        if (!groupRef.current) return;

        // Main directional light (key light) - Increased intensity and adjusted position
        const mainLight = new THREE.DirectionalLight(0xfff5e6, 2.5); // Increased intensity from 1.6 to 2.5
        mainLight.position.set(0, 5, 10); // Moved forward to increase frontal lighting
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 2000;
        mainLight.shadow.bias = -0.00001;
        groupRef.current.add(mainLight);

        // Fill light (softer blue tint) - Increased intensity and adjusted position
        const fillLight = new THREE.DirectionalLight(0xb6ceff, 1.4); // Increased from 0.9 to 1.4
        fillLight.position.set(-10, 4, 5); // Moved more to the front
        fillLight.castShadow = true;
        groupRef.current.add(fillLight);

        // Ambient light - Significantly increased for better overall brightness
        const ambientLight = new THREE.AmbientLight(0x404040, 1.2); // Increased from 0.5 to 1.2
        groupRef.current.add(ambientLight);

        // Rim light (dramatic back lighting) - Adjusted position and increased intensity
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.4); // Increased from 0.2 to 0.4
        rimLight.position.set(4, 2.5, -4);
        groupRef.current.add(rimLight);

        // Eye lights (for catch lights in eyes) - Increased intensity
        const eyeLight1 = new THREE.SpotLight(0xffffff, 1.0); // Increased from 0.6 to 1.0
        eyeLight1.position.set(0.4, 2.1, 3.2); // Moved slightly forward
        eyeLight1.angle = Math.PI / 6;
        eyeLight1.penumbra = 0.5; // Reduced for sharper highlights
        eyeLight1.decay = 1.5; // Reduced decay for stronger light
        eyeLight1.distance = 10; // Increased range
        groupRef.current.add(eyeLight1);

        const eyeLight2 = new THREE.SpotLight(0xffffff, 0.8); // Increased from 0.4 to 0.8
        eyeLight2.position.set(-1.2, 2.1, 3.2); // Moved forward
        eyeLight2.angle = Math.PI / 8;
        eyeLight2.penumbra = 0.5; // Reduced for sharper highlights
        eyeLight2.decay = 1.5;
        eyeLight2.distance = 10; // Increased range
        groupRef.current.add(eyeLight2);

        // Bounce light (ground reflection) - Increased for better fill
        const bounceLight = new THREE.DirectionalLight(0xfff5e6, 0.4); // Increased from 0.15 to 0.4
        bounceLight.position.set(0, -2.5, 3.0); // Moved forward
        groupRef.current.add(bounceLight);

        // Hair highlight - Increased intensity and adjusted position
        const hairLight = new THREE.SpotLight(0xfff5e6, 0.6); // Increased from 0.25 to 0.6
        hairLight.position.set(1.5, 5, 1.0); // Moved more to the front for better highlights
        hairLight.angle = Math.PI / 4;
        hairLight.penumbra = 0.3; // Reduced for crisper highlights
        groupRef.current.add(hairLight);

        // Focused face light - Significantly increased intensity
        const faceLight = new THREE.SpotLight(0xffffff, 2.2); // Increased from 1.3 to 2.2
        faceLight.position.set(0, 2.9, 4.0); // Moved forward for more direct illumination
        faceLight.angle = Math.PI / 5; // Adjusted for better focus
        faceLight.penumbra = 0.15; // Reduced for sharper highlights
        faceLight.decay = 1.5; // Reduced decay for stronger illumination
        faceLight.distance = 6; // Increased range
        groupRef.current.add(faceLight);

        // Additional soft light from the side - Increased and adjusted
        const sideLight = new THREE.DirectionalLight(0xffffff, 0.5); // Increased from 0.2 to 0.5
        sideLight.position.set(3, 2, 2); // Moved to front-side position
        groupRef.current.add(sideLight);

        // Added new front fill light for better facial illumination
        const frontFill = new THREE.DirectionalLight(0xffffff, 0.8); // New light for better frontal illumination
        frontFill.position.set(0, 1, 6); // Positioned directly in front
        groupRef.current.add(frontFill);

        // Subtle top light - Increased for better downward illumination
        const topLight = new THREE.DirectionalLight(0xffffff, 0.3); // Increased from 0.15 to 0.3
        topLight.position.set(0, 6, 2); // Adjusted to illuminate more from front-top
        groupRef.current.add(topLight);

    return () => {
        if (groupRef.current) {
            groupRef.current.remove(mainLight);
            groupRef.current.remove(fillLight);
            groupRef.current.remove(ambientLight);
            groupRef.current.remove(rimLight);
            groupRef.current.remove(eyeLight1);
            groupRef.current.remove(eyeLight2);
            groupRef.current.remove(bounceLight);
            groupRef.current.remove(hairLight);
            groupRef.current.remove(faceLight);
            groupRef.current.remove(sideLight);
            groupRef.current.remove(frontFill); // Remember to clean up new light
            groupRef.current.remove(topLight);
        }
    };
}, []);

    // Handle audio playback
    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        const handlePlay = () => {
            setIsPlaying(true);
        };

        const handleEnd = () => {
            setIsPlaying(false);
            // Reset visemes with a moderate value
            if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
                Object.values(VISEME_MAP).forEach(viseme => {
                    [nodes.Wolf3D_Head, nodes.Wolf3D_Teeth].forEach(node => {
                        if (node.morphTargetDictionary[viseme] !== undefined) {
                            node.morphTargetInfluences[node.morphTargetDictionary[viseme]] = 0.1;
                        }
                    });
                });
            }
            audioPlayOnceRef.current = false;
        };

        const handleError = (error) => {
            console.error("Audio Playback Error:", error);
            setIsPlaying(false);
           setError("Error playing audio.");
            audioPlayOnceRef.current = false;
        };

        audio.addEventListener("play", handlePlay);
        audio.addEventListener("ended", handleEnd);
        audio.addEventListener("error", handleError);

        if (!audioPlayOnceRef.current) {
            audio.play().catch(handleError);
            audioPlayOnceRef.current = true;
        }

        return () => {
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("ended", handleEnd);
            audio.removeEventListener("error", handleError);
            audio.pause();
            audio.currentTime = 0;
        };
    }, [audioUrl, nodes, setIsPlaying, setError]);

    // Automatic blinking
    useEffect(() => {
        let blinkTimer;

        const triggerBlink = () => {
            blinkTimer = setTimeout(() => {
                setBlink(true);
                setTimeout(() => {
                    setBlink(false);
                    triggerBlink();
                }, 200); // Keep blink duration at 200ms for natural look
            }, 5000 + Math.random() * 3000); // Randomize blink interval
        };

        triggerBlink();
        return () => clearTimeout(blinkTimer);
    }, []);

   // Animation frame updates
    useFrame((state, delta) => {
        // Update animation mixer
        mixerRef.current?.update(delta);

        // Update eye blinks
        lerpMorphTarget(groupRef, smileIntensity, "eyeBlinkLeft", blink ? 1 : 0, 0.5);
        lerpMorphTarget(groupRef, smileIntensity, "eyeBlinkRight", blink ? 1 : 0, 0.5);

        // Update facial expressions
        if (nodes.EyeLeft?.morphTargetDictionary) {
            Object.keys(nodes.EyeLeft.morphTargetDictionary).forEach(key => {
                if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;

                const expression = FACIAL_EXPRESSIONS[facialExpression];
                lerpMorphTarget(groupRef, smileIntensity, key, expression?.[key] || 0, 0.1);
            });
        }

        // Update lip sync with moderate values
        if (!audioRef.current?.currentTime || !isPlaying || !lipSyncData.length) return;

        const currentTime = audioRef.current.currentTime;
        const currentViseme = lipSyncData.find(
            data => currentTime >= data.start && currentTime <= data.end
        );

        if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
            // Reset all visemes to a small base value
            Object.values(VISEME_MAP).forEach(viseme => {
                [nodes.Wolf3D_Head, nodes.Wolf3D_Teeth].forEach(node => {
                    if (node.morphTargetDictionary[viseme] !== undefined) {
                        node.morphTargetInfluences[node.morphTargetDictionary[viseme]] = 0.1;
                    }
                });
            });

            // Apply current viseme with moderate intensity
            if (currentViseme && VISEME_MAP[currentViseme.viseme]) {
                const viseme = VISEME_MAP[currentViseme.viseme];
                const weight = Math.min(0.5, currentViseme.weight || 0.4); // Cap maximum weight at 0.5

                [nodes.Wolf3D_Head, nodes.Wolf3D_Teeth].forEach(node => {
                    if (node.morphTargetDictionary[viseme] !== undefined) {
                        node.morphTargetInfluences[node.morphTargetDictionary[viseme]] = weight;
                    }
                });
            }
        }
    });

    // Head tracking
    useFrame((state) => {
        const head = groupRef.current?.getObjectByName("Head");
        if (head) {
            const cameraPos = state.camera.position.clone();
            cameraPos.y = head.position.y;
            head.lookAt(cameraPos);
        }
    });

    return (
        <Suspense fallback={<Html>Loading...</Html>}>
            <group ref={groupRef} position={[-0, -15, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={9.1}>
                <primitive object={nodes.Hips} />
                <skinnedMesh
                    name="EyeLeft"
                    geometry={nodes.EyeLeft.geometry}
                    material={materials.Wolf3D_Eye}
                    skeleton={nodes.EyeLeft.skeleton}
                    morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
                    morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
                />
                <skinnedMesh
                    name="EyeRight"
                    geometry={nodes.EyeRight.geometry}
                    material={materials.Wolf3D_Eye}
                    skeleton={nodes.EyeRight.skeleton}
                    morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
                    morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
                />
                <skinnedMesh
                    name="Wolf3D_Head"
                    geometry={nodes.Wolf3D_Head.geometry}
                    material={materials.Wolf3D_Skin}
                    skeleton={nodes.Wolf3D_Head.skeleton}
                    morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
                    morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
                />
                <skinnedMesh
                    name="Wolf3D_Teeth"
                    geometry={nodes.Wolf3D_Teeth.geometry}
                    material={materials.Wolf3D_Teeth}
                    skeleton={nodes.Wolf3D_Teeth.skeleton}
                    morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
                    morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
                />
                <skinnedMesh
                    geometry={nodes.Wolf3D_Hair.geometry}
                    material={materials.Wolf3D_Hair}
                    skeleton={nodes.Wolf3D_Hair.skeleton}
                />
                <skinnedMesh
                    geometry={nodes.Wolf3D_Body.geometry}
                    material={materials.Wolf3D_Body}
                    skeleton={nodes.Wolf3D_Body.skeleton}
                />
                <skinnedMesh
                    geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
                    material={materials.Wolf3D_Outfit_Bottom}
                    skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
                />
                <skinnedMesh
                    geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
                    material={materials.Wolf3D_Outfit_Footwear}
                    skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
                />
                <skinnedMesh
                    geometry={nodes.Wolf3D_Outfit_Top.geometry}
                    material={materials.Wolf3D_Outfit_Top}
                    skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
                />
            </group>

                   {/* Interface components */}
                   <Html position={[0, -2.5, 0]} style={{ pointerEvents: 'auto' }}>
                {/* Voice chat interface */}
                <VoiceChatInterface
                    isListening={isListening}
                    loading={loading}
                    isPlaying={isPlaying}
                    toggleListening={toggleListening}
                />
                
                {/* Chat toggle button */}
                <ChatToggle 
                    isChatOpen={isChatOpen} 
                    toggleChat={toggleChat} 
                />
                
                {/* Conversation display */}
                <ConversationDisplay 
                    conversation={conversation}
                    isChatOpen={isChatOpen}
                />
                
                {/* Chat input box */}
                {isChatOpen && (
                    <ChatBox 
                        onSendMessage={handleSendMessage}
                        loading={loading}
                    />
                )}
            </Html>
        </Suspense>
    );
}

// Preload assets
useGLTF.preload("/models/MP1.glb");
useFBX.preload("/animations/id.fbx");