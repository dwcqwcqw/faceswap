import os
from typing import List, Dict, Any

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKFLOW_DIR = os.path.join(ROOT_DIR, "workflow")

file_types = [
    ("Image", ("*.png", "*.jpg", "*.jpeg", "*.gif", "*.bmp")),
    ("Video", ("*.mp4", "*.mkv")),
]

source_target_map = []
simple_map = {}

source_path = None
target_path = None
output_path = None
frame_processors: List[str] = []
keep_fps = True
keep_audio = True
keep_frames = False
many_faces = False
map_faces = False
color_correction = False  # New global variable for color correction toggle
nsfw_filter = False
video_encoder = None
video_quality = None
live_mirror = False
live_resizable = True
max_memory = None
execution_providers: List[str] = []
execution_threads = None

# Check if running in headless mode (RunPod Serverless)
headless = os.environ.get('HEADLESS', 'false').lower() == 'true' or os.environ.get('DISPLAY', '') == ''

log_level = "error"
fp_ui: Dict[str, bool] = {"face_enhancer": False}

# GUI-related variables (only used in non-headless mode)
if not headless:
    camera_input_combobox = None
    webcam_preview_running = False
    show_fps = False
    mouth_mask = False
    show_mouth_mask_box = False
else:
    # Set safe defaults for headless mode
    camera_input_combobox = None
    webcam_preview_running = False
    show_fps = False
    mouth_mask = False
    show_mouth_mask_box = False

mask_feather_ratio = 8
mask_down_size = 0.50
mask_size = 1

# Model paths configuration
def get_models_dir():
    """Get models directory path, supporting both local development and RunPod deployment"""
    
    # Priority 1: Environment variable (set by download_models.py)
    if 'MODELS_DIR' in os.environ:
        models_dir = os.environ['MODELS_DIR']
        if os.path.exists(models_dir):
            return models_dir
    
    # Priority 2: RunPod Serverless paths (NEW - higher priority)
    runpod_serverless_paths = [
        '/runpod-volume/faceswap',
        '/runpod-volume/faceswap/models',
        '/runpod-volume/models'
    ]
    
    for path in runpod_serverless_paths:
        if os.path.exists(path):
            return path
    
    # Priority 3: Traditional RunPod Pod paths - workspace/faceswap (user's setup)
    workspace_paths = [
        '/workspace/faceswap',
        '/workspace/faceswap/models',
        '/workspace/models'
    ]
    
    for path in workspace_paths:
        if os.path.exists(path):
            return path
    
    # Priority 4: Docker app models
    if os.path.exists('/app/models'):
        return '/app/models'
    
    # Priority 5: Local development - use relative path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(os.path.dirname(current_dir), 'models')
    
    return models_dir

def get_model_path(model_name):
    """Get full path to a specific model file"""
    models_dir = get_models_dir()
    model_path = os.path.join(models_dir, model_name)
    
    # Check if model exists
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")
    
    return model_path
