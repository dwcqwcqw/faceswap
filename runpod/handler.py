import runpod
import os
import tempfile
import uuid
from urllib.parse import urlparse
import requests
import boto3
from botocore.config import Config

# Initialize models before importing modules
print("🚀 Initializing Face Swap Handler...")

# Download models if needed
try:
    from download_models import check_and_download_models
    models_dir = check_and_download_models()
    print(f"✅ Models initialized in: {models_dir}")
    
    # Set environment variable for global module access
    os.environ['MODELS_DIR'] = models_dir
    
except Exception as e:
    print(f"⚠️  Model initialization error: {str(e)}")
    print("📦 Proceeding with default model paths...")

from modules.face_swapper import swap_face
from modules.face_enhancer import enhance_faces
from modules.face_detector import detect_faces
from modules.globals import get_model_path
import cv2

# R2 Configuration
CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID', 'c7c141ce43d175e60601edc46d904553')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID', '5885b29961ce9fc2b593139d9de52f81')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY', 'a4415c670e669229db451ea7b38544c0a2e44dbe630f1f35f99f28a27593d181')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'faceswap-storage')

# Initialize R2 client
def get_r2_client():
    """Initialize Cloudflare R2 client with S3 compatibility"""
    return boto3.client(
        's3',
        endpoint_url=f'https://{CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(
            signature_version='s3v4',
            s3={
                'addressing_style': 'path'
            }
        ),
        region_name='auto'
    )

