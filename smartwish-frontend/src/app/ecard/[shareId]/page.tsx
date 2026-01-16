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
import QRCode from "qrcode";

interface GiftCardData {
    storeName: string;
    amount: number;
    qrCode?: string;
    storeLogo?: string;
    redemptionLink?: string;
    code?: string;
    pin?: string;
}

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
        metadata?: any;
    } | null;
    // Gift card data attached to the e-card
    giftCardData?: GiftCardData | null;
}

export default function ECardViewer() {
    const params = useParams();
    const shareId = params?.shareId as string;
    const [eCard, setECard] = useState<ECard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [isFlipping, setIsFlipping] = useState(false);
    const [generatedQrCode, setGeneratedQrCode] = useState<string | null>(null);

    useEffect(() => {
        if (!shareId) return;

        const fetchECard = async () => {
            try {
                // Fetch the ecard using the new API endpoint
                const response = await fetch(`/api/ecard/${shareId}`);
                const data = await response.json();

                if (data.success && data.ecard) {
                    // Use the ecard data directly
                    const ecardData = data.ecard;
                    
                    console.log('═══════════════════════════════════════════════════════════')
                    console.log('📧 E-CARD VIEWER - Data received from API')
                    console.log('📧 ecardData.id:', ecardData.id)
                    console.log('📧 ecardData.giftCardData:', ecardData.giftCardData ? 'PRESENT' : 'NOT PRESENT')
                    if (ecardData.giftCardData) {
                        console.log('🎁 Gift card details:', {
                            storeName: ecardData.giftCardData.storeName,
                            amount: ecardData.giftCardData.amount,
                            hasQrCode: !!ecardData.giftCardData.qrCode,
                            qrCodeLength: ecardData.giftCardData.qrCode?.length || 0,
                            hasRedemptionLink: !!ecardData.giftCardData.redemptionLink
                        });
                    }
                    console.log('═══════════════════════════════════════════════════════════')
                    
                    const ecard: ECard = {
                        id: ecardData.id,
                        cardId: ecardData.cardId,
                        senderName: ecardData.senderName,
                        senderEmail: ecardData.senderEmail,
                        message: ecardData.message,
                        createdAt: ecardData.createdAt,
                        cardData: ecardData.cardData,
                        // Include gift card data from the e-card record
                        giftCardData: ecardData.giftCardData || null
                    };
                    console.log('🎁 E-card state set with giftCardData:', ecard.giftCardData ? 'YES' : 'NO');
                    setECard(ecard);
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
        if (!eCard?.cardData) {
            return [];
        }

        // First try to get images from image1-image4 properties
        const directImages = [
            eCard.cardData.image1,
            eCard.cardData.image2,
            eCard.cardData.image3,
            eCard.cardData.image4,
        ].filter(Boolean) as string[];

        // If no direct images, try to get from designData pages
        if (directImages.length === 0 && eCard.cardData.designData?.pages) {
            const pageImages = eCard.cardData.designData.pages
                .map(page => page.image)
                .filter(Boolean) as string[];
            if (pageImages.length < 3) {
                return pageImages.length > 0 ? pageImages : ["/placeholder-image.jpg"];
            }
            const swapped = [...pageImages];
            [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
            return swapped;
        }

        if (directImages.length > 0) {
            if (directImages.length < 3) return directImages;
            const swapped = [...directImages];
            [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
            return swapped;
        }

        return ["/placeholder-image.jpg"];
    };

    const cardImages = getCardImages();
    const totalPages = cardImages.length;

    // Extract gift card data - prefer direct giftCardData, fallback to metadata
    const giftCardData = eCard?.giftCardData || eCard?.cardData?.metadata?.giftCard || null;
    
    // Log gift card extraction for debugging
    if (eCard) {
        console.log('🎁 Gift card extraction:', {
            fromEcardGiftCardData: eCard.giftCardData ? 'YES' : 'NO',
            fromMetadata: eCard.cardData?.metadata?.giftCard ? 'YES' : 'NO',
            finalGiftCardData: giftCardData ? {
                storeName: giftCardData.storeName,
                amount: giftCardData.amount,
                hasQrCode: !!giftCardData.qrCode,
                qrCodeLength: giftCardData.qrCode?.length || 0,
                hasRedemptionLink: !!giftCardData.redemptionLink
            } : 'NULL'
        });
    }
    
    // Generate QR code dynamically if not present but we have redemption info
    useEffect(() => {
        const generateQR = async () => {
            if (giftCardData && !giftCardData.qrCode && !generatedQrCode) {
                // Determine QR content from available data
                let qrContent = giftCardData.redemptionLink || '';
                
                if (!qrContent && giftCardData.code) {
                    qrContent = giftCardData.code;
                    if (giftCardData.pin) {
                        qrContent += ` PIN: ${giftCardData.pin}`;
                    }
                }
                
                if (!qrContent) {
                    qrContent = `${giftCardData.storeName} - $${giftCardData.amount}`;
                }
                
                console.log('🎁 Generating QR code dynamically for:', qrContent.substring(0, 50) + '...');
                
                try {
                    const qrDataUrl = await QRCode.toDataURL(qrContent, {
                        width: 200,
                        margin: 2,
                        color: { dark: '#2d3748', light: '#ffffff' },
                        errorCorrectionLevel: 'H'
                    });
                    setGeneratedQrCode(qrDataUrl);
                    console.log('✅ QR code generated dynamically, length:', qrDataUrl.length);
                } catch (error) {
                    console.error('❌ Failed to generate QR code:', error);
                }
            }
        };
        
        generateQR();
    }, [giftCardData, generatedQrCode]);
    
    // Use stored QR code or dynamically generated one
    const displayQrCode = giftCardData?.qrCode || generatedQrCode;

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
                            <Image
                                src="/resources/logo/logo-full.png"
                                alt="SmartWish"
                                width={288}
                                height={96}
                                className="h-24 w-auto"
                            />
                            <div>
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
                                {cardImages[currentPage] && (
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
                                )}
                                {!cardImages[currentPage] && (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                        <p className="text-gray-500">No image available</p>
                                    </div>
                                )}

                                {/* Gift Card QR Code and Logo Overlay - Show on page 3 (index 2) */}
                                {currentPage === 2 && giftCardData && displayQrCode && (
                                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200 z-10">
                                        <div className="flex flex-col items-center space-y-3">
                                            {/* QR Code and Logo side-by-side */}
                                            <div className="flex items-center space-x-4">
                                                {/* QR Code on left */}
                                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                                    <img
                                                        src={displayQrCode}
                                                        alt="Gift Card QR Code"
                                                        className="w-24 h-24 object-contain"
                                                    />
                                                </div>

                                                {/* Company Logo on right (same size as QR code) */}
                                                {giftCardData.storeLogo && (
                                                    <div className="bg-white p-2 rounded-lg shadow-sm">
                                                        <img
                                                            src={giftCardData.storeLogo}
                                                            alt={giftCardData.storeName}
                                                            className="w-24 h-24 object-contain"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Company Name and Amount centered below */}
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-gray-800">{giftCardData.storeName}</p>
                                                <p className="text-xs text-gray-600">${giftCardData.amount}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                {eCard.cardData?.title || "E-Card"}
                            </h2>

                            {eCard.message && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Message from {eCard.senderName}</p>
                                    <p className="text-gray-700 italic leading-relaxed">
                                        &ldquo;{eCard.message}&rdquo;
                                    </p>
                                </div>
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

                                {giftCardData && (
                                    <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                            </svg>
                                            <p className="text-sm font-semibold text-green-800">Gift Card Included</p>
                                        </div>
                                        <p className="text-xs text-green-700">
                                            {giftCardData.storeName} - ${giftCardData.amount}
                                        </p>
                                        <p className="text-xs text-green-600 mt-1">
                                            View on page 3 for details
                                        </p>
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
                            <Image
                                src="/resources/logo/logo-full.png"
                                alt="SmartWish"
                                width={240}
                                height={80}
                                className="h-20 w-auto"
                            />
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
