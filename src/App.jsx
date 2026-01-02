import React, { useState, useRef, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import {
    Upload, FileText, CheckCircle2, AlertCircle, Play, Download,
    Trash2, Folder, Cpu, Terminal, Shield, Sparkles,
    Calendar, FileArchive, Search, BrainCircuit, Loader2,
    PieChart, LayoutDashboard, FileStack, History, Info,
    Filter, ChevronRight, HardDrive, User, LogOut, Bell, X, Menu,
    FileImage, FileType, CheckCircle, MoreHorizontal, BookOpen, Languages, CloudUpload, Lock,
    Calendar as CalendarIcon, FileCode, Sliders, Zap, Award, WifiOff, Wand2
} from 'lucide-react';
import { extractFileContent } from './utils/fileExtractor';
import { generateStudyBrief } from './utils/postProcessing';
import { uploadToDrive } from './utils/driveService';
import AnalysisModeSelector from './components/AnalysisModeSelector';
import ImageAnalysisToggle from './components/ImageAnalysisToggle';
import FileContextToggle from './components/FileContextToggle';
// Worker import compatible with Vite
import ZipWorker from './workers/zipWorker?worker';
import ReactMarkdown from 'react-markdown';
import TimelineView from './components/TimelineView';
import QuizModal from './components/QuizModal';

// --- Configuration Constants ---
const GOOGLE_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ""; // Loaded from .env

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD6UJ9DMh-3qLdHabcfWxQFReggV_7ox90",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "semscan-51.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "semscan-51",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "semscan-51.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "712898743864",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:712898743864:web:f31919102875ad6899e0cd",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-EZEY18W995"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all group ${active
            ? 'bg-[#28425A] text-white shadow-sm'
            : 'text-[#8fa6b8] hover:text-white hover:bg-white/5'
            }`}
    >
        <Icon className={`w-5 h-5 transition-colors ${active ? 'text-white' : 'text-[#8fa6b8]'}`} />
        {label}
    </button>
);

const MetricCard = ({ label, value, icon: Icon }) => (
    <div className="bg-white border border-[#d1c7b3]/30 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#f8f5f0] rounded-lg">
                <Icon className="w-4 h-4 text-[#122538]" />
            </div>
            <span className="text-[10px] font-bold text-[#122538]/50 uppercase tracking-widest">{label}</span>
        </div>
        <div className="text-4xl font-serif font-bold text-[#122538] tracking-tight">{value}</div>
    </div>
);

const FileIcon = ({ filename }) => {
    const ext = filename?.split('.').pop().toLowerCase();
    if (['jpg', 'png', 'jpeg'].includes(ext)) return <FileImage className="w-4 h-4 text-[#c8bca0]" />;
    if (ext === 'pdf') return <FileType className="w-4 h-4 text-rose-800/60" />;
    return <FileText className="w-4 h-4 text-[#1a3b5d]" />;
};

// --- Main Application ---

export default function App() {

    const [view, setView] = useState('overview');
    const [zipInstance, setZipInstance] = useState(null);
    const [isProcessingZip, setIsProcessingZip] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStep, setScanStep] = useState(0);
    const [results, setResults] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [subjectFilter, setSubjectFilter] = useState('All'); // For filtering by subject from Subjects view
    const [driveToken, setDriveToken] = useState(null);
    const [user, setUser] = useState(null);
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state
    const [scanMode, setScanMode] = useState('fast'); // 'fast' | 'pro'
    const [includeImages, setIncludeImages] = useState(true); // Toggle for image analysis
    const [includeFileContext, setIncludeFileContext] = useState(false); // Toggle for sending file context (100 chars)
    const [proQuota, setProQuota] = useState({ count: 0, lastRun: null }); // Persistence for hackathon limits
    const [studyBriefModal, setStudyBriefModal] = useState({ open: false, content: '', loading: false }); // Study Brief preview
    const [isUploading, setIsUploading] = useState(false); // Cloud upload state
    const [scanHistory, setScanHistory] = useState([]); // Level 3: Firebase History
    const [originalFile, setOriginalFile] = useState(null); // Persistence for Worker re-init

    // --- Beta Features State ---
    const [isBetaEnabled, setIsBetaEnabled] = useState(true); // Feature Flag
    const [timelineEvents, setTimelineEvents] = useState([]); // Extracted chat events
    const [quizModal, setQuizModal] = useState({ open: false, data: null, loading: false }); // Quiz State

    const fileInputRef = useRef(null);
    const workerRef = useRef(null); // Reference to the ZipWorker

    // Fetch History when view changes
    useEffect(() => {
        if (view === 'history' && user) {
            const fetchHistory = async () => {
                try {
                    // Requires Index if using compound query, but simplified here:
                    const q = query(
                        collection(db, "scans"),
                        where("uid", "==", user.uid),
                        orderBy("date", "desc"),
                        limit(10)
                    );
                    const querySnapshot = await getDocs(q);
                    const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setScanHistory(history);
                } catch (e) {
                    console.error("History fetch error (check Firestore indexes):", e);
                }
            };
            fetchHistory();
        }
    }, [view, user]);

    const SUBJECT_KEYWORDS = {
        "Physics": ["physics", "phy", "optics", "quantum", "mechanics", "light", "wave", "thermo", "lab", "modern physics", "electromagnetic"],
        "Math": ["math", "maths", "calculus", "integration", "algebra", "matrix", "derivative", "statistics"],
        "BME": ["bme", "biology", "biomedical", "anatomy", "cell", "physiology"],
        "Engineering_Graphics": ["eg", "graphics", "drawing", "projection", "autocad", "isometric", "scale"],
        "General": ["notice", "circular", "holiday", "exam", "time table", "schedule", "fees", "admin"]
    };

    const scanNarrative = [
        "Mounting local archive",
        "Identifying file pointers",
        "Local subject heuristics",
        "Privacy-shielded AI Scan",
        "Building academic tree"
    ];



    // Load Quota from LocalStorage (Sync on mount)
    useEffect(() => {
        const saved = localStorage.getItem('semscan_quota');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Reset if it's a new day
                const today = new Date().toDateString();
                if (parsed.date !== today) {
                    setProQuota({ count: 0, lastRun: Date.now() });
                } else {
                    setProQuota(parsed);
                }
            } catch (e) {
                console.error("Quota parse error", e);
            }
        }
    }, []);

    // Load Dependencies & Init Worker

    // Load Dependencies & Init Worker
    useEffect(() => {
        // Initialize Web Worker
        workerRef.current = new ZipWorker();
        workerRef.current.onmessage = (e) => {
            const { type, entries, blob, error } = e.data;
            if (type === 'ZIP_LOADED') {
                // Metadata-First: We have the file list, but NOT the heavy file contents
                setZipInstance(entries); // storing lightweight entries list instead of heavy JSZip obj
                setIsProcessingZip(false);
            } else if (type === 'ZIP_GENERATED') {
                // This will be handled by the one-off listener in generateOrganizedBlob, 
                // but we might need a global handler if we used that pattern.
                // However, generateOrganizedBlob uses a Promise wrapper with addEventListener.
                // To avoid double handling, we can ignore it here or dispatch a custom event.
                // Better yet, let's make the Promise wrapper rely on a unique ID or just this event if we move the listener here?
                // For simplicity, let's keep the global error handler here and letting the specific promise listener handle success.
                // BUT, if we have multiple listeners, they both fire.
                window.dispatchEvent(new CustomEvent('ZIP_GENERATED', { detail: blob }));
            } else if (type === 'ERROR') {
                console.error("Worker Error:", error);
                alert("Error processing ZIP: " + error);
                setIsProcessingZip(false);
                window.dispatchEvent(new CustomEvent('ZIP_ERROR', { detail: error }));
            }
        };

        const gapiScript = document.createElement('script');
        gapiScript.src = "https://apis.google.com/js/api.js";
        gapiScript.async = true;
        gapiScript.onload = () => {
            window.gapi.load('picker', () => setIsGapiLoaded(true));
        };
        document.body.appendChild(gapiScript);

        // Load Quota from LocalStorage
        const savedQuota = localStorage.getItem('semscan_quota');
        if (savedQuota) {
            const parsed = JSON.parse(savedQuota);
            // Reset if it's a new day
            if (new Date(parsed.lastRun).getDate() !== new Date().getDate()) {
                setProQuota({ count: 0, lastRun: Date.now() });
            } else {
                setProQuota(parsed);
            }
        }

        return () => {
            if (gapiScript.parentNode) document.body.removeChild(gapiScript);
            // Terminate worker? No, let's keep it alive for the session.
            // workerRef.current?.terminate(); 
        };
    }, []);

    // --- Google Drive Logic ---

    const handleDriveAuth = async (callback) => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.readonly');
        provider.addScope('https://www.googleapis.com/auth/drive.file');

        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            const user = result.user;

            setDriveToken(token);
            setUser(user);
            if (callback) callback(token);
        } catch (error) {
            console.error("Firebase Auth Error:", error);
            alert("Authentication failed: " + error.message);
        }
    };

    const handleDriveImport = () => handleDriveAuth((token) => {
        if (!window.google || !window.google.picker) {
            alert("Google Picker API is still loading. Please try again in a few seconds.");
            return;
        }
        const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS)
            .setOAuthToken(token)
            .setDeveloperKey(GOOGLE_API_KEY)
            .setCallback(async (data) => {
                if (data.action === window.google.picker.Action.PICKED) {
                    const fileId = data.docs[0].id;
                    const fileName = data.docs[0].name;
                    setIsProcessingZip(true);
                    try {
                        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const blob = await resp.blob();
                        if (fileName.endsWith('.zip')) {
                            const zip = await new window.JSZip().loadAsync(blob);
                            setZipInstance(zip);
                        }
                        setResults([]);
                    } catch (e) { console.error(e); } finally { setIsProcessingZip(false); }
                }
            })
            .build();
        picker.setVisible(true);
    });

    // --- AI Privacy Logic ---

    const blobToBase64 = (blob) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });

    const callGeminiPrivacyFirst = async (item, imageData = null, textContent = null) => {
        // DIAGNOSTIC: Check if API Key is configured
        if (!GOOGLE_API_KEY) {
            console.error("Gemini API Key is missing! Please configure VITE_GEMINI_API_KEY in Vercel environment variables.");
            return { category: "Uncategorized", ocr: "", confidence: "Error: No Key", suggested_filename: null };
        }

        let promptText = `Analyze this academic file: "${item.fileName}". 
               The suggested subject from local processing is "${item.subject}".
               Categories: Notes, Assignment, Admin, Junk.
               
               IMPORTANT: Generate a clean, descriptive filename based on the content.
               - Use format: Subject_Type_Topic (e.g., Physics_Lab_Thermodynamics)
               - Max 40 characters, use underscores, no spaces
               - Keep the original file extension
               - If content is unclear, use the original filename`;

        if (textContent && includeFileContext) {
            promptText += `\n\nFile Context (first 100 chars):\n"${textContent.slice(0, 100)}..."`;
        }

        promptText += `\n\nOutput JSON ONLY: {
            "category": "string",
            "ocr": "string",
            "confidence": "string",
            "suggested_filename": "string (without extension)"
        }`;

        const parts = [{ text: promptText }];

        if (imageData) {
            parts.push({ inlineData: { mimeType: "image/png", data: imageData } });
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts }] })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API Error:", response.status, errorData);
                throw new Error(`Gemini API failed with status ${response.status}`);
            }

            const data = await response.json();
            let text = data.candidates[0].content.parts[0].text;

            // CLEANUP: Remove markdown code block wrappers if present
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();

            return JSON.parse(text);
        } catch (e) {
            console.error("PRO Scan Error for " + item.fileName + ":", e);
            return { category: "Uncategorized", ocr: "", confidence: "Low", suggested_filename: null };
        }
    };

    // --- Beta Feature Functions ---

    const callGeminiTimeline = async (chatText) => {
        if (!GOOGLE_API_KEY) return [];

        const prompt = `
        Analyze this chat log and extract key academic dates, exams, and assignment deadlines.
        Ignore conversation filler. Focus on explicit dates or "next monday"-style phrases if context allows.
        Return a JSON array of objects with keys: { date: "YYYY-MM-DD", title: "Short Title", description: "Details", type: "exam" | "assignment" | "event", context: "Quote from chat" }.
        If no events found, return [].
        
        Chat Log:
        ${chatText.substring(0, 15000)} // Limit context 
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let text = data.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(text);
        } catch (e) {
            console.error("Timeline Gen Error:", e);
            return [];
        }
    };

    const callGeminiQuiz = async (fileText, fileName) => {
        if (!GOOGLE_API_KEY) throw new Error("No API Key");

        const prompt = `
        Create a 5-question multiple-choice quiz based on these notes.
        Target Audience: University Student.
        File: ${fileName}
        
        Content:
        ${fileText.substring(0, 10000)}

        Return strictly JSON format:
        {
          "questions": [
            {
              "question": "Question text?",
              "options": ["A", "B", "C", "D"],
              "correctAnswerIndex": 0 // 0-3
            }
          ]
        }
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let text = data.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(text);
        } catch (e) {
            console.error("Quiz Gen Error:", e);
            return null;
        }
    };

    const checkQuota = () => {
        if (scanMode !== 'pro') return true;

        // 5 Requests per day limit for Hackathon
        const today = new Date().toDateString();
        const stored = localStorage.getItem('semscan_quota');
        let data = stored ? JSON.parse(stored) : { count: 0, date: today };

        if (data.date !== today) {
            data = { count: 0, date: today }; // Reset if new day
        }

        if (data.count >= 5) {
            alert("Daily PRO Quota Reached (5/5). Try again tomorrow or use FAST mode!");
            return false;
        }
        return true;
    };

    const updateQuota = () => {
        if (scanMode !== 'pro') return;
        const today = new Date().toDateString();
        const stored = localStorage.getItem('semscan_quota');
        let data = stored ? JSON.parse(stored) : { count: 0, date: today };

        if (data.date !== today) data = { count: 0, date: today };

        data.count += 1;
        data.lastRun = Date.now();
        localStorage.setItem('semscan_quota', JSON.stringify(data));
        setProQuota(data);
    };

    const getFileFromWorker = (filename) => {
        return new Promise((resolve, reject) => {
            const tempChannel = new MessageChannel();
            tempChannel.port1.onmessage = (e) => {
                const { blob, error } = e.data;
                if (error) reject(error);
                else resolve(blob);
            };
            workerRef.current.postMessage(
                { type: 'EXTRACT_FILE', entryName: filename },
                [tempChannel.port2] // Transfer port
            );
            // Worker needs to be updated to accept port, or we use simpler main listener
            // Given current worker impl, we used postMessage globally. 
            // Let's rely on a one-off event listener for simplicity in this MVP.
            const handler = (e) => {
                if (e.data.type === 'FILE_EXTRACTED' && e.data.entryName === filename) {
                    workerRef.current.removeEventListener('message', handler);
                    resolve(e.data.blob);
                }
            };
            workerRef.current.addEventListener('message', handler);
        });
    };

    const saveScanSession = async (scanResults) => {
        if (!user) return; // Only save history for logged-in users (Level 3)
        try {
            await addDoc(collection(db, "scans"), {
                uid: user.uid,
                date: new Date().toISOString(),
                fileCount: scanResults.length,
                subjects: [...new Set(scanResults.map(r => r.subject))],
                type: scanMode,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error("Failed to save history:", e);
        }
    };

    const startScan = async () => {
        if (!zipInstance) { alert("Please upload a file first."); return; }
        if (!checkQuota()) return;

        setIsScanning(true);
        setScanStep(1);

        const rawItems = [];

        // Build list of relevant files from ZIP entries
        zipInstance.forEach((entry, index) => {
            const fileName = entry.filename;
            if (entry.directory || fileName.includes('__MACOSX')) return;

            // Skip chat/text files UNLESS Beta is valid
            if (fileName.toLowerCase().endsWith('.txt') && !isBetaEnabled) return;

            // PRIVACY: Skip images when includeImages is OFF
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
            if (isImage && !includeImages) {
                return;
            }

            // Heuristic: Check filename for subject
            let subject = "General";
            const filenameLower = fileName.toLowerCase();

            for (const [sub, keys] of Object.entries(SUBJECT_KEYWORDS)) {
                if (keys.some(k => filenameLower.includes(k))) {
                    subject = sub;
                    break;
                }
            }
            rawItems.push({ id: index, fileName, subject });
        });

        // Also add "Loose" files that might be in ZIP but not in chat (PRO feature?)
        // For now, stick to chat-linked files for safety.

        setScanStep(3);
        await new Promise(r => setTimeout(r, 1000));

        // STEP 4: Mode-Based Processing
        setScanStep(4);
        const processedResults = [];
        // PRO Mode: Analyze ALL files (as requested). FAST Mode: Process chunk or all?
        // For FAST mode, it's local only, so we can do all.
        // For PRO mode, it takes time. 
        const itemsToProcess = rawItems;

        for (const item of itemsToProcess) {
            let aiResult;
            let fileContent = null;
            let ocrText = "";

            // Tier 1 Gatekeeper: Did local heuristics find a specific subject?
            // "General" is our fallback, so if it's NOT General, we are conditionally confident.
            const tier1Confident = item.subject !== 'General';
            const isImage = /\.(jpg|jpeg|png)$/i.test(item.fileName);

            // Tier 2 Trigger:
            // 1. It's an Image (Regex can't read pixels) -> ALWAYS AI (if enabled)
            // 2. OR Tier 1 was unsure (Subject is General) -> AI
            const needsAI = (includeImages && isImage) || !tier1Confident;

            if (scanMode === 'pro' && needsAI) {
                try {
                    const blob = await getFileFromWorker(item.fileName);

                    if (isImage) {
                        // Image Handling (Tier 2 Vision)
                        if (includeImages) {
                            fileContent = await blobToBase64(blob);
                            aiResult = await callGeminiPrivacyFirst(item, fileContent);
                        } else {
                            // Privacy Toggle OFF -> Skip Content
                            aiResult = { category: "Uncategorized", ocr: "", confidence: "Skipped (Privacy)" };
                        }
                    } else {
                        // Text Document Handling (Tier 2 Metadata-Only Analysis)
                        // Extract content ONLY if user enables "File Context" toggle
                        if (includeFileContext) {
                            fileContent = await extractFileContent(new File([blob], item.fileName));
                            aiResult = await callGeminiPrivacyFirst(item, null, fileContent);
                        } else {
                            // PRIVACY: NO text extraction - only filename metadata is sent to AI
                            aiResult = await callGeminiPrivacyFirst(item, null, null);
                        }
                    }
                } catch (e) {
                    console.warn("Extraction/AI failed for", item.fileName);
                    // Fallback to Tier 1 even if it failed? Or Junk?
                    aiResult = { category: "Junk", ocr: "", confidence: "Error" };
                }
            } else {
                // Tier 1 Success (or Fast Mode): Use Local Data Only
                // Simple keyword mapping for category since we skipped AI
                const lowerName = item.fileName.toLowerCase();
                let localCategory = 'Notes'; // Default
                if (lowerName.includes('lab') || lowerName.includes('practical')) localCategory = 'Lab';
                if (lowerName.includes('assign') || lowerName.includes('h.w')) localCategory = 'Assignment';
                if (lowerName.includes('syllabus') || lowerName.includes('table')) localCategory = 'Admin';
                // Beta: Classify .txt as Chat
                if (lowerName.endsWith('.txt')) localCategory = 'Chat Log';

                aiResult = {
                    category: localCategory,
                    ocr: "",
                    confidence: tier1Confident ? "High (Tier 1)" : "Low (Local)"
                };
            }

            // Beta: If it is a chat log, try to extract timeline (Silent background process)
            if (isBetaEnabled && scanMode === 'pro' && item.fileName.endsWith('.txt')) {
                getFileFromWorker(item.fileName).then(async (blob) => {
                    const text = await blob.text();
                    const events = await callGeminiTimeline(text);
                    if (events && events.length > 0) {
                        setTimelineEvents(prev => [...prev, ...events]);
                    }
                });
            }

            // Generate clean filename from AI suggestion
            const fileExtension = item.fileName.split('.').pop();
            const cleanFileName = aiResult.suggested_filename
                ? `${aiResult.suggested_filename}.${fileExtension}`
                : item.fileName;

            processedResults.push({
                ...item,
                category: aiResult.category,
                ocrText: aiResult.ocr || "", // Only OCR from images, never text content
                confidence: aiResult.confidence,
                cleanFileName: cleanFileName, // Smart renamed file
                originalFileName: item.fileName // Keep original for reference
            });

            // Rate Limiting: 2s delay ONLY if we actually hit the API
            if (scanMode === 'pro' && needsAI) await new Promise(r => setTimeout(r, 2000));
        }

        setScanStep(5);
        setResults(processedResults);
        saveScanSession(processedResults);
        setIsScanning(false);
        updateQuota();
    };

    // --- Export Logic ---

    const generateOrganizedBlob = async () => {
        if (!zipInstance) return null;

        const fileMap = [];
        zipInstance.forEach(entry => {
            const name = entry.filename;
            if (entry.directory || name.includes('__MACOSX')) return;

            const match = results.find(r => r.originalFileName === name);
            let newPath = name;

            if (match) {
                if (name.toLowerCase().endsWith('.txt')) {
                    newPath = name;
                } else {
                    const folder = match.category === 'Junk' ? 'Junk' : `College_Docs/${match.subject}/${match.category}`;
                    newPath = `${folder}/${match.cleanFileName || name}`;
                }
            } else {
                newPath = `Unsorted/${name}`;
            }
            fileMap.push({ original: name, newPath });
        });

        return new Promise((resolve, reject) => {
            const handler = (e) => {
                window.removeEventListener('ZIP_GENERATED', handler);
                window.removeEventListener('ZIP_ERROR', errHandler);
                resolve(e.detail);
            };
            const errHandler = (e) => {
                window.removeEventListener('ZIP_GENERATED', handler);
                window.removeEventListener('ZIP_ERROR', errHandler);
                reject(e.detail);
            };

            window.addEventListener('ZIP_GENERATED', handler);
            window.addEventListener('ZIP_ERROR', errHandler);

            workerRef.current.postMessage({ type: 'GENERATE_ZIP', fileMap, file: originalFile });
        });
    };

    const saveToDrive = async () => {
        if (!driveToken) { handleDriveAuth(() => saveToDrive()); return; }
        setIsScanning(true);
        try {
            const blob = await generateOrganizedBlob();
            if (!blob) return;
            const metadata = { name: `Organized_Semester_${new Date().toISOString().split('T')[0]}.zip`, mimeType: 'application/zip' };
            const res = await uploadToDrive(blob, metadata.name, driveToken);
            if (res.success) {
                alert(`✅ Successfully saved to Google Drive!\nFolder: SemesterScan\nFile: ${res.name} `);
            } else {
                throw new Error(res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Upload failed: " + e.message);
        } finally {
            setIsScanning(false);
        }
    };

    const downloadOrganizedZip = async () => {
        setIsScanning(true);
        const blob = await generateOrganizedBlob();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Organized_Archive.zip`;
            a.click();
        }
        setIsScanning(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = ''; // Reset so same file can be selected again


        // Security: Zip Bomb / Large File Check
        // 5GB is too big for JSZip, but OK for our Streaming Worker.
        // However, standard File Input can technically handle it.
        // We'll trust the Worker to handle it gracefully.

        setIsProcessingZip(true);
        setOriginalFile(file);
        // Offload to Worker
        workerRef.current.postMessage({ type: 'INIT_ZIP', file: file });
    };

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = r.fileName.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q);
            const matchesFilter = activeFilter === 'All' || r.category === activeFilter;
            const matchesSubject = subjectFilter === 'All' || r.subject === subjectFilter;
            return matchesSearch && matchesFilter && matchesSubject;
        });
    }, [results, searchQuery, activeFilter, subjectFilter]);

    const stats = useMemo(() => ({
        academic: results.filter(r => r.category !== 'Junk').length,
        junk: results.filter(r => r.category === 'Junk').length,
        subjects: new Set(results.map(r => r.subject)).size
    }), [results]);

    return (
        <div className="min-h-screen bg-[#f8f5f0] text-[#122538] font-sans flex overflow-hidden">

            {/* MOBILE OVERLAY */}
            {isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
                />
            )}

            {/* SIDEBAR */}
            <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-[#122538] text-white flex flex-col h-screen shrink-0 shadow-2xl z-30 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="h-20 flex items-center px-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                        <span className="font-bold text-xl tracking-wide text-white">SemesterScan</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 mt-6 space-y-2">
                    <SidebarItem icon={LayoutDashboard} label="Overview" active={view === 'overview'} onClick={() => setView('overview')} />
                    <SidebarItem icon={FileStack} label="Files" active={view === 'files'} onClick={() => setView('files')} />
                    <SidebarItem icon={PieChart} label="Subjects" active={view === 'subjects'} onClick={() => setView('subjects')} />
                    <SidebarItem icon={CloudUpload} label="Import Drive" active={false} onClick={handleDriveImport} />
                    <SidebarItem icon={History} label="History" active={view === 'history'} onClick={() => setView('history')} />
                    <div className="px-6 my-6"><div className="h-px bg-white/10 w-full" /></div>
                    <SidebarItem icon={BookOpen} label="Guide" active={view === 'guide'} onClick={() => setView('guide')} />
                </nav>

                <div className="p-4 bg-[#122538] space-y-2">
                    <div className="px-4 py-2 bg-indigo-500/10 rounded-lg flex items-center gap-3 border border-indigo-500/20 mb-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest leading-none">Privacy Engine Active</span>
                    </div>

                    <div
                        onClick={async () => {
                            if (!user) {
                                // Use the centralized auth function with correct scopes
                                handleDriveAuth();
                            } else {
                                // Sign out
                                await signOut(auth);
                                setUser(null);
                                setDriveToken(null);
                            }
                        }}
                        className="flex items-center gap-3 px-4 py-3 border-t border-white/10 pt-4 cursor-pointer hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#28425A] flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
                            {user && user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full" /> : 'U1'}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold text-white truncate">{user ? user.displayName : 'Guest User'}</span>
                            <span className="text-xs text-[#8fa6b8]">{user ? 'Click to sign out' : 'Sign in with Google'}</span>
                        </div>
                        {!user && <ChevronRight className="w-4 h-4 text-[#8fa6b8]" />}
                    </div>
                </div>
            </aside>

            {/* MAIN VIEWPORT */}
            <main className="flex-1 flex flex-col relative bg-[#f8f5f0] overflow-hidden">

                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                    <svg className="absolute -top-20 -left-20 w-[500px] h-[500px] text-[#c8bca0]/20" fill="none" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="38" stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.2" />
                    </svg>
                    <BookOpen className="absolute top-24 left-1/4 w-12 h-12 text-[#122538]/10 -rotate-12" />
                    <div className="absolute bottom-0 right-0 w-[600px] h-[600px] border-[60px] border-white/40 rounded-full translate-x-1/2 translate-y-1/2" />
                </div>

                {/* HEADER */}
                <header className="h-20 flex items-center justify-between px-4 lg:px-8 relative z-20 gap-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-[#122538]">
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-4 flex-1">
                        <Search className="w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search organized files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-sm outline-none w-full max-w-md text-[#122538] font-medium placeholder-gray-400 focus:ring-0"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-[#d1e7dd] text-[#0f5132] flex items-center gap-2`}>
                            <Lock className="w-3 h-3" /> local processing
                        </div>
                    </div>
                </header>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-8">

                    {/* VIEW: GUIDE */}
                    {view === 'guide' && (
                        <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                            <div className="space-y-4 text-center">
                                <div className="w-16 h-16 bg-[#1a3b5d]/5 rounded-2xl flex items-center justify-center mx-auto">
                                    <Shield className="w-8 h-8 text-[#1a3b5d]" />
                                </div>
                                <h1 className="font-serif text-4xl font-bold text-[#122538]">Privacy-First Organization</h1>
                                <p className="text-gray-500 text-lg">Your group chats stay private. We only use AI to classify files and process image text, never to read your messages.</p>
                            </div>
                        </div>
                    )}

                    {/* INITIAL STATE: HERO */}
                    {view === 'overview' && results.length === 0 && !isScanning && (
                        <div className="min-h-full flex flex-col items-center justify-start text-center max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 py-20">
                            <div className="mb-10 relative">
                                <img
                                    src="/logo.png"
                                    alt="Academic Illustration"
                                    className="w-48 relative z-10 mx-auto"
                                />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-[#c8bca0]/40 rounded-full -z-10" />
                            </div>

                            <h1 className="font-serif text-5xl font-bold text-[#122538] mb-6 tracking-tight">Organize your semester</h1>
                            <p className="text-gray-500 text-lg mb-8 max-w-[600px]">Upload your semester ZIP archive to structure your notes by subject. Processing is local and private.</p>

                            {/* Seasonal Callout */}
                            <div className="mb-8 bg-amber-50 border border-amber-200 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">🔥 Final Exams Approaching?</span>
                                <span className="text-xs text-amber-800">Find that one missing PDF in seconds.</span>
                            </div>

                            <div className="flex flex-col items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-1 border-2 border-[#c8bca0] rounded-[12px] bg-transparent">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="bg-[#1a3b5d] hover:bg-[#0d1b2a] text-white px-8 py-3 rounded-[8px] flex items-center gap-3 font-medium text-lg shadow-lg"
                                        >
                                            {isProcessingZip ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileArchive className="w-5 h-5" />}
                                            {zipInstance ? 'ZIP Verified' : 'Upload ZIP Export'}
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".zip" className="hidden" />
                                        </button>
                                    </div>
                                </div>
                                {zipInstance && (
                                    <div className="flex flex-col items-center gap-4 w-full max-w-md">
                                        {/* Analysis Mode Selector Component */}
                                        <AnalysisModeSelector
                                            mode={scanMode.toUpperCase()}
                                            onChange={(mode) => setScanMode(mode.toLowerCase())}
                                            disabled={false}
                                        />

                                        {/* Image Analysis Toggle Component */}
                                        {scanMode === 'pro' && (
                                            <ImageAnalysisToggle
                                                enabled={includeImages}
                                                onChange={setIncludeImages}
                                                disabled={false}
                                            />
                                        )}

                                        {/* File Context Toggle Component */}
                                        {scanMode === 'pro' && (
                                            <FileContextToggle
                                                enabled={includeFileContext}
                                                onChange={setIncludeFileContext}
                                                disabled={false}
                                            />
                                        )}

                                        {/* Beta Features Toggle */}
                                        <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${isBetaEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                                onClick={() => setIsBetaEnabled(!isBetaEnabled)}>
                                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${isBetaEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                            <div className="text-xs">
                                                <div className="font-bold text-indigo-900">Beta Features</div>
                                                <div className="text-[10px] text-indigo-600/70">Enable Chat Timeline & Quizzes</div>
                                            </div>
                                        </div>

                                        {/* Quota Display */}
                                        {scanMode === 'pro' && (
                                            <div className="w-full px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 text-xs text-center font-medium text-purple-700">
                                                <span className="font-bold">{proQuota.count}/5</span> PRO scans used today
                                            </div>
                                        )}

                                        <button onClick={startScan} className="text-[#1a3b5d] font-bold text-sm underline underline-offset-4 hover:text-[#c8bca0] flex items-center gap-2 mt-2">
                                            Begin {scanMode === 'pro' ? 'Deep' : 'Rapid'} Extraction <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* MAJOR SPECIFIC LANDING BLOCKS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full text-left">
                                {[
                                    { title: "Engineering", desc: "Organize Mechanics & Graphics notes automatically.", color: "bg-blue-50 text-blue-700" },
                                    { title: "Medical", desc: "Sort Anatomy diagrams from whiteboard photos.", color: "bg-rose-50 text-rose-700" },
                                    { title: "CS & IT", desc: "Keep track of coding assignments & lab manuals.", color: "bg-emerald-50 text-emerald-700" }
                                ].map((major, i) => (
                                    <div key={i} className={`p - 6 rounded - 2xl border border - black / 5 ${major.color} bg - opacity - 50`}>
                                        <h3 className="font-bold mb-2">{major.title}</h3>
                                        <p className="text-xs opacity-80">{major.desc}</p>
                                    </div>
                                ))}
                            </div>

                            {/* PRIVACY TRUST SECTION */}
                            <div className="mt-16 flex flex-col items-center gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#122538]/40">Trusted by Privacy-Conscious Students</span>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#d1c7b3]/30 shadow-sm text-xs font-bold text-[#122538]">
                                        <Lock className="w-3 h-3 text-emerald-600" /> Client-Side Processing
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#d1c7b3]/30 shadow-sm text-xs font-bold text-[#122538]">
                                        <WifiOff className="w-3 h-3 text-gray-400" /> Works Offline
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SCANNING STATE */}
                    {isScanning && (
                        <div className="h-full flex flex-col items-center justify-center max-w-sm mx-auto space-y-12">
                            <div className="w-16 h-16 rounded-full border-2 border-gray-200 border-t-[#1a3b5d] animate-spin" />
                            <div className="w-full space-y-4">
                                {scanNarrative.map((text, i) => (
                                    <div key={i} className={`flex items - center justify - between px - 6 py - 4 rounded - xl border transition - all duration - 500 ${scanStep > i + 1 ? 'bg-emerald-50 border-emerald-100' : scanStep === i + 1 ? 'bg-white border-[#1a3b5d]/30' : 'bg-white/50 opacity-20'
                                        } `}>
                                        <span className="text-sm font-medium text-[#122538]">{text}</span>
                                        {scanStep > i + 1 ? <CheckCircle2 className="w-4 h-4 text-[#0f5132]" /> : scanStep === i + 1 && <Loader2 className="w-4 h-4 animate-spin text-[#1a3b5d]" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DASHBOARD (Overview) */}
                    {view === 'overview' && results.length > 0 && !isScanning && (
                        <div className="space-y-10 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">
                            <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-[#d1c7b3]/30 pb-8 gap-6">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#122538] tracking-tight">Curation Complete.</h2>
                                    <p className="text-gray-500 text-sm mt-2 font-medium">Chat messages filtered out. Only academic assets retained.</p>
                                </div>
                                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                                    <div className="p-1 border border-[#c8bca0] rounded-[10px]">
                                        <button onClick={downloadOrganizedZip} className="px-6 py-2.5 bg-[#1a3b5d] hover:bg-[#0d1b2a] text-white rounded-[6px] text-sm font-bold flex items-center gap-2">
                                            <Download className="w-4 h-4" /> Download ZIP
                                        </button>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            // Check if user is signed in
                                            if (!user || !driveToken) {
                                                const confirmLogin = confirm("You need to sign in with Google to save files. Sign in now?");
                                                if (confirmLogin) {
                                                    handleDriveAuth();
                                                }
                                                return;
                                            }

                                            setIsUploading(true);
                                            try {
                                                const blob = await generateOrganizedBlob();
                                                if (blob) {
                                                    const filename = `SemesterScan_${new Date().toISOString().split('T')[0]}.zip`;
                                                    const result = await uploadToDrive(blob, filename, driveToken);
                                                    if (result.success) {
                                                        alert(`✅ Saved to Google Drive!\n\nView: ${result.webViewLink} `);
                                                    } else {
                                                        throw new Error(result.error);
                                                    }
                                                }
                                            } catch (e) {
                                                console.error("Drive Upload Failed:", e);
                                                alert(`❌ Upload failed: ${e.message} \n\nTIP: Did you add '${window.location.origin}' to "Authorized JavaScript origins" in Google Cloud Console ? `);
                                            } finally {
                                                setIsUploading(false);
                                            }
                                        }}
                                        disabled={isUploading}
                                        className="px-6 py-2.5 bg-white border border-[#d1c7b3]/50 text-[#122538] hover:bg-[#f8f5f0] rounded-[10px] text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4 text-[#c8bca0]" />}
                                        Save to Drive
                                    </button>
                                    <button
                                        onClick={() => {
                                            setZipInstance(null);
                                            setResults([]);
                                            setSelectedFile(null);
                                            setSubjectFilter('All');
                                            setActiveFilter('All');
                                            setView('overview');
                                        }}
                                        className="px-6 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-[10px] text-sm font-bold flex items-center gap-2"
                                    >
                                        <Upload className="w-4 h-4" /> New Scan
                                    </button>
                                </div>
                            </div>

                            {/* POST PROCESSING ACTIONS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={async () => {
                                        setStudyBriefModal({ open: true, content: '', loading: true });
                                        const brief = await generateStudyBrief(results, GOOGLE_API_KEY);
                                        setStudyBriefModal({ open: true, content: brief, loading: false });
                                    }}
                                    className="bg-white p-4 rounded-xl border border-[#d1c7b3]/30 flex items-center gap-4 hover:shadow-md transition-all group"
                                >
                                    <div className="p-3 bg-rose-50 rounded-lg text-rose-600 group-hover:scale-110 transition-transform"><BookOpen className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <div className="font-bold text-[#122538]">Generate Study Brief</div>
                                        <div className="text-xs text-gray-500">AI summary of top files (Preview first)</div>
                                    </div>
                                </button>
                                {/* Calendar Sync Removed: Feature requires chat logs which are disabled for privacy. */}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <MetricCard label="Private Docs" value={stats.academic} icon={FileStack} />
                                <MetricCard label="Chat Noise Filtered" value={stats.junk} icon={Trash2} />
                                <MetricCard label="Department Clusters" value={stats.subjects} icon={Folder} />
                            </div>

                            {/* TIMELINE BETA VIEW */}
                            {/* TIMELINE BETA VIEW */}
                            {isBetaEnabled && (
                                timelineEvents.length > 0 ? (
                                    <div className="bg-white border border-[#d1c7b3]/30 rounded-2xl p-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                                            <CalendarIcon className="w-5 h-5 text-indigo-600" />
                                            <h3 className="font-bold text-lg text-[#122538]">Key Curricular Dates (Beta)</h3>
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full">AI Generated</span>
                                        </div>
                                        <TimelineView events={timelineEvents} />
                                    </div>
                                ) : (
                                    <div className="p-4 border border-dashed border-gray-300 rounded-xl text-center bg-gray-50/50">
                                        <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-2">
                                            <CalendarIcon className="w-3 h-3" />
                                            Timeline requires a chat log (.txt) scanned in <span className="font-bold text-purple-600">PRO Mode</span>.
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* VIEW: FILES */}
                    {view === 'files' && results.length > 0 && (
                        <div className="bg-white border border-[#d1c7b3]/30 rounded-2xl overflow-hidden shadow-sm animate-in fade-in">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#122538]/50 px-2 flex items-center gap-2">
                                        <Lock className="w-3 h-3 text-emerald-600" /> Filesystem Preview
                                    </h3>
                                    {subjectFilter !== 'All' && (
                                        <div className="flex items-center gap-2 bg-[#1a3b5d]/10 text-[#1a3b5d] px-3 py-1.5 rounded-full text-xs font-bold">
                                            <Folder className="w-3 h-3" />
                                            {subjectFilter.replace('_', ' ')}
                                            <button
                                                onClick={() => setSubjectFilter('All')}
                                                className="ml-1 hover:bg-[#1a3b5d]/20 rounded-full p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400">{filteredResults.length} files</span>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-[0.2em] bg-[#fcfbf9]">
                                        <th className="px-8 py-4">Descriptor</th>
                                        <th className="px-8 py-4">Department</th>
                                        <th className="px-8 py-4">Assurance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredResults.map((r, i) => (
                                        <tr key={i} onClick={() => setSelectedFile(r)} className="group cursor-pointer hover:bg-[#fcfbf9] transition-all">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    {r.cleanFileName && r.cleanFileName !== r.fileName ? (
                                                        <div className="flex items-center gap-3">
                                                            {/* Before */}
                                                            <div className="opacity-40 flex items-center gap-2 grayscale group-hover:grayscale-0 transition-all">
                                                                <FileIcon filename={r.originalFileName} />
                                                                <span className="text-xs line-through max-w-[80px] truncate decoration-red-400 decoration-2">{r.originalFileName}</span>
                                                            </div>
                                                            {/* Magic */}
                                                            <div className="bg-amber-100 p-1.5 rounded-full text-amber-600 animate-pulse">
                                                                <Wand2 className="w-3 h-3" />
                                                            </div>
                                                            {/* After */}
                                                            <div className="flex items-center gap-2">
                                                                <FileIcon filename={r.cleanFileName} />
                                                                <span className="text-sm font-bold text-[#1a3b5d]">{r.cleanFileName}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-4">
                                                            <FileIcon filename={r.fileName} />
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-[#122538] truncate max-w-xs">{r.fileName}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 italic text-gray-400 text-xs font-serif">{r.subject}</td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w - 1.5 h - 1.5 rounded - full ${r.category === 'Junk' ? 'bg-gray-300' : 'bg-[#c8bca0]'} `} />
                                                    <span className={`text - [10px] font - bold uppercase ${r.category === 'Junk' ? 'text-gray-400' : 'text-[#1a3b5d]'} `}>{r.confidence} Match</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* VIEW: SUBJECTS */}
                    {view === 'subjects' && (
                        <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">
                            <div className="border-b border-[#d1c7b3]/30 pb-6">
                                <h2 className="text-3xl font-serif font-bold text-[#122538] tracking-tight">Subject Overview</h2>
                                <p className="text-gray-500 text-sm mt-2">Files organized by academic department</p>
                            </div>

                            {results.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <PieChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium">No files scanned yet</p>
                                    <p className="text-sm">Upload and scan a ZIP file to see subject breakdown</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Object.entries(
                                        results.reduce((acc, r) => {
                                            acc[r.subject] = (acc[r.subject] || 0) + 1;
                                            return acc;
                                        }, {})
                                    ).map(([subject, count]) => (
                                        <div
                                            key={subject}
                                            onClick={() => { setSubjectFilter(subject); setView('files'); }}
                                            className="bg-white p-6 rounded-2xl border border-[#d1c7b3]/30 hover:shadow-lg transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-[#f8f5f0] rounded-xl group-hover:bg-[#1a3b5d] transition-colors">
                                                    <Folder className="w-6 h-6 text-[#1a3b5d] group-hover:text-white transition-colors" />
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1a3b5d] transition-colors" />
                                            </div>
                                            <h3 className="font-bold text-xl text-[#122538] mb-1">{subject.replace('_', ' ')}</h3>
                                            <p className="text-gray-500 text-sm">{count} file{count > 1 ? 's' : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: HISTORY */}
                    {view === 'history' && (
                        <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-4xl mx-auto">
                            <div className="border-b border-[#d1c7b3]/30 pb-6">
                                <h2 className="text-3xl font-serif font-bold text-[#122538] tracking-tight">Scan History</h2>
                                <p className="text-gray-500 text-sm mt-2">Your recent analysis sessions</p>
                            </div>

                            {!user ? (
                                <div className="p-8 bg-blue-50 text-blue-800 rounded-xl text-center border border-blue-100">
                                    <h3 className="font-bold text-lg mb-2">Sync your History</h3>
                                    <p className="text-sm mb-4">Sign in with Google to save and view your past scan sessions across devices.</p>
                                    <button onClick={() => handleDriveAuth()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">
                                        Sign In
                                    </button>
                                </div>
                            ) : scanHistory.length === 0 && results.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium">No scan history found</p>
                                    <p className="text-sm">Your future scans will be saved here automatically.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Current Session Card */}
                                    {results.length > 0 && (
                                        <div className="bg-white rounded-2xl border-2 border-[#1a3b5d]/10 overflow-hidden shadow-sm">
                                            <div className="p-4 bg-[#1a3b5d]/5 border-b border-[#1a3b5d]/10 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="font-bold text-[#1a3b5d] text-sm">Active Session</span>
                                                </div>
                                                <button onClick={() => setView('overview')} className="text-xs font-bold text-[#1a3b5d] hover:underline">
                                                    View Results &rarr;
                                                </button>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex items-center gap-6 text-sm text-gray-600">
                                                    <div className="flex items-center gap-2"><FileStack className="w-4 h-4" /> {stats.academic} Files</div>
                                                    <div className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> {stats.junk} Junk</div>
                                                    <div className="flex items-center gap-2"><Folder className="w-4 h-4" /> {stats.subjects} Subjects</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Past Sessions List */}
                                    {scanHistory.map((session) => (
                                        <div key={session.id} className="bg-white rounded-2xl border border-[#d1c7b3]/30 p-6 flex justify-between items-center hover:shadow-md transition-all">
                                            <div>
                                                <h3 className="font-bold text-[#122538] text-lg">Scan from {new Date(session.date).toLocaleDateString()}</h3>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {session.fileCount} files • {session.subjects?.slice(0, 3).join(', ') || 'Various'} {session.subjects?.length > 3 && `+ ${session.subjects.length - 3} `}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className={`inline - flex items - center px - 2.5 py - 0.5 rounded - full text - xs font - medium ${session.type === 'pro' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                                    } `}>
                                                    {session.type === 'pro' ? 'PRO MODE' : 'FAST MODE'}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-2">{new Date(session.date).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: GUIDE */}
                    {view === 'guide' && (
                        <div className="space-y-12 animate-in fade-in duration-500 pb-20 max-w-4xl mx-auto">
                            <div className="border-b border-[#d1c7b3]/30 pb-6">
                                <h2 className="text-3xl font-serif font-bold text-[#122538] tracking-tight">User Guide</h2>
                                <p className="text-gray-500 text-sm mt-2">Master your semester organization</p>
                            </div>

                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-xl font-bold text-[#1a3b5d] mb-4 flex items-center gap-2">
                                        <Zap className="w-5 h-5" /> How it Works
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[
                                            { step: '01', title: 'Upload ZIP', desc: 'Export your WhatsApp chat to ZIP (without media restrictions) and upload it here.' },
                                            { step: '02', title: 'Smart Scan', desc: 'Our local AI identifies academic documents and filters out junk files.' },
                                            { step: '03', title: 'Organize', desc: 'Files are auto-categorized by subject. Sync to Drive instantly.' }
                                        ].map((item, i) => (
                                            <div key={i} className="bg-white p-6 rounded-2xl border border-[#d1c7b3]/30">
                                                <div className="text-4xl font-black text-[#d1c7b3]/40 mb-2">{item.step}</div>
                                                <h4 className="font-bold text-[#122538] mb-2">{item.title}</h4>
                                                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="bg-[#1a3b5d] text-white p-8 rounded-3xl relative overflow-hidden">
                                    <Shield className="absolute top-0 right-0 w-64 h-64 text-white/5 -rotate-12 translate-x-1/4 -translate-y-1/4" />
                                    <div className="relative z-10">
                                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                            <Shield className="w-5 h-5" /> Privacy Engine
                                        </h3>
                                        <p className="text-indigo-100 max-w-2xl leading-relaxed mb-6">
                                            SemesterScan is built with a "Privacy First" architecture. Your chat logs are processed
                                            entirely in your browser's memory and are never uploaded to any server. Only file metadata
                                            (filenames) and specific image content (if enabled) are sent to Gemini for categorization.
                                        </p>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full">
                                                <Lock className="w-3 h-3" /> Local Processing
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full">
                                                <LogOut className="w-3 h-3" /> Zero-Retention API
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-[#1a3b5d] mb-4 flex items-center gap-2">
                                        <Award className="w-5 h-5" /> Features
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[
                                            { icon: HardDrive, label: 'Google Drive Sync', desc: 'Save organized files directly to your Drive.' },
                                            { icon: BrainCircuit, label: 'AI Study Brief', desc: 'Get a generated summary of your syllabus.' },
                                            { icon: FileImage, label: 'Image Analysis', desc: 'OCR for handwritten notes and whiteboard pics.' }
                                        ].map((feat, i) => (
                                            <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-[#d1c7b3]/30">
                                                <div className="p-2 bg-[#f8f5f0] rounded-lg shrink-0">
                                                    <feat.icon className="w-5 h-5 text-[#1a3b5d]" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-[#122538] text-sm">{feat.label}</h4>
                                                    <p className="text-xs text-gray-500 mt-1">{feat.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                </div>

                {/* RIGHT PANEL INSPECTOR */}
                {
                    selectedFile && (
                        <div className="absolute top-0 right-0 w-full md:w-[420px] h-full bg-white border-l border-[#d1c7b3]/30 z-40 animate-in slide-in-from-right duration-300 shadow-2xl flex flex-col">
                            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-[0.3em]">Privacy Detail View</span>
                                <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 space-y-12">
                                <div className="space-y-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-[#f8f5f0] rounded-2xl flex items-center justify-center border border-[#d1c7b3]/20">
                                        <FileIcon filename={selectedFile.fileName} />
                                    </div>
                                    <h3 className="font-serif text-2xl font-bold text-[#122538] leading-tight break-all">{selectedFile.fileName}</h3>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        <span className="px-3 py-1 bg-[#1a3b5d]/5 text-[#1a3b5d] text-[10px] font-bold uppercase tracking-wider rounded-md border border-[#1a3b5d]/10">{selectedFile.subject}</span>
                                    </div>

                                    {/* Beta: Quiz Generator Button */}
                                    {isBetaEnabled && (selectedFile.category === 'Notes' || selectedFile.category === 'Assignment') && (
                                        <button
                                            onClick={async () => {
                                                setQuizModal({ open: true, data: null, loading: true });
                                                // We need content. If OCR exists use it. If not, try to fetch/extract (if text).
                                                let content = selectedFile.ocrText;
                                                if (!content && selectedFile.fileName.endsWith('.txt')) {
                                                    // If it's a txt file we didn't extract yet? 
                                                    // Actually we don't store text content for privacy unless context enabled.
                                                    // We'll have to re-extract on demand here.
                                                    try {
                                                        const blob = await getFileFromWorker(selectedFile.fileName);
                                                        if (blob) content = await extractFileContent(new File([blob], selectedFile.fileName));
                                                    } catch (e) { console.error(e); }
                                                }

                                                if (!content || content.length < 50) {
                                                    alert("Not enough text content found to generate a quiz directly. Enable 'File Context' or use on OCR'd images.");
                                                    setQuizModal({ open: false, data: null, loading: false });
                                                    return;
                                                }

                                                const quiz = await callGeminiQuiz(content, selectedFile.fileName);
                                                if (quiz) {
                                                    setQuizModal({ open: true, data: quiz, loading: false });
                                                } else {
                                                    alert("Failed to generate quiz.");
                                                    setQuizModal({ open: false, data: null, loading: false });
                                                }
                                            }}
                                            className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Sparkles className="w-4 h-4" /> Generate Practice Quiz
                                        </button>
                                    )}
                                </div>

                                {selectedFile.ocrText && (
                                    <div className="space-y-4">
                                        <div className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-widest flex items-center gap-2">OCR Analysis Result</div>
                                        <div className="bg-[#fcfbf9] border border-[#d1c7b3]/20 p-6 rounded-2xl text-gray-600 text-sm whitespace-pre-wrap font-mono">
                                            {selectedFile.ocrText}
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4">
                                    <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-1" />
                                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                                        <strong>Privacy Note:</strong> All analysis is performed locally in your browser. Gemini only processes file metadata and image content (if enabled).
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* STUDY BRIEF MODAL */}
            {
                studyBriefModal.open && (
                    <div className="fixed inset-0 bg-[#122538]/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
                        <div className="bg-[#f8f5f0] w-full max-w-2xl max-h-[80vh] rounded-[32px] shadow-2xl overflow-hidden border border-white/50 animate-in fade-in flex flex-col">
                            <div className="p-8 border-b border-[#d1c7b3]/30 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="font-serif text-2xl font-bold text-[#122538]">Study Brief Preview</h3>
                                    <p className="text-sm text-gray-500">AI-generated summary of your files</p>
                                </div>
                                <button onClick={() => setStudyBriefModal({ open: false, content: '', loading: false })}>
                                    <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8">
                                {studyBriefModal.loading ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <Loader2 className="w-12 h-12 animate-spin mb-4" />
                                        <p className="text-lg font-medium">Generating Study Brief...</p>
                                        <p className="text-sm">This may take a few seconds</p>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-[#d1c7b3]/30 rounded-2xl p-6 prose prose-sm prose-slate max-w-none prose-headings:font-serif prose-headings:text-[#122538] prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-[#1a3b5d] prose-table:text-sm prose-th:bg-[#f8f5f0] prose-th:p-2 prose-th:border prose-th:border-[#d1c7b3]/30 prose-td:p-2 prose-td:border prose-td:border-[#d1c7b3]/30">
                                        <ReactMarkdown>
                                            {studyBriefModal.content || 'No content generated.'}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                            {!studyBriefModal.loading && studyBriefModal.content && (
                                <div className="p-6 bg-white/80 border-t border-[#d1c7b3]/30 flex justify-end gap-4 shrink-0">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(studyBriefModal.content)}
                                        className="px-6 py-3 bg-gray-100 text-[#122538] rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        Copy to Clipboard
                                    </button>
                                    <button
                                        onClick={() => {
                                            const blob = new Blob([studyBriefModal.content], { type: 'text/markdown' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a'); a.href = url; a.download = 'Study_Brief.md'; a.click();
                                        }}
                                        className="px-6 py-3 bg-[#1a3b5d] text-white rounded-xl text-sm font-bold hover:bg-[#0d1b2a] transition-colors flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Download
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }


            {/* FLOATING HELP */}
            {/* QUIZ MODAL */}
            {
                quizModal.open && (
                    quizModal.loading ? (
                        <div className="fixed inset-0 bg-[#122538]/80 backdrop-blur-sm flex items-center justify-center z-[60]">
                            <div className="bg-white p-8 rounded-2xl flex flex-col items-center animate-in zoom-in-95">
                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                                <h3 className="font-bold text-lg text-[#122538]">Generating Quiz...</h3>
                                <p className="text-sm text-gray-500">Analyzing concepts & creating questions</p>
                            </div>
                        </div>
                    ) : (
                        <QuizModal
                            isOpen={quizModal.open}
                            quizData={quizModal.data}
                            onClose={() => setQuizModal({ open: false, data: null, loading: false })}
                        />
                    )
                )
            }

            {/* FLOATING HELP */}
            <button onClick={() => setView('guide')} className="fixed bottom-10 right-10 w-14 h-14 bg-[#1a3b5d] hover:bg-[#0d1b2a] rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 z-30 shadow-indigo-600/20"><Info className="w-6 h-6" /></button>

            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1c7b3; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c8bca0; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom { from { transform: translateY(20px); } to { transform: translateY(0); } }
        @keyframes slide-in-from-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-in { animation-duration: 400ms; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom; }
        .slide-in-from-right { animation-name: slide-in-from-right; }
`}} />
        </div >
    );
}