def download_from_url(url, local_path):
    """Download file from URL to local path"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True
    except Exception as e:
        print(f"Error downloading from {url}: {str(e)}")
        return False

def upload_to_r2(local_path, r2_key):
    """Upload file to Cloudflare R2"""
    try:
        r2_client = get_r2_client()
        
        with open(local_path, 'rb') as f:
            r2_client.upload_fileobj(
                f, 
                R2_BUCKET_NAME, 
                r2_key,
                ExtraArgs={
                    'Metadata': {
                        'upload_time': str(int(os.path.getmtime(local_path))),
                        'content_type': get_content_type(local_path)
                    }
                }
            )
        
        # Generate public URL
        result_url = f"https://{R2_BUCKET_NAME}.{CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/{r2_key}"
        return result_url
        
    except Exception as e:
        print(f"Error uploading to R2: {str(e)}")
        return None

def get_content_type(file_path):
    """Get content type based on file extension"""
    ext = os.path.splitext(file_path)[1].lower()
    content_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime'
    }
    return content_types.get(ext, 'application/octet-stream')

def process_single_image_swap(input_data):
    """Process single person image face swap"""
    try:
        print("🎯 Processing single person image face swap...")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Download source and target images
        source_url = input_data.get('source_file')
        target_url = input_data.get('target_file')
        
        source_path = os.path.join(temp_dir, 'source.jpg')
        target_path = os.path.join(temp_dir, 'target.jpg')
        
        print(f"📥 Downloading source: {source_url}")
        if not download_from_url(source_url, source_path):
            raise Exception("❌ Failed to download source image")
        
        print(f"📥 Downloading target: {target_url}")
        if not download_from_url(target_url, target_path):
            raise Exception("❌ Failed to download target image")
        
        # Process face swap
        options = input_data.get('options', {})
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.jpg')
        
        # High quality settings - Always enable face enhancement for better results
        frame_processors = ['face_swapper', 'face_enhancer']
        enhance_quality = True
        
        # Load images
        print("📂 Loading images...")
        source_image = cv2.imread(source_path)
        target_image = cv2.imread(target_path)
        
        if source_image is None or target_image is None:
            raise Exception("❌ Failed to load images")
        
        print(f"✅ Images loaded - Source: {source_image.shape}, Target: {target_image.shape}")
        
        # Detect faces
        print("🔍 Detecting faces...")
        from modules.face_analyser import get_one_face
        
        source_face = get_one_face(source_image)
        if source_face is None:
            raise Exception("❌ No face detected in source image")
        print("✅ Source face detected")
        
        target_face = get_one_face(target_image)
        if target_face is None:
            raise Exception("❌ No face detected in target image")
        print("✅ Target face detected")
        
        # Swap faces with correct parameters
        print("🔄 Starting face swap...")
        result_image = swap_face(
            source_face=source_face,
            target_face=target_face,
            temp_frame=target_image
        )
        print("✅ Face swap completed")
        
        # Always enhance faces for better quality
        print("✨ Enhancing faces for better quality...")
        result_image = enhance_faces(
            image=result_image,
            model_path=get_model_path('GFPGANv1.4.pth')
        )
        print("✅ Face enhancement completed")
        
        # 🔍 Check if image needs super-resolution (low resolution images)
        height, width = result_image.shape[:2]
        total_pixels = height * width
        print(f"📏 Image resolution: {width}x{height} ({total_pixels:,} pixels)")
        
        # If image is low resolution (less than 0.5MP), apply super-resolution
        if total_pixels < 500000:  # 500K pixels threshold
            try:
                print("🔧 Applying super-resolution for low resolution image...")
                # Use OpenCV for simple bicubic upscaling (more reliable than external models)
                scale_factor = 2
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                result_image = cv2.resize(result_image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
                print(f"✅ Super-resolution completed: {new_width}x{new_height}")
            except Exception as e:
                print(f"⚠️ Super-resolution failed, continuing: {str(e)}")
                # Continue without super-resolution if it fails
        
        # Save result and convert to base64
        print("💾 Saving result...")
        cv2.imwrite(output_path, result_image)
        
        # Convert result to base64 for direct return
        print("📸 Converting result to base64...")
        with open(output_path, 'rb') as f:
            import base64
            result_data = base64.b64encode(f.read()).decode('utf-8')
            # Add proper data URL prefix for JPEG images
            result_data = f"data:image/jpeg;base64,{result_data}"
        
        # Upload result to R2 (for backup storage)
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/single_image_{job_id}_{uuid.uuid4()}.jpg"
        print(f"☁️ Uploading to R2: {r2_key}")
        result_url = upload_to_r2(output_path, r2_key)
        
        if result_url:
            print(f"✅ Backup upload successful: {result_url}")
        else:
            print("⚠️ Backup upload failed, but continuing with base64 result")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        print("🧹 Cleanup completed")
        
        return {
            'success': True,
            'result': result_data,  # Return base64 data directly
            'process_type': 'single-image'
        }
        
    except Exception as e:
        print(f"❌ Error in single image processing: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def process_multi_image_swap(input_data):
    """Process multi-person image face swap"""
    try:
        print("👥 Processing multi-person image face swap...")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Check if we have face_mappings (new multi-face approach) or single source (legacy)
        face_mappings = input_data.get('face_mappings', {})
        source_url = input_data.get('source_file')
        target_url = input_data.get('target_file')
        
        if not target_url:
            raise Exception("❌ Target file URL is required")
        
        # Download target image
        target_path = os.path.join(temp_dir, 'target.jpg')
        print(f"📥 Downloading target: {target_url}")
        if not download_from_url(target_url, target_path):
            raise Exception("❌ Failed to download target image")
        
        # Handle different input modes
        if face_mappings:
            print(f"🔄 Using face mappings mode with {len(face_mappings)} face(s)")
            # Download all source face images
            source_faces = {}
            for face_id, face_url in face_mappings.items():
                if face_url:
                    face_path = os.path.join(temp_dir, f'source_{face_id}.jpg')
                    print(f"📥 Downloading source face {face_id}: {face_url}")
                    if download_from_url(face_url, face_path):
                        source_faces[face_id] = face_path
                    else:
                        print(f"⚠️ Failed to download source face {face_id}, skipping")
        else:
            print("🔄 Using legacy single source mode")
            # Legacy mode: single source image for all faces
            if not source_url:
                raise Exception("❌ Source file URL is required in legacy mode")
                
            source_path = os.path.join(temp_dir, 'source.jpg')
            print(f"📥 Downloading source: {source_url}")
            if not download_from_url(source_url, source_path):
                raise Exception("❌ Failed to download source image")
        
        # Process face swap with multiple faces
        options = input_data.get('options', {})
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.jpg')
        
        # High quality settings
        frame_processors = ['face_swapper', 'face_enhancer']
        
        # Load target image
        print("📂 Loading target image...")
        target_image = cv2.imread(target_path)
        if target_image is None:
            raise Exception("❌ Failed to load target image")
        print(f"✅ Target image loaded: {target_image.shape}")
        
        # Detect target faces
        print("🔍 Detecting target faces...")
        from modules.face_analyser import get_one_face, get_many_faces
        
        target_faces = get_many_faces(target_image)
        if not target_faces or len(target_faces) == 0:
            # Try single face detection as fallback
            single_face = get_one_face(target_image)
            if single_face is not None:
                target_faces = [single_face]
                print("✅ 1 target face detected (fallback to single face detection)")
            else:
                raise Exception("❌ No faces detected in target image")
        else:
            print(f"✅ {len(target_faces)} target face(s) detected")
        
        # Process face swapping
        print("🔄 Starting multi-face swap...")
        result_image = target_image.copy()
        
        if face_mappings:
            # New mode: specific source face for each detected face
            for i, target_face in enumerate(target_faces):
                face_key = f"face_{i}"
                if face_key in source_faces:
                    source_path = source_faces[face_key]
                    source_image = cv2.imread(source_path)
                    if source_image is not None:
                        source_face = get_one_face(source_image)
                        if source_face is not None:
                            print(f"   🔄 Swapping face {i+1}/{len(target_faces)} with specific source...")
                            result_image = swap_face(
                                source_face=source_face,
                                target_face=target_face,
                                temp_frame=result_image
                            )
                            print(f"   ✅ Face {i+1} swap completed")
                        else:
                            print(f"   ⚠️ No face detected in source image for face {i+1}, skipping")
                    else:
                        print(f"   ⚠️ Failed to load source image for face {i+1}, skipping")
                else:
                    print(f"   ⚠️ No source mapping for face {i+1}, skipping")
        else:
            # Legacy mode: use single source for all faces
            source_image = cv2.imread(source_path)
            if source_image is None:
                raise Exception("❌ Failed to load source image")
            
            source_face = get_one_face(source_image)
            if source_face is None:
                raise Exception("❌ No face detected in source image")
            print("✅ Source face detected")
            
            for i, target_face in enumerate(target_faces):
                print(f"   🔄 Swapping face {i+1}/{len(target_faces)}...")
                result_image = swap_face(
                    source_face=source_face,
                    target_face=target_face,
                    temp_frame=result_image
                )
                print(f"   ✅ Face {i+1} swap completed")
        
        print("✅ All face swaps completed")
        
        # Always enhance faces for better quality
        print("✨ Enhancing faces for better quality...")
        result_image = enhance_faces(
            image=result_image,
            model_path=get_model_path('GFPGANv1.4.pth')
        )
        print("✅ Face enhancement completed")
        
        # 🔍 Check if image needs super-resolution (low resolution images)
        height, width = result_image.shape[:2]
        total_pixels = height * width
        print(f"📏 Image resolution: {width}x{height} ({total_pixels:,} pixels)")
        
        # If image is low resolution (less than 0.5MP), apply super-resolution
        if total_pixels < 500000:  # 500K pixels threshold
            try:
                print("🔧 Applying super-resolution for low resolution image...")
                # Use OpenCV for simple bicubic upscaling (more reliable than external models)
                scale_factor = 2
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                result_image = cv2.resize(result_image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
                print(f"✅ Super-resolution completed: {new_width}x{new_height}")
            except Exception as e:
                print(f"⚠️ Super-resolution failed, continuing: {str(e)}")
                # Continue without super-resolution if it fails
        
        # Save result and convert to base64
        print("💾 Saving result...")
        cv2.imwrite(output_path, result_image)
        
        # Convert result to base64 for direct return
        print("📸 Converting result to base64...")
        with open(output_path, 'rb') as f:
            import base64
            result_data = base64.b64encode(f.read()).decode('utf-8')
            # Add proper data URL prefix for JPEG images
            result_data = f"data:image/jpeg;base64,{result_data}"
        
        # Upload result to R2 (for backup storage)
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/multi_image_{job_id}_{uuid.uuid4()}.jpg"
        print(f"☁️ Uploading to R2: {r2_key}")
        result_url = upload_to_r2(output_path, r2_key)
        
        if result_url:
            print(f"✅ Backup upload successful: {result_url}")
        else:
            print("⚠️ Backup upload failed, but continuing with base64 result")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        print("🧹 Cleanup completed")
        
        return {
            'success': True,
            'result': result_data,  # Return base64 data directly
            'process_type': 'multi-image'
        }
        
    except Exception as e:
        print(f"❌ Error in multi-image processing: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def process_single_video_swap(input_data):
    """Process single person video face swap"""
    try:
        print("🎬 Processing single person video face swap...")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Download source image and target video
        source_url = input_data.get('source_file')
        target_url = input_data.get('target_file')
        
        source_path = os.path.join(temp_dir, 'source.jpg')
        target_path = os.path.join(temp_dir, 'target.mp4')
        
        print(f"📥 Downloading source: {source_url}")
        if not download_from_url(source_url, source_path):
            raise Exception("❌ Failed to download source image")
        
        print(f"📥 Downloading target: {target_url}")
        if not download_from_url(target_url, target_path):
            raise Exception("❌ Failed to download target video")
        
        # Process video face swap
        options = input_data.get('options', {})
        temp_video_path = os.path.join(temp_dir, f'temp_video_{uuid.uuid4()}.mp4')
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.mp4')
        
        # High quality video settings - Optimized for best quality
        video_settings = {
            'frame_processors': ['face_swapper', 'face_enhancer'],
            'mouth_mask': True,
            'video_quality': 15,  # Lower value = higher quality (15 is very high quality)
            'video_encoder': 'libx264',
            'keep_fps': True,
            'keep_audio': True,
            'enhance_every_frame': True  # Enable enhancement for every frame
        }
        
        # Load source image and detect face
        print("📂 Loading source image...")
        source_image = cv2.imread(source_path)
        if source_image is None:
            raise Exception("❌ Failed to load source image")
        
        print("🔍 Detecting source face...")
        from modules.face_analyser import get_one_face
        source_face = get_one_face(source_image)
        if source_face is None:
            raise Exception("❌ No face detected in source image")
        print("✅ Source face detected")
        
        # Process video frame by frame
        print("🎬 Opening target video...")
        cap = cv2.VideoCapture(target_path)
        if not cap.isOpened():
            raise Exception("❌ Failed to open target video")
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"📹 Video info: {width}x{height}, {fps} FPS, {total_frames} frames")
        
        # Set up video writer (write to temp file first, without audio)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_video_path, fourcc, fps, (width, height))
        
        frame_count = 0
        success_count = 0
        
        print("🔄 Starting frame-by-frame processing...")
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            try:
                # Detect face in current frame
                target_face = get_one_face(frame)
                
                if target_face is not None:
                    # Swap face in current frame
                    result_frame = swap_face(
                        source_face=source_face,
                        target_face=target_face,
                        temp_frame=frame
                    )
                    
                    # Always enhance faces for better quality
                    result_frame = enhance_faces(
                        image=result_frame,
                        model_path=get_model_path('GFPGANv1.4.pth')
                    )
                    
                    out.write(result_frame)
                    success_count += 1
                else:
                    # No face detected, write original frame
                    out.write(frame)
                
            except Exception as e:
                print(f"⚠️ Error processing frame {frame_count}: {e}")
                # Write original frame on error
                out.write(frame)
            
            frame_count += 1
            
            if frame_count % 30 == 0:
                progress = (frame_count / total_frames) * 100 if total_frames > 0 else 0
                print(f"📹 Progress: {frame_count}/{total_frames} frames ({progress:.1f}%), {success_count} faces swapped")
        
        cap.release()
        out.release()
        
        print(f"✅ Video processing completed: {frame_count} frames, {success_count} successful swaps")
        
        # 🎵 Merge audio from original video using FFmpeg
        print("🎵 Merging audio from original video...")
        try:
            import subprocess
            ffmpeg_cmd = [
                'ffmpeg', '-y',  # -y to overwrite output file
                '-i', temp_video_path,  # processed video (no audio)
                '-i', target_path,      # original video (with audio)
                '-c:v', 'copy',         # copy video stream
                '-c:a', 'aac',          # encode audio to AAC
                '-map', '0:v:0',        # use video from first input
                '-map', '1:a:0',        # use audio from second input
                '-shortest',            # finish when shortest stream ends
                output_path
            ]
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                print("✅ Audio merge successful")
            else:
                print(f"⚠️ Audio merge failed: {result.stderr}")
                print("📹 Using video without audio as fallback")
                # Copy temp video to output if FFmpeg fails
                import shutil
                shutil.copy2(temp_video_path, output_path)
                
        except Exception as e:
            print(f"⚠️ Audio merge error: {str(e)}")
            print("📹 Using video without audio as fallback")
            # Copy temp video to output if FFmpeg fails
            import shutil
            shutil.copy2(temp_video_path, output_path)
        
        # Convert result to base64 for direct return
        print("📸 Converting video result to base64...")
        with open(output_path, 'rb') as f:
            import base64
            result_data = base64.b64encode(f.read()).decode('utf-8')
            # Add proper data URL prefix for MP4 videos
            result_data = f"data:video/mp4;base64,{result_data}"
        
        # Upload result to R2 (for backup storage)
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/single_video_{job_id}_{uuid.uuid4()}.mp4"
        print(f"☁️ Uploading to R2: {r2_key}")
        result_url = upload_to_r2(output_path, r2_key)
        
        if result_url:
            print(f"✅ Backup upload successful: {result_url}")
        else:
            print("⚠️ Backup upload failed, but continuing with base64 result")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        print("🧹 Cleanup completed")
        
        return {
            'success': True,
            'result': result_data,  # Return base64 data directly
            'process_type': 'single-video',
            'frames_processed': frame_count,
            'successful_swaps': success_count
        }
        
    except Exception as e:
        print(f"❌ Error in single video processing: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def process_multi_video_swap(input_data):
    """Process multi-person video face swap"""
    try:
        print("🎬👥 Processing multi-person video face swap...")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Download source image and target video
        source_url = input_data.get('source_file')
        target_url = input_data.get('target_file')
        
        source_path = os.path.join(temp_dir, 'source.jpg')
        target_path = os.path.join(temp_dir, 'target.mp4')
        
        if not download_from_url(source_url, source_path):
            raise Exception("Failed to download source image")
        
        if not download_from_url(target_url, target_path):
            raise Exception("Failed to download target video")
        
        # Process video face swap with multiple faces
        options = input_data.get('options', {})
        temp_video_path = os.path.join(temp_dir, f'temp_video_{uuid.uuid4()}.mp4')
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.mp4')
        
        # High quality video settings - Optimized for best quality
        video_settings = {
            'frame_processors': ['face_swapper', 'face_enhancer'],
            'mouth_mask': True,
            'video_quality': 15,  # Lower value = higher quality (15 is very high quality)
            'video_encoder': 'libx264',
            'keep_fps': True,
            'keep_audio': True,
            'enhance_every_frame': True  # Enable enhancement for every frame
        }
        
        # Load source image
        source_image = cv2.imread(source_path)
        if source_image is None:
            raise Exception("Failed to load source image")
        
        # Process video frame by frame
        cap = cv2.VideoCapture(target_path)
        if not cap.isOpened():
            raise Exception("Failed to open target video")
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Set up video writer (write to temp file first, without audio)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_video_path, fourcc, fps, (width, height))
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Get faces and swap all faces in current frame
            from modules.face_analyser import get_one_face, get_many_faces
            source_face = get_one_face(source_image)
            target_faces = get_many_faces(frame)
            
            result_frame = frame.copy()
            
            if source_face is not None and target_faces:
                for target_face in target_faces:
                    result_frame = swap_face(
                        source_face=source_face,
                        target_face=target_face,
                        temp_frame=result_frame
                    )
            else:
                # No faces detected, keep original frame
                result_frame = frame
            
            # Always enhance faces for better quality
            result_frame = enhance_faces(
                image=result_frame,
                model_path=get_model_path('GFPGANv1.4.pth')
            )
            
            out.write(result_frame)
            frame_count += 1
            
            if frame_count % 30 == 0:
                print(f"Processed {frame_count} frames...")
        
        cap.release()
        out.release()
        
        print(f"✅ Multi-video processing completed: {frame_count} frames processed")
        
        # 🎵 Merge audio from original video using FFmpeg
        print("🎵 Merging audio from original video...")
        try:
            import subprocess
            ffmpeg_cmd = [
                'ffmpeg', '-y',  # -y to overwrite output file
                '-i', temp_video_path,  # processed video (no audio)
                '-i', target_path,      # original video (with audio)
                '-c:v', 'copy',         # copy video stream
                '-c:a', 'aac',          # encode audio to AAC
                '-map', '0:v:0',        # use video from first input
                '-map', '1:a:0',        # use audio from second input
                '-shortest',            # finish when shortest stream ends
                output_path
            ]
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                print("✅ Audio merge successful")
            else:
                print(f"⚠️ Audio merge failed: {result.stderr}")
                print("📹 Using video without audio as fallback")
                # Copy temp video to output if FFmpeg fails
                import shutil
                shutil.copy2(temp_video_path, output_path)
                
        except Exception as e:
            print(f"⚠️ Audio merge error: {str(e)}")
            print("📹 Using video without audio as fallback")
            # Copy temp video to output if FFmpeg fails
            import shutil
            shutil.copy2(temp_video_path, output_path)
        
        # Convert result to base64 for direct return
        print("📸 Converting video result to base64...")
        with open(output_path, 'rb') as f:
            import base64
            result_data = base64.b64encode(f.read()).decode('utf-8')
            # Add proper data URL prefix for MP4 videos
            result_data = f"data:video/mp4;base64,{result_data}"
        
        # Upload result to R2 (for backup storage)
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/multi_video_{job_id}_{uuid.uuid4()}.mp4"
        result_url = upload_to_r2(output_path, r2_key)
        
        if result_url:
            print(f"✅ Backup upload successful: {result_url}")
        else:
            print("⚠️ Backup upload failed, but continuing with base64 result")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        
        return {
            'success': True,
            'result': result_data,  # Return base64 data directly
            'process_type': 'multi-video',
            'frames_processed': frame_count
        }
        
    except Exception as e:
        print(f"Error in multi-video processing: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def process_detect_faces(input_data):
    """Detect faces in image or video"""
    try:
        print("🔍 Detecting faces...")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Download file
        file_url = input_data.get('image_file')
        print(f"📥 Downloading file from: {file_url}")
        
        # Try to determine file type from URL or download it to check
        temp_file_path = os.path.join(temp_dir, 'temp_file')
        
        if not download_from_url(file_url, temp_file_path):
            raise Exception("Failed to download file")
        
        # Check if it's a video file by trying to open with OpenCV VideoCapture
        cap = cv2.VideoCapture(temp_file_path)
        is_video = cap.isOpened() and cap.get(cv2.CAP_PROP_FRAME_COUNT) > 0
        
        if is_video:
            print("📹 Detected video file, extracting first frame for face detection")
            
            # Read first frame
            ret, frame = cap.read()
            cap.release()
            
            if not ret or frame is None:
                raise Exception("Failed to extract frame from video")
            
            # Use the first frame for face detection
            image = frame
            print(f"✅ Extracted first frame: {image.shape}")
            
        else:
            print("🖼️ Detected image file")
            # Try to load as image
            image_path = os.path.join(temp_dir, 'image.jpg')
            
            # Copy and rename file with proper extension
            import shutil
            shutil.copy2(temp_file_path, image_path)
            
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                raise Exception("Failed to load image")
            
            print(f"✅ Loaded image: {image.shape}")
        
        # Detect faces
        print("🔍 Starting face detection...")
        faces = detect_faces(image)
        print(f"✅ Face detection completed, found {len(faces)} faces")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        
        return {
            'success': True,
            'faces_detected': len(faces),
            'file_type': 'video' if is_video else 'image',
            'faces': [
                {
                    'bbox': face['bbox'],
                    'confidence': face['confidence'],
                    'landmarks': face.get('landmarks', []),
                    'x': face['bbox'][0] if 'bbox' in face else 0,
                    'y': face['bbox'][1] if 'bbox' in face else 0,
                    'width': face['bbox'][2] if 'bbox' in face else 0,
                    'height': face['bbox'][3] if 'bbox' in face else 0
                }
                for face in faces
            ]
        }
        
    except Exception as e:
        print(f"❌ Error in face detection: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def handler(job):
    """Main handler function for RunPod"""
    try:
        job_input = job["input"]
        process_type = job_input.get("process_type")
        
        print(f"Processing job with type: {process_type}")
        
        if process_type == "single-image":
            return process_single_image_swap(job_input)
        elif process_type == "multi-image" or process_type == "multi_image":
            return process_multi_image_swap(job_input)
        elif process_type == "single-video":
            return process_single_video_swap(job_input)
        elif process_type == "multi-video" or process_type == "multi_video":
            return process_multi_video_swap(job_input)
        elif process_type == "detect_faces":
            return process_detect_faces(job_input)
        else:
            return {
                'success': False,
                'error': f'Unknown process type: {process_type}'
            }
            
    except Exception as e:
        print(f"Handler error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler}) 