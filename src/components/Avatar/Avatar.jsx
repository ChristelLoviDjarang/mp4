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


export function Avatar({ onChatToggle }) {
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
    
    // Store available morph targets to prevent errors
    const [availableVisemes, setAvailableVisemes] = useState({});

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

    // Add a new state for WebGL availability
    const [isWebGLAvailable, setIsWebGLAvailable] = useState(true);

    // Add effect to notify parent of chat state changes
    useEffect(() => {
        if (onChatToggle) {
            onChatToggle(isChatOpen);
        }
    }, [isChatOpen, onChatToggle]);

    // Toggle chat interface
    const toggleChat = () => {
        setIsChatOpen(!isChatOpen);
    };

    // Load 3D models and animations
    const { nodes, materials } = useGLTF("/models/MPG.glb");
    const { animations: idleAnimations } = useFBX("/animations/id.fbx");

    // Initialize available visemes after model loads
    useEffect(() => {
        if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
            const headVisemes = {};
            const teethVisemes = {};
            
            // Manually inspect the available morphs to find all mouth-related ones
            if (nodes.Wolf3D_Head.morphTargetDictionary) {
                console.log("Full head morph dictionary:", nodes.Wolf3D_Head.morphTargetDictionary);
                
                // First try to find standard mouth morphs
                const mouthMorphs = Object.keys(nodes.Wolf3D_Head.morphTargetDictionary)
                    .filter(key => 
                        key.toLowerCase().includes('mouth') || 
                        key.toLowerCase().includes('jaw') || 
                        key.toLowerCase().includes('lip') ||
                        key.toLowerCase().includes('viseme')
                    );
                
                console.log("Found mouth-related morphs:", mouthMorphs);
                
                // Initialize these mouth morphs to make them active
                mouthMorphs.forEach(key => {
                    const index = nodes.Wolf3D_Head.morphTargetDictionary[key];
                    // Set to a small value to ensure they're active
                    nodes.Wolf3D_Head.morphTargetInfluences[index] = 0.01;
                });
                
                // Map all available visemes in the model
                Object.entries(VISEME_MAP).forEach(([key, visemeName]) => {
                    if (nodes.Wolf3D_Head.morphTargetDictionary[visemeName] !== undefined) {
                        headVisemes[visemeName] = nodes.Wolf3D_Head.morphTargetDictionary[visemeName];
                    } else {
                        console.log(`Head viseme not found: ${visemeName}`);
                    }
                });
            }
            
            // Same for teeth
            if (nodes.Wolf3D_Teeth.morphTargetDictionary) {
                console.log("Full teeth morph dictionary:", nodes.Wolf3D_Teeth.morphTargetDictionary);
                
                // First try to find standard mouth morphs for teeth
                const teethMouthMorphs = Object.keys(nodes.Wolf3D_Teeth.morphTargetDictionary)
                    .filter(key => 
                        key.toLowerCase().includes('mouth') || 
                        key.toLowerCase().includes('jaw') || 
                        key.toLowerCase().includes('lip') ||
                        key.toLowerCase().includes('viseme')
                    );
                
                console.log("Found teeth mouth-related morphs:", teethMouthMorphs);
                
                // Initialize these mouth morphs to make them active
                teethMouthMorphs.forEach(key => {
                    const index = nodes.Wolf3D_Teeth.morphTargetDictionary[key];
                    // Set to a small value to ensure they're active
                    nodes.Wolf3D_Teeth.morphTargetInfluences[index] = 0.01;
                });
                
                Object.entries(VISEME_MAP).forEach(([key, visemeName]) => {
                    if (nodes.Wolf3D_Teeth.morphTargetDictionary[visemeName] !== undefined) {
                        teethVisemes[visemeName] = nodes.Wolf3D_Teeth.morphTargetDictionary[visemeName];
                    } else {
                        console.log(`Teeth viseme not found: ${visemeName}`);
                    }
                });
            }
            
            setAvailableVisemes({
                head: headVisemes,
                teeth: teethVisemes
            });
            
            console.log("Available head visemes:", Object.keys(headVisemes));
            console.log("Available teeth visemes:", Object.keys(teethVisemes));
            
            // Check if any mouth-related morphs exist
            const mouthRelatedMorphsHead = Object.keys(nodes.Wolf3D_Head.morphTargetDictionary)
                .filter(key => key.toLowerCase().includes('mouth') || key.toLowerCase().includes('lip'));
            console.log("Mouth-related morphs in head:", mouthRelatedMorphsHead);
            
            const mouthRelatedMorphsTeeth = Object.keys(nodes.Wolf3D_Teeth.morphTargetDictionary)
                .filter(key => key.toLowerCase().includes('mouth') || key.toLowerCase().includes('lip'));
            console.log("Mouth-related morphs in teeth:", mouthRelatedMorphsTeeth);
        }
    }, [nodes]);

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

        // Use audio timing to more accurately generate lip sync data
        // We'll create a more natural pattern based on the audio URL
        const tempLipSyncData = [];
        
        // Set a request to analyze the audio file when it's loaded
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
            // Now we know the actual duration of the audio file
            const actualDuration = audio.duration || 30; // Fallback to 30s if duration is undefined
            
            // Generate lip sync data based on actual audio duration
            let currentTime = 0;
            
            // Create speech patterns that better mimic natural speech rhythm
            while (currentTime < actualDuration) {
                // Each phrase has natural pauses
                const phraseLength = 0.8 + Math.random() * 1.2; // 0.8-2.0 second phrases
                let phraseTime = 0;
                
                // Each phrase has multiple words
                const wordCount = 1 + Math.floor(Math.random() * 3); // 1-3 words per phrase
                
                for (let wordIndex = 0; wordIndex < wordCount; wordIndex++) {
                    // Words have syllables
                    const syllableCount = 1 + Math.floor(Math.random() * 2); // 1-2 syllables
                    const wordDuration = syllableCount * (0.15 + Math.random() * 0.1); // 0.15-0.25s per syllable
                    
                    let syllableTime = 0;
                    for (let i = 0; i < syllableCount; i++) {
                        const syllableDuration = wordDuration / syllableCount;
                        
                        // Use more realistic selection of visemes
                        // Different visemes for beginning, middle, and end of words
                        let viseme;
                        if (i === 0) {
                            // First syllable often starts with consonants
                            viseme = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
                        } else if (i === syllableCount - 1) {
                            // Last syllable often ends with vowels
                            viseme = ['D', 'E', 'F'][Math.floor(Math.random() * 3)];
                        } else {
                            // Middle syllables with more vowels
                            viseme = ['C', 'D', 'E', 'F'][Math.floor(Math.random() * 4)];
                        }
                        
                        // Weight based on stress pattern - first syllable often stressed
                        const weight = (i === 0) ? 
                            0.6 + Math.random() * 0.3 : // 0.6-0.9 for stressed syllables
                            0.4 + Math.random() * 0.2;  // 0.4-0.6 for unstressed
                        
                        // Add viseme that precisely fits within audio timeline
                        tempLipSyncData.push({
                            start: currentTime + phraseTime + syllableTime,
                            end: currentTime + phraseTime + syllableTime + syllableDuration,
                            viseme: viseme,
                            weight: weight
                        });
                        
                        syllableTime += syllableDuration;
                    }
                    
                    phraseTime += wordDuration;
                    
                    // Add word spacing (natural pauses between words)
                    if (wordIndex < wordCount - 1) {
                        phraseTime += 0.05 + Math.random() * 0.1; // 0.05-0.15s pause
                    }
                }
                
                currentTime += phraseTime;
                
                // Add natural pauses between phrases
                if (currentTime < actualDuration) {
                    // Add breath pause between phrases
                    currentTime += 0.2 + Math.random() * 0.3; // 0.2-0.5s breath pause
                }
            }
            
            // Set the lip sync data with precise alignment to audio duration
            setLipSyncData(tempLipSyncData);
        });

        // Handle error cases
        audio.addEventListener('error', () => {
            console.error("Error loading audio for lip sync analysis");
            // Create fallback lip sync data
            const fallbackData = [];
            let time = 0;
            while (time < 30) {
                fallbackData.push({
                    start: time,
                    end: time + 0.2,
                    viseme: ['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)],
                    weight: 0.5 + Math.random() * 0.3
                });
                time += 0.3;
            }
            setLipSyncData(fallbackData);
        });

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
    const handleSendMessage = async (message) => {
        try {
            // Add user message to conversation immediately
            const newMessage = { role: 'user', message };
            setConversation(prev => [...prev, newMessage]);
            
            // Show loading state
            setLoading(true);

            // Send message to backend
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.post(`${backendUrl}/api/query`, {
                query: message
            });

            // Get the response from backend
            const answer = response.data.answer || 'I apologize, but I am unable to provide a response at the moment.';
            
            // Add avatar's response to conversation
            setConversation(prev => [...prev, { role: 'assistant', message: answer }]);

            // Process audio if available
            if (response.data.audio_file) {
                processAudioFile(`${backendUrl}/api/audio/${response.data.audio_file}`);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            // Add error message to conversation
            setConversation(prev => [...prev, { 
                role: 'assistant', 
                message: 'Sorry, I encountered an error processing your message. Please try again.' 
            }]);
        } finally {
            setLoading(false);
        }
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

    // Handle audio playback with better lip sync synchronization
    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        const handlePlay = () => {
            setIsPlaying(true);
            console.log("Audio started playing, activating lip sync");
        };

        const handleEnd = () => {
            setIsPlaying(false);
            console.log("Audio ended, stopping lip sync");
            // Completely reset mouth to neutral position
            if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
                fullyResetMouth();
            }
            audioPlayOnceRef.current = false;
        };

        const handlePause = () => {
            setIsPlaying(false);
            console.log("Audio paused, stopping lip sync");
            // Completely reset mouth to neutral position
            if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
                fullyResetMouth();
            }
        };

        // Add seeking handler to ensure mouth position updates correctly when audio is skipped
        const handleSeeking = () => {
            console.log("Audio seeking to new position");
            if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
                // Reset temporarily until we reach the new position
                safeResetVisemes();
            }
        };

        // Time update handler for more precise synchronization
        const handleTimeUpdate = () => {
            // Time updates happen frequently, we don't need to log them
            // This event ensures real-time synchronization
        };

        const handleError = (error) => {
            console.error("Audio Playback Error:", error);
            setIsPlaying(false);
            setError("Error playing audio.");
            audioPlayOnceRef.current = false;
            // Reset visemes to completely close the mouth on error
            if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
                fullyResetMouth();
            }
        };

        audio.addEventListener("play", handlePlay);
        audio.addEventListener("ended", handleEnd);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("seeking", handleSeeking);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("error", handleError);

        if (!audioPlayOnceRef.current) {
            audio.play().catch(handleError);
            audioPlayOnceRef.current = true;
        }

        return () => {
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("ended", handleEnd);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("seeking", handleSeeking);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("error", handleError);
            audio.pause();
            audio.currentTime = 0;
            // Reset mouth on cleanup
            if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
                fullyResetMouth();
            }
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

    // Safe method to reset all visemes
    const safeResetVisemes = () => {
        if (!nodes.Wolf3D_Head || !nodes.Wolf3D_Teeth) return;
        
        // For debugging - log all available morph targets
        if (!window.morphTargetsLogged) {
            console.log("Head morph targets:", nodes.Wolf3D_Head.morphTargetDictionary);
            console.log("Teeth morph targets:", nodes.Wolf3D_Teeth.morphTargetDictionary);
            window.morphTargetsLogged = true;
        }
        
        // Reset head visemes - but to a small value instead of 0
        if (nodes.Wolf3D_Head.morphTargetDictionary) {
            Object.keys(nodes.Wolf3D_Head.morphTargetDictionary).forEach(key => {
                if (key.startsWith('viseme_') || key.includes('mouth') || key.includes('jaw')) {
                    const index = nodes.Wolf3D_Head.morphTargetDictionary[key];
                    nodes.Wolf3D_Head.morphTargetInfluences[index] = 0.01; // Very small but not zero
                }
            });
        }
        
        // Reset teeth visemes - but to a small value instead of 0
        if (nodes.Wolf3D_Teeth.morphTargetDictionary) {
            Object.keys(nodes.Wolf3D_Teeth.morphTargetDictionary).forEach(key => {
                if (key.startsWith('viseme_') || key.includes('mouth') || key.includes('jaw')) {
                    const index = nodes.Wolf3D_Teeth.morphTargetDictionary[key];
                    nodes.Wolf3D_Teeth.morphTargetInfluences[index] = 0.01; // Very small but not zero
                }
            });
        }
    };

    // Safe method to apply viseme
    const safeApplyViseme = (visemeName, weight) => {
        if (!nodes.Wolf3D_Head || !nodes.Wolf3D_Teeth) return;
        
        // Complementary visemes with INCREASED values for bigger mouth opening
        const complementaryVisemes = {
            'viseme_PP': { 'jawOpen': 0.3, 'mouthClose': 0.2 },   // Increased from 0.2/0.3 to 0.3/0.2
            'viseme_FF': { 'jawOpen': 0.4, 'mouthClose': 0.15 },  // Increased from 0.25/0.2 to 0.4/0.15
            'viseme_TH': { 'jawOpen': 0.5, 'mouthClose': 0.1 },   // Increased from 0.3/0.1 to 0.5/0.1
            'viseme_DD': { 'jawOpen': 0.7, 'mouthClose': 0.0 },   // Increased from 0.5/0.0 to 0.7/0.0
            'viseme_kk': { 'jawOpen': 0.8, 'mouthClose': 0.0 },   // Increased from 0.6/0.0 to 0.8/0.0
            'viseme_CH': { 'jawOpen': 0.7, 'mouthClose': 0.0 },   // Increased from 0.5/0.1 to 0.7/0.0
            'viseme_SS': { 'jawOpen': 0.5, 'mouthClose': 0.0 },   // Increased from 0.3/0.1 to 0.5/0.0
            'viseme_nn': { 'jawOpen': 0.5, 'mouthClose': 0.0 },   // Increased from 0.3/0.1 to 0.5/0.0
            'viseme_RR': { 'jawOpen': 0.7, 'mouthClose': 0.0 },   // Increased from 0.5/0.0 to 0.7/0.0
            'viseme_aa': { 'jawOpen': 1.0, 'mouthClose': 0.0 },   // Increased from 0.7/0.0 to 1.0/0.0 
            'viseme_E': { 'jawOpen': 0.8, 'mouthClose': 0.0 },    // Increased from 0.5/0.0 to 0.8/0.0
            'viseme_I': { 'jawOpen': 0.7, 'mouthClose': 0.0 },    // Increased from 0.5/0.0 to 0.7/0.0
            'viseme_O': { 'jawOpen': 0.9, 'mouthClose': 0.0 },    // Increased from 0.6/0.0 to 0.9/0.0
            'viseme_U': { 'jawOpen': 0.7, 'mouthClose': 0.0 },    // Increased from 0.5/0.0 to 0.7/0.0
        };
        
        // Apply main viseme
        // SLOWED DOWN smoothing for more gradual transitions
        const applyMorphSmooth = (mesh, morphName, targetValue, speed = 0.15) => { // Reduced from 0.3 to 0.15
            if (mesh.morphTargetDictionary && mesh.morphTargetDictionary[morphName] !== undefined) {
                const index = mesh.morphTargetDictionary[morphName];
                const currentValue = mesh.morphTargetInfluences[index];
                
                // Smooth transition - slower speed for more gradual changes
                mesh.morphTargetInfluences[index] = currentValue + (targetValue - currentValue) * speed;
            }
        };
        
        // Apply main viseme with smooth transition to head and teeth
        if (nodes.Wolf3D_Head.morphTargetDictionary && 
            nodes.Wolf3D_Head.morphTargetDictionary[visemeName] !== undefined) {
            applyMorphSmooth(nodes.Wolf3D_Head, visemeName, weight);
        }
        
        if (nodes.Wolf3D_Teeth.morphTargetDictionary && 
            nodes.Wolf3D_Teeth.morphTargetDictionary[visemeName] !== undefined) {
            applyMorphSmooth(nodes.Wolf3D_Teeth, visemeName, weight);
        }
        
        // Apply complementary visemes for more natural speech shape
        if (complementaryVisemes[visemeName]) {
            Object.entries(complementaryVisemes[visemeName]).forEach(([morphName, relativeWeight]) => {
                // Apply to head with reduced weight
                if (nodes.Wolf3D_Head.morphTargetDictionary && 
                    nodes.Wolf3D_Head.morphTargetDictionary[morphName] !== undefined) {
                    applyMorphSmooth(nodes.Wolf3D_Head, morphName, weight * relativeWeight);
                }
                
                // Apply to teeth with reduced weight
                if (nodes.Wolf3D_Teeth.morphTargetDictionary && 
                    nodes.Wolf3D_Teeth.morphTargetDictionary[morphName] !== undefined) {
                    applyMorphSmooth(nodes.Wolf3D_Teeth, morphName, weight * relativeWeight);
                }
            });
        }
        
        // Apply common mouth morphs that should be active during all speech
        const commonMorphs = ["mouthOpen", "jawOpen"];
        commonMorphs.forEach(morphName => {
            // Determine appropriate weight based on viseme type
            const isVowel = ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'].includes(visemeName);
            const morphWeight = isVowel ? weight * 2.0 : weight * 1.2; // Increased from 1.4/0.8 to 2.0/1.2
            
            // Apply to head and teeth with the slower smoothing
            if (nodes.Wolf3D_Head.morphTargetDictionary && 
                nodes.Wolf3D_Head.morphTargetDictionary[morphName] !== undefined) {
                applyMorphSmooth(nodes.Wolf3D_Head, morphName, morphWeight);
            }
            
            if (nodes.Wolf3D_Teeth.morphTargetDictionary && 
                nodes.Wolf3D_Teeth.morphTargetDictionary[morphName] !== undefined) {
                applyMorphSmooth(nodes.Wolf3D_Teeth, morphName, morphWeight);
            }
        });
    };

    // New function to directly control mouth movements for talking with more natural movement
    const animateMouth = (currentTime, intensity = 0.5, audioFactor = 1) => {
        if (!nodes.Wolf3D_Head || !nodes.Wolf3D_Teeth) return;
        
        // Create a more natural pulsing pattern based on time
        // INCREASED amplitude for more pronounced movement
        const pulseValue = 0.2 +  // Increased base value from 0.15 to 0.2
            (Math.sin(currentTime * 2.5) * 0.15 +     // Increased from 0.1 to 0.15
             Math.sin(currentTime * 6) * 0.05 +      // Increased from 0.04 to 0.05
             Math.sin(currentTime * 1.2) * 0.08) *   // Increased from 0.06 to 0.08
            intensity * audioFactor;
        
        // More varied and natural mouth morph weights - SIGNIFICANTLY INCREASED for more opening
        const mouthMorphs = {
            // Primary mouth opening morphs - dramatically increased
            jawOpen: 1.1 * audioFactor,       // Increased from 0.85 to 1.1
            mouthOpen: 1.2 * audioFactor,    // Increased from 1.0 to 1.2
            
            // Secondary morphs for natural variation - increased
            jawForward: 0.25 * audioFactor,   // Increased from 0.2 to 0.25
            mouthWide: 0.40 * audioFactor,    // Increased from 0.3 to 0.35
            
            // Subtle expressions that happen during speech
            mouthSmile: 0.25 * audioFactor,   // Increased from 0.2 to 0.25
            
            // Minimal side movement
            mouthLeft: 0.03 * audioFactor,
            mouthRight: 0.03 * audioFactor,
            
            // Viseme morphs for specific sounds - increased
            viseme_AA: 0.10 * audioFactor,    // Increased from 0.7 to 0.8
            viseme_O: 0.75 * audioFactor,    // Increased from 0.65 to 0.75
            viseme_U: 0.65 * audioFactor,    // Increased from 0.55 to 0.65
            viseme_I: 0.6 * audioFactor      // Increased from 0.5 to 0.6
        };
        
        // Smooth transition technique for applying morphs
        // INCREASED smoothing speed for slower transitions
        const applyMorphWithSmoothing = (mesh, morphName, targetValue, speed = 0.1) => { // Reduced from 0.2 to 0.1
            if (mesh.morphTargetDictionary && mesh.morphTargetDictionary[morphName] !== undefined) {
                const index = mesh.morphTargetDictionary[morphName];
                const currentValue = mesh.morphTargetInfluences[index];
                
                // Use sine-based easing for more natural movement
                const t = speed; // Reduced transition speed for slower movement
                const smoothValue = currentValue + (targetValue - currentValue) * t;
                
                mesh.morphTargetInfluences[index] = smoothValue;
            }
        };
        
        // Apply morphs to head and teeth with smoothing
        Object.entries(mouthMorphs).forEach(([morphName, baseWeight]) => {
            // Vary weight slightly based on sine position for more natural movement
            const variedWeight = pulseValue * baseWeight;
            
            // Apply to head with smoothing
            if (nodes.Wolf3D_Head.morphTargetDictionary) {
                applyMorphWithSmoothing(nodes.Wolf3D_Head, morphName, variedWeight);
            }
            
            // Apply to teeth with smoothing
            if (nodes.Wolf3D_Teeth.morphTargetDictionary) {
                applyMorphWithSmoothing(nodes.Wolf3D_Teeth, morphName, variedWeight);
            }
        });
    };

    // Update the fullyResetMouth function to ensure mouth closes completely
    const fullyResetMouth = () => {
        if (!nodes.Wolf3D_Head || !nodes.Wolf3D_Teeth) return;
        
        console.log("Fully resetting mouth to closed position");
        
        // Complete list of all possible mouth-related morphs
        const mouthRelatedMorphs = [
            "jawOpen", "mouthOpen", "mouthOpen_0", "jawForward", "mouthWide", 
            "mouthSmile", "mouthLeft", "mouthRight", "mouthShrugLower",
            "mouthShrugUpper", "mouthClose", "mouthFunnel", "mouthPucker",
            "mouthRollLower", "mouthRollUpper", "mouthDimple"
        ];
        
        // Add all viseme morphs
        Object.values(VISEME_MAP).forEach(visemeName => {
            if (visemeName && !mouthRelatedMorphs.includes(visemeName)) {
                mouthRelatedMorphs.push(visemeName);
            }
        });
        
        // Reset all mouth morphs to zero on both head and teeth
        mouthRelatedMorphs.forEach(morphName => {
            // Reset on head
            if (nodes.Wolf3D_Head.morphTargetDictionary && 
                nodes.Wolf3D_Head.morphTargetDictionary[morphName] !== undefined) {
                const index = nodes.Wolf3D_Head.morphTargetDictionary[morphName];
                // Ensure zero value for complete closure
                nodes.Wolf3D_Head.morphTargetInfluences[index] = 0;
            }
            
            // Reset on teeth
            if (nodes.Wolf3D_Teeth.morphTargetDictionary && 
                nodes.Wolf3D_Teeth.morphTargetDictionary[morphName] !== undefined) {
                const index = nodes.Wolf3D_Teeth.morphTargetDictionary[morphName];
                // Ensure zero value for complete closure
                nodes.Wolf3D_Teeth.morphTargetInfluences[index] = 0;
            }
        });
    };

    // Animation frame update for lip sync
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

        // Only handle lip sync if audio is actually playing with sufficient data
        if (audioRef.current && isPlaying && lipSyncData.length > 0) {
            // Get current playback time
            const currentTime = audioRef.current.currentTime;
            
            // Double-check that audio is actually playing, not just in "playing" state
            const isActuallyPlaying = !audioRef.current.paused && !audioRef.current.ended && currentTime > 0;
            
            if (!isActuallyPlaying) {
                // If audio isn't really playing despite state saying it is, close the mouth
                fullyResetMouth();
                return;
            }
            
            // Find active visemes at current audio position
            const activeVisemes = lipSyncData.filter(
                data => currentTime >= data.start && currentTime <= data.end
            );
            
            // Reset viseme values before applying new ones
            safeResetVisemes();
            
            // Get audio intensity factor based on current playback position
            const audioFactor = getAudioIntensity(audioRef.current, currentTime);
            
            // Only apply mouth animation if we have a positive audio factor
            if (audioFactor > 0) {
                // Apply base mouth animation scaled by audio factor
                animateMouth(currentTime, 0.8, audioFactor);
                
                // Apply active visemes with natural transitions
                if (activeVisemes.length > 0) {
                    activeVisemes.forEach(viseme => {
                        if (VISEME_MAP[viseme.viseme]) {
                            const visemeName = VISEME_MAP[viseme.viseme];
                            
                            // Calculate progress through this viseme for natural movement
                            const visemeDuration = viseme.end - viseme.start;
                            const visemeProgress = (currentTime - viseme.start) / visemeDuration;
                            
                            // Use a more natural curve for viseme weight
                            // Bell curve that peaks in middle and tapers at edges
                            const progressFactor = 1 - Math.pow(Math.abs(visemeProgress - 0.5) * 1.8, 2);
                            
                            // Apply with weight adjusted by audio factor and progress
                            const adjustedWeight = viseme.weight * progressFactor * audioFactor * 2.0;
                            
                            // Only apply if weight is significant
                            if (adjustedWeight > 0.05) {
                                safeApplyViseme(visemeName, adjustedWeight);
                            }
                        }
                    });
                }
            } else {
                // If audio factor is zero, ensure mouth is closed
                fullyResetMouth();
            }
        } else if (!isPlaying) {
            // If not playing, ensure mouth is completely closed
            fullyResetMouth();
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

    // Add a useEffect to check WebGL availability early
    useEffect(() => {
        // Function to check if WebGL is available
        function checkWebGLAvailability() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                
                if (!gl) {
                    // WebGL is not supported
                    console.error('WebGL is not supported in this browser.');
                    return false;
                }
                
                return true;
            } catch (e) {
                console.error('Error checking WebGL availability:', e);
                return false;
            }
        }
        
        // Set the WebGL availability state
        setIsWebGLAvailable(checkWebGLAvailability());
    }, []);

    // Improved function to get audio intensity that better matches human speech patterns
    const getAudioIntensity = (audioElement, currentTime) => {
        if (!audioElement) return 0; // Return 0 when no audio to ensure mouth stays closed
        
        // Get playback state directly from the audio element
        const isActuallyPlaying = !audioElement.paused && !audioElement.ended && audioElement.currentTime > 0;
        
        // If the audio isn't actually playing, return 0 to keep mouth closed
        if (!isActuallyPlaying) return 0;
        
        // Create a more speech-like pattern based on audio position
        // Speech typically follows a pattern of emphasized syllables
        const syllableRate = 3.5; // Average syllables per second in normal speech
        const syllablePosition = (currentTime * syllableRate) % 1.0; // Position within syllable cycle
        
        // Create a natural envelope that mimics a syllable (quick attack, slow decay)
        let syllableEnvelope;
        if (syllablePosition < 0.1) {
            // Quick attack (0-10% of syllable)
            syllableEnvelope = syllablePosition * 10; // 0 to 1 quickly
        } else if (syllablePosition < 0.5) {
            // Hold (10-50% of syllable)
            syllableEnvelope = 1.0;
        } else {
            // Gradual decay (50-100% of syllable)
            syllableEnvelope = 1.0 - ((syllablePosition - 0.5) * 2.0);
        }
        
        // Add natural variation
        const variationFactor = 0.7 + 
            (Math.sin(currentTime * 2.7) * 0.15) + 
            (Math.sin(currentTime * 1.5) * 0.15);
        
        // Combine for final intensity that mimics natural speech patterns
        return Math.max(0, Math.min(1, syllableEnvelope * variationFactor));
    };

    return (
        <>
            {!isWebGLAvailable ? (
                // Fallback UI when WebGL is not available
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0c2043',
                    color: 'white',
                    padding: '20px',
                    textAlign: 'center',
                    zIndex: 1000
                }}>
                    <h2>WebGL Not Available</h2>
                    <p>Your browser or device doesn't support WebGL, which is required to display the 3D avatar.</p>
                    <p>Please try using a different browser or device that supports WebGL.</p>
                    
                    <div style={{ marginTop: '30px' }}>
                        {/* Still show chat interface for text-only interaction */}
                        <h3>You can still chat via text:</h3>
                        <div style={{ 
                            width: '400px', 
                            height: '400px', 
                            backgroundColor: '#1a3056',
                            borderRadius: '10px',
                            padding: '15px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ 
                                flex: 1, 
                                overflowY: 'auto',
                                marginBottom: '15px',
                                backgroundColor: '#0a1835',
                                borderRadius: '8px',
                                padding: '10px'
                            }}>
                                {conversation.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>
                                        Start a conversation by typing a message
                                    </div>
                                ) : (
                                    conversation.map((msg, idx) => (
                                        <div key={idx} style={{ 
                                            padding: '10px', 
                                            margin: '5px 0',
                                            backgroundColor: msg.role === 'user' ? '#4CAF50' : '#e0e0e0',
                                            color: msg.role === 'user' ? 'white' : '#333',
                                            borderRadius: '8px',
                                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            maxWidth: '80%',
                                            marginLeft: msg.role === 'user' ? 'auto' : '0'
                                        }}>
                                            <strong>{msg.role === 'user' ? 'You' : 'Avatar'}:</strong> {msg.message}
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const input = e.target.elements.message;
                                if (input.value.trim()) {
                                    handleSendMessage(input.value);
                                    input.value = '';
                                }
                            }} style={{ display: 'flex' }}>
                                <input 
                                    name="message"
                                    type="text" 
                                    placeholder="Type your message..." 
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '20px',
                                        border: 'none',
                                        backgroundColor: '#1a3056',
                                        color: 'white'
                                    }}
                                />
                                <button 
                                    type="submit"
                                    style={{
                                        marginLeft: '10px',
                                        padding: '10px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                // Original 3D content when WebGL is available
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

                        {/* Text box */}
                        {isChatOpen && (
                            <ConversationDisplay 
                                conversation={conversation}
                                isChatOpen={isChatOpen}
                                onSendMessage={handleSendMessage}
                                isLoading={loading}
                            />
                        )}
                    </Html>
                </Suspense>
            )}
        </>
    );
}

// Preload assets
useGLTF.preload("/models/MPG.glb");
useFBX.preload("/animations/id.fbx");
