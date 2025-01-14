const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus
} = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class TTSHandler {
    constructor() {
        this.player = createAudioPlayer();
        this.connection = null;
        this.enabled = true;
        this.voiceId = 'default';
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

    async speak(text) {
        if (!this.connection) return false;

        try {
            // Call the TTS server
            const formData = new FormData();
            formData.append('text', text);
            formData.append('speaker', this.voiceId);
            const response = await axios.post('http://localhost:8000/tts/', 
                formData,
                { 
                    responseType: 'arraybuffer',
                    headers: {
                        ...formData.getHeaders(),
                        'Accept': 'application/json, text/plain, */*'
                    }
                }
            );

            // Create a unique temporary file name
            const tempFile = path.join(__dirname, `temp_audio_${Date.now()}.wav`);
            
            try {
                // Save the audio to a temporary file
                fs.writeFileSync(tempFile, response.data);

                // Create and play the audio resource
                const resource = createAudioResource(tempFile);
                this.player.play(resource);

                return new Promise((resolve) => {
                    const cleanup = () => {
                        try {
                            if (fs.existsSync(tempFile)) {
                                fs.unlinkSync(tempFile);
                            }
                        } catch (err) {
                            console.warn('Warning: Could not delete temporary file:', err);
                        }
                    };

                    // Clean up on both successful completion and error
                    this.player.once(AudioPlayerStatus.Idle, () => {
                        cleanup();
                        resolve(true);
                    });

                    this.player.once('error', () => {
                        cleanup();
                        resolve(false);
                    });
                });
            } catch (error) {
                // Clean up if we fail before playing
                if (fs.existsSync(tempFile)) {
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.warn('Warning: Could not delete temporary file:', err);
                    }
                }
                throw error;
            }
        } catch (error) {
            console.error('Error in TTS:', error);
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
}

module.exports = TTSHandler;