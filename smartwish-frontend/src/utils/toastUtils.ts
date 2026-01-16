import { useToast, ToastType } from '@/contexts/ToastContext';

// Common toast message functions
export const showSuccessToast = (title: string, message?: string) => {
    // This will be called from components that have access to useToast
    return { type: 'success' as ToastType, title, message };
};

export const showErrorToast = (title: string, message?: string) => {
    return { type: 'error' as ToastType, title, message };
};

export const showWarningToast = (title: string, message?: string) => {
    return { type: 'warning' as ToastType, title, message };
};

export const showInfoToast = (title: string, message?: string) => {
    return { type: 'info' as ToastType, title, message };
};

// Predefined toast messages for common actions
export const TOAST_MESSAGES = {
    // Card operations
    CARD_SAVED: { type: 'success' as ToastType, title: 'Card Saved', message: 'Your card has been saved successfully!' },
    CARD_PUBLISHED: { type: 'success' as ToastType, title: 'Card Published', message: 'Your card has been published to the marketplace!' },
    CARD_DELETED: { type: 'success' as ToastType, title: 'Card Deleted', message: 'Card has been deleted successfully.' },
    CARD_DUPLICATED: { type: 'success' as ToastType, title: 'Card Duplicated', message: 'Card has been duplicated successfully.' },

    // Contact operations
    CONTACT_SAVED: { type: 'success' as ToastType, title: 'Contact Saved', message: 'Contact information has been saved successfully!' },
    CONTACT_DELETED: { type: 'success' as ToastType, title: 'Contact Deleted', message: 'Contact has been deleted successfully.' },
    CONTACT_UPDATED: { type: 'success' as ToastType, title: 'Contact Updated', message: 'Contact information has been updated successfully!' },

    // Template operations
    TEMPLATE_LOADED: { type: 'success' as ToastType, title: 'Template Loaded', message: 'Template has been loaded successfully!' },
    TEMPLATE_SAVED: { type: 'success' as ToastType, title: 'Template Saved', message: 'Template has been saved successfully!' },

    // AI operations
    AI_REQUEST_SENT: { type: 'info' as ToastType, title: 'AI Processing', message: 'Your AI request is being processed...' },
    AI_REQUEST_COMPLETED: { type: 'success' as ToastType, title: 'AI Complete', message: 'AI processing has been completed successfully!' },

    // Authentication
    SIGN_IN_REQUIRED: { type: 'warning' as ToastType, title: 'Sign In Required', message: 'Please sign in to perform this action.' },
    SESSION_EXPIRED: { type: 'warning' as ToastType, title: 'Session Expired', message: 'Your session has expired. Please sign in again.' },

    // Errors
    NETWORK_ERROR: { type: 'error' as ToastType, title: 'Network Error', message: 'Please check your internet connection and try again.' },
    UNKNOWN_ERROR: { type: 'error' as ToastType, title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' },
    VALIDATION_ERROR: { type: 'error' as ToastType, title: 'Validation Error', message: 'Please check your input and try again.' },

    // File operations
    FILE_UPLOADED: { type: 'success' as ToastType, title: 'File Uploaded', message: 'File has been uploaded successfully!' },
    FILE_UPLOAD_FAILED: { type: 'error' as ToastType, title: 'Upload Failed', message: 'Failed to upload file. Please try again.' },
    IMAGE_LOADED: { type: 'success' as ToastType, title: 'Image Loaded', message: 'Image has been loaded successfully!' },
    IMAGE_LOAD_FAILED: { type: 'error' as ToastType, title: 'Image Load Failed', message: 'Failed to load image. Please try again.' },

    // General operations
    CHANGES_SAVED: { type: 'success' as ToastType, title: 'Changes Saved', message: 'Your changes have been saved successfully!' },
    OPERATION_CANCELLED: { type: 'info' as ToastType, title: 'Operation Cancelled', message: 'Operation has been cancelled.' },
    LOADING: { type: 'info' as ToastType, title: 'Loading', message: 'Please wait while we process your request...' },
};

// Helper function to create custom error toasts
export const createErrorToast = (operation: string, error: any) => {
    let message = 'An unexpected error occurred.';

    if (error?.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }

    return {
        type: 'error' as ToastType,
        title: `${operation} Failed`,
        message: message.length > 100 ? message.substring(0, 100) + '...' : message
    };
};

// Helper function to create custom success toasts
export const createSuccessToast = (operation: string, itemName?: string) => {
    const message = itemName
        ? `${operation} completed successfully for "${itemName}"!`
        : `${operation} completed successfully!`;

    return {
        type: 'success' as ToastType,
        title: `${operation} Successful`,
        message
    };
};
