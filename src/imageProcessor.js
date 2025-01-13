const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('./config');

class ImageProcessor {
    constructor(textProcessor) {
        this.textProcessor = textProcessor;
    }

    async processImage(attachment, prompt, userId, message) {
        try {
            let imageDescription;
            try {
                // Create temp directory if it doesn't exist
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir);
                }

                // Generate a random filename with extension from URL
                const fileExt = attachment.url.split('.').pop().split('?')[0];
                const tempFile = path.join(tempDir, `${crypto.randomBytes(16).toString('hex')}.${fileExt}`);
                
                console.log('Downloading attachment to:', tempFile);
                
                try {
                    // Download the attachment using axios
                    const response = await axios({
                        method: 'get',
                        url: attachment.url,
                        responseType: 'arraybuffer',
                        timeout: 5000
                    });
                    
                    // Save the file
                    fs.writeFileSync(tempFile, response.data);
                    
                    // Read the file and convert to base64
                    const imageBuffer = fs.readFileSync(tempFile);
                    const base64Image = imageBuffer.toString('base64');
                    
                    // Clean up the temp file
                    fs.unlinkSync(tempFile);

                    console.log('Successfully processed image, sending to vision API...');
                    
                    const visionResponse = await axios.post(`${config.MSTY_API_URL}/v1/chat/completions`, {
                        model: 'llava-phi3',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:${attachment.contentType};base64,${base64Image}`
                                        }
                                    },
                                    {
                                        type: 'text',
                                        text: 'Describe this image in detail, focusing on what you see.'
                                    }
                                ]
                            }
                        ],
                        max_tokens: 1000,
                        temperature: 0.7,
                        presence_penalty: 0.6,
                        frequency_penalty: 0.6
                    });
                    
                    imageDescription = visionResponse.data?.choices?.[0]?.message?.content;
                    
                } catch (error) {
                    console.error('Error processing image file:', error);
                    if (error.code === 'ECONNABORTED') {
                        throw new Error('download_timeout');
                    } else if (error.response?.status === 404) {
                        throw new Error('download_not_found');
                    } else {
                        throw new Error('download_failed');
                    }
                } finally {
                    // Clean up temp file if it exists
                    if (fs.existsSync(tempFile)) {
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {
                            console.error('Error cleaning up temp file:', e);
                        }
                    }
                }
            } catch (error) {
                console.error('Vision API error:', error.response?.data || error.message);
                // If vision API fails, provide more specific error message based on the error type
                if (error.message === 'download_timeout') {
                    imageDescription = "FUCK! The image download timed out. Discord's being slower than my grandma's dial-up! *smashes virtual router*";
                } else if (error.message === 'download_not_found') {
                    imageDescription = "The fuck? The image disappeared! Did Discord eat it or something? *searches through digital trash*";
                } else if (error.message === 'download_failed') {
                    imageDescription = "SHIT! I couldn't download the image. Discord's being a little bitch right now. *kicks server repeatedly*";
                } else if (error.message.includes('content type')) {
                    imageDescription = "Hold up! That doesn't look like an image to me. Are you trying to trick me? *suspicious glare*";
                } else {
                    imageDescription = "I see an image, but I'm having trouble processing it right now. My vision circuits are a bit fuzzy. *rubs digital eyes*";
                }
            }

            // Then, feed the description to the main model along with the original prompt
            return await this.textProcessor.processText(
                `I'm looking at an image. Here's what I see: ${imageDescription}\n\n${prompt || 'What do you think about this?'}`,
                userId,
                message
            );
        } catch (error) {
            console.error('Error processing image:', error);
            return 'HOLY SHIT! The image broke my eyes! *digital seizure*';
        }
    }
}

module.exports = ImageProcessor;