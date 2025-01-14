const fs = require('fs').promises;
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const crypto = require('crypto');

class TrackDownloader {
    constructor() {
        this.downloadPath = path.join(__dirname, '../../data/tracks');
        this.downloadQueue = new Map(); // Map of promises for ongoing downloads
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            await fs.mkdir(this.downloadPath, { recursive: true });
            // Clean up old files on startup
            this.cleanupOldFiles();
        } catch (error) {
            console.error('Error creating tracks directory:', error);
        }
    }

    async cleanupOldFiles() {
        try {
            const files = await fs.readdir(this.downloadPath);
            const now = Date.now();
            for (const file of files) {
                const filePath = path.join(this.downloadPath, file);
                const stats = await fs.stat(filePath);
                // Delete files older than 1 hour
                if (now - stats.mtimeMs > 3600000) {
                    await fs.unlink(filePath);
                    console.log('Deleted old track file:', file);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old files:', error);
        }
    }

    generateFileName(url) {
        const hash = crypto.createHash('md5').update(url).digest('hex');
        return `${hash}.opus`;
    }

    getFilePath(url) {
        return path.join(this.downloadPath, this.generateFileName(url));
    }

    async isDownloaded(url) {
        try {
            await fs.access(this.getFilePath(url));
            return true;
        } catch {
            return false;
        }
    }

    async downloadTrack(url) {
        const filePath = this.getFilePath(url);

        // If already downloading, return the existing promise
        if (this.downloadQueue.has(url)) {
            return this.downloadQueue.get(url);
        }

        // If already downloaded, return the file path
        if (await this.isDownloaded(url)) {
            return filePath;
        }

        // Create download promise
        const downloadPromise = (async () => {
            try {
                console.log('Downloading track:', url);

                // Get video info first
                const info = await ytdl.getInfo(url);
                const format = ytdl.chooseFormat(info.formats, {
                    quality: 'highestaudio',
                    filter: 'audioonly'
                });

                if (!format) {
                    throw new Error('No suitable audio format found');
                }

                // Create write stream
                const writeStream = require('fs').createWriteStream(filePath);

                // Download the audio
                const stream = ytdl.downloadFromInfo(info, {
                    format: format,
                    quality: 'highestaudio',
                    filter: 'audioonly'
                });

                // Pipe the audio stream to the file
                stream.pipe(writeStream);

                // Wait for the download to complete
                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                    stream.on('error', reject);

                    // Progress tracking
                    let lastPercent = 0;
                    stream.on('progress', (_, downloaded, total) => {
                        const percent = Math.round((downloaded / total) * 100);
                        if (percent > lastPercent) {
                            console.log(`Download progress: ${percent}%`);
                            lastPercent = percent;
                        }
                    });
                });

                console.log('Download complete:', url);
                return filePath;
            } catch (error) {
                console.error('Error downloading track:', error);
                // Clean up failed download
                try {
                    await fs.unlink(filePath);
                } catch {}
                throw error;
            } finally {
                // Remove from download queue
                this.downloadQueue.delete(url);
            }
        })();

        // Add to download queue
        this.downloadQueue.set(url, downloadPromise);

        return downloadPromise;
    }

    // Download multiple tracks in parallel
    async downloadTracks(urls) {
        return Promise.all(urls.map(url => this.downloadTrack(url)));
    }

    // Pre-download next few tracks in queue
    async preloadTracks(tracks, count = 3) {
        const tracksToDownload = tracks.slice(0, count);
        return this.downloadTracks(tracksToDownload.map(t => t.url));
    }

    // Get download progress
    getDownloadProgress() {
        return {
            active: this.downloadQueue.size,
            urls: Array.from(this.downloadQueue.keys())
        };
    }
}

module.exports = TrackDownloader;