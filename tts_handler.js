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
            const response = await axios.post('http://localhost:8000/tts/', 
                formData,
                { 
                    responseType: 'arraybuffer',
                    headers: formData.getHeaders()
                }
            );

            // Save the audio to a temporary file
            const tempFile = path.join(__dirname, 'temp_audio.wav');
            fs.writeFileSync(tempFile, response.data);

            // Create and play the audio resource
            const resource = createAudioResource(tempFile);
            this.player.play(resource);

            return new Promise((resolve) => {
                this.player.once(AudioPlayerStatus.Idle, () => {
                    fs.unlinkSync(tempFile);
                    resolve(true);
                });
            });
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
}

module.exports = TTSHandler;