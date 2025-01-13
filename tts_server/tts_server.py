from flask import Flask, request, send_file
import torch
from transformers import VitsModel, AutoTokenizer
import soundfile as sf
import os
from threading import Lock

app = Flask(__name__)
model_lock = Lock()

print("Loading TTS model...")
model = VitsModel.from_pretrained("facebook/mms-tts-eng")
tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-eng")
print("TTS model loaded successfully!")

@app.route('/tts/', methods=['POST'])
def text_to_speech():
    try:
        text = request.form.get('text', '')
        if not text:
            return 'No text provided', 400

        # Use a lock to prevent concurrent model inference
        with model_lock:
            inputs = tokenizer(text, return_tensors="pt")
            with torch.no_grad():
                output = model(**inputs).waveform

            # Convert to numpy array
            audio_data = output.numpy()[0]
            
            # Save to temporary file
            output_path = os.path.join(os.path.dirname(__file__), "temp_audio.wav")
            sf.write(output_path, audio_data, samplerate=16000)
            
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