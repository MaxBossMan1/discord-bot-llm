const axios = require('axios');
const { bingHeaders, config } = require('./config');

// Simple token counter (approximation)
function countTokens(text) {
    if (!text) return 0;
    const str = String(text);
    return Math.ceil(str.length / 4);
}

// Function to replace user mentions with usernames
async function replaceUserMentions(text, message) {
    if (!text) return text;
    
    return text.replace(/<@!?(\d+)>/g, (match, id) => {
        try {
            const member = message.guild.members.cache.get(id);
            return member ? `@${member.displayName}` : match;
        } catch (error) {
            console.error('Error getting username:', error);
            return match;
        }
    });
}

// Bing search function
async function bingSearch(query) {
    try {
        const response = await axios.get(config.BING_ENDPOINT, {
            headers: bingHeaders,
            params: {
                q: query,
                count: 5,
                responseFilter: 'Webpages,News',
                textFormat: 'HTML'
            }
        });

        const results = response.data.webPages?.value || [];
        if (results.length === 0) {
            return {
                success: false,
                message: "Sorry, I couldn't find any results for that query."
            };
        }

        // Format the results for AI processing
        const formattedResults = results.map((result, index) => {
            return {
                title: result.name,
                snippet: result.snippet,
                url: result.url
            };
        });

        return {
            success: true,
            results: formattedResults,
            rawResults: results
        };
    } catch (error) {
        console.error('Bing search error:', error);
        return {
            success: false,
            message: "Sorry, I couldn't perform the search right now. Make sure the Bing API key is configured correctly.",
            error: error
        };
    }
}

module.exports = {
    countTokens,
    replaceUserMentions,
    bingSearch
};