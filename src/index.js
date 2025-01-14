const TTSHandler = require('../tts_handler');
const { MemoryManager } = require('./memory');
const TextProcessor = require('./textProcessor');
const ImageProcessor = require('./imageProcessor');
const CommandManager = require('./commands');
const { bingSearch } = require('./utils');
const DiscordBot = require('./bot');
const MusicModule = require('./music/musicModule');

// Initialize components
const memoryManager = new MemoryManager();
const textProcessor = new TextProcessor(memoryManager);
const imageProcessor = new ImageProcessor(textProcessor);
const commandManager = new CommandManager(textProcessor, bingSearch);
const ttsHandler = new TTSHandler();
const musicModule = new MusicModule(config);

// Create and start the bot
const bot = new DiscordBot(memoryManager, textProcessor, imageProcessor, commandManager, ttsHandler, musicModule);

// Start both bots
musicModule.start(config.MUSIC_BOT_TOKEN);
bot.start();