from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
import torch
from transformers import VitsModel, AutoTokenizer
import soundfile as sf
import io
import numpy as np
import os

app = FastAPI()

# Initialize the model and tokenizer
model = VitsModel.from_pretrained("facebook/mms-tts-eng")
tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-eng")

@app.post("/tts/")
async def text_to_speech(text: str):
    try:
        inputs = tokenizer(text, return_tensors="pt")
        with torch.no_grad():
            output = model(**inputs).waveform

        # Convert to numpy array
        audio_data = output.numpy()[0]
        
        # Save to temporary file
        output_path = "temp_audio.wav"
        sf.write(output_path, audio_data, samplerate=16000)
        
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="speech.wav"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)