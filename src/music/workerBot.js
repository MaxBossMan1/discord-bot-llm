const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { config } = require('../config');
const play = require('play-dl');

class MusicWorkerBot {
    constructor(trackInfo) {
        this.trackInfo = trackInfo;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
            ]
        });

        this.player = createAudioPlayer();
        this.queue = new Map();
        this.connection = null;
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('ready', () => {
            console.log(`Music Worker Bot logged in as ${this.client.user.tag}!`);
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.playNext();
        });

        this.player.on('error', error => {
            console.error('Error:', error.message);
            this.playNext();
        });
    }

    async connectToChannel(channelId, guildId) {
        const guild = this.client.guilds.cache.get(guildId);
        const channel = guild.channels.cache.get(channelId);

        if (!channel) return false;

        this.connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        this.connection.subscribe(this.player);
        return true;
    }

    async addToQueue(guildId, query, isPlaylist = false) {
        if (!this.queue.has(guildId)) {
            this.queue.set(guildId, []);
        }

        if (isPlaylist) {
            const playlistInfo = await this.trackInfo.getPlaylistInfo(query);
            if (!playlistInfo) return null;

            // Add all tracks from playlist to queue
            this.queue.get(guildId).push(...playlistInfo.tracks);

            if (this.player.state.status === AudioPlayerStatus.Idle) {
                this.playNext(guildId);
            }

            return playlistInfo;
        } else {
            const trackInfo = await this.trackInfo.getTrackInfo(query);
            if (!trackInfo) return null;

            this.queue.get(guildId).push(trackInfo);

            if (this.player.state.status === AudioPlayerStatus.Idle) {
                this.playNext(guildId);
            }

            return trackInfo;
        }
    }

    async playNext(guildId) {
        const queue = this.queue.get(guildId);
        if (!queue || queue.length === 0) return;

        const track = queue.shift();
        try {
            const stream = await play.stream(track.url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });
            this.player.play(resource);
        } catch (error) {
            console.error('Error playing track:', error);
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