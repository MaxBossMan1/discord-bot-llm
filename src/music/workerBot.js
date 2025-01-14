const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType
} = require('@discordjs/voice');
const play = require('play-dl');
const TrackDownloader = require('./trackDownloader');
const fs = require('fs');

class MusicWorkerBot {
    constructor(trackInfo, config) {
        this.trackInfo = trackInfo;
        this.config = config;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
            ]
        });

        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
                maxMissedFrames: 100
            }
        });
        this.queue = new Map();
        this.connection = null;
        this.downloader = new TrackDownloader();
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('ready', () => {
            console.log(`Music Worker Bot logged in as ${this.client.user.tag}!`);
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            console.log('Player is idle, playing next track...');
            this.playNext();
        });

        this.player.on(AudioPlayerStatus.Playing, () => {
            console.log('Player started playing');
        });

        this.player.on(AudioPlayerStatus.Buffering, () => {
            console.log('Player is buffering');
        });

        this.player.on(AudioPlayerStatus.AutoPaused, () => {
            console.log('Player auto-paused');
        });

        this.player.on('error', error => {
            console.error('Player error:', error.message);
            this.playNext();
        });

        this.player.on('stateChange', (oldState, newState) => {
            console.log(`Player state changed from ${oldState.status} to ${newState.status}`);
        });
    }

    async connectToChannel(channelId, guildId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            const channel = guild.channels.cache.get(channelId);

            if (!channel) {
                console.error('Channel not found:', channelId);
                return false;
            }

            // Destroy existing connection if any
            if (this.connection) {
                this.connection.destroy();
                this.connection = null;
            }

            // Create new connection
            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            // Handle connection events
            this.connection.on('stateChange', (oldState, newState) => {
                console.log(`Connection state changed from ${oldState.status} to ${newState.status}`);
                if (newState.status === 'disconnected') {
                    this.connection = null;
                }
            });

            // Subscribe player to connection
            this.connection.subscribe(this.player);

            // Wait for ready state
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.connection.on('stateChange', (_, newState) => {
                    if (newState.status === 'ready') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });

            console.log('Successfully connected to voice channel:', channel.name);
            return true;
        } catch (error) {
            console.error('Error connecting to voice channel:', error);
            return false;
        }
    }

    async addToQueue(guildId, query, isPlaylist = false) {
        if (!this.queue.has(guildId)) {
            this.queue.set(guildId, []);
        }

        try {
            if (isPlaylist) {
                const playlistInfo = await this.trackInfo.getPlaylistInfo(query);
                if (!playlistInfo) return null;

                // Add all tracks from playlist to queue
                this.queue.get(guildId).push(...playlistInfo.tracks);

                // Start preloading first few tracks
                this.downloader.preloadTracks(playlistInfo.tracks)
                    .catch(error => console.error('Error preloading playlist tracks:', error));

                if (this.player.state.status === AudioPlayerStatus.Idle) {
                    await this.playNext(guildId);
                }

                return playlistInfo;
            } else {
                const trackInfo = await this.trackInfo.getTrackInfo(query);
                if (!trackInfo) return null;

                this.queue.get(guildId).push(trackInfo);

                // Start downloading the track immediately
                this.downloader.downloadTrack(trackInfo.url)
                    .catch(error => console.error('Error downloading track:', error));

                if (this.player.state.status === AudioPlayerStatus.Idle) {
                    await this.playNext(guildId);
                }

                return trackInfo;
            }
        } catch (error) {
            console.error('Error adding to queue:', error);
            return null;
        }
    }

    async playNext(guildId) {
        const queue = this.queue.get(guildId);
        if (!queue || queue.length === 0) {
            console.log('Queue is empty');
            return;
        }

        const track = queue[0]; // Don't shift yet, wait until we confirm playback
        console.log('Preparing to play:', track.title);

        try {
            // Make sure we're still connected
            if (!this.connection) {
                console.error('No voice connection');
                return;
            }

            // Download the track (or get it from cache)
            console.log('Getting track file for:', track.title);
            const filePath = await this.downloader.downloadTrack(track.url);
            console.log('Track file ready:', filePath);

            // Create resource from file
            const resource = createAudioResource(fs.createReadStream(filePath), {
                inputType: StreamType.OggOpus,
                inlineVolume: true,
                silencePaddingFrames: 5
            });

            if (!resource) {
                console.error('Failed to create audio resource');
                queue.shift(); // Remove failed track
                this.playNext(guildId);
                return;
            }

            // Set volume
            if (resource.volume) {
                resource.volume.setVolume(0.5);
            }

            // Stop current playback if any
            this.player.stop();

            // Remove the track from queue now that we're sure we can play it
            queue.shift();

            // Start preloading next tracks
            if (queue.length > 0) {
                this.downloader.preloadTracks(queue)
                    .catch(error => console.error('Error preloading next tracks:', error));
            }

            // Play the resource
            console.log('Playing track from file:', track.title);
            this.player.play(resource);

        } catch (error) {
            console.error('Error playing track:', error);
            queue.shift(); // Remove failed track
            this.playNext(guildId);
        }
    }

    skipCurrent(guildId) {
        this.player.stop();
        return this.queue.get(guildId)?.length || 0;
    }

    clearQueue(guildId) {
        this.queue.set(guildId, []);
        this.player.stop();
    }

    disconnect() {
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
    }

    start(token) {
        this.client.login(token);
    }
}

module.exports = MusicWorkerBot;