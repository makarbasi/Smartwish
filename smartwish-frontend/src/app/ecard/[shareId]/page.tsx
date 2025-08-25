"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowLeftIcon,
    HeartIcon
} from "@heroicons/react/24/outline";

interface ECard {
    id: string;
    cardId: string;
    senderName: string;
    senderEmail: string;
    message: string;
    createdAt: string;
    cardData: {
        id: string;
        title: string;
        description: string;
        designData: {
            templateKey: string;
            pages: Array<{
                header: string;
                image: string;
                text: string;
                footer: string;
            }>;
        };
        image1?: string;
        image2?: string;
        image3?: string;
        image4?: string;
    };
}

export default function ECardViewer() {
    const params = useParams();
    const shareId = params?.shareId as string;
    const [eCard, setECard] = useState<ECard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [isFlipping, setIsFlipping] = useState(false);

    useEffect(() => {
        if (!shareId) return;

        const fetchECard = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/ecard/view/${shareId}`);
                const data = await response.json();

                if (data.success) {
                    setECard(data.eCard);
                } else {
                    setError(data.error || "E-Card not found");
                }
            } catch (err) {
                console.error("Error fetching E-Card:", err);
                setError("Failed to load E-Card");
            } finally {
                setLoading(false);
            }
        };

        fetchECard();
    }, [shareId]);

    const getCardImages = (): string[] => {
        if (!eCard?.cardData) return [];

        const images = [
            eCard.cardData.image1,
            eCard.cardData.image2,
            eCard.cardData.image3,
            eCard.cardData.image4,
        ].filter(Boolean) as string[];

        return images.length > 0 ? images : ["/placeholder-image.jpg"];
    };

    const cardImages = getCardImages();
    const totalPages = cardImages.length;

    const nextPage = () => {
        if (isFlipping) return;
        setIsFlipping(true);
        setTimeout(() => {
            setCurrentPage((prev) => (prev + 1) % totalPages);
            setIsFlipping(false);
        }, 150);
    };

    const prevPage = () => {
        if (isFlipping) return;
        setIsFlipping(true);
        setTimeout(() => {
            setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
            setIsFlipping(false);
        }, 150);
    };

    const goToPage = (pageIndex: number) => {
        if (isFlipping || pageIndex === currentPage) return;
        setIsFlipping(true);
        setTimeout(() => {
            setCurrentPage(pageIndex);
            setIsFlipping(false);
        }, 150);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-medium text-gray-700">Loading your E-Card...</p>
                </div>
            </div>
        );
    }

    if (error || !eCard) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">😔</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">E-Card Not Found</h1>
                    <p className="text-gray-600 mb-6">
                        {error || "This E-Card may have expired or the link is invalid."}
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Visit SmartWish
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">SW</span>
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900">SmartWish</h1>
                                <p className="text-xs text-gray-500">Digital E-Card</p>
                            </div>
                        </div>
                        <Link
                            href="/"
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Create Your Own
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Sender Info */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200 mb-4">
                        <HeartIcon className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-gray-700">
                            From <span className="text-gray-900 font-semibold">{eCard.senderName}</span>
                        </span>
                    </div>
                    {eCard.message && (
                        <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                            <p className="text-gray-700 italic text-lg leading-relaxed">
                                &ldquo;{eCard.message}&rdquo;
                            </p>
                            <p className="text-right text-sm text-gray-500 mt-3">
                                — {eCard.senderName}
                            </p>
                        </div>
                    )}
                </div>

                {/* Card Viewer */}
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Card Display */}
                    <div className="flex-1 max-w-lg mx-auto">
                        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
                            {/* Navigation Arrows */}
                            {totalPages > 1 && (
                                <>
                                    <button
                                        onClick={prevPage}
                                        disabled={isFlipping}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/70 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                                    >
                                        <ChevronLeftIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={nextPage}
                                        disabled={isFlipping}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/70 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                                    >
                                        <ChevronRightIcon className="h-5 w-5" />
                                    </button>
                                </>
                            )}

                            {/* Card Image */}
                            <div className={`relative aspect-[640/989] transition-transform duration-150 ${isFlipping ? 'scale-95' : 'scale-100'}`}>
                                <Image
                                    src={cardImages[currentPage]}
                                    alt={`Card page ${currentPage + 1}`}
                                    fill
                                    className="object-cover"
                                    priority
                                    onError={(e) => {
                                        e.currentTarget.src = "/placeholder-image.jpg";
                                    }}
                                />
                            </div>

                            {/* Page Indicator */}
                            {totalPages > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-2">
                                    {cardImages.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => goToPage(index)}
                                            className={`w-2 h-2 rounded-full transition-all ${index === currentPage
                                                ? 'bg-white scale-125'
                                                : 'bg-white/50 hover:bg-white/75'
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Page Navigation */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-6">
                                <button
                                    onClick={prevPage}
                                    disabled={isFlipping}
                                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600 font-medium px-4">
                                    {currentPage + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={nextPage}
                                    disabled={isFlipping}
                                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Next
                                    <ChevronRightIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Card Info Sidebar */}
                    <div className="w-full lg:w-80">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 sticky top-24">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">
                                {eCard.cardData.title}
                            </h2>

                            {eCard.cardData.description && (
                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    {eCard.cardData.description}
                                </p>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Sent on</p>
                                    <p className="text-gray-900">
                                        {new Date(eCard.createdAt).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Category</p>
                                    <p className="text-gray-900">Digital Greeting Card</p>
                                </div>

                                {totalPages > 1 && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 mb-1">Pages</p>
                                        <p className="text-gray-900">{totalPages} pages</p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 mt-6 pt-6">
                                <p className="text-sm text-gray-500 text-center mb-4">
                                    Want to create your own E-Cards?
                                </p>
                                <Link
                                    href="/"
                                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium"
                                >
                                    <span>Visit SmartWish</span>
                                    <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-md flex items-center justify-center">
                                <span className="text-white font-bold text-xs">SW</span>
                            </div>
                            <span className="font-bold text-gray-900">SmartWish</span>
                        </div>
                        <p className="text-sm text-gray-500">
                            Creating beautiful digital experiences, one card at a time.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
