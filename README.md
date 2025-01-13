# Discord Bot with Local LLM Integration

This Discord bot uses local LLM models through Msty to respond to messages with both text and image processing capabilities, along with Text-to-Speech (TTS) support.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the sample configuration file and edit it with your settings:
```bash
cp config.sample.json config.json
```

3. Edit config.json and fill in your settings:
```json
{
    "DISCORD_TOKEN": "your-discord-bot-token-here",
    "MSTY_API_URL": "http://localhost:1234",
    "TARGET_GUILD_ID": "your-guild-id",
    "TARGET_CHANNEL_ID": "your-channel-id",
    "VOICE_CHANNEL_ID": "your-voice-channel-id",
    "MEMORY_LIMIT": 10
}
```

4. Make sure your Msty server is running and accessible at the URL specified in your config.json

5. Install Python dependencies and start the TTS server:
```bash
cd tts_server
pip install -r requirements.txt
python tts_server.py
```

6. In another terminal, start the bot:
```bash
node index.js
```

## Features

### Core Features
- Uses Llama2 Uncensored for text responses
- Uses LLaVA Phi3 for image processing
- Maintains conversation memory (last 10 messages per user)
- Handles long responses by splitting them into chunks
- Maintains a chaotic and entertaining personality

### Response Behavior
- 30% chance to respond to normal messages
- 100% chance to respond when mentioned
- 60% chance to send random messages every 3 hours
- Randomly mentions users in responses
- Uses rich text formatting and emojis

### Text-to-Speech (TTS)
- Real-time voice synthesis in voice channels
- Voice cloning capability using YourTTS
- Multiple voice profile support
- Speaks responses while also sending text messages

## Commands

### TTS Commands
- `/tts enable` - Enable TTS functionality
- `/tts disable` - Disable TTS functionality
- `/tts status` - Check current TTS status
- `/tts clone` - Clone a voice from an audio file
  - Requires a WAV file and a name for the voice profile

### Suggested Additional Commands
Here are some useful commands we could add:

#### Voice Commands
- `/voice list` - List all available voice profiles
- `/voice select <name>` - Select a voice profile to use
- `/voice random` - Use random voice profiles for responses
- `/voice preview <name>` - Preview how a voice profile sounds

#### Personality Commands
- `/personality aggressive` - Make responses more aggressive
- `/personality friendly` - Make responses more friendly
- `/personality random` - Randomize personality traits
- `/personality reset` - Reset to default personality

#### Interaction Commands
- `/chance set <percentage>` - Set response chance for normal messages
- `/timer set <hours>` - Set random message interval
- `/memory clear` - Clear conversation memory
- `/memory show` - Show stored conversation history
- `/target channel <channel>` - Change target text channel
- `/target voice <channel>` - Change target voice channel

#### Fun Commands
- `/impersonate <user>` - Temporarily impersonate another user's style
- `/debate <topic>` - Start a debate on a topic
- `/story` - Generate a random story
- `/roast <user>` - Generate a playful roast
- `/compliment <user>` - Generate a nice compliment
- `/conspiracy` - Generate a random conspiracy theory
- `/fact` - Share a "fact" (may be true or false)
- `/quote` - Generate an inspirational (or chaotic) quote

## Configuration

### config.json Settings
- `DISCORD_TOKEN`: Your Discord bot token
- `MSTY_API_URL`: URL of your Msty server
- `TARGET_GUILD_ID`: The Discord server ID
- `TARGET_CHANNEL_ID`: The channel ID to monitor
- `VOICE_CHANNEL_ID`: The voice channel ID for TTS
- `MEMORY_LIMIT`: Number of messages to remember per user

### Response Settings (in index.js)
- Response chance: 30% for normal messages
- Mention response: 100%
- Random message: 60% chance every 3 hours
- Random mention: 30% chance in responses
- Formatting: 70% chance per sentence
- Emoji chance: 50% at start/end of sentences

## Contributing

Feel free to submit issues and enhancement requests!