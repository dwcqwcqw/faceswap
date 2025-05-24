# Face Swap Quality Settings

This document explains the quality settings used to achieve the best possible face swap results.

## High Quality Default Settings

The application is configured with high-quality defaults to ensure the best possible output:

### Image Processing
- **Frame Processors**: `['face_swapper', 'face_enhancer']`
  - Face swapping for the main effect
  - Face enhancement for improved quality and realism
- **Mouth Mask**: `True` - Preserves natural mouth movement and expressions
- **Execution Provider**: `CPUExecutionProvider` (GPU when available)

### Video Processing
- **Frame Processors**: `['face_swapper', 'face_enhancer']`
- **Keep FPS**: `True` - Maintains original frame rate
- **Keep Audio**: `True` - Preserves original audio track
- **Video Quality**: `18` - High quality setting (0=best, 51=worst)
- **Video Encoder**: `libx264` - Good balance of quality and compatibility
- **Mouth Mask**: `True` - Enhanced facial expression preservation
- **Keep Frames**: `False` - Cleans up temporary files

## Quality Parameters Explained

### Video Quality Scale (0-51)
- **0-15**: Visually lossless to excellent quality
- **16-23**: High quality (recommended range)
- **24-30**: Good quality
- **31-51**: Lower quality (not recommended)

**Default Setting: 18** - Provides excellent quality with reasonable file size

### Video Encoders
- **libx264**: Best compatibility, good quality/size ratio (default)
- **libx265**: Better compression, newer format
- **libvpx-vp9**: Good for web, open source

### Face Enhancement Benefits
- Improves facial texture and details
- Reduces artifacts from face swapping
- Better skin tone matching
- Enhanced facial features clarity

### Mouth Mask Benefits
- Preserves natural lip movement
- Better speech synchronization
- Maintains facial expressions
- Reduces unnatural mouth distortions

## Multi-Face Processing

### Many Faces Mode
- **Single Face**: Processes only the most prominent face
- **Many Faces**: Processes all detected faces in the image/video
- **Auto-enabled**: For multi-image and multi-video modes

### Face Mapping
- Advanced face-to-face correspondence
- Better results for multi-person scenarios
- Preserves individual facial characteristics

## Performance vs Quality Trade-offs

### High Quality (Recommended)
```json
{
  "frame_processors": ["face_swapper", "face_enhancer"],
  "mouth_mask": true,
  "video_quality": 18,
  "video_encoder": "libx264",
  "use_face_enhancer": true
}
```

### Balanced Quality
```json
{
  "frame_processors": ["face_swapper"],
  "mouth_mask": true,
  "video_quality": 23,
  "video_encoder": "libx264",
  "use_face_enhancer": false
}
```

### Fast Processing
```json
{
  "frame_processors": ["face_swapper"],
  "mouth_mask": false,
  "video_quality": 28,
  "video_encoder": "libx264",
  "use_face_enhancer": false
}
```

## Input Requirements for Best Results

### Image Quality
- **Resolution**: Higher resolution = better results
- **Lighting**: Even, well-lit faces
- **Face Angle**: Front-facing or slight angle
- **Image Format**: PNG or high-quality JPEG

### Video Quality
- **Resolution**: 720p minimum, 1080p recommended
- **Frame Rate**: 24fps or higher
- **Compression**: Minimal compression preferred
- **Lighting**: Consistent lighting throughout

### Face Requirements
- **Visibility**: Clear, unobstructed faces
- **Size**: Face should be at least 64x64 pixels
- **Quality**: Sharp, in-focus faces
- **Expression**: Neutral expressions work best

## Model Dependencies

### Required Models
1. **inswapper_128_fp16.onnx** (264MB)
   - Primary face swapping model
   - REQUIRED for all operations

2. **GFPGANv1.4.pth** (332MB)
   - Face enhancement model
   - REQUIRED for high-quality output
   - Automatically used when `use_face_enhancer: true`

### Model Paths
- **Local Development**: `./models/`
- **RunPod Deployment**: `/workspace/faceswap/`

## Troubleshooting Quality Issues

### Low Quality Output
1. Ensure face enhancer is enabled
2. Check input image/video quality
3. Verify both models are present
4. Use lower video quality number (higher quality)

### Artifacts or Distortions
1. Enable mouth mask
2. Use face enhancement
3. Check face visibility in source/target
4. Ensure proper lighting conditions

### Performance Issues
1. Disable face enhancer for faster processing
2. Increase video quality number (lower quality)
3. Process smaller resolution videos
4. Use CPU execution provider if GPU causes issues

## API Usage Examples

### High Quality Image Processing
```javascript
const request = {
  source_file: "source.jpg",
  target_file: "target.jpg",
  options: {
    mouth_mask: true,
    use_face_enhancer: true,
    execution_provider: "CPUExecutionProvider"
  }
}
```

### High Quality Video Processing
```javascript
const request = {
  source_file: "source.jpg",
  target_file: "target.mp4",
  options: {
    keep_fps: true,
    video_quality: 18,
    video_encoder: "libx264",
    mouth_mask: true,
    use_face_enhancer: true,
    execution_provider: "CPUExecutionProvider"
  }
}
```

These settings ensure the highest possible quality for face swap operations while maintaining reasonable processing times. 