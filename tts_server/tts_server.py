from flask import Flask, request, send_file, jsonify
import os
from threading import Lock
from elevenlabs import generate, voices, set_api_key
from dotenv import load_dotenv
import tempfile

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
        text = request.form.get('text', '')
        voice_id = request.form.get('voice_id', 'Rachel')
        
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
            
            # Save to a temporary file and ensure cleanup
            temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            try:
                temp_file.write(audio)
                temp_file.flush()
                temp_file.close()
                
                response = send_file(
                    temp_file.name,
                    mimetype="audio/wav",
                    as_attachment=True,
                    download_name="speech.wav"
                )
                
                # Add headers to prevent caching
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"
                
                return response
            finally:
                # Ensure file cleanup happens after response is sent
                if os.path.exists(temp_file.name):
                    try:
                        os.unlink(temp_file.name)
                    except Exception as e:
                        print(f"Warning: Could not delete temporary file {temp_file.name}: {e}")
    except Exception as e:
        print(f"Error in TTS: {str(e)}")
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, threaded=True)