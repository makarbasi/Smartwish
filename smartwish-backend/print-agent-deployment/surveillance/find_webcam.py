"""
Find available webcams and their indices
"""
import cv2

print("Searching for available webcams...")
print("=" * 50)

found_cameras = []

# Check indices 0-9
for i in range(10):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret:
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            found_cameras.append({
                'index': i,
                'width': width,
                'height': height,
                'fps': fps
            })
            print(f"✅ Camera {i}: {width}x{height} @ {fps:.1f} FPS")
        cap.release()

print("=" * 50)

if found_cameras:
    print(f"\nFound {len(found_cameras)} camera(s)")
    print(f"\nUse webcamIndex: {found_cameras[0]['index']} for the first camera")
    
    if len(found_cameras) > 1:
        print("\nOther cameras available:")
        for cam in found_cameras[1:]:
            print(f"  - webcamIndex: {cam['index']}")
else:
    print("\n❌ No cameras found!")
    print("\nTroubleshooting:")
    print("  1. Make sure your webcam is connected")
    print("  2. Check if another app is using the camera")
    print("  3. Try running as Administrator")
    print("  4. Check Windows Device Manager for camera drivers")

input("\nPress Enter to exit...")
