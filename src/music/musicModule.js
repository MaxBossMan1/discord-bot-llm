const { EmbedBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');
const MusicWorkerBot = require('./workerBot');
const TrackInfo = require('./trackInfo');
const PlaylistManager = require('./playlistManager');
const play = require('play-dl');

class MusicModule {
    constructor(config) {
        this.trackInfo = new TrackInfo(config);
        this.workerBot = new MusicWorkerBot(this.trackInfo);
        this.playlistManager = new PlaylistManager();
        this.config = config;
    }

    start(token) {
        this.workerBot.start(token);
    }

    async handleCommand(interaction, command) {
        // Voice channel check for music playback commands
        if (['play', 'skip', 'stop'].includes(command) && !interaction.member.voice.channel) {
            await interaction.reply('You need to be in a voice channel to use music playback commands!');
            return;
        }

        switch (command) {
            case 'play':
                await this.handlePlay(interaction);
                break;
            case 'skip':
                await this.handleSkip(interaction);
                break;
            case 'stop':
                await this.handleStop(interaction);
                break;
            case 'queue':
                await this.handleQueue(interaction);
                break;
            case 'playlist':
                await this.handlePlaylistCommand(interaction);
                break;
        }
    }

    async handlePlay(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('query');
        try {
            // Connect to voice channel if not already connected
            if (!this.workerBot.connection) {
                const connected = await this.workerBot.connectToChannel(
                    interaction.member.voice.channel.id,
                    interaction.guildId
                );
                if (!connected) {
                    await interaction.editReply('Failed to join voice channel!');
                    return;
                }
            }

            // Check if it's a playlist URL
            const isPlaylist = query.includes('/playlist/') || query.includes('list=');
            const result = await this.workerBot.addToQueue(interaction.guildId, query, isPlaylist);

            if (!result) {
                await interaction.editReply('No results found!');
                return;
            }

            if (isPlaylist) {
                const embed = this.trackInfo.createPlaylistEmbed(result);
                await interaction.editReply({ 
                    content: 'Added playlist to queue!',
                    embeds: [embed]
                });
            } else {
                const embed = this.trackInfo.createEmbed(result);
                await interaction.editReply({ 
                    content: 'Added to queue!',
                    embeds: [embed]
                });
            }
        } catch (error) {
            console.error('Error playing music:', error);
            await interaction.editReply('An error occurred while trying to play the music.');
        }
    }

    async handleSkip(interaction) {
        const remainingTracks = this.workerBot.skipCurrent(interaction.guildId);
        await interaction.reply(`Skipped current track. ${remainingTracks} tracks remaining in queue.`);
    }

    async handleStop(interaction) {
        this.workerBot.clearQueue(interaction.guildId);
        this.workerBot.disconnect();
        await interaction.reply('Stopped playback and cleared the queue.');
    }

    async handleQueue(interaction) {
        const queue = this.workerBot.queue.get(interaction.guildId) || [];
        if (queue.length === 0) {
            await interaction.reply('The queue is empty!');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('Current Queue')
            .setDescription(`${queue.length} tracks in queue`);

        // Add current track
        if (this.workerBot.player.state.status !== AudioPlayerStatus.Idle) {
            const currentTrack = queue[0];
            embed.addFields({
                name: 'Now Playing',
                value: `${currentTrack.title} - ${currentTrack.artist || 'Unknown'}`
            });
        }

        // Add upcoming tracks (up to 10)
        const upcomingTracks = queue.slice(1, 11)
            .map((track, index) => `${index + 1}. ${track.title} - ${track.artist || 'Unknown'} (${track.duration})`)
            .join('\n');

        if (upcomingTracks) {
            embed.addFields({
                name: 'Up Next',
                value: upcomingTracks
            });
        }

        // If there are more tracks, add a note
        if (queue.length > 11) {
            embed.addFields({
                name: 'And more...',
                value: `${queue.length - 11} more tracks in queue`
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    async handlePlaylistCommand(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await this.handlePlaylistCreate(interaction);
                    break;
                case 'add':
                    await this.handlePlaylistAdd(interaction);
                    break;
                case 'remove':
                    await this.handlePlaylistRemove(interaction);
                    break;
                case 'delete':
                    await this.handlePlaylistDelete(interaction);
                    break;
                case 'list':
                    await this.handlePlaylistList(interaction);
                    break;
                case 'view':
                    await this.handlePlaylistView(interaction);
                    break;
                case 'play':
                    await this.handlePlaylistPlay(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error handling playlist command:', error);
            const errorMessage = error.message || 'An error occurred while managing the playlist.';
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.editReply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    async handlePlaylistCreate(interaction) {
        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description') || '';

        await interaction.deferReply();
        const playlist = await this.playlistManager.createPlaylist(
            interaction.user.id,
            name,
            description
        );

        const embed = this.playlistManager.createPlaylistEmbed(playlist);
        await interaction.editReply({
            content: 'Playlist created successfully!',
            embeds: [embed]
        });
    }

    async handlePlaylistAdd(interaction) {
        const name = interaction.options.getString('name');
        const query = interaction.options.getString('query');

        await interaction.deferReply();
        
        // Get track info
        const trackInfo = await this.trackInfo.getTrackInfo(query);
        if (!trackInfo) {
            await interaction.editReply('Could not find the track!');
            return;
        }

        // Add to playlist
        const playlist = await this.playlistManager.addToPlaylist(
            interaction.user.id,
            name,
            trackInfo
        );

        const embed = this.playlistManager.createPlaylistEmbed(playlist);
        await interaction.editReply({
            content: `Added "${trackInfo.title}" to playlist "${name}"!`,
            embeds: [embed]
        });
    }

    async handlePlaylistRemove(interaction) {
        const name = interaction.options.getString('name');
        const index = interaction.options.getInteger('index') - 1; // Convert to 0-based index

        await interaction.deferReply();
        const playlist = await this.playlistManager.removeFromPlaylist(
            interaction.user.id,
            name,
            index
        );

        const embed = this.playlistManager.createPlaylistEmbed(playlist);
        await interaction.editReply({
            content: 'Track removed from playlist!',
            embeds: [embed]
        });
    }

    async handlePlaylistDelete(interaction) {
        const name = interaction.options.getString('name');

        await interaction.deferReply();
        await this.playlistManager.deletePlaylist(interaction.user.id, name);

        await interaction.editReply(`Playlist "${name}" has been deleted!`);
    }

    async handlePlaylistList(interaction) {
        await interaction.deferReply();
        const userPlaylists = await this.playlistManager.getUserPlaylists(interaction.user.id);
        
        const embed = this.playlistManager.createPlaylistListEmbed(
            interaction.user.id,
            userPlaylists.playlists
        );

        await interaction.editReply({ embeds: [embed] });
    }

    async handlePlaylistView(interaction) {
        const name = interaction.options.getString('name');

        await interaction.deferReply();
        const playlist = await this.playlistManager.getPlaylist(interaction.user.id, name);
        
        const embed = this.playlistManager.createPlaylistEmbed(playlist, true);
        await interaction.editReply({ embeds: [embed] });
    }

    async handlePlaylistPlay(interaction) {
        const name = interaction.options.getString('name');

        await interaction.deferReply();
        
        // Get the playlist
        const playlist = await this.playlistManager.getPlaylist(interaction.user.id, name);
        
        // Connect to voice channel if not already connected
        if (!this.workerBot.connection) {
            const connected = await this.workerBot.connectToChannel(
                interaction.member.voice.channel.id,
                interaction.guildId
            );
            if (!connected) {
                await interaction.editReply('Failed to join voice channel!');
                return;
            }
        }

        // Add all tracks to queue
        for (const track of playlist.tracks) {
            await this.workerBot.addToQueue(interaction.guildId, track);
        }

        const embed = this.playlistManager.createPlaylistEmbed(playlist);
        await interaction.editReply({
            content: `Playing playlist "${name}"!`,
            embeds: [embed]
        });
    }
}

module.exports = MusicModule;