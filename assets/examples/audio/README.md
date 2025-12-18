# Audio sample instructions

No audio files included. Use any 60–90s mono 16 kHz WAV.
Suggested commands:
1) Downmix: ffmpeg -i input.mp3 -ar 16000 -ac 1 sample.wav
2) STT: python -m faster_whisper.transcribe sample.wav --model medium --beam-size 5 --vad-filter
3) TTS (XTTS): tts --text "Please exit via the nearest marked door. Do not use elevators." --model_name tts_models/multilingual/multi-dataset/xtts_v2 --out_path out/announcement.wav
