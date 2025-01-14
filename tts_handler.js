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
        if (this.audioQueue.length === 0 || this.isPlaying) return;

        const nextAudio = this.audioQueue.shift();
        this.isPlaying = true;

        try {
            const resource = createAudioResource(nextAudio.tempFile, {
                inputType: 'mp3',
                inlineVolume: true
            });

            if (!resource) {
                throw new Error('Failed to create audio resource');
            }

            this.player.play(resource);
            console.log('Playing next audio in queue:', nextAudio.tempFile);

            // Clean up the temporary file when done
            this.player.once(AudioPlayerStatus.Idle, () => {
                try {
                    fs.unlinkSync(nextAudio.tempFile);
                    console.log('Temporary file cleaned up:', nextAudio.tempFile);
                } catch (err) {
                    console.error('Error cleaning up temp file:', err);
                }
            });
        } catch (error) {
            console.error('Error playing queued audio:', error);
            this.isPlaying = false;
            this.playNextInQueue();
        }
    }

    async connectToChannel(channel) {
        if (!channel) return false;

        try {
            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            this.connection.subscribe(this.player);
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
                console.error('Error creating or playing audio resource:', error);
                // Clean up the temporary file on error
                try {
                    fs.unlinkSync(tempFile);
                    console.log('Temporary file cleaned up after error:', tempFile);
                } catch (err) {
                    console.error('Error cleaning up temp file:', err);
                }
                return false;
            }
        } catch (error) {
            console.error('Error in TTS:', error.response?.data || error.message);
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