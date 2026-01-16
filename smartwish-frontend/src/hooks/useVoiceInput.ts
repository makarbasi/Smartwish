/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';

interface UseVoiceInputProps {
    onResult: (transcript: string) => void;
    onError?: (error: string) => void;
}

export const useVoiceInput = ({ onResult, onError }: UseVoiceInputProps) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Check if speech recognition is supported
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                setIsSupported(true);
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    onResult(transcript);
                    setIsRecording(false);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    if (onError) {
                        onError(event.error === 'no-speech' ? 'No speech detected. Please try again.' : 'Voice input error. Please try again.');
                    }
                    setIsRecording(false);
                };

                recognitionRef.current.onend = () => {
                    setIsRecording(false);
                };
            } else {
                setIsSupported(false);
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [onResult, onError]);

    const startRecording = () => {
        if (recognitionRef.current && !isRecording) {
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (error) {
                console.error('Failed to start recording:', error);
                if (onError) {
                    onError('Failed to start voice input');
                }
            }
        }
    };

    const stopRecording = () => {
        if (recognitionRef.current && isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    return {
        isRecording,
        isSupported,
        startRecording,
        stopRecording,
    };
};

