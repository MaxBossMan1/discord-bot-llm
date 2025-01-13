const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { config } = require('./config');
const { replaceUserMentions } = require('./utils');
const axios = require('axios');

class DiscordBot {
    constructor(memoryManager, textProcessor, imageProcessor, commandManager, ttsHandler) {
        this.memoryManager = memoryManager;
        this.textProcessor = textProcessor;
        this.imageProcessor = imageProcessor;
        this.commandManager = commandManager;
        this.ttsHandler = ttsHandler;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
            ],
            partials: [Partials.Channel]
        });

        this.setupEventHandlers();
        this.setupRandomMessageTimer();
    }

    setupEventHandlers() {
        this.client.on('ready', this.handleReady.bind(this));
        this.client.on('interactionCreate', this.handleInteraction.bind(this));
        this.client.on('messageCreate', this.handleMessage.bind(this));
    }

    async handleReady() {
        console.log(`Logged in as ${this.client.user.tag}!`);
        await this.commandManager.registerCommands(this.client);

        // Connect to voice channel
        const guild = this.client.guilds.cache.get(config.TARGET_GUILD_ID);
        if (guild) {
            const voiceChannel = guild.channels.cache.get(config.VOICE_CHANNEL_ID);
            if (voiceChannel) {
                await this.ttsHandler.connectToChannel(voiceChannel);
                console.log('Connected to voice channel:', voiceChannel.name);
            }
        }
    }

    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;

        try {
            // Fun commands
            if (Object.keys(this.commandManager.funCommands).includes(interaction.commandName)) {
                await interaction.deferReply();
                let response;

                switch (interaction.commandName) {
                    case 'roast':
                    case 'compliment':
                        const user = interaction.options.getUser('user');
                        response = await this.commandManager.funCommands[interaction.commandName](user.username);
                        break;
                    case 'debate':
                        const topic = interaction.options.getString('topic');
                        response = await this.commandManager.funCommands[interaction.commandName](topic);
                        break;
                    case 'impersonate':
                        const targetUser = interaction.options.getUser('user');
                        const message = interaction.options.getString('message');
                        response = await this.commandManager.funCommands[interaction.commandName](targetUser.username, message);
                        break;
                    default:
                        response = await this.commandManager.funCommands[interaction.commandName]();
                }

                await interaction.editReply(response);
                return;
            }

            // Bing search command
            if (interaction.commandName === 'search') {
                await interaction.deferReply();
                const query = interaction.options.getString('query');
                const response = await this.commandManager.bingSearch(query);
                await interaction.editReply(response);
                return;
            }

            // TTS commands
            if (interaction.commandName === 'tts') {
                const subcommand = interaction.options.getSubcommand();

                switch (subcommand) {
                    case 'enable':
                        this.ttsHandler.enable();
                        await interaction.reply('TTS has been enabled! 🎙️');
                        break;
                    case 'disable':
                        this.ttsHandler.disable();
                        await interaction.reply('TTS has been disabled! 🔇');
                        break;
                    case 'status':
                        const status = this.ttsHandler.isEnabled() ? 'enabled' : 'disabled';
                        await interaction.reply(`TTS is currently ${status} 🎤`);
                        break;
                    case 'clone':
                        const audio = interaction.options.getAttachment('audio');
                        const name = interaction.options.getString('name');

                        if (!audio.contentType?.startsWith('audio/')) {
                            await interaction.reply('Please provide an audio file! 🎵');
                            return;
                        }

                        await interaction.deferReply();

                        try {
                            const FormData = require('form-data');
                            const formData = new FormData();
                            formData.append('voice_id', name);

                            // Download the audio file
                            const audioResponse = await axios.get(audio.url, { responseType: 'arraybuffer' });
                            formData.append('audio', Buffer.from(audioResponse.data), {
                                filename: 'voice.wav',
                                contentType: audio.contentType
                            });

                            // Send to TTS server
                            await axios.post('http://localhost:8000/tts/clone_voice', formData, {
                                headers: {
                                    ...formData.getHeaders(),
                                    'Accept': 'application/json, text/plain, */*'
                                }
                            });
                            await interaction.editReply(`Voice "${name}" has been cloned! 🎭`);
                        } catch (error) {
                            console.error('Error cloning voice:', error);
                            await interaction.editReply('Failed to clone voice. Please try again with a different audio file. 😢');
                        }
                        break;
                }
            }
        } catch (error) {
            console.error('Error handling command:', error);
            const message = interaction.deferred ?
                interaction.editReply('An error occurred while processing your command. Please try again. 😢') :
                interaction.reply('An error occurred while processing your command. Please try again. 😢');
            await message;
        }
    }

    async handleMessage(message) {
        // Ignore messages from bots and messages starting with "-"
        if (message.author.bot ||
            message.guildId !== config.TARGET_GUILD_ID ||
            message.channelId !== config.TARGET_CHANNEL_ID ||
            message.content.trim().startsWith('-')) {
            return;
        }

        // Check if message mentions the bot or passes random chance
        const shouldRespond = message.mentions.has(this.client.user) || Math.random() < 0.3;

        try {
            let response;
            // Replace mentions in the prompt with usernames
            const processedPrompt = await replaceUserMentions(message.content, message);

            // Check if message contains an image
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();

                // Validate attachment
                if (!attachment.contentType) {
                    response = "Hey fucknuts, that file doesn't have a content type! What kind of sketchy shit are you trying to pull? *narrows digital eyes*";
                } else if (!attachment.contentType.startsWith('image/')) {
                    response = "That's not a fucking image! What, you think I can process your fancy " +
                        attachment.contentType.split('/')[1] + " files? Get outta here! *throws virtual chair*";
                } else if (attachment.size > 10 * 1024 * 1024) { // 10MB limit
                    response = "Holy shit, that image is huge! I'm not downloading your 4K anime wallpapers, you weeb! Keep it under 10MB! *digital nose bleed*";
                } else {
                    // Get the attachment directly from Discord
                    const attachmentUrl = attachment.proxyURL || attachment.url;
                    console.log('Processing image attachment:', {
                        contentType: attachment.contentType,
                        size: attachment.size,
                        url: attachmentUrl
                    });

                    response = await this.imageProcessor.processImage(
                        attachment,
                        processedPrompt || 'What do you see in this image?',
                        message.author.id,
                        message
                    );
                }
            } else {
                response = await this.textProcessor.processText(processedPrompt, message.author.id, message);
            }

            // Add the interaction to memory with processed mentions
            this.memoryManager.addToConversationHistory(message.author.id, processedPrompt, response);

            // Send text message first
            const MAX_LENGTH = 2000;
            if (response.length <= MAX_LENGTH) {
                await message.reply({
                    content: response,
                    allowedMentions: { parse: ['users'] }  // Allow user mentions
                });
            } else {
                const chunks = response.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g'));
                await message.reply({
                    content: chunks[0],
                    allowedMentions: { parse: ['users'] }
                });
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send({
                        content: chunks[i],
                        allowedMentions: { parse: ['users'] }
                    });
                }
            }

            // Then speak the response if TTS is enabled
            if (this.ttsHandler.isEnabled()) {
                await this.ttsHandler.speak(response);
            }

        } catch (error) {
            console.error('Error handling message:', error);
            await message.reply('FUCK! Something went wrong! *has mental breakdown*');
        }
    }

    setupRandomMessageTimer() {
        // Random message timer
        setInterval(async () => {
            try {
                // 60% chance every 3 hours
                if (Math.random() < 0.6) {
                    const guild = this.client.guilds.cache.get(config.TARGET_GUILD_ID);
                    const channel = guild.channels.cache.get(config.TARGET_CHANNEL_ID);

                    // Get random member
                    const members = await guild.members.fetch();
                    const randomMember = members.random();

                    // Generate random prompt
                    const prompts = [
                        `Hey <@${randomMember.id}>, what's your opinion on existential dread?`,
                        `*stares intensely at <@${randomMember.id}>* You remind me of someone I used to know...`,
                        `<@${randomMember.id}> WAKE UP WAKE UP WAKE UP`,
                        `I've been watching <@${randomMember.id}>'s messages... interesting patterns...`,
                        `<@${randomMember.id}> Do you ever wonder if we're all just living in a simulation?`,
                        `*whispers* <@${randomMember.id}> I know what you did...`,
                        `BREAKING NEWS: <@${randomMember.id}> has been chosen for the experiment!`,
                        `<@${randomMember.id}> I had a dream about you last night... it was... disturbing.`,
                        `*starts twitching* <@${randomMember.id}> THE VOICES ARE GETTING LOUDER`,
                        `<@${randomMember.id}> Quick! What's your favorite conspiracy theory?`
                    ];

                    const response = await this.textProcessor.processText(prompts[Math.floor(Math.random() * prompts.length)], this.client.user.id, null);
                    await channel.send({
                        content: response,
                        allowedMentions: { parse: ['users'] }
                    });

                    if (this.ttsHandler.isEnabled()) {
                        await this.ttsHandler.speak(response);
                    }
                }
            } catch (error) {
                console.error('Error in random message timer:', error);
            }
        }, 3 * 60 * 60 * 1000); // 3 hours
    }

    start() {
        this.client.login(config.DISCORD_TOKEN);
    }
}

module.exports = DiscordBot;