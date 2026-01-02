
import { BlobReader, ZipReader, TextWriter, BlobWriter, ZipWriter } from '@zip.js/zip.js';

self.onmessage = async (e) => {
    const { type, file, entryName, fileMap } = e.data;

    try {
        if (type === 'INIT_ZIP') {
            const zipReader = new ZipReader(new BlobReader(file));
            const entries = await zipReader.getEntries();
            const entryList = entries.map((entry, index) => ({
                id: index,
                filename: entry.filename,
                directory: entry.directory,
                uncompressedSize: entry.uncompressedSize
            }));

            self.postMessage({ type: 'ZIP_LOADED', entries: entryList });
            self.currentZipReader = zipReader;
        }

        if (type === 'EXTRACT_FILE') {
            if (!self.currentZipReader && file) {
                self.currentZipReader = new ZipReader(new BlobReader(file));
            }
            const entries = await self.currentZipReader.getEntries();
            const entry = entries.find(e => e.filename === entryName);
            if (entry) {
                const blob = await entry.getData(new BlobWriter());
                // Handle port transfer if available? Main thread currently uses event listener.
                self.postMessage({ type: 'FILE_EXTRACTED', entryName, blob });
            } else {
                self.postMessage({ type: 'ERROR', error: 'File not found' });
            }
        }

        if (type === 'GENERATE_ZIP') {
            // fileMap is array of { original, newPath }
            if (!self.currentZipReader && file) {
                self.currentZipReader = new ZipReader(new BlobReader(file));
            }
            const entries = await self.currentZipReader.getEntries();
            const blobWriter = new BlobWriter("application/zip");
            const zipWriter = new ZipWriter(blobWriter);

            for (const mapItem of fileMap) {
                const entry = entries.find(e => e.filename === mapItem.original);
                if (entry) {
                    // Pipe directly? entry.getData(writer)
                    // But ZipWriter.add takes a Reader.
                    // We have to separate the two.
                    // entry.getData returns data written to writer.
                    // We can read into a Blob then write. For memory efficiency, ideally streams, 
                    // but zip.js simplified API often uses Blobs. 
                    // Let's use Blob for simplicity and robustness first.
                    const blob = await entry.getData(new BlobWriter());
                    await zipWriter.add(mapItem.newPath, new BlobReader(blob));
                }
            }

            const organizedBlob = await zipWriter.close();
            self.postMessage({ type: 'ZIP_GENERATED', blob: organizedBlob });
        }

    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};
