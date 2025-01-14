# Discord Bot with Local LLM Integration

This Discord bot uses local LLM models through Msty to respond to messages with both text and image processing capabilities, along with Text-to-Speech (TTS) support.

## Setup

1. Make sure you have Python 3.11 installed on your system.

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
    "MEMORY_LIMIT": 10,
    "BING_API_KEY": "your-bing-api-key-here",
    "BING_ENDPOINT": "https://api.bing.microsoft.com/v7.0/search"
}
```

4. Get your Bing Web Search API key:
   - Go to the [Azure Portal](https://portal.azure.com)
   - Create a new Bing Web Search resource or use an existing one
   - Go to "Keys and Endpoint" section
   - Copy one of the keys and the endpoint
   - Add them to your config.json

5. Make sure your Msty server is running and accessible at the URL specified in your config.json

5. Start everything with a single command:
```bash
./start.sh
```

This script will:
- Check for Python 3.11
- Install Node.js dependencies
- Set up Python virtual environment
- Install Python dependencies
- Start the TTS server
- Start the Discord bot

Alternatively, you can start components manually:

```bash
# Install dependencies
npm install
cd tts_server
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Start TTS server
python tts_server.py

# In another terminal, start the bot
node index.js
```

## Features

### Core Features
- Uses Llama2 Uncensored for text responses
- Uses LLaVA Phi3 for image processing
- Maintains conversation memory (last 10 messages per user)
- Handles long responses by splitting them into chunks
- Maintains a chaotic and entertaining personality
- Web search capabilities using Bing

### Response Behavior
- 30% chance to respond to normal messages
- 100% chance to respond when mentioned
- 60% chance to send random messages every 3 hours
- Randomly mentions users in responses
- Uses rich text formatting and emojis

### Text-to-Speech (TTS)
- Real-time voice synthesis in voice channels
- Voice cloning capability using ElevenLabs
- Multiple voice profile support
- Speaks responses only when users are present in the voice channel
- Automatically skips TTS when voice channel is empty
- Sends text messages regardless of TTS status

## Commands

### TTS Commands
- `/tts enable` - Enable TTS functionality
- `/tts disable` - Disable TTS functionality
- `/tts status` - Check current TTS status
- `/tts clone` - Clone a voice from an audio file
  - Requires a WAV file and a name for the voice profile

### Fun Commands
- `/story` - Generate a random story
- `/roast @user` - Generate a playful roast
- `/compliment @user` - Generate a nice compliment
- `/conspiracy` - Generate a random conspiracy theory
- `/fact` - Share an interesting "fact" (may be true or false)
- `/quote` - Generate an inspirational (or chaotic) quote
- `/debate <topic>` - Start a debate on a topic
- `/impersonate @user <message>` - Temporarily impersonate another user's style

### Search Commands
- `/search <query>` - Search the web using Bing

### Planned Features
Here are some features planned for future updates:

#### Voice Commands
- `/voice list` - List all available voice profiles
- `/voice select <n>` - Select a voice profile to use
- `/voice random` - Use random voice profiles for responses
- `/voice preview <n>` - Preview how a voice profile sounds

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

## Configuration

### config.json Settings
- `DISCORD_TOKEN`: Your Discord bot token
- `MSTY_API_URL`: URL of your Msty server
- `TARGET_GUILD_ID`: The Discord server ID
- `TARGET_CHANNEL_ID`: The channel ID to monitor
- `VOICE_CHANNEL_ID`: The voice channel ID for TTS
- `MEMORY_LIMIT`: Number of messages to remember per user
- `BING_API_KEY`: Your Bing Web Search API key from Azure Portal
- `BING_ENDPOINT`: Bing Web Search API endpoint (default is v7.0)

### Response Settings (in index.js)
- Response chance: 30% for normal messages
- Mention response: 100%
- Random message: 60% chance every 3 hours
- Random mention: 30% chance in responses
- Formatting: 70% chance per sentence
- Emoji chance: 50% at start/end of sentences

## Contributing

Feel free to submit issues and enhancement requests!