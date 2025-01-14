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
        this.voiceId = '1S8dlQj81Ty3soQ57nz7';  // Default to 'dafuck' voice
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
            formData.append('voice_id', this.voiceId);
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

            try {
                // Save the audio buffer to a temporary file
                const tempFile = path.join(__dirname, `temp_${Date.now()}.mp3`);
                fs.writeFileSync(tempFile, response.data);

                // Create an audio resource from the file
                const resource = createAudioResource(tempFile, {
                    inputType: 'mp3',
                    inlineVolume: true
                });

                if (!resource) {
                    throw new Error('Failed to create audio resource');
                }

                // Add state change logging
                this.player.on(AudioPlayerStatus.Playing, () => {
                    console.log('Audio player is now playing');
                });
                
                this.player.on(AudioPlayerStatus.Idle, () => {
                    console.log('Audio player is now idle');
                    // Clean up the temporary file
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.error('Error cleaning up temp file:', err);
                    }
                });
                
                this.player.on('error', error => {
                    console.error('Error in audio player:', error);
                    // Clean up the temporary file on error
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.error('Error cleaning up temp file:', err);
                    }
                });

                this.player.play(resource);
                console.log('Attempting to play audio resource from file:', tempFile);

                return new Promise((resolve) => {
                    this.player.once(AudioPlayerStatus.Idle, () => {
                        resolve(true);
                    });

                    this.player.once('error', () => {
                        resolve(false);
                    });
                });
            } catch (error) {
                console.error('Error creating or playing audio resource:', error);
                return false;
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