"""Face enhancer module - wrapper for processors"""

import cv2
import numpy as np
from modules.processors.frame import face_enhancer as frame_face_enhancer

def enhance_faces(image, model_path):
    """Enhance faces in the given image"""
    try:
        # Use the frame processor for face enhancement
        result = frame_face_enhancer.process_frame(
            source_face=None,
            reference_face=None,
            temp_frame=image
        )
        
        return result if result is not None else image
        
    except Exception as e:
        print(f"Error in face enhancement: {str(e)}")
        return image 