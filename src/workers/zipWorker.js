
import { BlobReader, ZipReader, TextWriter, BlobWriter } from '@zip.js/zip.js';

self.onmessage = async (e) => {
    const { type, file, entryName } = e.data;

    try {
        if (type === 'INIT_ZIP') {
            // Initialize reader and return entries + chat text
            const zipReader = new ZipReader(new BlobReader(file));
            const entries = await zipReader.getEntries();

            // Extract chat file immediately (Metadata-First)
            // WhatsApp exports are typically "WhatsApp Chat with [Name].txt" 
            // We'll look for any .txt file that's not in __MACOSX folder
            const chatEntry = entries.find(entry =>
                entry.filename.toLowerCase().endsWith('.txt') &&
                !entry.filename.includes('__MACOSX') &&
                !entry.directory
            );

            let chatContent = null;
            if (chatEntry) {
                const textWriter = new TextWriter();
                chatContent = await chatEntry.getData(textWriter);
            }

            // Return lightweight entry list (just names and indices) to main thread
            const entryList = entries.map((entry, index) => ({
                id: index,
                filename: entry.filename,
                directory: entry.directory,
                uncompressedSize: entry.uncompressedSize
            }));

            self.postMessage({
                type: 'ZIP_LOADED',
                entries: entryList,
                chatContent
            });

            // Keep reader alive? No, we can't easily pass the reader instance back. 
            // For now, we might re-instantiate or just hold it in global scope if we want to be fancy.
            // A simple approach for this app: The Main thread manages the Blob, 
            // passing it to the worker is cheap (cloned).
            // BUT re-reading the directory for 5GB file might be slow? 
            // Actually, reading central directory is fast.
            // Let's store the reader in self for subsequent requests.
            self.currentZipReader = zipReader;
            // Note: For a true robust app we'd handle multiple instances, but singleton is fine here.
        }

        if (type === 'EXTRACT_FILE') {
            if (!self.currentZipReader) {
                // Re-init if missing (shouldn't happen in this flow)
                self.currentZipReader = new ZipReader(new BlobReader(file));
                await self.currentZipReader.getEntries();
            }

            const entries = await self.currentZipReader.getEntries();
            const entry = entries.find(e => e.filename === entryName);

            if (entry) {
                const blobWriter = new BlobWriter();
                const blob = await entry.getData(blobWriter);
                self.postMessage({ type: 'FILE_EXTRACTED', entryName, blob });
            } else {
                self.postMessage({ type: 'ERROR', error: 'File not found' });
            }
        }

    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};
