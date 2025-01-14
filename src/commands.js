const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const { config } = require('./config');

class CommandManager {
    constructor(textProcessor, bingSearchFn) {
        this.textProcessor = textProcessor;
        this.bingSearch = bingSearchFn;
        this.funCommands = this.initializeFunCommands();
    }

    initializeFunCommands() {
        return {
            story: async () => {
                return await this.textProcessor.processText("Generate a creative and entertaining short story. Be imaginative and unexpected.");
            },
            roast: async (user) => {
                return await this.textProcessor.processText(`Generate a playful and funny roast for ${user}. Keep it light-hearted and not too mean.`);
            },
            compliment: async (user) => {
                return await this.textProcessor.processText(`Generate a creative and sincere compliment for ${user}.`);
            },
            conspiracy: async () => {
                return await this.textProcessor.processText("Generate a funny and absurd conspiracy theory. Make it entertaining and obviously not serious.");
            },
            fact: async () => {
                return await this.textProcessor.processText("Share an interesting fact that might be true or false. Don't indicate which it is.");
            },
            quote: async () => {
                return await this.textProcessor.processText("Generate an inspirational or chaotic quote with its fictional author.");
            },
            debate: async (topic) => {
                return await this.textProcessor.processText(`Start a debate about "${topic}" by presenting multiple viewpoints in a humorous way.`);
            },
            impersonate: async (user, message) => {
                return await this.textProcessor.processText(`Respond to "${message}" while impersonating ${user}'s style and mannerisms.`);
            }
        };
    }

    getSlashCommands() {
        return [
            // Music commands
            new SlashCommandBuilder()
                .setName('play')
                .setDescription('Play a song')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('The song to play (URL or search query)')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('skip')
                .setDescription('Skip the current song'),
            new SlashCommandBuilder()
                .setName('stop')
                .setDescription('Stop playback and clear the queue'),
            new SlashCommandBuilder()
                .setName('queue')
                .setDescription('Show the current music queue'),
            new SlashCommandBuilder()
                .setName('playlist')
                .setDescription('Manage your playlists')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('create')
                        .setDescription('Create a new playlist')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the playlist')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('description')
                                .setDescription('Description of the playlist')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a track to a playlist')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the playlist')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('query')
                                .setDescription('Track to add (URL or search query)')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a track from a playlist')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the playlist')
                                .setRequired(true))
                        .addIntegerOption(option =>
                            option.setName('index')
                                .setDescription('Track number to remove')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('delete')
                        .setDescription('Delete a playlist')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the playlist')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List all your playlists'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('view')
                        .setDescription('View a playlist\'s contents')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the playlist')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('play')
                        .setDescription('Play a playlist')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the playlist')
                                .setRequired(true))),
            // Fun commands
            new SlashCommandBuilder()
                .setName('story')
                .setDescription('Generate a random story'),
            new SlashCommandBuilder()
                .setName('roast')
                .setDescription('Generate a playful roast')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to roast')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('compliment')
                .setDescription('Generate a nice compliment')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to compliment')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('conspiracy')
                .setDescription('Generate a random conspiracy theory'),
            new SlashCommandBuilder()
                .setName('fact')
                .setDescription('Share an interesting "fact"'),
            new SlashCommandBuilder()
                .setName('quote')
                .setDescription('Generate an inspirational or chaotic quote'),
            new SlashCommandBuilder()
                .setName('debate')
                .setDescription('Start a debate on a topic')
                .addStringOption(option =>
                    option.setName('topic')
                        .setDescription('The topic to debate')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('impersonate')
                .setDescription('Impersonate another user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to impersonate')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message to respond to')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('search')
                .setDescription('Search the web using Bing')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('What to search for')
                        .setRequired(true)),
            // TTS commands
            new SlashCommandBuilder()
                .setName('tts')
                .setDescription('Control TTS settings')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('enable')
                        .setDescription('Enable TTS'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('disable')
                        .setDescription('Disable TTS'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Check TTS status'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('clone')
                        .setDescription('Clone a voice from an audio file')
                        .addAttachmentOption(option =>
                            option
                                .setName('audio')
                                .setDescription('Audio file to clone voice from (.wav file)')
                                .setRequired(true))
                        .addStringOption(option =>
                            option
                                .setName('name')
                                .setDescription('Name for the cloned voice')
                                .setRequired(true)))
        ];
    }

    async registerCommands(client) {
        try {
            console.log('Started refreshing application (/) commands.');
            const rest = new REST().setToken(config.DISCORD_TOKEN);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, config.TARGET_GUILD_ID),
                { body: this.getSlashCommands() },
            );
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = CommandManager;