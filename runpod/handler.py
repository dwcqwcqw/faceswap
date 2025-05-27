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
        
        # High quality settings
        frame_processors = ['face_swapper', 'face_enhancer']
        
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
        
        # Enhance faces if requested
        if 'face_enhancer' in frame_processors:
            print("✨ Enhancing faces...")
            result_image = enhance_faces(
                image=result_image,
                model_path=get_model_path('GFPGANv1.4.pth')
            )
            print("✅ Face enhancement completed")
        
        # Save result
        print("💾 Saving result...")
        cv2.imwrite(output_path, result_image)
        
        # Upload result to R2
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/single_image_{job_id}_{uuid.uuid4()}.jpg"
        print(f"☁️ Uploading to R2: {r2_key}")
        result_url = upload_to_r2(output_path, r2_key)
        
        if not result_url:
            raise Exception("❌ Failed to upload result to R2")
        
        print(f"✅ Upload successful: {result_url}")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        print("🧹 Cleanup completed")
        
        return {
            'success': True,
            'result_url': result_url,
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
        
        # Process face swap with multiple faces
        options = input_data.get('options', {})
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.jpg')
        
        # High quality settings
        frame_processors = ['face_swapper', 'face_enhancer']
        
        # Load images
        print("📂 Loading images...")
        source_image = cv2.imread(source_path)
        target_image = cv2.imread(target_path)
        
        if source_image is None or target_image is None:
            raise Exception("❌ Failed to load images")
        
        print(f"✅ Images loaded - Source: {source_image.shape}, Target: {target_image.shape}")
        
        # Detect faces
        print("🔍 Detecting faces...")
        from modules.face_analyser import get_one_face, get_many_faces
        
        source_face = get_one_face(source_image)
        if source_face is None:
            raise Exception("❌ No face detected in source image")
        print("✅ Source face detected")
        
        target_faces = get_many_faces(target_image)
        if not target_faces or len(target_faces) == 0:
            raise Exception("❌ No faces detected in target image")
        print(f"✅ {len(target_faces)} target face(s) detected")
        
        # Swap all faces
        print("🔄 Starting multi-face swap...")
        result_image = target_image.copy()
        
        for i, target_face in enumerate(target_faces):
            print(f"   🔄 Swapping face {i+1}/{len(target_faces)}...")
            result_image = swap_face(
                source_face=source_face,
                target_face=target_face,
                temp_frame=result_image
            )
            print(f"   ✅ Face {i+1} swap completed")
        
        print("✅ All face swaps completed")
        
        # Enhance faces if requested
        if 'face_enhancer' in frame_processors:
            print("✨ Enhancing faces...")
            result_image = enhance_faces(
                image=result_image,
                model_path=get_model_path('GFPGANv1.4.pth')
            )
            print("✅ Face enhancement completed")
        
        # Save result
        print("💾 Saving result...")
        cv2.imwrite(output_path, result_image)
        
        # Upload result to R2
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/multi_image_{job_id}_{uuid.uuid4()}.jpg"
        print(f"☁️ Uploading to R2: {r2_key}")
        result_url = upload_to_r2(output_path, r2_key)
        
        if not result_url:
            raise Exception("❌ Failed to upload result to R2")
        
        print(f"✅ Upload successful: {result_url}")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        print("🧹 Cleanup completed")
        
        return {
            'success': True,
            'result_url': result_url,
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
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.mp4')
        
        # High quality video settings
        video_settings = {
            'frame_processors': ['face_swapper', 'face_enhancer'],
            'mouth_mask': True,
            'video_quality': 18,
            'video_encoder': 'libx264',
            'keep_fps': True,
            'keep_audio': True
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
        
        # Set up video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
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
                    
                    # Enhance face if requested
                    if 'face_enhancer' in video_settings['frame_processors']:
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
        
        # Upload result to R2
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/single_video_{job_id}_{uuid.uuid4()}.mp4"
        print(f"☁️ Uploading to R2: {r2_key}")
        result_url = upload_to_r2(output_path, r2_key)
        
        if not result_url:
            raise Exception("❌ Failed to upload result to R2")
        
        print(f"✅ Upload successful: {result_url}")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        print("🧹 Cleanup completed")
        
        return {
            'success': True,
            'result_url': result_url,
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
        output_path = os.path.join(temp_dir, f'result_{uuid.uuid4()}.mp4')
        
        # High quality video settings
        video_settings = {
            'frame_processors': ['face_swapper', 'face_enhancer'],
            'mouth_mask': True,
            'video_quality': 18,
            'video_encoder': 'libx264',
            'keep_fps': True,
            'keep_audio': True
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
        
        # Set up video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
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
            
            # Enhance faces if requested
            if 'face_enhancer' in video_settings['frame_processors']:
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
        
        # Upload result to R2
        job_id = input_data.get('job_id', str(uuid.uuid4()))
        r2_key = f"results/multi_video_{job_id}_{uuid.uuid4()}.mp4"
        result_url = upload_to_r2(output_path, r2_key)
        
        if not result_url:
            raise Exception("Failed to upload result to R2")
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        
        return {
            'success': True,
            'result_url': result_url,
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
    """Detect faces in image"""
    try:
        print("Detecting faces...")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Download image
        image_url = input_data.get('image_file')
        image_path = os.path.join(temp_dir, 'image.jpg')
        
        if not download_from_url(image_url, image_path):
            raise Exception("Failed to download image")
        
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise Exception("Failed to load image")
        
        # Detect faces
        faces = detect_faces(image)
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)
        
        return {
            'success': True,
            'faces_detected': len(faces),
            'faces': [
                {
                    'bbox': face['bbox'],
                    'confidence': face['confidence'],
                    'landmarks': face.get('landmarks', [])
                }
                for face in faces
            ]
        }
        
    except Exception as e:
        print(f"Error in face detection: {str(e)}")
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