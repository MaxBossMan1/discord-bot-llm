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
                const searchResult = await this.commandManager.bingSearch(query);

                if (!searchResult.success) {
                    await interaction.editReply(searchResult.message);
                    return;
                }

                // Format search results for AI processing
                const searchContext = `Here are the search results for "${query}":\n\n` +
                    searchResult.results.map((result, index) => 
                        `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.url}`
                    ).join('\n\n');

                console.log(`[Search] Processing query: "${query}"\nContext length: ${searchContext.length} characters`);

                // Process through Mistral
                const response = await this.textProcessor.processText(
                    `Based on these search results, please provide a comprehensive but concise answer to the query "${query}". Include relevant information from the sources and cite them using [1], [2], etc.: \n\n${searchContext}`,
                    interaction.user.id,
                    interaction,
                    interaction.user.username
                );

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

        // First check for direct mentions
        const isMentioned = message.mentions.has(this.client.user);
        let shouldRespond = false;
        let responseReason = '';
        let randomChance = 0;

        if (isMentioned) {
            shouldRespond = true;
            responseReason = 'bot mentioned';
        } else {
            // If not mentioned, use random chance
            randomChance = Math.random();
            shouldRespond = randomChance < 0.3;
            responseReason = shouldRespond ? 'random chance' : 'skipped (random)';
        }
        
        console.log(`[Message Response] User: ${message.author.username}, Content: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"
    - Mentioned bot: ${isMentioned}
    ${!isMentioned ? `    - Random chance: ${randomChance.toFixed(4)} (threshold: 0.3)` : ''}
    - Will respond: ${shouldRespond} (${responseReason})`);

        if (!shouldRespond) {
            return;
        }

        try {
            let response;
            let prompt;

            // Check if this is a reply to a message
            if (message.reference && message.reference.messageId) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    
                    // Only process if it's a reply to the bot's message
                    if (repliedMessage.author.id === this.client.user.id) {
                        console.log(`[Reply Context] Found reply to bot's message:
    Original: "${repliedMessage.content.substring(0, 100)}${repliedMessage.content.length > 100 ? '...' : ''}"
    Reply: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`);
                        
                        // Combine the original message and reply for context
                        prompt = `Previous message: "${repliedMessage.content}"\nUser's reply: "${message.content}"`;
                    }
                } catch (error) {
                    console.error('Error fetching replied message:', error);
                }
            }

            // If no valid reply context was set, use the message content directly
            if (!prompt) {
                prompt = message.content;
            }

            // Replace mentions in the prompt with usernames
            const processedPrompt = await replaceUserMentions(prompt, message);

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
                response = await this.textProcessor.processText(processedPrompt, message.author.id, message, message.author.username);
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
        const { randomMessageConfig } = require('./config');
        let lastMessageTime = Date.now();

        const getRandomPrompt = (member) => {
            const prompts = [
                // Existential and philosophical
                `Hey <@${member.id}>, what's your opinion on existential dread?`,
                `<@${member.id}> Do you ever wonder if we're all just living in a simulation?`,
                `<@${member.id}>, if you could know the absolute truth about one thing, what would it be?`,
                `*contemplates existence* <@${member.id}>, what's your take on parallel universes?`,

                // Creepy and unsettling
                `*stares intensely at <@${member.id}>* You remind me of someone I used to know...`,
                `*whispers* <@${member.id}> I know what you did...`,
                `<@${member.id}> I had a dream about you last night... it was... disturbing.`,
                `I've been watching <@${member.id}>'s messages... interesting patterns...`,

                // Chaotic and random
                `<@${member.id}> WAKE UP WAKE UP WAKE UP`,
                `*starts twitching* <@${member.id}> THE VOICES ARE GETTING LOUDER`,
                `BREAKING NEWS: <@${member.id}> has been chosen for the experiment!`,
                `<@${member.id}> QUICK! The aliens are coming! What's your favorite cheese?!`,

                // Conspiracy and paranormal
                `<@${member.id}> Quick! What's your favorite conspiracy theory?`,
                `<@${member.id}>, have you ever seen a ghost? Or are YOU the ghost? *X-Files theme plays*`,
                `*adjusts tinfoil hat* <@${member.id}>, the lizard people are watching us!`,
                `<@${member.id}>, what's your take on bigfoot's cryptocurrency investments?`,

                // Random challenges
                `<@${member.id}>, I challenge you to speak in only emojis for the next hour!`,
                `ATTENTION <@${member.id}>! You must now explain quantum physics using only memes!`,
                `<@${member.id}>, quick! Explain why pizza is round but comes in a square box!`,
                `*dramatic pose* <@${member.id}>, defend your position on pineapple on pizza!`,

                // Personal and intrusive
                `<@${member.id}>, what's the weirdest dream you've ever had?`,
                `*reads your browser history* Interesting choices, <@${member.id}>... very interesting...`,
                `<@${member.id}>, if your pet could talk, what secrets would they reveal?`,
                `*scans brain waves* <@${member.id}>, why were you thinking about THAT?`,

                // Time-based
                `<@${member.id}>, what were you doing exactly 3 years, 2 months, 15 days, 7 hours and 23 seconds ago?`,
                `<@${member.id}>, in an alternate timeline, you're currently a professional kazoo player. How's that going?`,
                `*checks interdimensional calendar* <@${member.id}>, according to my calculations, you're late for something in dimension C-137!`,

                // Absurd scenarios
                `<@${member.id}>, if you had to fight 100 duck-sized horses or 1 horse-sized duck, which would you choose?`,
                `EMERGENCY SCENARIO: <@${member.id}>, the world's supply of socks has vanished! What's your solution?`,
                `<@${member.id}>, you've been chosen to be the first human to telepathically communicate with houseplants. What's your first message?`,
                `*breaks fourth wall* <@${member.id}>, have you noticed we're all just characters in a cosmic Discord bot's fever dream?`
            ];
            return prompts[Math.floor(Math.random() * prompts.length)];
        };

        const scheduleNextMessage = () => {
            const baseMs = randomMessageConfig.baseInterval * 60 * 1000;
            const randomMs = Math.floor(Math.random() * randomMessageConfig.randomInterval * 60 * 1000);
            const nextInterval = baseMs + randomMs;
            const nextMinutes = nextInterval / (60 * 1000);
            
            console.log(`[Random Timer] Scheduling next message check:
    - Base interval: ${randomMessageConfig.baseInterval} minutes
    - Random addition: ${(randomMs / (60 * 1000)).toFixed(2)} minutes
    - Total wait: ${nextMinutes.toFixed(2)} minutes
    - Next check at: ${new Date(Date.now() + nextInterval).toLocaleString()}`);
            
            setTimeout(async () => {
                try {
                    const now = Date.now();
                    const timeSinceLastMessage = now - lastMessageTime;
                    const minTimeMs = randomMessageConfig.minTimeBetweenMessages * 60 * 1000;
                    const randomTrigger = Math.random();
                    const timeCheck = timeSinceLastMessage >= minTimeMs;

                    console.log(`[Random Timer] Checking conditions:
    - Time since last message: ${(timeSinceLastMessage / (60 * 1000)).toFixed(2)} minutes
    - Minimum required: ${randomMessageConfig.minTimeBetweenMessages} minutes
    - Time check passed: ${timeCheck}
    - Random trigger: ${randomTrigger.toFixed(4)} (threshold: ${randomMessageConfig.triggerChance})
    - Will attempt message: ${timeCheck && randomTrigger < randomMessageConfig.triggerChance}`);

                    if (timeCheck && randomTrigger < randomMessageConfig.triggerChance) {
                        const guild = this.client.guilds.cache.get(config.TARGET_GUILD_ID);
                        const channel = guild.channels.cache.get(config.TARGET_CHANNEL_ID);

                        // Get random member, excluding bots
                        const members = (await guild.members.fetch()).filter(member => !member.user.bot);
                        const randomMember = members.random();

                        console.log(`[Random Timer] Member selection:
    - Total members (excluding bots): ${members.size}
    - Selected member: ${randomMember ? randomMember.user.username : 'none'}`);

                        if (randomMember) {
                            const prompt = getRandomPrompt(randomMember);
                            console.log(`[Random Timer] Generated prompt:
    - Target user: ${randomMember.user.username}
    - Prompt: "${prompt}"`);

                            const response = await this.textProcessor.processText(
                                prompt,
                                this.client.user.id,
                                null,
                                randomMember.user.username
                            );

                            console.log(`[Random Timer] Generated response:
    - Length: ${response.length} characters
    - Response: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);

                            await channel.send({
                                content: response,
                                allowedMentions: { parse: ['users'] }
                            });

                            if (this.ttsHandler.isEnabled()) {
                                console.log('[Random Timer] TTS is enabled, speaking response');
                                await this.ttsHandler.speak(response);
                            } else {
                                console.log('[Random Timer] TTS is disabled, skipping speech');
                            }

                            lastMessageTime = now;
                            console.log(`[Random Timer] Message sent successfully, updated last message time to: ${new Date(lastMessageTime).toLocaleString()}`);
                        } else {
                            console.log('[Random Timer] No eligible members found, skipping message');
                        }
                    }
                } catch (error) {
                    console.error('Error in random message timer:', error);
                } finally {
                    scheduleNextMessage();
                }
            }, nextInterval);
        };

        // Start the timer
        scheduleNextMessage();
    }

    start() {
        this.client.login(config.DISCORD_TOKEN);
    }
}

module.exports = DiscordBot;