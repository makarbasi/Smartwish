#!/usr/bin/env python3
"""
SmartWish Kiosk Surveillance - People Counter

Uses YOLO for person detection and tracking. Saves images of detected people
and reports statistics to the cloud server.

Usage:
    python count_people.py --kiosk-id=kiosk-001 --server-url=https://smartwish.onrender.com --api-key=YOUR_API_KEY

Options:
    --kiosk-id          Unique identifier for this kiosk (required)
    --server-url        Cloud server URL (default: https://smartwish.onrender.com)
    --api-key           Kiosk API key for authentication (required)
    --webcam-index      Webcam device index (default: 0)
    --output-dir        Base directory for saved images (default: ./saved_detections)
    --dwell-threshold   Seconds before counting a person (default: 8)
    --frame-threshold   Frames before saving image (default: 10)
    --http-port         Port for local HTTP server to serve images (default: 8765)
    --no-preview        Disable OpenCV preview window
    --batch-interval    Seconds between batch uploads (default: 30)
"""

import cv2
import time
import os
import sys
import argparse
import json
import threading
import queue
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler
from functools import partial
from io import BytesIO

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)


# =============================================================================
# Configuration
# =============================================================================

class Config:
    def __init__(self, args):
        self.kiosk_id = args.kiosk_id
        self.server_url = args.server_url.rstrip('/')
        self.api_key = args.api_key
        self.webcam_index = args.webcam_index
        self.output_dir = Path(args.output_dir)
        self.dwell_threshold = args.dwell_threshold
        self.frame_threshold = args.frame_threshold
        self.http_port = args.http_port
        self.show_preview = not args.no_preview
        self.batch_interval = args.batch_interval
        self.fps_target = 5  # Process at 5 FPS
        
        # Calculated values
        self.frames_to_count = int(self.dwell_threshold * self.fps_target)  # 8s * 5fps = 40 frames


# =============================================================================
# HTTP Server for serving detection images and live stream
# =============================================================================

# Global frame holder for MJPEG streaming
class FrameHolder:
    def __init__(self):
        self.frame = None
        self.lock = threading.Lock()
        self.annotated_frame = None
    
    def set_frame(self, frame, annotated=None):
        with self.lock:
            self.frame = frame
            self.annotated_frame = annotated
    
    def get_frame(self, annotated=False):
        with self.lock:
            if annotated and self.annotated_frame is not None:
                return self.annotated_frame
            return self.frame

frame_holder = FrameHolder()


class SurveillanceHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler that serves images and live MJPEG stream"""
    
    base_directory = None
    
    def do_GET(self):
        # Live stream endpoint
        if self.path == '/stream' or self.path == '/stream.mjpg':
            self.send_mjpeg_stream()
        # Single frame endpoint (for polling fallback)
        elif self.path == '/frame' or self.path == '/frame.jpg':
            self.send_single_frame()
        # Status endpoint
        elif self.path == '/status':
            self.send_status()
        # Static file serving for saved images
        else:
            self.send_static_file()
    
    def send_mjpeg_stream(self):
        """Send continuous MJPEG stream"""
        self.send_response(200)
        self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        try:
            while True:
                frame = frame_holder.get_frame(annotated=True)
                if frame is not None:
                    # Encode frame as JPEG
                    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    
                    # Send frame
                    self.wfile.write(b'--frame\r\n')
                    self.wfile.write(b'Content-Type: image/jpeg\r\n\r\n')
                    self.wfile.write(jpeg.tobytes())
                    self.wfile.write(b'\r\n')
                
                time.sleep(0.1)  # ~10 FPS for stream
        except (BrokenPipeError, ConnectionResetError):
            pass  # Client disconnected
    
    def send_single_frame(self):
        """Send single JPEG frame"""
        frame = frame_holder.get_frame(annotated=True)
        
        if frame is None:
            self.send_error(503, 'No frame available')
            return
        
        _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        
        self.send_response(200)
        self.send_header('Content-Type', 'image/jpeg')
        self.send_header('Content-Length', len(jpeg))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(jpeg.tobytes())
    
    def send_status(self):
        """Send JSON status"""
        import json
        status = {
            'streaming': frame_holder.get_frame() is not None,
            'timestamp': datetime.now().isoformat(),
        }
        
        data = json.dumps(status).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(data))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)
    
    def send_static_file(self):
        """Serve static files from base directory"""
        # Remove leading slash and query string
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        path = path.lstrip('/')
        
        if not path:
            self.send_error(404)
            return
        
        filepath = os.path.join(self.base_directory, path)
        
        if not os.path.isfile(filepath):
            self.send_error(404)
            return
        
        try:
            with open(filepath, 'rb') as f:
                data = f.read()
            
            # Determine content type
            if filepath.endswith('.jpg') or filepath.endswith('.jpeg'):
                content_type = 'image/jpeg'
            elif filepath.endswith('.png'):
                content_type = 'image/png'
            else:
                content_type = 'application/octet-stream'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(data))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_error(500)
    
    def log_message(self, format, *args):
        """Suppress HTTP request logging"""
        pass


def start_http_server(port, base_directory):
    """Start HTTP server in a background thread"""
    SurveillanceHTTPHandler.base_directory = str(base_directory)
    server = HTTPServer(('0.0.0.0', port), SurveillanceHTTPHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"  🌐 Image server started on http://localhost:{port}")
    print(f"  📹 Live stream: http://localhost:{port}/stream")
    print(f"  🖼️  Single frame: http://localhost:{port}/frame")
    return server


# =============================================================================
# Detection Reporter - Sends detections to cloud server
# =============================================================================

class DetectionReporter:
    """Handles reporting detections to the cloud server"""
    
    def __init__(self, config: Config):
        self.config = config
        self.pending_queue = queue.Queue()
        self.running = True
        
        # Start background upload thread
        self.upload_thread = threading.Thread(target=self._upload_worker, daemon=True)
        self.upload_thread.start()
    
    def report_detection(self, person_track_id: int, detected_at: datetime, 
                        dwell_seconds: float | None, was_counted: bool, image_path: str | None):
        """Queue a detection for upload"""
        detection = {
            'personTrackId': person_track_id,
            'detectedAt': detected_at.isoformat(),
            'dwellSeconds': dwell_seconds,
            'wasCounted': was_counted,
            'imagePath': image_path,
        }
        self.pending_queue.put(detection)
    
    def _upload_worker(self):
        """Background worker that batches and uploads detections"""
        batch = []
        last_upload = time.time()
        
        while self.running:
            try:
                # Get items with timeout
                try:
                    detection = self.pending_queue.get(timeout=1.0)
                    batch.append(detection)
                except queue.Empty:
                    pass
                
                # Upload if batch is full or interval elapsed
                now = time.time()
                should_upload = (
                    len(batch) >= 10 or 
                    (len(batch) > 0 and now - last_upload >= self.config.batch_interval)
                )
                
                if should_upload:
                    self._upload_batch(batch)
                    batch = []
                    last_upload = now
                    
            except Exception as e:
                print(f"  ⚠️ Upload worker error: {e}")
                time.sleep(5)
    
    def _upload_batch(self, batch):
        """Upload a batch of detections to the server"""
        if not batch:
            return
        
        url = f"{self.config.server_url}/surveillance/events/batch"
        headers = {
            'Content-Type': 'application/json',
            'x-kiosk-api-key': self.config.api_key,
            'x-kiosk-id': self.config.kiosk_id,
        }
        payload = {'detections': batch}
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 201:
                print(f"  ☁️  Uploaded {len(batch)} detection(s) to server")
            else:
                print(f"  ⚠️ Upload failed: {response.status_code} - {response.text[:100]}")
        except requests.RequestException as e:
            print(f"  ⚠️ Upload error: {e}")
            # Re-queue failed items
            for item in batch:
                self.pending_queue.put(item)
    
    def stop(self):
        """Stop the upload worker and flush pending items"""
        self.running = False
        self.upload_thread.join(timeout=5)


# =============================================================================
# Person Tracker
# =============================================================================

class PersonTracker:
    """Tracks people detected by YOLO and manages counting logic"""
    
    def __init__(self, config: Config, reporter: DetectionReporter):
        self.config = config
        self.reporter = reporter
        
        # State management
        self.id_frame_counts = {}       # Track ID -> frame count
        self.id_first_seen = {}         # Track ID -> first seen timestamp
        self.counted_ids = set()        # IDs that have been counted (>8s)
        self.saved_ids = set()          # IDs whose images have been saved
        self.daily_count = 0            # Total counted today
        
        # Create output directory
        today = datetime.now().strftime('%Y-%m-%d')
        self.today_dir = self.config.output_dir / today / self.config.kiosk_id
        self.today_dir.mkdir(parents=True, exist_ok=True)
    
    def process_detections(self, track_ids: list, frame):
        """Process detected track IDs from current frame"""
        now = datetime.now()
        
        for obj_id in track_ids:
            # Initialize tracking for new IDs
            if obj_id not in self.id_first_seen:
                self.id_first_seen[obj_id] = now
                self.id_frame_counts[obj_id] = 0
            
            # Increment frame counter
            self.id_frame_counts[obj_id] += 1
            frame_count = self.id_frame_counts[obj_id]
            
            # A. Save image after threshold frames (default 10 = 2 seconds)
            if frame_count == self.config.frame_threshold and obj_id not in self.saved_ids:
                self.saved_ids.add(obj_id)
                image_path = self._save_image(obj_id, now, frame)
                
                # Report detection (not yet counted)
                relative_path = str(image_path.relative_to(self.config.output_dir))
                self.reporter.report_detection(
                    person_track_id=obj_id,
                    detected_at=now,
                    dwell_seconds=None,
                    was_counted=False,
                    image_path=relative_path,
                )
                print(f"  📸 Saved image for ID {obj_id}")
            
            # B. Count person if seen for threshold frames (default 40 = 8 seconds)
            if frame_count >= self.config.frames_to_count and obj_id not in self.counted_ids:
                self.counted_ids.add(obj_id)
                self.daily_count += 1
                
                # Calculate dwell time
                dwell_seconds = (now - self.id_first_seen[obj_id]).total_seconds()
                
                # Report as counted
                image_path = None
                if obj_id in self.saved_ids:
                    # Find the saved image path
                    for f in self.today_dir.glob(f"id_{obj_id}_*.jpg"):
                        image_path = str(f.relative_to(self.config.output_dir))
                        break
                
                self.reporter.report_detection(
                    person_track_id=obj_id,
                    detected_at=now,
                    dwell_seconds=dwell_seconds,
                    was_counted=True,
                    image_path=image_path,
                )
                
                timestamp = now.strftime('%H:%M:%S')
                print(f"  ✅ [{timestamp}] ID {obj_id} stayed {dwell_seconds:.1f}s - Total counted: {self.daily_count}")
    
    def _save_image(self, obj_id: int, timestamp: datetime, frame) -> Path:
        """Save detection image to disk"""
        filename = f"id_{obj_id}_{timestamp.strftime('%H-%M-%S')}.jpg"
        filepath = self.today_dir / filename
        cv2.imwrite(str(filepath), frame)
        return filepath
    
    def get_stats(self) -> dict:
        """Get current tracking statistics"""
        return {
            'daily_count': self.daily_count,
            'active_tracks': len(self.id_frame_counts),
            'saved_images': len(self.saved_ids),
        }


# =============================================================================
# Main Application
# =============================================================================

def parse_args():
    parser = argparse.ArgumentParser(description='SmartWish Kiosk Surveillance')
    parser.add_argument('--kiosk-id', required=True, help='Unique kiosk identifier')
    parser.add_argument('--server-url', default='https://smartwish.onrender.com', help='Cloud server URL')
    parser.add_argument('--api-key', required=True, help='Kiosk API key')
    parser.add_argument('--webcam-index', type=int, default=0, help='Webcam device index')
    parser.add_argument('--output-dir', default='./saved_detections', help='Base directory for saved images')
    parser.add_argument('--dwell-threshold', type=int, default=8, help='Seconds before counting a person')
    parser.add_argument('--frame-threshold', type=int, default=10, help='Frames before saving image')
    parser.add_argument('--http-port', type=int, default=8765, help='Port for local HTTP server')
    parser.add_argument('--no-preview', action='store_true', help='Disable OpenCV preview window')
    parser.add_argument('--batch-interval', type=int, default=30, help='Seconds between batch uploads')
    return parser.parse_args()


def find_model_file(script_dir: Path) -> Path:
    """Find YOLO model file in script directory or parent"""
    model_names = ['yolo26n.pt', 'yolo11n.pt', 'yolov8n.pt']
    
    for name in model_names:
        # Check script directory
        model_path = script_dir / name
        if model_path.exists():
            return model_path
        
        # Check parent directory
        model_path = script_dir.parent / name
        if model_path.exists():
            return model_path
    
    # Fallback to default (will be downloaded)
    return Path('yolov8n.pt')


def main():
    args = parse_args()
    config = Config(args)
    
    print("═" * 60)
    print("  🎥 SMARTWISH KIOSK SURVEILLANCE")
    print("═" * 60)
    print(f"  Kiosk ID: {config.kiosk_id}")
    print(f"  Server: {config.server_url}")
    print(f"  Webcam: {config.webcam_index}")
    print(f"  Dwell threshold: {config.dwell_threshold}s ({config.frames_to_count} frames)")
    print(f"  Save image after: {config.frame_threshold} frames")
    print(f"  Output: {config.output_dir}")
    print("")
    
    # Find and load YOLO model
    script_dir = Path(__file__).parent
    model_path = find_model_file(script_dir)
    print(f"  📦 Loading YOLO model: {model_path}")
    
    try:
        model = YOLO(str(model_path))
    except Exception as e:
        print(f"  ❌ Failed to load YOLO model: {e}")
        sys.exit(1)
    
    # Initialize webcam
    print(f"  📹 Opening webcam {config.webcam_index}...")
    cap = cv2.VideoCapture(config.webcam_index)
    
    if not cap.isOpened():
        print(f"  ❌ Failed to open webcam {config.webcam_index}")
        sys.exit(1)
    
    # Set camera resolution (optional)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    # Start HTTP server for serving images
    config.output_dir.mkdir(parents=True, exist_ok=True)
    http_server = start_http_server(config.http_port, config.output_dir)
    
    # Initialize reporter and tracker
    reporter = DetectionReporter(config)
    tracker = PersonTracker(config, reporter)
    
    # Load tracker config if exists
    tracker_config = script_dir / 'custom_tracker.yaml'
    tracker_yaml = str(tracker_config) if tracker_config.exists() else 'bytetrack.yaml'
    
    print("")
    print("  🔄 Starting tracking...")
    print(f"  Logic: Count if present > {config.dwell_threshold}s. Save image at {config.frame_threshold} frames.")
    print("  Press 'q' in preview window or Ctrl+C to stop.")
    print("")
    
    frame_interval = 1.0 / config.fps_target  # Target 5 FPS
    
    try:
        while cap.isOpened():
            start_time = time.time()
            
            success, frame = cap.read()
            if not success:
                print("  ⚠️ Failed to read frame, retrying...")
                time.sleep(0.5)
                continue
            
            # Run YOLO tracking
            results = model.track(
                source=frame,
                persist=True,
                classes=[0],  # Only detect people (class 0)
                tracker=tracker_yaml,
                verbose=False,
                stream=True
            )
            
            for r in results:
                if r.boxes is not None and r.boxes.id is not None:
                    track_ids = r.boxes.id.int().tolist()
                    tracker.process_detections(track_ids, frame)
                
                # Create annotated frame for streaming/preview
                annotated_frame = r.plot()
                stats = tracker.get_stats()
                cv2.putText(
                    annotated_frame, 
                    f"Counted (>{config.dwell_threshold}s): {stats['daily_count']}", 
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2
                )
                cv2.putText(
                    annotated_frame, 
                    f"Active tracks: {stats['active_tracks']}", 
                    (20, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1
                )
                cv2.putText(
                    annotated_frame, 
                    f"Kiosk: {config.kiosk_id}", 
                    (20, annotated_frame.shape[0] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1
                )
                
                # Update frame holder for HTTP streaming
                frame_holder.set_frame(frame, annotated_frame)
                
                # Show local preview if enabled
                if config.show_preview:
                    cv2.imshow("SmartWish Surveillance", annotated_frame)
            
            # Maintain target FPS
            elapsed = time.time() - start_time
            sleep_time = max(0.01, frame_interval - elapsed)
            time.sleep(sleep_time)
            
            # Check for quit key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        print("\n  ⏹️  Stopping surveillance...")
    
    finally:
        stats = tracker.get_stats()
        print(f"\n  📊 FINAL REPORT: {stats['daily_count']} people counted (stayed > {config.dwell_threshold}s)")
        print(f"     Total images saved: {stats['saved_images']}")
        
        reporter.stop()
        cap.release()
        cv2.destroyAllWindows()
        print("  ✅ Surveillance stopped")


if __name__ == '__main__':
    main()
