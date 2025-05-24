# RunPod Serverless Face Swap Docker Image
# Based on Deep-Live-Cam project: https://github.com/hacksider/Deep-Live-Cam

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
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
    libglib2.0-0 \
    libgthread-2.0-0 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY runpod/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install additional Deep-Live-Cam specific dependencies
RUN pip install --no-cache-dir \
    typing-extensions>=4.8.0 \
    cv2_enumerate_cameras==1.1.15 \
    psutil==5.9.8 \
    customtkinter==5.2.2 \
    opennsfw2==0.10.2 \
    protobuf==4.23.2

# Copy modules and core files
COPY modules/ /app/modules/
COPY locales/ /app/locales/
COPY runpod/handler.py /app/handler.py

# Create models directory
RUN mkdir -p /app/models

# Download required models (as per Deep-Live-Cam requirements)
RUN wget -O /app/models/inswapper_128_fp16.onnx \
    "https://huggingface.co/hacksider/deep-live-cam/resolve/main/inswapper_128_fp16.onnx"

RUN wget -O /app/models/GFPGANv1.4.pth \
    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth"

RUN wget -O /app/models/buffalo_l.zip \
    "https://huggingface.co/hacksider/deep-live-cam/resolve/main/buffalo_l.zip" \
    && cd /app/models && unzip buffalo_l.zip && rm buffalo_l.zip

# Additional face analysis models
RUN wget -O /app/models/79999_iter.pth \
    "https://huggingface.co/hacksider/deep-live-cam/resolve/main/79999_iter.pth"

# Set model permissions
RUN chmod -R 755 /app/models

# Create temp directory for processing
RUN mkdir -p /tmp/faceswap

# Set up the handler as the entry point
CMD ["python", "-u", "handler.py"] 