'use client';

import { useState } from 'react';

interface ChatFeedbackWidgetProps {
  onSubmit: (feedback: string) => Promise<void>;
}

const feedbackOptions = [
  { value: 1, emoji: '😞', label: 'Very Unhappy' },
  { value: 2, emoji: '😕', label: 'Unhappy' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Happy' },
  { value: 5, emoji: '😄', label: 'Very Happy' },
];

export default function ChatFeedbackWidget({ onSubmit }: ChatFeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);

  const isUnhappy = selectedRating !== null && selectedRating <= 2;

  const handleRatingSelect = (value: number) => {
    setSelectedRating(value);
    // Auto-expand text input for unhappy ratings
    if (value <= 2) {
      setShowTextInput(true);
    }
  };

  const handleSubmit = async () => {
    if (selectedRating === null) return;
    
    setIsSubmitting(true);
    try {
      const ratingLabel = feedbackOptions.find(o => o.value === selectedRating)?.label || '';
      const emoji = feedbackOptions.find(o => o.value === selectedRating)?.emoji || '';
      
      let feedbackMessage = `📋 Feedback: ${emoji} ${ratingLabel} (${selectedRating}/5)`;
      
      if (feedbackText.trim()) {
        feedbackMessage += `\n💬 Comment: "${feedbackText.trim()}"`;
      }
      
      await onSubmit(feedbackMessage);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-indigo-900">
          ⭐ Rate your experience
        </p>
        {selectedRating !== null && !isUnhappy && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
          >
            {isSubmitting ? 'Sending...' : 'Submit'}
          </button>
        )}
      </div>

      {/* Rating Buttons - Always Visible */}
      <div className="flex justify-between gap-1 mb-2">
        {feedbackOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleRatingSelect(option.value)}
            className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg transition-all ${
              selectedRating === option.value
                ? 'bg-indigo-600 text-white shadow-md scale-105'
                : 'bg-white hover:bg-indigo-100 text-gray-700 border border-gray-200'
            }`}
            title={option.label}
          >
            <span className="text-xl sm:text-2xl">{option.emoji}</span>
          </button>
        ))}
      </div>

      {/* Feedback text area - shows for unhappy or when expanded */}
      {(isUnhappy || (showTextInput && selectedRating !== null)) && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          {isUnhappy ? (
            <label className="block text-xs font-medium text-indigo-800 mb-1">
              We&apos;re sorry! Please tell us what went wrong:
            </label>
          ) : (
            <label className="block text-xs font-medium text-indigo-800 mb-1">
              Any comments? <span className="text-indigo-400">(optional)</span>
            </label>
          )}
          <div className="flex gap-2">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={isUnhappy ? "Please tell us what went wrong..." : "Share your thoughts..."}
              rows={2}
              maxLength={500}
              className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (isUnhappy && !feedbackText.trim())}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all self-end ${
                isSubmitting || (isUnhappy && !feedbackText.trim())
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? '...' : 'Send'}
            </button>
          </div>
          {isUnhappy && !feedbackText.trim() && (
            <p className="text-xs text-amber-600 mt-1">
              Please share your feedback to help us improve
            </p>
          )}
        </div>
      )}

      {/* Add comment link for happy ratings */}
      {selectedRating !== null && selectedRating > 2 && !showTextInput && (
        <button
          onClick={() => setShowTextInput(true)}
          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          + Add a comment
        </button>
      )}
    </div>
  );
}
