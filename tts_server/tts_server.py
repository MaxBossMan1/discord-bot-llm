from flask import Flask, request, send_file, jsonify
import torch
from TTS.api import TTS
import os
from threading import Lock
import json

app = Flask(__name__)
model_lock = Lock()

# Directory for storing voice references
VOICE_DIR = os.path.join(os.path.dirname(__file__), "voice_references")
os.makedirs(VOICE_DIR, exist_ok=True)

print("Loading TTS model...")
tts = TTS(model_name="tts_models/multilingual/multi-dataset/your_tts", progress_bar=False)
print("TTS model loaded successfully!")

# Store voice embeddings
voice_embeddings = {}

@app.route('/tts/clone_voice', methods=['POST'])
def clone_voice():
    try:
        if 'audio' not in request.files:
            return 'No audio file provided', 400
        
        voice_id = request.form.get('voice_id', 'default')
        audio_file = request.files['audio']
        
        # Save the reference audio
        ref_path = os.path.join(VOICE_DIR, f"{voice_id}_ref.wav")
        audio_file.save(ref_path)
        
        # Generate and save speaker embedding
        with model_lock:
            speaker_embedding = tts.synthesizer.tts_model.speaker_manager.compute_embedding_from_clip(ref_path)
            voice_embeddings[voice_id] = speaker_embedding
        
        return jsonify({"message": f"Voice {voice_id} cloned successfully"})
    except Exception as e:
        print(f"Error in voice cloning: {str(e)}")
        return str(e), 500

@app.route('/tts/voices', methods=['GET'])
def list_voices():
    return jsonify(list(voice_embeddings.keys()))

@app.route('/tts/', methods=['POST'])
def text_to_speech():
    try:
        text = request.form.get('text', '')
        voice_id = request.form.get('voice_id', 'default')
        
        if not text:
            return 'No text provided', 400

        # Use a lock to prevent concurrent model inference
        with model_lock:
            speaker_embedding = voice_embeddings.get(voice_id)
            
            output_path = os.path.join(os.path.dirname(__file__), "temp_audio.wav")
            
            if speaker_embedding is not None:
                # Use cloned voice
                tts.tts_to_file(
                    text=text,
                    file_path=output_path,
                    speaker_wav=os.path.join(VOICE_DIR, f"{voice_id}_ref.wav"),
                    language="en"
                )
            else:
                # Use default voice
                tts.tts_to_file(
                    text=text,
                    file_path=output_path,
                    speaker_wav=None,
                    language="en"
                )
            
            return send_file(
                output_path,
                mimetype="audio/wav",
                as_attachment=True,
                download_name="speech.wav"
            )
    except Exception as e:
        print(f"Error in TTS: {str(e)}")
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, threaded=True)