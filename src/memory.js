const fs = require('fs');
const { MEMORY_FILE, config } = require('./config');

class UserMemory {
    constructor() {
        this.conversations = [];  // Array of {user: string, assistant: string} pairs
        this.lastInteraction = Date.now();
    }
}

class MemoryManager {
    constructor() {
        this.conversationMemory = new Map();
        this.loadMemoryFromFile();
        this.startAutoSave();
    }

    loadMemoryFromFile() {
        try {
            if (fs.existsSync(MEMORY_FILE)) {
                const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
                this.conversationMemory = new Map(Object.entries(data).map(([key, value]) => {
                    const memory = new UserMemory();
                    Object.assign(memory, value);
                    return [key, memory];
                }));
                console.log('Memory loaded from file');
            }
        } catch (error) {
            console.error('Error loading memory:', error);
        }
    }

    saveMemoryToFile() {
        try {
            const data = Object.fromEntries(this.conversationMemory);
            fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving memory:', error);
        }
    }

    startAutoSave() {
        // Save memory periodically (every 5 minutes)
        setInterval(() => this.saveMemoryToFile(), 5 * 60 * 1000);
    }

    getConversationHistory(userId) {
        if (!this.conversationMemory.has(userId)) {
            this.conversationMemory.set(userId, new UserMemory());
        }
        return this.conversationMemory.get(userId).conversations;
    }

    addToConversationHistory(userId, userMessage, assistantMessage) {
        if (!this.conversationMemory.has(userId)) {
            this.conversationMemory.set(userId, new UserMemory());
        }
        const memory = this.conversationMemory.get(userId);
        memory.conversations.push({ user: userMessage, assistant: assistantMessage });
        memory.lastInteraction = Date.now();
        
        // Keep only the last N conversations
        if (memory.conversations.length > config.MEMORY_LIMIT) {
            memory.conversations.shift();
        }
    }
}

module.exports = {
    MemoryManager,
    UserMemory
};