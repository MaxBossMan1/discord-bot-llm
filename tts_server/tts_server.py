from flask import Flask, request, send_file, jsonify
import time
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
            
            # Save to a temporary file and ensure cleanup
            temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            
            temp_file_path = os.path.join(temp_dir, f'speech_{int(time.time()*1000)}.wav')
            try:
                with open(temp_file_path, 'wb') as f:
                    f.write(audio)
                
                print(f"Audio file saved to: {temp_file_path}")
                if not os.path.exists(temp_file_path):
                    print("Error: File was not created!")
                    return "Failed to create audio file", 500
                
                response = send_file(
                    temp_file_path,
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
                if os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except Exception as e:
                        print(f"Warning: Could not delete temporary file {temp_file_path}: {e}")
    except Exception as e:
        print(f"Error in TTS: {str(e)}")
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, threaded=True)