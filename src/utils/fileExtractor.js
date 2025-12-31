
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MAX_CHARS = 3000; // Smart limit for token optimization

/**
 * Extracts text from a Blob/File based on its type.
 * Uses "Smart Sampling" to only read the start of large files.
 */
export async function extractFileContent(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    try {
        if (ext === 'pdf') {
            return await extractPdfText(file);
        } else if (['docx', 'doc'].includes(ext)) {
            return await extractDocxText(file);
        } else if (['txt', 'md', 'json', 'js', 'py', 'java', 'c', 'cpp'].includes(ext)) {
            return await extractPlainText(file);
        }
    } catch (error) {
        console.warn(`Extraction failed for ${file.name}:`, error);
        return ""; // Fail gracefully
    }
    return "";
}

async function extractPlainText(file) {
    // Only read the first 5KB chunk
    const chunk = file.slice(0, 5000);
    const text = await chunk.text();
    return text.slice(0, MAX_CHARS);
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    // Only load the document structure, not full render
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let text = "";
    // Only read first 3 pages max
    const pagesToRead = Math.min(pdf.numPages, 3);

    for (let i = 1; i <= pagesToRead; i++) {
        const page = await pdf.getPage(i);
        const tokenizedText = await page.getTextContent();
        const pageText = tokenizedText.items.map(token => token.str).join(' ');
        text += pageText + "\n";

        if (text.length > MAX_CHARS) break;
    }

    return text.slice(0, MAX_CHARS);
}

async function extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value.slice(0, MAX_CHARS);
}
