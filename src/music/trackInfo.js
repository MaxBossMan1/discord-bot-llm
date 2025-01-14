const { EmbedBuilder } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const play = require('play-dl');

class TrackInfo {
    constructor(config) {
        this.spotify = new SpotifyWebApi({
            clientId: config.SPOTIFY_CLIENT_ID,
            clientSecret: config.SPOTIFY_CLIENT_SECRET
        });
        this.initializeSpotify();
    }

    async initializeSpotify() {
        try {
            const data = await this.spotify.clientCredentialsGrant();
            this.spotify.setAccessToken(data.body.access_token);

            // Refresh token periodically
            setInterval(async () => {
                const data = await this.spotify.clientCredentialsGrant();
                this.spotify.setAccessToken(data.body.access_token);
            }, (data.body.expires_in - 60) * 1000);
        } catch (error) {
            console.error('Failed to initialize Spotify:', error);
        }
    }

    createEmbed(trackInfo) {
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle(trackInfo.title)
            .setURL(trackInfo.url);

        if (trackInfo.thumbnail) {
            embed.setThumbnail(trackInfo.thumbnail);
        }

        if (trackInfo.artist) {
            embed.addFields({ name: 'Artist', value: trackInfo.artist });
        }

        if (trackInfo.duration) {
            embed.addFields({ name: 'Duration', value: trackInfo.duration });
        }

        if (trackInfo.source) {
            embed.setFooter({ text: `Source: ${trackInfo.source}` });
        }

        return embed;
    }

    async getTrackInfo(query) {
        // Check if it's a Spotify URL
        if (query.includes('spotify.com')) {
            return await this.getSpotifyTrackInfo(query);
        }

        // Check if it's a YouTube URL or search query
        try {
            const searchResult = await play.search(query, { limit: 1 });
            if (!searchResult || searchResult.length === 0) return null;

            const video = searchResult[0];
            return {
                title: video.title,
                artist: video.channel.name,
                duration: video.durationRaw,
                thumbnail: video.thumbnails[0].url,
                url: video.url,
                source: 'YouTube'
            };
        } catch (error) {
            console.error('Error getting track info:', error);
            return null;
        }
    }

    async getSpotifyTrackInfo(url) {
        try {
            const trackId = url.split('/track/')[1].split('?')[0];
            const track = await this.spotify.getTrack(trackId);
            
            return {
                title: track.body.name,
                artist: track.body.artists.map(a => a.name).join(', '),
                duration: this.formatDuration(track.body.duration_ms),
                thumbnail: track.body.album.images[0].url,
                url: track.body.external_urls.spotify,
                source: 'Spotify'
            };
        } catch (error) {
            console.error('Error getting Spotify track info:', error);
            return null;
        }
    }

    async getPlaylistInfo(url) {
        if (url.includes('spotify.com')) {
            return await this.getSpotifyPlaylistInfo(url);
        } else if (url.includes('youtube.com')) {
            return await this.getYouTubePlaylistInfo(url);
        }
        return null;
    }

    async getSpotifyPlaylistInfo(url) {
        try {
            const playlistId = url.split('/playlist/')[1].split('?')[0];
            const playlist = await this.spotify.getPlaylist(playlistId);
            const tracks = await this.getSpotifyPlaylistTracks(playlistId);

            return {
                title: playlist.body.name,
                description: playlist.body.description,
                thumbnail: playlist.body.images[0].url,
                url: playlist.body.external_urls.spotify,
                trackCount: playlist.body.tracks.total,
                tracks: tracks,
                source: 'Spotify'
            };
        } catch (error) {
            console.error('Error getting Spotify playlist info:', error);
            return null;
        }
    }

    async getSpotifyPlaylistTracks(playlistId) {
        const tracks = [];
        let offset = 0;
        const limit = 100;

        while (true) {
            try {
                const response = await this.spotify.getPlaylistTracks(playlistId, { offset, limit });
                const items = response.body.items;
                
                if (items.length === 0) break;

                tracks.push(...items.map(item => ({
                    title: item.track.name,
                    artist: item.track.artists.map(a => a.name).join(', '),
                    duration: this.formatDuration(item.track.duration_ms),
                    url: item.track.external_urls.spotify
                })));

                if (items.length < limit) break;
                offset += limit;
            } catch (error) {
                console.error('Error getting playlist tracks:', error);
                break;
            }
        }

        return tracks;
    }

    async getYouTubePlaylistInfo(url) {
        try {
            const playlist = await play.playlist_info(url);
            const videos = await playlist.all_videos();

            return {
                title: playlist.title,
                description: playlist.description?.substring(0, 100) + '...',
                thumbnail: playlist.thumbnail?.url,
                url: playlist.url,
                trackCount: videos.length,
                tracks: videos.map(video => ({
                    title: video.title,
                    artist: video.channel.name,
                    duration: video.durationRaw,
                    url: video.url
                })),
                source: 'YouTube'
            };
        } catch (error) {
            console.error('Error getting YouTube playlist info:', error);
            return null;
        }
    }

    createPlaylistEmbed(playlistInfo) {
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle(playlistInfo.title)
            .setURL(playlistInfo.url)
            .setDescription(playlistInfo.description || 'No description available')
            .addFields(
                { name: 'Track Count', value: playlistInfo.trackCount.toString() },
                { name: 'Source', value: playlistInfo.source }
            );

        if (playlistInfo.thumbnail) {
            embed.setThumbnail(playlistInfo.thumbnail);
        }

        // Add a sample of tracks (first 5)
        const trackList = playlistInfo.tracks
            .slice(0, 5)
            .map((track, index) => `${index + 1}. ${track.title} - ${track.artist}`)
            .join('\n');

        if (trackList) {
            embed.addFields({ name: 'Sample Tracks', value: trackList });
        }

        if (playlistInfo.tracks.length > 5) {
            embed.addFields({ name: 'And more...', value: `${playlistInfo.tracks.length - 5} more tracks` });
        }

        return embed;
    }

    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = TrackInfo;