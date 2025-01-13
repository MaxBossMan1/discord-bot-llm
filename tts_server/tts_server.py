from flask import Flask, request, send_file, jsonify
import os
from threading import Lock
from elevenlabs import Voice, generate_and_play, generate_and_stream, generate_and_save, voices, set_api_key
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
            output_path = os.path.join(tempfile.gettempdir(), "speech.wav")
            generate_and_save(
                text=text,
                voice=voice_id,
                model="eleven_monolingual_v1",
                filename=output_path
            )
            
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