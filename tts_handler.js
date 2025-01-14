const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus
} = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class TTSHandler {
    constructor() {
        this.player = createAudioPlayer();
        this.connection = null;
        this.enabled = true;
        this.voiceId = '1S8dlQj81Ty3soQ57nz7';  // Default voice ID
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.audioQueue = [];
        this.isPlaying = false;
        
        if (!this.apiKey) {
            throw new Error('ELEVENLABS_API_KEY environment variable is not set');
        }

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.playNextInQueue();
        });
    }

    async playNextInQueue() {
        if (this.audioQueue.length === 0 || this.isPlaying) {
            console.log('No audio in queue or already playing');
            return;
        }

        const nextAudio = this.audioQueue.shift();
        console.log('Playing next audio from queue:', nextAudio.tempFile);

        try {
            // Make sure we're still connected
            if (!this.connection) {
                console.error('No TTS voice connection');
                return;
            }

            // Create resource
            const resource = createAudioResource(nextAudio.tempFile, {
                inputType: 'mp3',
                inlineVolume: true
            });

            if (!resource) {
                throw new Error('Failed to create audio resource');
            }

            // Set volume
            if (resource.volume) {
                resource.volume.setVolume(0.8);
            }

            // Stop current playback if any
            this.player.stop();

            // Play the resource
            this.isPlaying = true;
            this.player.play(resource);

            // Monitor playback
            const cleanup = () => {
                try {
                    fs.unlinkSync(nextAudio.tempFile);
                    console.log('Temporary file cleaned up:', nextAudio.tempFile);
                } catch (err) {
                    console.error('Error cleaning up temp file:', err);
                }
                this.isPlaying = false;
                this.playNextInQueue();
            };

            this.player.once(AudioPlayerStatus.Idle, cleanup);
            this.player.once('error', (error) => {
                console.error('Error during TTS playback:', error);
                cleanup();
            });
        } catch (error) {
            console.error('Error playing queued audio:', error);
            this.isPlaying = false;
            try {
                fs.unlinkSync(nextAudio.tempFile);
            } catch {}
            this.playNextInQueue();
        }
    }

    async connectToChannel(channel) {
        if (!channel) return false;

        try {
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
                console.log(`TTS Connection state changed from ${oldState.status} to ${newState.status}`);
                if (newState.status === 'disconnected') {
                    this.connection = null;
                }
            });

            // Subscribe player
            this.connection.subscribe(this.player);

            // Wait for ready state
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('TTS Connection timeout'));
                }, 10000);

                const onStateChange = (_, newState) => {
                    if (newState.status === 'ready') {
                        clearTimeout(timeout);
                        this.connection.off('stateChange', onStateChange);
                        resolve();
                    }
                };

                this.connection.on('stateChange', onStateChange);
            });

            console.log('TTS Connected to voice channel:', channel.name);
            return true;
        } catch (error) {
            console.error('Error connecting to voice channel:', error);
            return false;
        }
    }

    async speak(text, channel) {
        if (!this.connection) return false;

        // Check if there are users in the voice channel
        if (!channel || channel.members.size <= 1) {  // <= 1 because the bot counts as a member
            console.log('No users in voice channel, skipping TTS');
            return false;
        }

        try {
            // Call ElevenLabs API directly
            console.log('Calling ElevenLabs API with:', { text, voiceId: this.voiceId });
            const response = await axios({
                method: 'post',
                url: `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey
                },
                data: {
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                },
                responseType: 'arraybuffer'
            });

            // Save the audio to a temporary file
            const tempFile = path.join(__dirname, `temp_${Date.now()}.mp3`);
            console.log('Saving audio to temporary file:', tempFile);
            fs.writeFileSync(tempFile, response.data);

            // Add to queue and start playing if not already playing
            this.audioQueue.push({ tempFile });
            console.log('Added audio to queue:', tempFile);
            
            if (!this.isPlaying) {
                await this.playNextInQueue();
            }
            
            return true;
        } catch (error) {
            console.error('Error in TTS:', error.response?.data || error.message);
            if (typeof tempFile !== 'undefined') {
                try {
                    fs.unlinkSync(tempFile);
                    console.log('Temporary file cleaned up after error:', tempFile);
                } catch (err) {
                    console.error('Error cleaning up temp file:', err);
                }
            }
            return false;
        }
    }

    disconnect() {
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
    }

    enable() {
        this.enabled = true;
        return true;
    }

    disable() {
        this.enabled = false;
        return true;
    }

    isEnabled() {
        return this.enabled;
    }

    setVoice(voiceId) {
        this.voiceId = voiceId;
        return true;
    }

    getVoice() {
        return this.voiceId;
    }

    async listVoices() {
        try {
            const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });
            return response.data.voices;
        } catch (error) {
            console.error('Error fetching voices:', error);
            return [];
        }
    }
}

module.exports = TTSHandler;