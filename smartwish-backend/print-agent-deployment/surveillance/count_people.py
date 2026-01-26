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
import numpy as np
import signal
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler
from functools import partial
from io import BytesIO

try:
    # Suppress ultralytics verbose logging (the 'source is missing' warning)
    import os
    os.environ.setdefault('YOLO_VERBOSE', 'False')
    import logging
    logging.getLogger('ultralytics').setLevel(logging.WARNING)
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

try:
    import mss
    import mss.tools
except ImportError:
    print("WARNING: mss not installed. Screen recording will be disabled.")
    print("Run: pip install mss")
    mss = None

try:
    from PIL import ImageGrab
except ImportError:
    print("WARNING: Pillow not installed. Screen recording fallback unavailable.")
    ImageGrab = None

try:
    import websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    print("WARNING: websocket-client not installed. WebSocket streaming unavailable.")
    print("Run: pip install websocket-client")
    WEBSOCKET_AVAILABLE = False
    websocket = None


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
        
        # Session-based recording
        self.session_id = getattr(args, 'session_id', None)
        self.record_webcam = getattr(args, 'record_webcam', True)
        self.record_screen = getattr(args, 'record_screen', True)
        self.webcam_fps = getattr(args, 'webcam_fps', 30)
        self.screen_fps = getattr(args, 'screen_fps', 1)
        self.output_video_dir = Path(getattr(args, 'output_video_dir', './recordings'))
        
        # Camera angle adjustment
        self.camera_rotation = getattr(args, 'camera_rotation', 0)  # 0, 90, 180, 270
        self.camera_flip_h = getattr(args, 'camera_flip_h', False)
        self.camera_flip_v = getattr(args, 'camera_flip_v', False)
        
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
    """HTTP handler that serves images, live MJPEG stream, and recording control"""
    
    base_directory = None
    video_recorder = None  # Will be set after initialization
    config = None  # Will be set after initialization
    
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
    
    def do_POST(self):
        """Handle POST requests for recording control"""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            data = json.loads(body) if body else {}
        except:
            data = {}
        
        # CORS headers
        self.send_header_cors = lambda: (
            self.send_header('Access-Control-Allow-Origin', '*'),
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            self.send_header('Access-Control-Allow-Headers', 'Content-Type'),
        )
        
        # POST /recording/start - Start session recording
        if self.path == '/recording/start':
            session_id = data.get('sessionId')
            recording_config = data.get('config', {})
            
            if not session_id:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'sessionId required'}).encode())
                return
            
            if self.video_recorder:
                # Update recording config from request
                if recording_config.get('recordWebcam') is not None:
                    self.video_recorder.config.record_webcam = recording_config.get('recordWebcam', True)
                if recording_config.get('recordScreen') is not None:
                    self.video_recorder.config.record_screen = recording_config.get('recordScreen', True)
                if recording_config.get('webcamFps'):
                    self.video_recorder.webcam_fps = float(recording_config['webcamFps'])
                    self.video_recorder.webcam_delay = 1.0 / self.video_recorder.webcam_fps
                if recording_config.get('screenFps'):
                    self.video_recorder.screen_fps = float(recording_config['screenFps'])
                    self.video_recorder.screen_delay = 1.0 / self.video_recorder.screen_fps
                if recording_config.get('cameraRotation') is not None:
                    self.video_recorder.camera_transformer.rotation = int(recording_config['cameraRotation'])
                if recording_config.get('cameraFlipHorizontal') is not None:
                    self.video_recorder.camera_transformer.flip_h = recording_config.get('cameraFlipHorizontal', False)
                if recording_config.get('cameraFlipVertical') is not None:
                    self.video_recorder.camera_transformer.flip_v = recording_config.get('cameraFlipVertical', False)
                
                self.video_recorder.start_recording(session_id)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': f'Recording started for session {session_id}',
                    'recording': {
                        'webcam': self.video_recorder.config.record_webcam,
                        'screen': self.video_recorder.config.record_screen,
                    }
                }).encode())
            else:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Video recorder not available'}).encode())
            return
        
        # POST /recording/stop - Stop session recording and upload
        elif self.path == '/recording/stop':
            session_id = data.get('sessionId')
            
            if self.video_recorder:
                print(f"  📤 HTTP: Stop recording requested for session: {session_id or 'current'}")
                self.video_recorder.stop_and_upload()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': 'Recording stopped and upload initiated',
                    'webcamFrames': self.video_recorder.webcam_frame_count,
                    'screenFrames': self.video_recorder.screen_frame_count,
                }).encode())
            else:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Video recorder not available'}).encode())
            return
        
        # POST /recording/status - Get recording status
        elif self.path == '/recording/status':
            if self.video_recorder:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'recording': self.video_recorder.is_recording,
                    'sessionId': self.video_recorder.session_id,
                    'webcamFrames': self.video_recorder.webcam_frame_count,
                    'screenFrames': self.video_recorder.screen_frame_count,
                }).encode())
            else:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Video recorder not available'}).encode())
            return
        
        # Unknown endpoint
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'error': 'Not found'}).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress HTTP request logging"""
        pass


def start_http_server(port, base_directory, video_recorder=None, config=None):
    """Start HTTP server in a background thread"""
    SurveillanceHTTPHandler.base_directory = str(base_directory)
    SurveillanceHTTPHandler.video_recorder = video_recorder
    SurveillanceHTTPHandler.config = config
    server = HTTPServer(('0.0.0.0', port), SurveillanceHTTPHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"  🌐 Surveillance HTTP server on http://localhost:{port}")
    print(f"  📹 Live stream: http://localhost:{port}/stream")
    print(f"  🖼️  Single frame: http://localhost:{port}/frame")
    print(f"  🎬 Recording control: POST /recording/start, /recording/stop")
    return server


# =============================================================================
# NOTE: The legacy FrameUploader class (HTTP polling) has been removed.
# Live frame streaming now uses WebSocket via WebSocketFrameStreamer.
# This reduces RAM usage and provides better real-time performance.
# =============================================================================


# =============================================================================
# WebSocket Frame Streamer - Real-time frame streaming via WebSocket
# =============================================================================

class WebSocketFrameStreamer:
    """
    Streams live frames to the cloud server via WebSocket for real-time viewing.
    This is more efficient than HTTP polling and provides lower latency.
    
    IMPORTANT: Only streams when admin viewers are watching!
    The server sends 'start_streaming' when a viewer subscribes and
    'stop_streaming' when all viewers disconnect.
    
    Protocol:
    1. Connect to WebSocket server at ws(s)://server/ws/surveillance
    2. Send auth message: {"type": "auth", "kioskId": "...", "apiKey": "..."}
    3. Wait for auth_success response
    4. Wait for 'start_streaming' message (admin viewer watching)
    5. Send binary JPEG frames until 'stop_streaming' received
    """
    
    def __init__(self, config: Config, frame_holder: FrameHolder):
        self.config = config
        self.frame_holder = frame_holder
        self.running = True
        self.connected = False
        self.authenticated = False
        self.streaming_active = False  # Only stream when viewers are watching
        self.ws = None
        self.stream_interval = 0.1  # 10 FPS (100ms between frames)
        self.frames_sent = 0
        self.reconnect_delay = 5  # Start with 5 seconds
        self.max_reconnect_delay = 60  # Max 60 seconds
        self.consecutive_failures = 0
        
        # Build WebSocket URL
        server_url = self.config.server_url
        if server_url.startswith('https://'):
            ws_url = 'wss://' + server_url[8:] + '/ws/surveillance'
        elif server_url.startswith('http://'):
            ws_url = 'ws://' + server_url[7:] + '/ws/surveillance'
        else:
            ws_url = 'ws://' + server_url + '/ws/surveillance'
        self.ws_url = ws_url
        
        print(f"  🔌 WebSocket frame streamer initializing...")
        print(f"     URL: {self.ws_url}")
        print(f"     Kiosk ID: {self.config.kiosk_id}")
        print(f"     Streaming: ON-DEMAND (only when admin is viewing)")
        
        # Start background connection thread
        self.connect_thread = threading.Thread(target=self._connect_loop, daemon=True)
        self.connect_thread.start()
    
    def _connect_loop(self):
        """Main connection loop - handles reconnection on failures"""
        while self.running:
            try:
                self._connect_and_stream()
            except Exception as e:
                if self.running:
                    print(f"  ⚠️ WebSocket error: {e}")
                    self.connected = False
                    self.authenticated = False
                    self.streaming_active = False
                    
                    # Exponential backoff
                    self.consecutive_failures += 1
                    delay = min(self.reconnect_delay * (2 ** (self.consecutive_failures - 1)), self.max_reconnect_delay)
                    print(f"  🔄 Reconnecting in {delay}s...")
                    time.sleep(delay)
    
    def _connect_and_stream(self):
        """Connect to WebSocket and stream frames when requested"""
        if not WEBSOCKET_AVAILABLE:
            print("  ⚠️ WebSocket not available, falling back to HTTP upload")
            self.running = False
            return
        
        print(f"  🔌 Connecting to WebSocket: {self.ws_url}")
        
        # Create WebSocket connection
        # Increased timeout to 30s to handle Render.com cold starts
        self.ws = websocket.WebSocket()
        self.ws.connect(self.ws_url, timeout=30)
        self.connected = True
        print(f"  ✅ WebSocket connected")
        
        # Authenticate
        auth_message = json.dumps({
            "event": "auth",
            "data": {
                "kioskId": self.config.kiosk_id,
                "apiKey": self.config.api_key
            }
        })
        self.ws.send(auth_message)
        
        # Wait for auth response (30s timeout for cold start)
        self.ws.settimeout(30)
        response = self.ws.recv()
        response_data = json.loads(response)
        
        if response_data.get('type') == 'auth_success':
            self.authenticated = True
            self.consecutive_failures = 0  # Reset on successful auth
            print(f"  ✅ WebSocket authenticated for kiosk: {self.config.kiosk_id}")
            print(f"  ⏸️  Waiting for admin viewer to start stream...")
        elif response_data.get('type') == 'error':
            print(f"  ❌ WebSocket auth failed: {response_data.get('message')}")
            self.ws.close()
            self.running = False
            return
        
        # Set socket to non-blocking for checking incoming messages
        self.ws.settimeout(0.05)  # 50ms timeout for recv
        
        # Main loop - wait for commands and stream when active
        last_frame_time = 0
        while self.running and self.connected:
            try:
                # Check for incoming messages (start/stop streaming)
                try:
                    message = self.ws.recv()
                    if message:
                        msg_data = json.loads(message)
                        msg_type = msg_data.get('type')
                        
                        if msg_type == 'start_streaming':
                            if not self.streaming_active:
                                self.streaming_active = True
                                print(f"  ▶️  Admin viewer connected - starting stream")
                        elif msg_type == 'stop_streaming':
                            if self.streaming_active:
                                self.streaming_active = False
                                print(f"  ⏹️  No viewers - stopping stream (saving resources)")
                except websocket.WebSocketTimeoutException:
                    pass  # No message, continue
                except json.JSONDecodeError:
                    pass  # Invalid JSON, ignore
                
                # Only stream if viewers are watching
                if not self.streaming_active:
                    time.sleep(0.1)  # Sleep longer when not streaming
                    continue
                
                current_time = time.time()
                if current_time - last_frame_time < self.stream_interval:
                    time.sleep(0.01)  # Small sleep to prevent busy waiting
                    continue
                
                frame = self.frame_holder.get_frame(annotated=True)
                if frame is not None:
                    # Encode frame as JPEG
                    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    jpeg_bytes = jpeg.tobytes()
                    
                    # Send as binary frame with a frame message wrapper
                    # The gateway expects a 'frame' event
                    frame_message = json.dumps({"event": "frame", "data": {}})
                    self.ws.send(frame_message)
                    self.ws.send_binary(jpeg_bytes)
                    
                    self.frames_sent += 1
                    last_frame_time = current_time
                    
                    # Log progress every 100 frames
                    if self.frames_sent % 100 == 0:
                        print(f"  🔌 WebSocket: {self.frames_sent} frames streamed")
                
            except websocket.WebSocketConnectionClosedException:
                print("  ⚠️ WebSocket connection closed")
                self.connected = False
                break
            except Exception as e:
                print(f"  ⚠️ WebSocket send error: {e}")
                self.connected = False
                break
        
        # Clean up
        self.streaming_active = False
        try:
            self.ws.close()
        except:
            pass
    
    def stop(self):
        """Stop the WebSocket streamer"""
        self.running = False
        self.connected = False
        self.streaming_active = False
        if self.ws:
            try:
                self.ws.close()
            except:
                pass
    
    def is_connected(self):
        """Check if WebSocket is connected and authenticated"""
        return self.connected and self.authenticated
    
    def is_streaming(self):
        """Check if actively streaming frames"""
        return self.streaming_active


# =============================================================================
# Screen Frame Streamer - Real-time screen streaming via WebSocket
# =============================================================================

class ScreenFrameStreamer:
    """
    Streams live screen frames to the cloud server via WebSocket for real-time viewing.
    This allows admins to see the kiosk display remotely.
    
    IMPORTANT: Only streams when admin viewers are watching!
    The server sends 'start_streaming' when a viewer subscribes and
    'stop_streaming' when all viewers disconnect.
    
    Protocol (same as webcam):
    1. Connect to WebSocket server at ws(s)://server/ws/screen
    2. Send auth message: {"type": "auth", "kioskId": "...", "apiKey": "..."}
    3. Wait for auth_success response
    4. Wait for 'start_streaming' message (admin viewer watching)
    5. Send binary JPEG frames until 'stop_streaming' received
    """
    
    def __init__(self, config: Config):
        self.config = config
        self.running = True
        self.connected = False
        self.authenticated = False
        self.streaming_active = False  # Only stream when viewers are watching
        self.ws = None
        self.stream_interval = 0.1  # 10 FPS (100ms between frames)
        self.frames_sent = 0
        self.reconnect_delay = 5  # Start with 5 seconds
        self.max_reconnect_delay = 60  # Max 60 seconds
        self.consecutive_failures = 0
        
        # Initialize screen capture
        if mss:
            self.sct = mss.mss()
            self.monitor = self.sct.monitors[1]  # Primary monitor
        else:
            self.sct = None
        
        # Build WebSocket URL for screen endpoint
        server_url = self.config.server_url
        if server_url.startswith('https://'):
            ws_url = 'wss://' + server_url[8:] + '/ws/screen'
        elif server_url.startswith('http://'):
            ws_url = 'ws://' + server_url[7:] + '/ws/screen'
        else:
            ws_url = 'ws://' + server_url + '/ws/screen'
        self.ws_url = ws_url
        
        print(f"  🖥️  Screen frame streamer initializing...")
        print(f"     URL: {self.ws_url}")
        print(f"     Kiosk ID: {self.config.kiosk_id}")
        print(f"     Streaming: ON-DEMAND (only when admin is viewing)")
        
        # Start background connection thread
        self.connect_thread = threading.Thread(target=self._connect_loop, daemon=True)
        self.connect_thread.start()
    
    def _connect_loop(self):
        """Main connection loop - handles reconnection on failures"""
        while self.running:
            try:
                self._connect_and_stream()
            except Exception as e:
                if self.running:
                    print(f"  ⚠️ Screen WebSocket error: {e}")
                    self.connected = False
                    self.authenticated = False
                    self.streaming_active = False
                    
                    # Exponential backoff
                    self.consecutive_failures += 1
                    delay = min(self.reconnect_delay * (2 ** (self.consecutive_failures - 1)), self.max_reconnect_delay)
                    print(f"  🔄 Screen streamer reconnecting in {delay}s...")
                    time.sleep(delay)
    
    def _connect_and_stream(self):
        """Connect to WebSocket and stream screen frames when requested"""
        if not WEBSOCKET_AVAILABLE:
            print("  ⚠️ WebSocket not available for screen streaming")
            self.running = False
            return
        
        if not self.sct and not ImageGrab:
            print("  ⚠️ No screen capture library available (mss or PIL)")
            self.running = False
            return
        
        print(f"  🖥️  Connecting to screen WebSocket: {self.ws_url}")
        
        # Create WebSocket connection
        # Increased timeout to 30s to handle Render.com cold starts
        self.ws = websocket.WebSocket()
        self.ws.connect(self.ws_url, timeout=30)
        self.connected = True
        print(f"  ✅ Screen WebSocket connected")
        
        # Authenticate
        auth_message = json.dumps({
            "event": "auth",
            "data": {
                "kioskId": self.config.kiosk_id,
                "apiKey": self.config.api_key
            }
        })
        self.ws.send(auth_message)
        
        # Wait for auth response (30s timeout for cold start)
        self.ws.settimeout(30)
        response = self.ws.recv()
        response_data = json.loads(response)
        
        if response_data.get('type') == 'auth_success':
            self.authenticated = True
            self.consecutive_failures = 0  # Reset on successful auth
            print(f"  ✅ Screen WebSocket authenticated for kiosk: {self.config.kiosk_id}")
            print(f"  ⏸️  Waiting for admin viewer to start screen stream...")
        elif response_data.get('type') == 'error':
            print(f"  ❌ Screen WebSocket auth failed: {response_data.get('message')}")
            self.ws.close()
            self.running = False
            return
        
        # Set socket to non-blocking for checking incoming messages
        self.ws.settimeout(0.05)  # 50ms timeout for recv
        
        # Main loop - wait for commands and stream when active
        last_frame_time = 0
        while self.running and self.connected:
            try:
                # Check for incoming messages (start/stop streaming)
                try:
                    message = self.ws.recv()
                    if message:
                        msg_data = json.loads(message)
                        msg_type = msg_data.get('type')
                        
                        if msg_type == 'start_streaming':
                            if not self.streaming_active:
                                self.streaming_active = True
                                print(f"  ▶️  Admin viewer connected - starting screen stream")
                        elif msg_type == 'stop_streaming':
                            if self.streaming_active:
                                self.streaming_active = False
                                print(f"  ⏹️  No viewers - stopping screen stream (saving resources)")
                except websocket.WebSocketTimeoutException:
                    pass  # No message, continue
                except json.JSONDecodeError:
                    pass  # Invalid JSON, ignore
                
                # Only stream if viewers are watching
                if not self.streaming_active:
                    time.sleep(0.1)  # Sleep longer when not streaming
                    continue
                
                current_time = time.time()
                if current_time - last_frame_time < self.stream_interval:
                    time.sleep(0.01)  # Small sleep to prevent busy waiting
                    continue
                
                # Capture screen
                frame = self._capture_screen()
                if frame is not None:
                    # Encode frame as JPEG
                    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
                    jpeg_bytes = jpeg.tobytes()
                    
                    # Send as binary frame with a frame message wrapper
                    frame_message = json.dumps({"event": "frame", "data": {}})
                    self.ws.send(frame_message)
                    self.ws.send_binary(jpeg_bytes)
                    
                    self.frames_sent += 1
                    last_frame_time = current_time
                    
                    # Log progress every 100 frames
                    if self.frames_sent % 100 == 0:
                        print(f"  🖥️  Screen stream: {self.frames_sent} frames sent")
                
            except websocket.WebSocketConnectionClosedException:
                print("  ⚠️ Screen WebSocket connection closed")
                self.connected = False
                break
            except Exception as e:
                print(f"  ⚠️ Screen WebSocket send error: {e}")
                self.connected = False
                break
        
        # Clean up
        self.streaming_active = False
        try:
            self.ws.close()
        except:
            pass
    
    def _capture_screen(self):
        """Capture a single screen frame"""
        try:
            if self.sct:
                img = self.sct.grab(self.monitor)
                frame = np.array(img)
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                return frame
            elif ImageGrab:
                screenshot = ImageGrab.grab()
                frame = np.array(screenshot)
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                return frame
        except Exception as e:
            print(f"  ⚠️ Screen capture error: {e}")
        return None
    
    def stop(self):
        """Stop the screen streamer"""
        self.running = False
        self.connected = False
        self.streaming_active = False
        if self.ws:
            try:
                self.ws.close()
            except:
                pass
    
    def is_connected(self):
        """Check if WebSocket is connected and authenticated"""
        return self.connected and self.authenticated
    
    def is_streaming(self):
        """Check if actively streaming screen frames"""
        return self.streaming_active


# =============================================================================
# Detection Reporter - Sends detections to cloud server
# =============================================================================

class DetectionReporter:
    """Handles reporting detections to the cloud server"""
    
    def __init__(self, config: Config):
        self.config = config
        self.pending_queue = queue.Queue()
        self.running = True
        self.cloud_upload_enabled = True  # Upload images to cloud storage
        self.cloud_upload_failures = 0
        self.max_cloud_failures = 5
        
        # Start background upload thread
        self.upload_thread = threading.Thread(target=self._upload_worker, daemon=True)
        self.upload_thread.start()
        print(f"  ☁️  Detection reporter started (cloud image upload: {'enabled' if self.cloud_upload_enabled else 'disabled'})")
    
    def report_detection_with_image(self, person_track_id: int, detected_at: datetime, 
                                    dwell_seconds: float | None, was_counted: bool, 
                                    frame) -> str | None:
        """
        Upload a detection with its image to the cloud.
        Returns the cloud URL of the image, or None if upload failed.
        """
        if not self.cloud_upload_enabled:
            return None
        
        url = f"{self.config.server_url}/surveillance/detection-image"
        headers = {
            'Content-Type': 'image/jpeg',
            'x-kiosk-api-key': self.config.api_key,
            'x-kiosk-id': self.config.kiosk_id,
            'x-person-track-id': str(person_track_id),
            'x-detected-at': detected_at.isoformat(),
            'x-dwell-seconds': str(dwell_seconds) if dwell_seconds else '',
            'x-was-counted': 'true' if was_counted else 'false',
        }
        
        try:
            # Encode frame as JPEG
            _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            response = requests.post(
                url, 
                data=jpeg.tobytes(), 
                headers=headers, 
                timeout=15  # Longer timeout for image upload
            )
            
            if response.status_code == 201:
                result = response.json()
                self.cloud_upload_failures = 0  # Reset failure counter
                if result.get('imageUrl'):
                    print(f"  ☁️  Uploaded detection image to cloud: ID {person_track_id}")
                    return result.get('imageUrl')
                return None
            elif response.status_code == 404:
                # Endpoint not available - disable cloud upload
                if self.cloud_upload_failures == 0:
                    print("  ⚠️ Cloud image upload endpoint not available (404)")
                self.cloud_upload_failures += 1
                if self.cloud_upload_failures >= self.max_cloud_failures:
                    print("  🔇 Cloud image upload disabled (endpoint not available)")
                    self.cloud_upload_enabled = False
                return None
            else:
                print(f"  ⚠️ Cloud image upload failed: {response.status_code}")
                self.cloud_upload_failures += 1
                if self.cloud_upload_failures >= self.max_cloud_failures:
                    print(f"  🔇 Cloud image upload disabled after {self.max_cloud_failures} failures")
                    self.cloud_upload_enabled = False
                return None
                
        except requests.RequestException as e:
            self.cloud_upload_failures += 1
            if self.cloud_upload_failures == 1:
                print(f"  ⚠️ Cloud image upload error: {e}")
            if self.cloud_upload_failures >= self.max_cloud_failures:
                print(f"  🔇 Cloud image upload disabled after {self.max_cloud_failures} failures")
                self.cloud_upload_enabled = False
            return None
    
    def report_detection(self, person_track_id: int, detected_at: datetime, 
                        dwell_seconds: float | None, was_counted: bool, image_path: str | None):
        """Queue a detection for upload (without image - for counted events)"""
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
        self.saved_ids = set()          # IDs whose images have been saved/uploaded
        self.id_cloud_urls = {}         # Track ID -> cloud image URL
        self.daily_count = 0            # Total counted today
        
        # Create local output directory (as backup)
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
            
            # Only save image AND count when person has stayed 8+ seconds
            # (Previously saved at frame_threshold=10 frames, now save only at frames_to_count=40 frames)
            if frame_count >= self.config.frames_to_count and obj_id not in self.counted_ids:
                self.counted_ids.add(obj_id)
                self.saved_ids.add(obj_id)  # Mark as saved
                self.daily_count += 1
                
                # Calculate dwell time
                dwell_seconds = (now - self.id_first_seen[obj_id]).total_seconds()
                
                # Upload image to cloud (only now, after 8+ seconds)
                cloud_url = self.reporter.report_detection_with_image(
                    person_track_id=obj_id,
                    detected_at=now,
                    dwell_seconds=dwell_seconds,
                    was_counted=True,  # Always true now since we save only after count
                    frame=frame,
                )
                
                if cloud_url:
                    # Successfully uploaded to cloud
                    self.id_cloud_urls[obj_id] = cloud_url
                    timestamp = now.strftime('%H:%M:%S')
                    print(f"  ✅ [{timestamp}] ID {obj_id} stayed {dwell_seconds:.1f}s - Saved image - Total: {self.daily_count}")
                else:
                    # Cloud upload failed, save locally as backup
                    local_path = self._save_image_locally(obj_id, now, frame)
                    relative_path = str(local_path.relative_to(self.config.output_dir))
                    self.reporter.report_detection(
                        person_track_id=obj_id,
                        detected_at=now,
                        dwell_seconds=dwell_seconds,
                        was_counted=True,
                        image_path=relative_path,
                    )
                    timestamp = now.strftime('%H:%M:%S')
                    print(f"  ✅ [{timestamp}] ID {obj_id} stayed {dwell_seconds:.1f}s - Saved locally - Total: {self.daily_count}")
    
    def _save_image_locally(self, obj_id: int, timestamp: datetime, frame) -> Path:
        """Save detection image to local disk (backup when cloud upload fails)"""
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
            'cloud_uploads': len(self.id_cloud_urls),
        }


# =============================================================================
# Main Application
# =============================================================================

def parse_args():
    parser = argparse.ArgumentParser(description='SmartWish Kiosk Surveillance with Recording')
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
    
    # Session-based recording arguments
    parser.add_argument('--session-id', help='Session ID for this recording session')
    parser.add_argument('--record-webcam', type=lambda x: x.lower() == 'true', default=True, help='Enable webcam video recording')
    parser.add_argument('--record-screen', type=lambda x: x.lower() == 'true', default=True, help='Enable screen video recording')
    parser.add_argument('--webcam-fps', type=int, default=30, help='Webcam recording FPS')
    parser.add_argument('--screen-fps', type=int, default=1, help='Screen recording FPS')
    parser.add_argument('--output-video-dir', default='./recordings', help='Directory for video recordings')
    
    # Camera angle adjustment arguments
    parser.add_argument('--camera-rotation', type=int, default=0, choices=[0, 90, 180, 270], help='Rotate camera: 0, 90, 180, 270 degrees')
    parser.add_argument('--camera-flip-h', type=lambda x: x.lower() == 'true', default=False, help='Flip camera horizontally')
    parser.add_argument('--camera-flip-v', type=lambda x: x.lower() == 'true', default=False, help='Flip camera vertically')
    
    return parser.parse_args()


# =============================================================================
# Video Recording Classes (Threaded - Like Reference Script)
# =============================================================================

class CameraTransformer:
    """Applies camera angle adjustments (rotation and flips)"""
    
    def __init__(self, rotation=0, flip_h=False, flip_v=False):
        self.rotation = rotation
        self.flip_h = flip_h
        self.flip_v = flip_v
    
    def get_rotation_flag(self, angle):
        """Helper to map angle to OpenCV constants (like reference script)"""
        if angle == 90:
            return cv2.ROTATE_90_CLOCKWISE
        elif angle == 180:
            return cv2.ROTATE_180
        elif angle == 270:
            return cv2.ROTATE_90_COUNTERCLOCKWISE
        return None
    
    def transform(self, frame):
        """Apply rotation and flips to frame"""
        if frame is None:
            return None
        
        # Apply horizontal flip
        if self.flip_h:
            frame = cv2.flip(frame, 1)
        
        # Apply vertical flip
        if self.flip_v:
            frame = cv2.flip(frame, 0)
        
        # Apply rotation
        rotate_code = self.get_rotation_flag(self.rotation)
        if rotate_code is not None:
            frame = cv2.rotate(frame, rotate_code)
        
        return frame


class VideoRecorder:
    """
    Handles webcam capture and video recording.
    
    ARCHITECTURE:
    - Webcam capture thread runs ALWAYS (provides frames for YOLO + streaming)
    - Video recording is OPTIONAL and controlled via start_recording/stop_and_upload
    - Screen recording thread starts/stops with session recording
    
    This ensures:
    1. People counting (YOLO) always works
    2. Recording only happens during sessions (when triggered via HTTP)
    """
    
    def __init__(self, config: Config):
        self.config = config
        self.session_id = None
        self.video_dir = None
        self.webcam_path = None
        self.screen_path = None
        
        # FPS settings
        self.webcam_fps = float(config.webcam_fps) if config.webcam_fps > 0 else 10.0
        self.screen_fps = float(config.screen_fps) if config.screen_fps > 0 else 5.0
        
        # Delays for timing control
        self.webcam_delay = 1.0 / self.webcam_fps
        self.screen_delay = 1.0 / self.screen_fps
        
        # Frame counters
        self.webcam_frame_count = 0
        self.screen_frame_count = 0
        
        # Recording state (for VIDEO writing, not webcam capture)
        self.is_recording = False  # Video writing state
        self.webcam_writer = None
        self.screen_thread = None
        self.screen_stop_event = threading.Event()
        
        # Webcam capture state (always running)
        self.capture_running = False
        self.capture_thread = None
        
        # Camera transformer
        self.camera_transformer = CameraTransformer(
            rotation=config.camera_rotation,
            flip_h=config.camera_flip_h,
            flip_v=config.camera_flip_v
        )
        
        # Webcam index
        self.webcam_index = config.webcam_index
        
        # Shared frame for YOLO (always available from capture thread)
        self.latest_frame = None
        self.frame_lock = threading.Lock()
        
        # Video writer lock
        self.writer_lock = threading.Lock()
    
    def start_capture(self):
        """Start webcam capture thread (always running for YOLO/streaming)"""
        if self.capture_running:
            return
        
        self.capture_running = True
        self.capture_thread = threading.Thread(target=self._webcam_capture_thread, daemon=True)
        self.capture_thread.start()
        print(f"  [Capture] Starting webcam capture thread...")
    
    def get_latest_frame(self):
        """Get the latest webcam frame (for YOLO processing)"""
        with self.frame_lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None
    
    def start_recording(self, session_id=None):
        """Start video recording for a session"""
        if self.is_recording:
            print("  ⚠️ Already recording!")
            return
        
        self.session_id = session_id or f"session-{int(time.time())}"
        self.video_dir = self.config.output_video_dir / self.config.kiosk_id / self.session_id
        self.video_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Reset counters
        self.webcam_frame_count = 0
        self.screen_frame_count = 0
        
        # Set up paths
        if self.config.record_webcam:
            self.webcam_path = self.video_dir / f"webcam_{timestamp}.mp4"
        else:
            self.webcam_path = None
        
        if self.config.record_screen:
            self.screen_path = self.video_dir / f"screen_{timestamp}.mp4"
        else:
            self.screen_path = None
        
        # Start recording flag - this enables video writing in capture thread
        self.is_recording = True
        
        print(f"\n  🎬 STARTED SESSION RECORDING for {self.session_id}")
        print(f"     Webcam recording: {self.config.record_webcam}")
        print(f"     Screen recording: {self.config.record_screen}")
        
        # Start screen recording thread if enabled
        if self.config.record_screen and (mss or ImageGrab):
            self.screen_stop_event.clear()
            self.screen_thread = threading.Thread(target=self._record_screen_thread, daemon=True)
            self.screen_thread.start()
    
    def _webcam_capture_thread(self):
        """
        Webcam capture thread - runs CONTINUOUSLY.
        - Always captures frames (for YOLO/streaming)
        - Optionally writes to video file when is_recording=True
        """
        # Open camera - try configured index first, then scan
        cap = None
        
        # 1. Try configured index
        print(f"  [Capture] Trying configured webcam index: {self.webcam_index}")
        temp_cap = cv2.VideoCapture(self.webcam_index)
        if temp_cap.isOpened():
            ret, _ = temp_cap.read()
            if ret:
                cap = temp_cap
                print(f"  [Capture] ✅ specific webcam {self.webcam_index} opened successfully")
            else:
                print(f"  [Capture] ⚠️ Webcam {self.webcam_index} opened but returned no frame")
                temp_cap.release()
        else:
            print(f"  [Capture] ❌ Failed to open webcam index {self.webcam_index}")
            
        # 2. If failed, scan other indices
        if cap is None:
            print(f"  [Capture] Scanning for available cameras (0-9)...")
            for i in range(10):
                if i == self.webcam_index: continue  # Skip already tried
                
                print(f"  [Capture] Checking index {i}...")
                temp_cap = cv2.VideoCapture(i)
                if temp_cap.isOpened():
                    # Read a frame to be sure
                    ret, _ = temp_cap.read()
                    if ret:
                        print(f"  [Capture] ✅ Found working camera at index {i}")
                        cap = temp_cap
                        self.webcam_index = i  # Update to working index
                        break
                    else:
                         temp_cap.release()
            
        if cap is None:
            print(f"  [Capture] ❌ ERROR: No working webcam found!")
            self.capture_running = False
            return
        
        # Try multiple codecs for best browser compatibility
        # H.264 (avc1/H264) works best in browsers, mp4v is fallback
        codec_options = ['avc1', 'H264', 'mp4v']
        fourcc = None
        codec_name = None
        writer = None
        writer_initialized = False
        
        print(f"  [Capture] Webcam opened (index: {self.webcam_index}, rotation: {self.camera_transformer.rotation}°)")
        
        while self.capture_running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue
            
            # Apply rotation/flips
            transformed = self.camera_transformer.transform(frame)
            
            # Share frame with main loop for YOLO processing (always)
            with self.frame_lock:
                self.latest_frame = transformed
            
            # Write to video file only if recording is active
            if self.is_recording and self.config.record_webcam:
                with self.writer_lock:
                    # Initialize VideoWriter on first frame - try multiple codecs
                    if not writer_initialized and self.webcam_path:
                        height, width = transformed.shape[:2]
                        print(f"  [Recording] Initializing webcam VideoWriter: {width}x{height}")
                        
                        # Try each codec until one works
                        for codec in codec_options:
                            fourcc = cv2.VideoWriter_fourcc(*codec)
                            writer = cv2.VideoWriter(str(self.webcam_path), fourcc, self.webcam_fps, (width, height))
                            if writer.isOpened():
                                codec_name = codec
                                break
                            writer = None
                        
                        if writer and writer.isOpened():
                            writer_initialized = True
                            self.webcam_writer = writer
                            print(f"  [Recording] ✅ Webcam recording started (codec: {codec_name}): {self.webcam_path}")
                        else:
                            print(f"  [Recording] ❌ Failed to open VideoWriter with any codec!")
                            writer = None
                    
                    # Write frame
                    if writer and writer.isOpened():
                        writer.write(transformed)
                        self.webcam_frame_count += 1
                        if self.webcam_frame_count % 100 == 0:
                            print(f"  [Recording] 📹 Webcam: {self.webcam_frame_count} frames")
            
            # If recording stopped, close writer
            elif writer_initialized and not self.is_recording:
                with self.writer_lock:
                    if writer:
                        writer.release()
                        print(f"  [Recording] Webcam writer closed ({self.webcam_frame_count} frames)")
                    writer = None
                    writer_initialized = False
                    self.webcam_writer = None
            
            time.sleep(self.webcam_delay)
        
        # Cleanup
        cap.release()
        if writer:
            writer.release()
        print(f"  [Capture] Webcam capture thread stopped")
    
    def _record_screen_thread(self):
        """
        Screen recording thread - runs only during session recording.
        Captures screen at configured FPS.
        """
        if mss:
            sct = mss.mss()
            monitor = sct.monitors[1]  # Primary monitor
        else:
            sct = None
        
        # Try multiple codecs for best browser compatibility
        codec_options = ['avc1', 'H264', 'mp4v']
        out = None
        codec_name = None
        
        print(f"  [Screen] Ready to record.")
        
        while self.is_recording and not self.screen_stop_event.is_set():
            try:
                # Capture screen
                if sct:
                    img = sct.grab(monitor)
                    frame = np.array(img)
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                elif ImageGrab:
                    screenshot = ImageGrab.grab()
                    frame = np.array(screenshot)
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                else:
                    break
                
                # Initialize VideoWriter on first frame - try multiple codecs
                if out is None:
                    height, width = frame.shape[:2]
                    print(f"  [Screen] Recording resolution: {width}x{height}")
                    
                    # Try each codec until one works
                    for codec in codec_options:
                        fourcc = cv2.VideoWriter_fourcc(*codec)
                        out = cv2.VideoWriter(str(self.screen_path), fourcc, self.screen_fps, (width, height))
                        if out.isOpened():
                            codec_name = codec
                            break
                        out = None
                    
                    if not out or not out.isOpened():
                        print(f"  [Screen] ERROR: Failed to open VideoWriter with any codec!")
                        break
                    print(f"  [Screen] ✅ Screen recording started (codec: {codec_name}): {self.screen_path}")
                
                out.write(frame)
                self.screen_frame_count += 1
                
                if self.screen_frame_count % 30 == 0:
                    print(f"  [Screen] 🖥️ {self.screen_frame_count} frames")
                
                time.sleep(self.screen_delay)
                
            except Exception as e:
                print(f"  [Screen] Error: {e}")
                time.sleep(0.5)
        
        if out:
            out.release()
        print(f"  [Screen] Recording stopped ({self.screen_frame_count} frames)")
    
    def stop_and_upload(self):
        """Stop recording and upload videos to cloud storage"""
        # Idempotent - safe to call multiple times
        if not self.is_recording:
            return
        
        print(f"\n  🛑 STOPPING SESSION RECORDING for {self.session_id}...")
        self.is_recording = False
        
        # Signal screen thread to stop
        self.screen_stop_event.set()
        
        # Wait for screen thread
        if self.screen_thread and self.screen_thread.is_alive():
            self.screen_thread.join(timeout=5.0)
        
        # Close webcam writer (the capture thread will detect is_recording=False and close it)
        # Wait a moment for it to close
        time.sleep(1.0)
        
        # Force close webcam writer if still open
        with self.writer_lock:
            if self.webcam_writer:
                self.webcam_writer.release()
                self.webcam_writer = None
        
        # Small delay to ensure files are fully written
        time.sleep(0.5)
        
        print(f"  📊 Recording stats: Webcam={self.webcam_frame_count} frames, Screen={self.screen_frame_count} frames")
        
        # Upload videos
        if self.webcam_path and self.webcam_path.exists():
            file_size = self.webcam_path.stat().st_size
            if file_size > 1024:  # Only upload if file is larger than 1KB
                print(f"  📤 Uploading webcam video: {file_size / 1024:.2f} KB")
                self._upload_video(self.webcam_path, 'webcam')
            else:
                print(f"  ⚠️ Webcam video too small ({file_size} bytes), skipping upload")
        else:
            print(f"  ℹ️ No webcam video to upload")
        
        if self.screen_path and self.screen_path.exists():
            file_size = self.screen_path.stat().st_size
            if file_size > 1024:  # Only upload if file is larger than 1KB
                print(f"  📤 Uploading screen video: {file_size / 1024:.2f} KB")
                self._upload_video(self.screen_path, 'screen')
            else:
                print(f"  ⚠️ Screen video too small ({file_size} bytes), skipping upload")
        else:
            print(f"  ℹ️ No screen video to upload")
        
        print(f"  ✅ Session recording complete for {self.session_id}")
    
    def _upload_video(self, video_path: Path, video_type: str):
        """Upload video file to cloud storage"""
        if not video_path.exists():
            print(f"  ⚠️ Video file not found: {video_path}")
            return
        
        url = f"{self.config.server_url}/kiosk/session/recording/upload-python"
        
        print(f"  📤 Upload details:")
        print(f"     URL: {url}")
        print(f"     Session ID: {self.session_id}")
        print(f"     Kiosk ID: {self.config.kiosk_id}")
        print(f"     Video type: {video_type}")
        print(f"     File: {video_path}")
        
        headers = {
            'x-kiosk-api-key': self.config.api_key,
            'x-kiosk-id': self.config.kiosk_id,
        }
        
        try:
            file_size = video_path.stat().st_size
            file_size_mb = file_size / 1024 / 1024
            file_size_kb = file_size / 1024
            
            # Determine MIME type based on file extension
            mime_type = 'video/mp4' if video_path.suffix == '.mp4' else 'video/x-msvideo'
            
            print(f"  📤 Uploading {video_type} video ({file_size_kb:.2f} KB / {file_size_mb:.2f} MB)...")
            print(f"     MIME type: {mime_type}")
            
            with open(video_path, 'rb') as f:
                files = {'file': (video_path.name, f, mime_type)}
                data = {
                    'sessionId': self.session_id,
                    'kioskId': self.config.kiosk_id,
                    'type': video_type,
                }
                
                response = requests.post(url, files=files, data=data, headers=headers, timeout=300)
                
                print(f"     Response status: {response.status_code}")
                
                if response.status_code == 200 or response.status_code == 201:
                    result = response.json()
                    print(f"  ✅ {video_type.capitalize()} video uploaded successfully!")
                    print(f"     Storage URL: {result.get('storageUrl', 'N/A')}")
                    print(f"     Storage Path: {result.get('storagePath', 'N/A')}")
                else:
                    print(f"  ❌ Failed to upload {video_type} video: HTTP {response.status_code}")
                    print(f"     Response: {response.text[:500]}")
                    
        except requests.exceptions.Timeout:
            print(f"  ❌ Upload timeout: Server took too long to respond")
        except requests.exceptions.ConnectionError as e:
            print(f"  ❌ Connection error: Could not reach server at {self.config.server_url}")
            print(f"     Error: {e}")
        except Exception as e:
            print(f"  ❌ Error uploading {video_type} video: {type(e).__name__}: {e}")


# Global video recorder instance for signal handling
_video_recorder = None
_should_stop = False


def signal_handler(signum, frame):
    """Handle SIGTERM/SIGINT for graceful shutdown"""
    global _should_stop, _video_recorder
    print(f"\n  ⚠️ Received signal {signum}, initiating graceful shutdown...")
    _should_stop = True
    if _video_recorder:
        _video_recorder.stop_and_upload()


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
    global _video_recorder, _should_stop
    
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
    print(f"  Record Webcam: {config.record_webcam}")
    print(f"  Record Screen: {config.record_screen}")
    print("")
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    print("  ✅ Signal handlers registered (SIGTERM, SIGINT)")
    
    # Find and load YOLO model
    script_dir = Path(__file__).parent
    model_path = find_model_file(script_dir)
    print(f"  📦 Loading YOLO model: {model_path}")
    
    try:
        model = YOLO(str(model_path))
    except Exception as e:
        print(f"  ❌ Failed to load YOLO model: {e}")
        sys.exit(1)
    
    # Initialize video recorder (for webcam capture + optional recording)
    video_recorder = VideoRecorder(config)
    
    # Store globally for signal handler
    _video_recorder = video_recorder
    
    # Start webcam capture thread (ALWAYS runs for YOLO/streaming)
    video_recorder.start_capture()
    
    # Wait for webcam capture thread to start
    print(f"  📹 Waiting for webcam capture...")
    wait_start = time.time()
    while video_recorder.get_latest_frame() is None and time.time() - wait_start < 10:
        time.sleep(0.1)
    if video_recorder.get_latest_frame() is None:
        print(f"  ❌ Webcam capture failed to start")
        sys.exit(1)
    print(f"  ✅ Webcam capture active")
    
    # Start HTTP server (with video_recorder for recording control)
    config.output_dir.mkdir(parents=True, exist_ok=True)
    http_server = start_http_server(config.http_port, config.output_dir, video_recorder, config)
    
    # Initialize reporter, frame streamer, tracker
    reporter = DetectionReporter(config)
    
    # Use WebSocket for real-time streaming (WebSocket is required)
    ws_streamer = None
    screen_streamer = None
    if not WEBSOCKET_AVAILABLE:
        print("  ❌ ERROR: websocket-client package not installed. Install with: pip install websocket-client")
        print("     WebSocket is required for live streaming. Exiting.")
        return
    
    ws_streamer = WebSocketFrameStreamer(config, frame_holder)  # WebSocket streaming
    print("  🔌 Using WebSocket for real-time webcam streaming")
    
    # Also start screen streamer for live screen viewing
    if mss or ImageGrab:
        screen_streamer = ScreenFrameStreamer(config)
        print("  🖥️  Screen streaming enabled (on-demand)")
    
    tracker = PersonTracker(config, reporter)
    
    # NOTE: Recording does NOT auto-start!
    # Recording is started via HTTP POST /recording/start when a session begins
    # Recording is stopped via HTTP POST /recording/stop when a session ends
    print("")
    print("  📝 Session recording is DISABLED by default")
    print("     Recording will start when a session begins (via HTTP command)")
    print("")
    
    # Load tracker config if exists
    tracker_config = script_dir / 'custom_tracker.yaml'
    tracker_yaml = str(tracker_config) if tracker_config.exists() else 'bytetrack.yaml'
    
    print("  🔄 Starting people tracking (YOLO)...")
    print(f"  Logic: Count AND save image if present > {config.dwell_threshold}s.")
    print("  Press 'q' in preview window or Ctrl+C to stop.")
    print("")
    
    frame_interval = 1.0 / config.fps_target  # Target 5 FPS
    
    try:
        while not _should_stop:
            start_time = time.time()
            
            # Get frame from video recorder capture thread (always running)
            frame = video_recorder.get_latest_frame()
            if frame is None:
                time.sleep(0.05)
                continue
            transformed_frame = frame  # Already transformed by capture thread
            
            # Run YOLO tracking on frame
            results = model.track(
                source=transformed_frame,
                persist=True,
                classes=[0],  # Only detect people (class 0)
                tracker=tracker_yaml,
                verbose=False,
                stream=True
            )
            
            for r in results:
                if r.boxes is not None and r.boxes.id is not None:
                    track_ids = r.boxes.id.int().tolist()
                    tracker.process_detections(track_ids, transformed_frame)
                
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
                frame_holder.set_frame(transformed_frame, annotated_frame)
                
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
        
        # Stop and upload video recordings if active
        if video_recorder.is_recording:
            video_recorder.stop_and_upload()
        
        # Stop webcam capture
        video_recorder.capture_running = False
        if video_recorder.capture_thread:
            video_recorder.capture_thread.join(timeout=2.0)
        
        # Stop frame streaming
        if ws_streamer:
            ws_streamer.stop()
        # frame_uploader removed
        reporter.stop()
        cv2.destroyAllWindows()
        print("  ✅ Surveillance stopped")


if __name__ == '__main__':
    main()
