from flask import Flask, request, send_file, jsonify
import os
from threading import Lock
import json
from elevenlabs import Voice, VoiceClone, VoiceSettings, generate, voices, set_api_key
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

# Directory for storing voice references
VOICE_DIR = os.path.join(os.path.dirname(__file__), "voice_references")
os.makedirs(VOICE_DIR, exist_ok=True)

print("ElevenLabs TTS initialized successfully!")

@app.route('/tts/clone_voice', methods=['POST'])
def clone_voice():
    try:
        if 'audio' not in request.files:
            return 'No audio file provided', 400
        
        voice_id = request.form.get('voice_id', 'default')
        name = request.form.get('name', voice_id)
        audio_file = request.files['audio']
        
        # Save the reference audio temporarily
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            audio_file.save(temp_file.name)
            
            # Clone the voice using ElevenLabs
            with model_lock:
                voice = Voice.clone(
                    name=name,
                    files=[temp_file.name],
                    description="Custom cloned voice",
                    settings=VoiceSettings(stability=0.5, similarity_boost=0.75)
                )
        
        # Clean up the temporary file
        os.unlink(temp_file.name)
        
        return jsonify({
            "message": f"Voice {name} cloned successfully",
            "voice_id": voice.voice_id
        })
    except Exception as e:
        print(f"Error in voice cloning: {str(e)}")
        return str(e), 500

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
        voice_id = request.form.get('voice_id')
        
        if not text:
            return 'No text provided', 400

        # Use a lock to prevent concurrent API calls
        with model_lock:
            # Generate audio using ElevenLabs
            audio = generate(
                text=text,
                voice=voice_id if voice_id else "Rachel",
                model="eleven_monolingual_v1",
                settings=VoiceSettings(stability=0.5, similarity_boost=0.75)
            )
            
            # Save to a temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio)
                output_path = temp_file.name
            
            response = send_file(
                output_path,
                mimetype="audio/wav",
                as_attachment=True,
                download_name="speech.wav"
            )
            
            # Clean up the temporary file after sending
            os.unlink(output_path)
            
            return response
    except Exception as e:
        print(f"Error in TTS: {str(e)}")
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, threaded=True)