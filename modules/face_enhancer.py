"""Face enhancer module - wrapper for processors"""

import cv2
import numpy as np
from modules.processors.frame import face_enhancer as frame_face_enhancer

def enhance_faces(image, model_path=None):
    """Enhance faces in the given image"""
    try:
        # Use the frame processor for face enhancement
        result = frame_face_enhancer.enhance_face(image)
        return result if result is not None else image
        
    except Exception as e:
        print(f"Error in face enhancement: {str(e)}")
        return image

def enhance_face(temp_frame):
    """Enhance face in the given frame"""
    try:
        # Use the frame processor
        result = frame_face_enhancer.enhance_face(temp_frame)
        return result if result is not None else temp_frame
        
    except Exception as e:
        print(f"Error in face enhancement enhance_face: {str(e)}")
        return temp_frame

def process_frame(source_face, temp_frame):
    """Process frame with face enhancement"""
    try:
        # Use the frame processor
        result = frame_face_enhancer.process_frame(source_face, temp_frame)
        return result if result is not None else temp_frame
        
    except Exception as e:
        print(f"Error in face enhancement process_frame: {str(e)}")
        return temp_frame 