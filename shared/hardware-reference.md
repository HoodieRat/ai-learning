# Hardware Reference (Quick)

Use this as a shared reference you can link from any tutorial.

## CPU
- Strengths: general-purpose logic, orchestration, running tools and the OS, handling many small tasks.
- Weaknesses: slower for heavy parallel matrix math compared to GPUs.

## GPU
- Strengths: massive parallel compute, excellent for matrix-heavy workloads used in LLMs and diffusion.
- Weaknesses: limited by VRAM; can be power-hungry; setup complexity (drivers, CUDA/ROCm).

## NPU
- Strengths: efficient inference for supported operations, often low power, great for certain “edge” scenarios.
- Weaknesses: limited operator support; performance depends on model + driver + runtime compatibility.

## VRAM vs RAM
- VRAM: where model weights typically live for GPU inference; the first major limiter for local models.
- RAM: feeds the system, handles tools/files, and supports CPU inference; can become a bottleneck when context is large.

## Practical Rule of Thumb
- If your task is image generation or large LLM inference: GPU + enough VRAM is the big win.
- If your task is orchestration, automation, and tooling: CPU + RAM + fast disk matter a lot.
