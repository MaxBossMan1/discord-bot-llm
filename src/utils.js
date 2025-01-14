const axios = require('axios');
const { bingHeaders, config, gifConfig } = require('./config');

// Function to fetch a random GIF based on keywords
async function getRandomGif(keywords) {
    try {
        // Extract emotion-related words and clean up the keywords
        const emotionKeywords = keywords.match(/\*(.*?)\*/g) || [];
        const cleanKeywords = keywords
            .replace(/[*_]/g, '') // Remove asterisks and underscores
            .replace(/<[^>]+>/g, '') // Remove Discord mentions/tags
            .split(' ')
            .filter(word => 
                word.length > 2 && 
                !word.startsWith('http') && 
                !word.includes('@')
            )
            .slice(0, 3); // Take first 3 meaningful words

        // Combine emotion keywords with clean keywords
        const processedKeywords = [
            ...emotionKeywords.map(k => k.replace(/\*/g, '').toLowerCase()),
            ...cleanKeywords
        ]
            .slice(0, 4) // Limit total keywords
            .join(' ')
            .substring(0, 50); // Limit total length

        // Skip if no valid keywords
        if (!processedKeywords.trim()) {
            console.log('[GIF] No valid keywords found, skipping GIF search');
            return null;
        }

        console.log(`[GIF] Searching with keywords: "${processedKeywords}"`);

        try {
            const response = await axios.get(`${gifConfig.endpoint}/search`, {
            params: {
                api_key: config.GIPHY_API_KEY,
                q: processedKeywords,
                limit: gifConfig.limit,
                rating: gifConfig.rating,
                lang: 'en'
            }
        });

        if (response.data.data && response.data.data.length > 0) {
            // Randomly select one GIF from the results
            const randomIndex = Math.floor(Math.random() * response.data.data.length);
            const gif = response.data.data[randomIndex];
            
            console.log(`[GIF] Found GIF: ${gif.title}`);
            return gif.images.original.url;
        }

        console.log('[GIF] No suitable GIFs found in search results');
        return null;
    } catch (error) {
        if (error.response) {
            console.error(`[GIF] API Error (${error.response.status}):`, error.response.data);
        } else if (error.request) {
            console.error('[GIF] Network Error:', error.message);
        } else {
            console.error('[GIF] Error:', error.message);
        }
        return null;
    }
} catch (error) {
    console.error('[GIF] Error processing keywords:', error.message);
    return null;
}
}

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
    bingSearch,
    getRandomGif
};