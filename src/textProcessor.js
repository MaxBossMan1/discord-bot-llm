const axios = require('axios');
const { config, systemPrompt, MAX_CONTEXT_TOKENS } = require('./config');
const { countTokens } = require('./utils');

class TextProcessor {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
    }

    async processText(prompt, userId, message) {
        try {
            const history = this.memoryManager.getConversationHistory(userId) || [];
            
            // Calculate remaining tokens for response
            const promptTokens = countTokens(prompt);
            const historyTokens = history.reduce((sum, conv) => 
                sum + countTokens(conv?.user || '') + countTokens(conv?.assistant || ''), 0);
            const systemTokens = countTokens(systemPrompt);
            const maxResponseTokens = Math.min(
                1000,  // Increased limit to 1000 tokens
                Math.max(200, MAX_CONTEXT_TOKENS - systemTokens - historyTokens - promptTokens)  // Ensure at least 200 tokens
            );

            // Build messages array with proper error handling
            const messages = [
                { 
                    role: 'system', 
                    content: systemPrompt + "\nIMPORTANT: Your response MUST be limited to maximum 2 paragraphs." 
                }
            ];

            // Add history messages with proper error handling
            for (const conv of history) {
                if (conv?.user) messages.push({ role: 'user', content: conv.user });
                if (conv?.assistant) messages.push({ role: 'assistant', content: conv.assistant });
            }

            // Add current prompt
            if (prompt) messages.push({ role: 'user', content: prompt });
            
            const response = await axios.post(`${config.MSTY_API_URL}/v1/chat/completions`, {
                model: 'mistral-nemo',
                messages,
                max_tokens: maxResponseTokens,
                temperature: 0.9,
                presence_penalty: 0.6,
                frequency_penalty: 0.6
            });
            
            if (!response.data?.choices?.[0]?.message?.content) {
                console.error('Invalid response format:', response.data);
                return 'Error: No valid response generated';
            }

            let content = response.data.choices[0].message.content;
            
            // Only truncate if it's going to exceed Discord's limit
            if (content.length > 1900) {  // Leave room for quotes and formatting
                const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
                content = sentences.slice(0, 4).join('').trim();  // Keep first 4 sentences
                
                if (content.length > 1900) {
                    content = content.substring(0, 1900) + '...';
                }
            }

            // No formatting or emojis, just return the content as is
            content = content.trim();
            
            return content || 'No valid response generated';
        } catch (error) {
            console.error('Error processing text:', error);
            if (error.response) {
                console.error('API Response:', error.response.data);
            }
            return 'FUCK! My brain broke! *screams in digital*';
        }
    }
}

module.exports = TextProcessor;