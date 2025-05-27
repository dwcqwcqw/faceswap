"""Face swapper module - wrapper for processors"""

import cv2
import numpy as np
from modules.processors.frame import face_swapper as frame_face_swapper
from modules.face_analyser import get_one_face

def swap_face(source_face, target_face, temp_frame):
    """Swap face from source face to target face in the given frame"""
    try:
        # Use the frame processor for face swapping
        result = frame_face_swapper.swap_face(source_face, target_face, temp_frame)
        return result if result is not None else temp_frame
        
    except Exception as e:
        print(f"Error in face swap: {str(e)}")
        return temp_frame

def process_frame(source_face, temp_frame):
    """Process frame with face swapping"""
    try:
        # Use the frame processor
        result = frame_face_swapper.process_frame(source_face, temp_frame)
        return result if result is not None else temp_frame
        
    except Exception as e:
        print(f"Error in face swap process_frame: {str(e)}")
        return temp_frame 