const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');

class PlaylistManager {
    constructor() {
        this.playlistsDir = path.join(__dirname, '../../data/playlists');
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            await fs.mkdir(this.playlistsDir, { recursive: true });
        } catch (error) {
            console.error('Error creating playlists directory:', error);
        }
    }

    async getUserPlaylists(userId) {
        try {
            const userFile = path.join(this.playlistsDir, `${userId}.json`);
            try {
                const data = await fs.readFile(userFile, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                // If file doesn't exist, return empty playlists object
                return { playlists: {} };
            }
        } catch (error) {
            console.error('Error reading user playlists:', error);
            return { playlists: {} };
        }
    }

    async saveUserPlaylists(userId, playlists) {
        try {
            const userFile = path.join(this.playlistsDir, `${userId}.json`);
            await fs.writeFile(userFile, JSON.stringify(playlists, null, 2));
        } catch (error) {
            console.error('Error saving user playlists:', error);
            throw error;
        }
    }

    async createPlaylist(userId, name, description = '') {
        try {
            const userPlaylists = await this.getUserPlaylists(userId);
            
            if (userPlaylists.playlists[name]) {
                throw new Error('A playlist with this name already exists');
            }

            userPlaylists.playlists[name] = {
                name,
                description,
                tracks: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await this.saveUserPlaylists(userId, userPlaylists);
            return userPlaylists.playlists[name];
        } catch (error) {
            console.error('Error creating playlist:', error);
            throw error;
        }
    }

    async addToPlaylist(userId, playlistName, track) {
        try {
            const userPlaylists = await this.getUserPlaylists(userId);
            
            if (!userPlaylists.playlists[playlistName]) {
                throw new Error('Playlist not found');
            }

            // Check for duplicates
            const isDuplicate = userPlaylists.playlists[playlistName].tracks.some(
                t => t.url === track.url
            );

            if (!isDuplicate) {
                userPlaylists.playlists[playlistName].tracks.push(track);
                userPlaylists.playlists[playlistName].updatedAt = new Date().toISOString();
                await this.saveUserPlaylists(userId, userPlaylists);
            }

            return userPlaylists.playlists[playlistName];
        } catch (error) {
            console.error('Error adding to playlist:', error);
            throw error;
        }
    }

    async removeFromPlaylist(userId, playlistName, index) {
        try {
            const userPlaylists = await this.getUserPlaylists(userId);
            
            if (!userPlaylists.playlists[playlistName]) {
                throw new Error('Playlist not found');
            }

            if (index < 0 || index >= userPlaylists.playlists[playlistName].tracks.length) {
                throw new Error('Invalid track index');
            }

            userPlaylists.playlists[playlistName].tracks.splice(index, 1);
            userPlaylists.playlists[playlistName].updatedAt = new Date().toISOString();
            await this.saveUserPlaylists(userId, userPlaylists);

            return userPlaylists.playlists[playlistName];
        } catch (error) {
            console.error('Error removing from playlist:', error);
            throw error;
        }
    }

    async deletePlaylist(userId, playlistName) {
        try {
            const userPlaylists = await this.getUserPlaylists(userId);
            
            if (!userPlaylists.playlists[playlistName]) {
                throw new Error('Playlist not found');
            }

            delete userPlaylists.playlists[playlistName];
            await this.saveUserPlaylists(userId, userPlaylists);
        } catch (error) {
            console.error('Error deleting playlist:', error);
            throw error;
        }
    }

    async getPlaylist(userId, playlistName) {
        try {
            const userPlaylists = await this.getUserPlaylists(userId);
            
            if (!userPlaylists.playlists[playlistName]) {
                throw new Error('Playlist not found');
            }

            return userPlaylists.playlists[playlistName];
        } catch (error) {
            console.error('Error getting playlist:', error);
            throw error;
        }
    }

    createPlaylistEmbed(playlist, detailed = false) {
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle(playlist.name)
            .setDescription(playlist.description || 'No description')
            .addFields(
                { name: 'Track Count', value: playlist.tracks.length.toString() },
                { name: 'Last Updated', value: new Date(playlist.updatedAt).toLocaleDateString() }
            );

        if (detailed && playlist.tracks.length > 0) {
            // Show all tracks in the playlist
            const tracksList = playlist.tracks
                .map((track, index) => `${index + 1}. ${track.title} - ${track.artist || 'Unknown'}`)
                .join('\n');

            // Split tracks into chunks if needed (Discord has a 1024 character limit per field)
            const chunks = this.chunkString(tracksList, 1024);
            chunks.forEach((chunk, index) => {
                embed.addFields({
                    name: index === 0 ? 'Tracks' : '⠀', // Empty character for additional fields
                    value: chunk
                });
            });
        } else if (playlist.tracks.length > 0) {
            // Show only first 5 tracks
            const tracksList = playlist.tracks
                .slice(0, 5)
                .map((track, index) => `${index + 1}. ${track.title} - ${track.artist || 'Unknown'}`)
                .join('\n');

            embed.addFields({ name: 'Sample Tracks', value: tracksList });

            if (playlist.tracks.length > 5) {
                embed.addFields({
                    name: 'And more...',
                    value: `${playlist.tracks.length - 5} more tracks`
                });
            }
        }

        return embed;
    }

    createPlaylistListEmbed(userId, playlists) {
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('Your Playlists')
            .setDescription(`You have ${Object.keys(playlists).length} playlists`);

        if (Object.keys(playlists).length > 0) {
            const playlistsList = Object.values(playlists)
                .map(playlist => `**${playlist.name}** - ${playlist.tracks.length} tracks`)
                .join('\n');

            embed.addFields({ name: 'Playlists', value: playlistsList });
        } else {
            embed.addFields({
                name: 'No Playlists',
                value: 'Create a playlist using /playlist create'
            });
        }

        return embed;
    }

    chunkString(str, size) {
        const chunks = [];
        for (let i = 0; i < str.length; i += size) {
            chunks.push(str.slice(i, i + size));
        }
        return chunks;
    }
}

module.exports = PlaylistManager;