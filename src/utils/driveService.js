/**
 * Google Drive Service - Uses Firebase OAuth access token
 * Manages uploads/downloads to user's Google Drive
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Get or create the SemesterScan folder in user's Drive
 */
async function getOrCreateFolder(accessToken) {
    const folderName = 'SemesterScan';

    // Check if folder exists
    const searchResponse = await fetch(
        `${DRIVE_API}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

    // Create folder
    const createResponse = await fetch(`${DRIVE_API}/files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        })
    });
    const createData = await createResponse.json();
    return createData.id;
}

/**
 * Upload a ZIP file to Google Drive
 * @param {Blob} blob - The ZIP file blob
 * @param {string} filename - Name for the file
 * @param {string} accessToken - Google OAuth access token
 */
export async function uploadToDrive(blob, filename, accessToken) {
    try {
        const folderId = await getOrCreateFolder(accessToken);

        const metadata = {
            name: filename,
            parents: [folderId]
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', blob);

        const response = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.error("Drive API Error:", errBody);

            let msg = `Upload failed (${response.status})`;
            if (response.status === 403) msg = "Permission Denied: Please enable 'Google Drive API' in your Google Cloud Console and ensure you granted Drive access during sign-in.";
            if (response.status === 401) msg = "Authentication Error: Please Sign Out and Sign In again to refresh your session.";

            throw new Error(msg);
        }

        const data = await response.json();
        return {
            success: true,
            fileId: data.id,
            name: data.name,
            webViewLink: `https://drive.google.com/file/d/${data.id}/view`
        };
    } catch (error) {
        console.error('Drive upload error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * List files in SemesterScan folder
 */
export async function listDriveFiles(accessToken) {
    try {
        const folderId = await getOrCreateFolder(accessToken);

        const response = await fetch(
            `${DRIVE_API}/files?q='${folderId}' in parents and trashed=false&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        const data = await response.json();
        return data.files || [];
    } catch (error) {
        console.error('Drive list error:', error);
        return [];
    }
}

/**
 * Download a file from Drive
 */
export async function downloadFromDrive(fileId, accessToken) {
    try {
        const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        return await response.blob();
    } catch (error) {
        console.error('Drive download error:', error);
        return null;
    }
}
