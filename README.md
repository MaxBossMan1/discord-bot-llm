# Discord Bot with Local LLM Integration

This Discord bot uses local LLM models through Msty to respond to messages with both text and image processing capabilities.

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
    "MEMORY_LIMIT": 10
}
```

4. Make sure your Msty server is running and accessible at the URL specified in your config.json

5. Start the bot:
```bash
node index.js
```

## Features

- Responds to all messages in the configured channel
- Uses Llama2 Uncensored for text responses
- Uses LLaVA Phi3 for image processing
- Maintains conversation memory (last 10 messages per user)
- Handles long responses by splitting them into chunks
- Maintains a chaotic and entertaining personality

## Configuration

You can modify these constants in `index.js`:
- `TARGET_GUILD_ID`: The Discord server ID
- `TARGET_CHANNEL_ID`: The channel ID to monitor
- `MEMORY_LIMIT`: Number of messages to remember per user
- `MSTY_API_URL`: URL of your Msty server