"""Face swapper module - wrapper for processors"""

import cv2
import numpy as np
from modules.processors.frame import face_swapper as frame_face_swapper

def swap_face(source_image, target_image, model_path):
    """Swap face from source image to target image"""
    try:
        # Use the frame processor for face swapping
        result = frame_face_swapper.process_frame(
            source_face=None,  # Will be detected automatically
            reference_face=None,  # Will be detected automatically
            temp_frame=target_image
        )
        
        return result if result is not None else target_image
        
    except Exception as e:
        print(f"Error in face swap: {str(e)}")
        return target_image 