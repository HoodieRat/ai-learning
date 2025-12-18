# Video sample assets

- storyboard.txt: 3-shot plan with timing and constraints
- keyframes.txt: prompts to generate/choose keyframe images
- concat.txt: use with ffmpeg concat demuxer

Example commands:
Generate clips (AnimateDiff/ComfyUI): set 512x512, 16-24 frames, 12-16 fps, reuse seed per shot, use keyframe/control for identity.
Concat:
ffmpeg -f concat -safe 0 -i assets/examples/video/concat.txt -c copy out.mp4
