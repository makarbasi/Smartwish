-- Check kiosk configuration and surveillance settings
SELECT 
    kc.kiosk_id,
    kc.name,
    kc.config->'surveillance'->>'enabled' as surveillance_enabled,
    kc.config->'recording'->>'recordWebcam' as record_webcam,
    kc.config->'recording'->>'recordScreen' as record_screen,
    kc.config->'surveillance'->>'webcamIndex' as webcam_index,
    kc.config->'recording'->>'webcamFps' as webcam_fps,
    kc.config->'recording'->>'cameraRotation' as camera_rotation
FROM kiosk_configs kc
WHERE kc.kiosk_id = 'PC_KIOSK_2';

-- To enable surveillance, run:
-- UPDATE kiosk_configs 
-- SET config = jsonb_set(
--     COALESCE(config, '{}'::jsonb),
--     '{surveillance,enabled}',
--     'true'::jsonb
-- )
-- WHERE kiosk_id = 'PC_KIOSK_2';

-- Check all kiosks with surveillance enabled
SELECT 
    kc.kiosk_id,
    kc.name,
    kc.config->'surveillance'->>'enabled' as surveillance_enabled,
    kc.config->'recording'->>'recordWebcam' as record_webcam,
    kc.config->'recording'->>'recordScreen' as record_screen
FROM kiosk_configs kc
ORDER BY kc.kiosk_id;
