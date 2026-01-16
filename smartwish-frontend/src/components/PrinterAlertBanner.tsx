'use client';

import React, { useState, useEffect } from 'react';
import { usePrinterStatusSafe, PrinterError, PrinterWarning } from '@/contexts/PrinterStatusContext';

// =============================================================================
// Types
// =============================================================================

interface PrinterAlertBannerProps {
  /** Position of the banner */
  position?: 'top' | 'bottom';
  /** Whether to show minor warnings (like low ink/paper) */
  showWarnings?: boolean;
  /** Custom class name for styling */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getErrorIcon(code: string): string {
  switch (code) {
    case 'no_paper':
    case 'paper_empty':
    case 'tray_empty':
    case 'low_paper':
      return '📄';
    case 'paper_jam':
      return '🚫';
    case 'no_ink':
    case 'ink_critical':
    case 'low_ink':
      return '🖨️';
    case 'door_open':
      return '🚪';
    case 'offline':
    case 'device_down':
      return '📡';
    case 'service_needed':
      return '🔧';
    case 'output_full':
    case 'output_near_full':
      return '📤';
    default:
      return '⚠️';
  }
}

function getErrorColor(code: string): string {
  // Critical errors - red
  if (['no_paper', 'paper_empty', 'tray_empty', 'paper_jam', 'no_ink', 'ink_critical', 'door_open', 'offline', 'device_down'].includes(code)) {
    return 'from-red-600 to-red-700';
  }
  // Warnings - amber
  if (['low_paper', 'low_ink', 'service_needed', 'output_near_full'].includes(code)) {
    return 'from-amber-500 to-amber-600';
  }
  // Default - yellow
  return 'from-yellow-500 to-yellow-600';
}

function formatErrorMessage(error: PrinterError | PrinterWarning): string {
  // Use the message from the error, or create a friendly one
  if (error.message) {
    return error.message;
  }
  
  switch (error.code) {
    case 'no_paper':
      return 'Printer is out of paper';
    case 'paper_empty':
      return 'Paper tray is empty';
    case 'tray_empty':
      return 'Input tray is empty';
    case 'low_paper':
      return 'Paper is running low';
    case 'paper_jam':
      return 'Paper jam detected - please clear';
    case 'no_ink':
      return 'Printer is out of ink';
    case 'ink_critical':
      return `${error.color || 'Ink'} is critically low`;
    case 'low_ink':
      return `${error.color || 'Ink'} is running low`;
    case 'door_open':
      return 'Printer door is open';
    case 'offline':
      return 'Printer is offline';
    case 'device_down':
      return 'Printer is not responding';
    case 'service_needed':
      return 'Printer needs service';
    case 'output_full':
      return 'Output tray is full';
    case 'output_near_full':
      return 'Output tray is nearly full';
    default:
      return `Printer issue: ${error.code}`;
  }
}

// =============================================================================
// Component
// =============================================================================

export const PrinterAlertBanner: React.FC<PrinterAlertBannerProps> = ({
  position = 'top',
  showWarnings = false,
  className = '',
}) => {
  const printerStatus = usePrinterStatusSafe();
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // If printer status context is not available, don't render
  if (!printerStatus) {
    return null;
  }

  const {
    status,
    isOnline,
    hasCriticalErrors,
    hasErrors,
    hasWarnings,
    criticalErrors,
    allErrors,
    allWarnings,
    dismissedAlerts,
    dismissAlert,
    lastUpdated,
  } = printerStatus;

  // Don't show anything if:
  // - Status is loading/unknown
  // - Printer is online with no errors/warnings
  // - All alerts have been dismissed
  if (!status) {
    return null;
  }

  // Gather errors to display
  const displayErrors: Array<PrinterError | PrinterWarning> = [];
  
  // Always show critical errors
  criticalErrors.forEach((e) => {
    if (!dismissedAlerts.has(e.code)) {
      displayErrors.push(e);
    }
  });

  // Show non-critical errors
  allErrors.forEach((e) => {
    if (!criticalErrors.some((c) => c.code === e.code) && !dismissedAlerts.has(e.code)) {
      displayErrors.push(e);
    }
  });

  // Optionally show warnings
  if (showWarnings) {
    allWarnings.forEach((w) => {
      if (!dismissedAlerts.has(w.code)) {
        displayErrors.push(w);
      }
    });
  }

  // Add offline error if printer is offline and not already shown
  if (!isOnline && !displayErrors.some((e) => e.code === 'offline')) {
    displayErrors.unshift({
      code: 'offline',
      message: 'Printer is offline - please check connection',
    });
  }

  // Don't render if no errors to display
  if (displayErrors.length === 0) {
    return null;
  }

  const primaryError = displayErrors[0];
  const additionalCount = displayErrors.length - 1;
  const colorClass = getErrorColor(primaryError.code);

  // Position classes
  const positionClasses = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0';

  return (
    <div
      className={`fixed ${positionClasses} z-50 ${className}`}
      role="alert"
      aria-live="polite"
    >
      {/* Main banner */}
      <div
        className={`bg-gradient-to-r ${colorClass} text-white shadow-lg`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Left: Icon and message */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Animated icon */}
              <span className="text-2xl animate-pulse flex-shrink-0">
                {getErrorIcon(primaryError.code)}
              </span>
              
              {/* Message */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">
                  {formatErrorMessage(primaryError)}
                </p>
                
                {/* Additional errors indicator */}
                {additionalCount > 0 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm text-white/90 hover:text-white underline mt-0.5"
                  >
                    {isExpanded ? 'Hide' : `+${additionalCount} more issue${additionalCount > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-sm">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <span>{isOnline ? 'Connected' : 'Disconnected'}</span>
              </div>

              {/* Dismiss button (only for non-critical single errors) */}
              {displayErrors.length === 1 && !['offline', 'no_paper', 'paper_jam'].includes(primaryError.code) && (
                <button
                  onClick={() => dismissAlert(primaryError.code)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Dismiss alert"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded error list */}
      {isExpanded && displayErrors.length > 1 && (
        <div className="bg-gray-900/95 text-white shadow-lg border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <ul className="space-y-2">
              {displayErrors.map((error, index) => (
                <li 
                  key={`${error.code}-${index}`}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getErrorIcon(error.code)}</span>
                    <span>{formatErrorMessage(error)}</span>
                  </div>
                  
                  {/* Dismiss individual error */}
                  {!['offline', 'no_paper', 'paper_jam', 'door_open'].includes(error.code) && (
                    <button
                      onClick={() => dismissAlert(error.code)}
                      className="text-gray-400 hover:text-white p-1"
                      title="Dismiss"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            
            {/* Last updated */}
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-white/10">
                Last checked: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Compact Status Indicator (for corners/headers)
// =============================================================================

interface PrinterStatusIndicatorProps {
  /** Whether to show text label */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PrinterStatusIndicator: React.FC<PrinterStatusIndicatorProps> = ({
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const printerStatus = usePrinterStatusSafe();

  if (!printerStatus || !printerStatus.status) {
    return null;
  }

  const { isOnline, hasCriticalErrors, hasErrors, hasWarnings } = printerStatus;

  // Determine status color and text
  let statusColor = 'bg-green-500';
  let statusText = 'Printer Ready';
  
  if (!isOnline || hasCriticalErrors) {
    statusColor = 'bg-red-500';
    statusText = 'Printer Error';
  } else if (hasErrors) {
    statusColor = 'bg-orange-500';
    statusText = 'Printer Issue';
  } else if (hasWarnings) {
    statusColor = 'bg-yellow-500';
    statusText = 'Printer Warning';
  }

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span 
        className={`${sizeClasses[size]} ${statusColor} rounded-full ${
          hasCriticalErrors || !isOnline ? 'animate-pulse' : ''
        }`}
      />
      {showLabel && (
        <span className={`${textSizeClasses[size]} text-gray-400`}>
          {statusText}
        </span>
      )}
    </div>
  );
};

export default PrinterAlertBanner;
