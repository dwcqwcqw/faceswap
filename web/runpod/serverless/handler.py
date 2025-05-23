import runpod
import os
import sys
import tempfile
import requests
from pathlib import Path
import json
import logging

# Add the faceswap modules to the path
sys.path.append('/workspace/faceswap')

# Import face swap modules
import modules.globals
import modules.core
from modules.processors.frame.core import get_frame_processors_modules
from modules.utilities import has_image_extension, is_image, is_video, normalize_output_path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_file(url, local_path):
    """Download a file from URL to local path"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True
    except Exception as e:
        logger.error(f"Failed to download file: {e}")
        return False

def upload_result(file_path, upload_url):
    """Upload result file to storage"""
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(upload_url, files=files)
            response.raise_for_status()
            return response.json().get('url')
    except Exception as e:
        logger.error(f"Failed to upload result: {e}")
        return None

def process_single_image(source_path, target_path, output_path, options=None):
    """Process single image face swap"""
    try:
        # Set global options
        modules.globals.source_path = source_path
        modules.globals.target_path = target_path
        modules.globals.output_path = output_path
        modules.globals.frame_processors = ['face_swapper']
        modules.globals.headless = True
        
        if options:
            modules.globals.many_faces = options.get('many_faces', False)
            modules.globals.mouth_mask = options.get('mouth_mask', False)
            modules.globals.execution_providers = ['CPUExecutionProvider']
        
        # Initialize frame processors
        for frame_processor in get_frame_processors_modules(modules.globals.frame_processors):
            if not frame_processor.pre_start():
                raise Exception(f"Failed to initialize {frame_processor.NAME}")
        
        # Copy target to output
        import shutil
        shutil.copy2(target_path, output_path)
        
        # Process the image
        for frame_processor in get_frame_processors_modules(modules.globals.frame_processors):
            frame_processor.process_image(source_path, output_path, output_path)
        
        return True
    except Exception as e:
        logger.error(f"Face swap processing failed: {e}")
        return False

def process_video(source_path, target_path, output_path, options=None):
    """Process video face swap"""
    try:
        # Set global options
        modules.globals.source_path = source_path
        modules.globals.target_path = target_path
        modules.globals.output_path = output_path
        modules.globals.frame_processors = ['face_swapper']
        modules.globals.headless = True
        modules.globals.keep_fps = options.get('keep_fps', True) if options else True
        modules.globals.keep_audio = True
        
        if options:
            modules.globals.many_faces = options.get('many_faces', False)
            modules.globals.mouth_mask = options.get('mouth_mask', False)
            modules.globals.video_quality = options.get('video_quality', 18)
            modules.globals.execution_providers = ['CPUExecutionProvider']
        
        # Initialize frame processors
        for frame_processor in get_frame_processors_modules(modules.globals.frame_processors):
            if not frame_processor.pre_start():
                raise Exception(f"Failed to initialize {frame_processor.NAME}")
        
        # Process the video using the core module
        modules.core.start()
        
        return True
    except Exception as e:
        logger.error(f"Video face swap processing failed: {e}")
        return False

def detect_faces(image_path):
    """Detect faces in an image"""
    try:
        from modules.face_analyser import get_many_faces
        faces = get_many_faces(image_path)
        
        face_data = []
        for i, face in enumerate(faces):
            face_info = {
                'id': str(i),
                'bbox': face.bbox.tolist() if hasattr(face, 'bbox') else [],
                'confidence': float(face.det_score) if hasattr(face, 'det_score') else 0.0,
                'landmarks': face.landmark_2d_106.tolist() if hasattr(face, 'landmark_2d_106') else []
            }
            face_data.append(face_info)
        
        return {
            'faces': face_data,
            'total_faces': len(face_data),
            'image_path': image_path
        }
    except Exception as e:
        logger.error(f"Face detection failed: {e}")
        return {'faces': [], 'total_faces': 0, 'image_path': image_path}

def handler(job):
    """Main handler function for RunPod"""
    try:
        job_input = job['input']
        job_id = job_input.get('job_id')
        process_type = job_input.get('process_type')
        
        logger.info(f"Processing job {job_id} of type {process_type}")
        
        # Create temporary directory for this job
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            if process_type == 'single-image':
                # Download source and target files
                source_url = job_input.get('source_file')
                target_url = job_input.get('target_file')
                
                source_path = temp_path / 'source.jpg'
                target_path = temp_path / 'target.jpg'
                output_path = temp_path / 'result.jpg'
                
                if not download_file(source_url, source_path):
                    return {"error": "Failed to download source file"}
                
                if not download_file(target_url, target_path):
                    return {"error": "Failed to download target file"}
                
                # Process the face swap
                options = job_input.get('options', {})
                success = process_single_image(str(source_path), str(target_path), str(output_path), options)
                
                if not success:
                    return {"error": "Face swap processing failed"}
                
                # Upload result (this would need to be implemented based on your storage solution)
                result_url = f"https://your-storage.com/results/{job_id}.jpg"
                
                return {
                    "status": "completed",
                    "result_url": result_url,
                    "job_id": job_id
                }
            
            elif process_type == 'detect-faces':
                # Download image file
                image_url = job_input.get('image_file')
                image_path = temp_path / 'image.jpg'
                
                if not download_file(image_url, image_path):
                    return {"error": "Failed to download image file"}
                
                # Detect faces
                face_data = detect_faces(str(image_path))
                
                return {
                    "status": "completed",
                    "faces": face_data,
                    "job_id": job_id
                }
            
            elif process_type == 'single-video':
                # Download source and target files
                source_url = job_input.get('source_file')
                target_url = job_input.get('target_file')
                
                source_path = temp_path / 'source.jpg'
                target_path = temp_path / 'target.mp4'
                output_path = temp_path / 'result.mp4'
                
                if not download_file(source_url, source_path):
                    return {"error": "Failed to download source file"}
                
                if not download_file(target_url, target_path):
                    return {"error": "Failed to download target file"}
                
                # Process the video face swap
                options = job_input.get('options', {})
                success = process_video(str(source_path), str(target_path), str(output_path), options)
                
                if not success:
                    return {"error": "Video face swap processing failed"}
                
                # Upload result
                result_url = f"https://your-storage.com/results/{job_id}.mp4"
                
                return {
                    "status": "completed",
                    "result_url": result_url,
                    "job_id": job_id
                }
            
            else:
                return {"error": f"Unknown process type: {process_type}"}
    
    except Exception as e:
        logger.error(f"Handler error: {e}")
        return {"error": str(e)}

# Start the RunPod serverless worker
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler}) 