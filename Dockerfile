# RunPod Serverless Face Swap Docker Image
# Based on Deep-Live-Cam project: https://github.com/hacksider/Deep-Live-Cam

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Set environment variables for headless operation
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive
ENV HEADLESS=1
ENV DISPLAY=

# Install system dependencies (excluding GUI packages)
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
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch with CUDA support first (the base image should have it, but let's be explicit)
RUN pip install --no-cache-dir torch==2.0.1+cu118 torchvision==0.15.2+cu118 --index-url https://download.pytorch.org/whl/cu118

# Install Python dependencies (excluding torch since we installed it above)
COPY runpod/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install additional Deep-Live-Cam specific dependencies (excluding GUI)
RUN pip install --no-cache-dir \
    typing-extensions>=4.8.0 \
    cv2_enumerate_cameras==1.1.15 \
    psutil==5.9.8 \
    opennsfw2==0.10.2 \
    protobuf==4.23.2

# Copy modules and core files
COPY modules/ /app/modules/
COPY locales/ /app/locales/
COPY runpod/handler_serverless.py /app/handler.py

# Create directories for models and temp processing
RUN mkdir -p /app/models /tmp/faceswap

# Create model download script (will run at startup if models not found)
COPY runpod/download_models.py /app/runpod/download_models.py

# Set up the handler as the entry point
CMD ["python", "-u", "handler.py"] 