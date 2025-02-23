from flask import Flask, request, send_file, jsonify, Response
import io
from threading import Lock
from elevenlabs import generate, voices, set_api_key
from dotenv import load_dotenv
import os

app = Flask(__name__)
model_lock = Lock()

# Load environment variables
load_dotenv()
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')

if not ELEVENLABS_API_KEY:
    raise ValueError("ELEVENLABS_API_KEY environment variable is not set")

set_api_key(ELEVENLABS_API_KEY)
print("ElevenLabs TTS initialized successfully!")

@app.route('/tts/voices', methods=['GET'])
def list_voices():
    try:
        available_voices = voices()
        voice_list = [{"voice_id": v.voice_id, "name": v.name} for v in available_voices]
        return jsonify(voice_list)
    except Exception as e:
        print(f"Error listing voices: {str(e)}")
        return str(e), 500

@app.route('/tts/', methods=['POST'])
def text_to_speech():
    try:
        print("Received TTS request with form data:", dict(request.form))
        text = request.form.get('text', '')
        voice_id = request.form.get('voice_id', '9BWtsMINqrJLrRacOk9x')  # Default to 'Aria' voice
        print(f"Using text: {text}, voice_id: {voice_id}")
        
        if not text:
            return 'No text provided', 400

        # Use a lock to prevent concurrent API calls
        with model_lock:
            # Generate audio using ElevenLabs
            audio = generate(
                text=text,
                voice=voice_id,
                model="eleven_multilingual_v2"
            )
            
            # Create an in-memory bytes buffer
            audio_buffer = io.BytesIO(audio)
            audio_buffer.seek(0)
            
            return Response(
                audio_buffer,
                mimetype="audio/mpeg",
                headers={
                    "Content-Disposition": "attachment; filename=speech.mp3",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                }
            )
            
    except Exception as e:
        print(f"Error in TTS: {str(e)}")
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, threaded=True)