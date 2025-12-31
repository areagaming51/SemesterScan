#!/usr/bin/env node

/**
 * SemesterScan CLI
 * A lightweight command-line tool to organize academic WhatsApp exports.
 * 
 * Usage:
 * node cli.js <input_zip_path> --key <GEMINI_API_KEY> [--out <output_dir>]
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';

// --- Constants ---
const SUBJECT_KEYWORDS = {
    "Math": ["math", "calculus", "integration", "algebra", "matrix", "derivative", "statistics"],
    "Physics": ["physics", "optics", "quantum", "mechanics", "light", "wave", "thermo", "lab"],
    "BME": ["bme", "biology", "biomedical", "kumari", "anatomy", "cell", "physiology"],
    "Engineering_Graphics": ["eg", "graphics", "drawing", "projection", "autocad", "isometric", "scale"],
    "General": ["notice", "circular", "holiday", "exam", "time table", "schedule", "fees", "admin"]
};

// --- Helpers ---
const log = (msg, color = '\x1b[0m') => console.log(`${color}${msg}\x1b[0m`);
const colors = {
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    dim: '\x1b[2m'
};

function parseArgs() {
    const args = process.argv.slice(2);
    // Try to read .env for default key
    let defaultKey = null;
    try {
        const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
            if (match) defaultKey = match[1].trim();
        }
    } catch (e) { }

    const config = { input: null, key: defaultKey, out: './organized_semester' };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--key') config.key = args[++i];
        else if (args[i] === '--out') config.out = args[++i];
        else if (!config.input) config.input = args[i];
    }
    return config;
}

// --- Core Logic ---

async function simpleAIClassify(apiKey, fileName, subject, imageData = null) {
    if (!apiKey) return { category: 'Uncategorized', confidence: 'Manual' };

    // Privacy-first prompt (matches web app)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

    const prompt = `Identify the academic category for this file: "${fileName}". 
       The suggested subject from local processing is "${subject}".
       Categories: Notes, Assignment, Admin, Junk.
       Output JSON ONLY: {"category": "string", "confidence": "string"}`;

    const parts = [{ text: prompt }];
    if (imageData) {
        parts.push({ inlineData: { mimeType: "image/png", data: imageData } });
    }

    try {
        const result = await model.generateContent(parts);
        const response = await result.response;
        let text = response.text();
        // Clean markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        // log(`AI Error: ${e.message}`, colors.red);
        return { category: 'Notes', confidence: 'Fallback' };
    }
}

async function main() {
    log(`\nSemesterScan CLI v1.0.0`, colors.cyan);
    log(`-----------------------`, colors.dim);

    const config = parseArgs();

    if (!config.input || !config.key) {
        log(`Error: Missing required arguments.`, colors.red);
        log(`Usage: node cli.js <input.zip> --key <YOUR_API_KEY> [--out <output_dir>]`);
        process.exit(1);
    }

    if (!fs.existsSync(config.input)) {
        log(`Error: Input file not found: ${config.input}`, colors.red);
        process.exit(1);
    }

    // 1. Read Zip
    log(`[1/4] Reading ZIP archive...`, colors.yellow);
    const data = fs.readFileSync(config.input);
    const zip = await JSZip.loadAsync(data);

    // 2. Find Chat TXT
    const chatFileName = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.txt') && !n.includes('__MACOSX'));
    if (!chatFileName) {
        log(`Error: No chat .txt file found in ZIP. Is this a WhatsApp export?`, colors.red);
        process.exit(1);
    }

    const chatContent = await zip.file(chatFileName).async("string");
    const lines = chatContent.split('\n');
    log(`[2/4] Found chat log: ${chatFileName} (${lines.length} lines)`, colors.green);

    // 3. Heuristics Scan
    log(`[3/4] Analyzing filenames and context...`, colors.yellow);
    const attachmentRegex = /[\w\-\.\(\)\s]+\.(?:pdf|jpg|png|docx|pptx|doc|mp4|opus)/i;
    const processQueue = [];

    lines.forEach((line, index) => {
        const match = line.match(attachmentRegex);
        if (match && (line.includes('attached') || line.includes('<attached:'))) {
            const fileName = match[0].trim();
            // Context window extraction
            const context = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 3)).join(' ');

            let subject = "General";
            for (const [sub, keys] of Object.entries(SUBJECT_KEYWORDS)) {
                if (keys.some(k => context.toLowerCase().includes(k))) { subject = sub; break; }
            }
            processQueue.push({ fileName, subject });
        }
    });

    log(`      Found ${processQueue.length} files to classify.`, colors.dim);

    // 4. Processing & Organizing
    log(`[4/4] Classifying with Google Gemini & Organizing...`, colors.yellow);

    // Create output dir
    if (!fs.existsSync(config.out)) fs.mkdirSync(config.out, { recursive: true });

    let processed = 0;
    for (const item of processQueue) {
        const fileObj = zip.file(item.fileName);
        if (!fileObj) continue;

        // AI Classification
        // Note: For CLI, we skip image OCR upload to keep it fast/simple unless user requests deep scan
        // simpleAIClassify call could be rate-limited here if needed
        const aiResult = await simpleAIClassify(config.key, item.fileName, item.subject);

        // Determine Path
        const category = aiResult.category || "Unsorted";
        const targetDir = path.join(config.out, category === 'Junk' ? '_Trash' : item.subject, category);

        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        // Write File
        const buffer = await fileObj.async("nodebuffer");
        fs.writeFileSync(path.join(targetDir, item.fileName), buffer);

        processed++;
        process.stdout.write(`\r      Progress: ${Math.round((processed / processQueue.length) * 100)}% (${item.fileName} -> ${item.subject}/${category})               `);

        // Simple rate limit
        await new Promise(r => setTimeout(r, 500));
    }

    log(`\n\nDone! Organized files are in: ${config.out}`, colors.green);
}

main().catch(err => log(`Fatal Error: ${err}`, colors.red));
