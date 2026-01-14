"use client";

import { useState, useEffect, useRef, Suspense, Fragment } from "react";
import {
  MinusCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CreditCardIcon,
  ArrowPathIcon,
  QrCodeIcon,
  VideoCameraIcon,
  XMarkIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface CardInfo {
  id: string;
  cardNumber: string;
  currentBalance: number;
  initialBalance: number;
  status: string;
  brandName: string;
  expiresAt: string;
}

type Step = "scan" | "pin" | "balance" | "redeem";

function GiftCardsContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Current step in the flow
  const [step, setStep] = useState<Step>("scan");

  // QR Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<any>(null);

  // Card data
  const [cardCode, setCardCode] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [pin, setPin] = useState("");
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);

  // Redeem State
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemDescription, setRedeemDescription] = useState("");

  // Initialize QR Scanner with better camera handling
  useEffect(() => {
    if (showScanner && !scannerRef.current) {
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        const scannerId = "manager-qr-reader";
        
        const initScanner = () => {
          const element = document.getElementById(scannerId);
          if (!element) {
            setTimeout(initScanner, 100);
            return;
          }

          const scanner = new Html5Qrcode(scannerId);
          scannerRef.current = scanner;

          // Try to get available cameras first
          Html5Qrcode.getCameras()
            .then((devices) => {
              console.log("Available cameras:", devices);
              
              // Try environment (rear) camera first, then user (front) camera
              const cameraConfigs = [
                { facingMode: "environment" },
                { facingMode: "user" },
                ...(devices.length > 0 ? [{ deviceId: devices[0].id }] : []),
              ];

              let currentConfigIndex = 0;

              const tryStartScanner = (config: any) => {
                scanner
                  .start(
                    config,
                    {
                      fps: 10,
                      qrbox: { width: 250, height: 250 },
                    },
                    (decodedText: string) => {
                      console.log("✅ QR Code scanned:", decodedText);
                      handleQrScan(decodedText);
                      scanner.stop().catch(console.error);
                      scannerRef.current = null;
                      setShowScanner(false);
                    },
                    () => {
                      // QR scanning in progress - ignore errors
                    }
                  )
                  .then(() => {
                    setScannerReady(true);
                  })
                  .catch((err: Error) => {
                    console.error(`Failed to start with config ${currentConfigIndex}:`, err);
                    
                    // Try next camera config
                    currentConfigIndex++;
                    if (currentConfigIndex < cameraConfigs.length) {
                      console.log(`Trying next camera config: ${currentConfigIndex}`);
                      tryStartScanner(cameraConfigs[currentConfigIndex]);
                    } else {
                      console.error("All camera configs failed");
                      setError("No camera found. Please ensure your device has a camera and grant camera permissions.");
                      setShowScanner(false);
                    }
                  });
              };

              tryStartScanner(cameraConfigs[0]);
            })
            .catch((err) => {
              console.error("Failed to get cameras:", err);
              // Fallback: try with default facingMode
              scanner
                .start(
                  { facingMode: "environment" },
                  {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                  },
                  (decodedText: string) => {
                    handleQrScan(decodedText);
                    scanner.stop().catch(console.error);
                    scannerRef.current = null;
                    setShowScanner(false);
                  },
                  () => {}
                )
                .then(() => setScannerReady(true))
                .catch((fallbackErr) => {
                  console.error("Fallback camera start failed:", fallbackErr);
                  setError("Failed to access camera. Please check permissions and try again.");
                  setShowScanner(false);
                });
            });
        };

        initScanner();
      }).catch((err) => {
        console.error("Failed to load QR scanner:", err);
        setError("Failed to load QR scanner");
        setShowScanner(false);
      });
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
        setScannerReady(false);
      }
    };
  }, [showScanner]);

  // Handle QR code scan result
  const handleQrScan = (scannedData: string) => {
    setError(null);
    
    try {
      const parsed = JSON.parse(scannedData);
      if (parsed.type === "smartwish_giftcard" && parsed.code) {
        setCardCode(scannedData);
        setCardNumber("");
        setStep("pin");
        setSuccess("✅ QR code scanned! Please enter the PIN.");
        return;
      }
    } catch {
      // Not JSON
    }

    if (scannedData.startsWith("SW") && scannedData.length === 16) {
      setCardNumber(scannedData);
      setCardCode(null);
      setStep("pin");
      setSuccess("✅ Card number scanned! Please enter the PIN.");
    } else {
      setError("Invalid QR code. Please scan a SmartWish gift card QR code.");
    }
  };

  // Check balance after PIN entry
  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: { cardNumber?: string; cardCode?: string; pin: string } = { pin };
    if (cardCode) {
      payload.cardCode = cardCode;
    } else if (cardNumber) {
      payload.cardNumber = cardNumber;
    } else {
      setError("Please scan a QR code or enter a card number");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/manager/gift-cards/check-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check balance");
      }

      setCardInfo(data.card);
      setStep("redeem");
      setSuccess("✅ Balance loaded. Enter amount to redeem.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Redeem Handler
  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardInfo) {
      setError("Card information not available");
      return;
    }

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (amount > cardInfo.currentBalance) {
      setError(`Amount exceeds available balance ($${cardInfo.currentBalance.toFixed(2)})`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/manager/gift-cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: cardInfo.id,
          pin,
          amount,
          description: redeemDescription || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to redeem gift card");
      }

      // Update card info with new balance
      setCardInfo((prev) =>
        prev ? { ...prev, currentBalance: data.newBalance, status: data.cardStatus } : null
      );

      setRedeemAmount("");
      setRedeemDescription("");
      setSuccess(`✅ Successfully redeemed $${amount.toFixed(2)}. New balance: $${data.newBalance.toFixed(2)}`);
      
      // Reset after 3 seconds
      setTimeout(() => {
        handleReset();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Reset all state
  const handleReset = () => {
    setCardNumber("");
    setCardCode(null);
    setPin("");
    setCardInfo(null);
    setRedeemAmount("");
    setRedeemDescription("");
    setError(null);
    setSuccess(null);
    setStep("scan");
    closeScanner();
  };

  const closeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerReady(false);
    setShowScanner(false);
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Redeem Gift Card</h1>
        <p className="mt-2 text-sm text-gray-600">
          Scan the QR code, enter PIN, and redeem from the card balance.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 border border-green-200">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* Step 1: Scan QR Code */}
            {step === "scan" && (
              <div className="space-y-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full inline-flex justify-center items-center px-6 py-4 border-2 border-dashed border-teal-300 text-base font-medium rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                  >
                    <QrCodeIcon className="h-8 w-8 mr-3" />
                    <span>Scan Gift Card QR Code</span>
                    <VideoCameraIcon className="h-6 w-6 ml-3 text-teal-500" />
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-gray-500">or enter manually</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Card Number
                  </label>
                  <input
                    type="text"
                    id="cardNumber"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.toUpperCase())}
                    placeholder="SWXXXXXXXXXXXX"
                    maxLength={16}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm font-mono"
                  />
                  <p className="mt-1 text-xs text-gray-500">16-character card number starting with SW</p>
                </div>

                {cardNumber && (
                  <button
                    onClick={() => setStep("pin")}
                    className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    Continue
                  </button>
                )}
              </div>
            )}

            {/* Step 2: Enter PIN */}
            {step === "pin" && (
              <form onSubmit={handleCheckBalance} className="space-y-4">
                {(cardCode || cardNumber) && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-green-700 font-medium">
                        {cardCode ? "QR Code Scanned" : `Card: ${cardNumber}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCardCode(null);
                        setCardNumber("");
                        setStep("scan");
                      }}
                      className="text-green-600 hover:text-green-800"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                    PIN
                  </label>
                  <input
                    type="password"
                    id="pin"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="****"
                    maxLength={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm font-mono"
                    required
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500">4-digit PIN provided with the gift card</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || !pin || pin.length !== 4}
                    className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                        Loading Balance...
                      </>
                    ) : (
                      <>
                        <LockClosedIcon className="h-5 w-5 mr-2" />
                        Check Balance & Continue
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPin("");
                      setStep("scan");
                    }}
                    className="px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Redeem */}
            {step === "redeem" && cardInfo && (
              <form onSubmit={handleRedeem} className="space-y-4">
                {/* Balance Display */}
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl p-6 text-white mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs uppercase tracking-wider opacity-80">SmartWish</span>
                    <CreditCardIcon className="h-6 w-6 opacity-80" />
                  </div>
                  <p className="font-mono text-lg tracking-wider mb-4">{cardInfo.cardNumber}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs opacity-80">Current Balance</p>
                      <p className="text-3xl font-bold">${cardInfo.currentBalance.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-80">{cardInfo.brandName}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="redeemAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Redeem
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      id="redeemAmount"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="0.00"
                      min="0.01"
                      max={cardInfo.currentBalance}
                      step="0.01"
                      className="block w-full rounded-lg border border-gray-300 pl-7 pr-4 py-3 focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Available balance: <span className="font-semibold">${cardInfo.currentBalance.toFixed(2)}</span>
                  </p>
                  
                  {/* Quick amount buttons */}
                  <div className="flex gap-2 mt-3">
                    {[5, 10, 25, cardInfo.currentBalance].map((amount) => {
                      const displayAmount = amount === cardInfo.currentBalance ? "Full" : `$${amount}`;
                      const actualAmount = amount === cardInfo.currentBalance ? cardInfo.currentBalance : amount;
                      
                      if (actualAmount > cardInfo.currentBalance) return null;
                      
                      return (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setRedeemAmount(actualAmount.toFixed(2))}
                          className="flex-1 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          {displayAmount}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="redeemDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    id="redeemDescription"
                    value={redeemDescription}
                    onChange={(e) => setRedeemDescription(e.target.value)}
                    placeholder="e.g., Purchase at Store #123"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || !redeemAmount || parseFloat(redeemAmount) <= 0}
                    className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <MinusCircleIcon className="h-5 w-5 mr-2" />
                        Redeem ${redeemAmount || "0.00"}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                  >
                    New Card
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Card Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Card Information</h3>

            {cardInfo ? (
              <div className="space-y-4">
                {/* Card Details */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status</span>
                    <span
                      className={`font-medium ${
                        cardInfo.status === "active"
                          ? "text-green-600"
                          : cardInfo.status === "depleted"
                          ? "text-gray-600"
                          : "text-red-600"
                      }`}
                    >
                      {cardInfo.status.charAt(0).toUpperCase() + cardInfo.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Initial Balance</span>
                    <span className="font-medium text-gray-900">
                      ${cardInfo.initialBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Used Amount</span>
                    <span className="font-medium text-gray-900">
                      ${(cardInfo.initialBalance - cardInfo.currentBalance).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Expires</span>
                    <span className="font-medium text-gray-900">
                      {new Date(cardInfo.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {cardInfo.status === "depleted" && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 shrink-0" />
                    <p className="text-sm text-yellow-700">This card has been fully used.</p>
                  </div>
                )}

                {cardInfo.status === "expired" && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                    <XCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">This card has expired.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCardIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  {step === "scan" && "Scan QR code or enter card number to begin"}
                  {step === "pin" && "Enter PIN to view balance"}
                  {step === "redeem" && "Card information will appear here"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <Transition appear show={showScanner} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeScanner}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                      <QrCodeIcon className="h-6 w-6 mr-2 text-teal-600" />
                      Scan Gift Card
                    </Dialog.Title>
                    <button
                      onClick={closeScanner}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Scanner Container */}
                  <div className="p-4 relative">
                    <div
                      id="manager-qr-reader"
                      className="w-full rounded-lg overflow-hidden bg-gray-900"
                      style={{ minHeight: 300 }}
                    />
                    
                    {!scannerReady && (
                      <div className="absolute inset-4 flex items-center justify-center bg-gray-900/50 rounded-lg">
                        <div className="text-center text-white">
                          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Starting camera...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-start gap-3">
                      <VideoCameraIcon className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-700 font-medium">Position the QR code in the frame</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Hold the gift card steady and ensure the QR code is clearly visible.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cancel Button */}
                  <div className="px-6 py-4 border-t border-gray-100">
                    <button
                      onClick={closeScanner}
                      className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default function ManagerGiftCardsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      }
    >
      <GiftCardsContent />
    </Suspense>
  );
}
