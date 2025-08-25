"use client";

import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

interface SendECardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (email: string, message: string) => void;
    cardName: string;
    cardThumbnail: string;
    isLoading?: boolean;
}

export default function SendECardModal({
    isOpen,
    onClose,
    onSend,
    cardName,
    cardThumbnail,
    isLoading = false,
}: SendECardModalProps) {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState<{ email?: string; message?: string }>({});

    const validateForm = () => {
        const newErrors: { email?: string; message?: string } = {};

        // Email validation
        if (!email.trim()) {
            newErrors.email = "Email address is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email address";
        }

        // Message validation (optional but helpful)
        if (message.length > 500) {
            newErrors.message = "Message cannot exceed 500 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSend = () => {
        if (validateForm()) {
            onSend(email.trim(), message.trim());
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setEmail("");
            setMessage("");
            setErrors({});
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isLoading) {
            handleSend();
        }
    };

    return (
        <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="mx-auto max-w-md w-full bg-white rounded-2xl shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                                <PaperAirplaneIcon className="h-5 w-5 text-white" />
                            </div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Send E-Card
                            </DialogTitle>
                        </div>
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Card Preview */}
                    <div className="px-6 pb-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            {cardThumbnail && cardThumbnail.trim() !== "" ? (
                                <Image
                                    src={cardThumbnail}
                                    alt={cardName}
                                    width={48}
                                    height={48}
                                    className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                    onError={(e) => {
                                        // Fall back to a simple div with icon if image fails
                                        const target = e.currentTarget;
                                        const parent = target.parentElement;
                                        if (parent) {
                                            parent.innerHTML = `
                                                <div class="w-12 h-12 bg-gray-200 rounded-lg border border-gray-200 flex items-center justify-center">
                                                    <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                    </svg>
                                                </div>
                                            `;
                                        }
                                    }}
                                />
                            ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded-lg border border-gray-200 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {cardName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Digital greeting card
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="px-6 space-y-4">
                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Recipient Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                className={`block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${errors.email
                                    ? "border-red-300 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500"
                                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500"
                                    }`}
                                placeholder="Enter recipient's email"
                            />
                            {errors.email && (
                                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                            )}
                        </div>

                        {/* Message Field */}
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                                Personal Message
                                <span className="text-gray-500 font-normal"> (optional)</span>
                            </label>
                            <textarea
                                id="message"
                                rows={3}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                className={`block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none ${errors.message
                                    ? "border-red-300 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500"
                                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500"
                                    }`}
                                placeholder="Add a personal message for the recipient..."
                            />
                            <div className="mt-1 flex justify-between items-center">
                                {errors.message ? (
                                    <p className="text-xs text-red-600">{errors.message}</p>
                                ) : (
                                    <div />
                                )}
                                <p className="text-xs text-gray-500">
                                    {message.length}/500
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 p-6 pt-5">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !email.trim()}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                    Send E-Card
                                </>
                            )}
                        </button>
                    </div>

                    {/* Helper text */}
                    <div className="px-6 pb-6">
                        <p className="text-xs text-gray-500 text-center">
                            The recipient will receive an email with a link to view your greeting card
                        </p>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
