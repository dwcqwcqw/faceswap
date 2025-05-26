# RunPod Serverless Face Swap Docker Image - Volume Optimized
# Based on Deep-Live-Cam project: https://github.com/hacksider/Deep-Live-Cam
# Optimized for Volume-mounted models (no download during startup)

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Set environment variables for headless operation
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive
ENV HEADLESS=1
ENV DISPLAY=

# Install system dependencies (optimized list)
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    libgomp1 \
    libgl1-mesa-glx \
    libgbm1 \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Python dependencies efficiently
COPY runpod/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install additional Deep-Live-Cam specific dependencies
RUN pip install --no-cache-dir \
    typing-extensions>=4.8.0 \
    cv2_enumerate_cameras==1.1.15 \
    psutil==5.9.8 \
    opennsfw2==0.10.2 \
    protobuf==4.23.2

# Copy application files efficiently
COPY modules/ /app/modules/
COPY locales/ /app/locales/
COPY runpod/ /app/runpod/

# Copy handler to root for easier access
COPY runpod/handler_serverless.py /app/handler.py

# Create necessary directories
RUN mkdir -p /app/models /tmp/faceswap

# Set up the handler as entry point (can be overridden by Container Start Command)
CMD ["python", "-u", "handler.py"] 