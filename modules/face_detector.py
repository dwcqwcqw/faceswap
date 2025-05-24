"""Face detector module"""

import cv2
import numpy as np
from modules.face_analyser import get_many_faces

def detect_faces(image):
    """Detect all faces in the given image"""
    try:
        # Use the face analyser to detect faces
        faces = get_many_faces(image)
        
        # Convert to simple format for API response
        detected_faces = []
        for i, face in enumerate(faces):
            if hasattr(face, 'bbox'):
                bbox = face.bbox.astype(int)
                detected_faces.append({
                    'face_id': i,
                    'bbox': {
                        'x': int(bbox[0]),
                        'y': int(bbox[1]),
                        'width': int(bbox[2] - bbox[0]),
                        'height': int(bbox[3] - bbox[1])
                    },
                    'confidence': float(face.det_score) if hasattr(face, 'det_score') else 0.9
                })
        
        return detected_faces
        
    except Exception as e:
        print(f"Error in face detection: {str(e)}")
        return [] 