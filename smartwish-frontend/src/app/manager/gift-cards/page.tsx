"use client";

import { useState, useEffect, useRef, Suspense, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import {
  MagnifyingGlassIcon,
  MinusCircleIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CreditCardIcon,
  ArrowPathIcon,
  QrCodeIcon,
  VideoCameraIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

// Tab types
type TabType = "check" | "redeem" | "history";

interface CardInfo {
  id: string;
  cardNumber: string;
  currentBalance: number;
  initialBalance: number;
  status: string;
  brandName: string;
  expiresAt: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  timestamp: string;
  referenceId?: string;
}

function GiftCardsContent() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get("action") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(initialAction || "check");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // QR Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Check Balance State
  const [cardNumber, setCardNumber] = useState("");
  const [cardCode, setCardCode] = useState<string | null>(null); // QR code data
  const [pin, setPin] = useState("");
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);

  // Redeem State
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemDescription, setRedeemDescription] = useState("");
  const [lastRedemption, setLastRedemption] = useState<{
    amount: number;
    previousBalance: number;
    newBalance: number;
  } | null>(null);

  // History State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyCardNumber, setHistoryCardNumber] = useState("");

  // Update tab based on URL params
  useEffect(() => {
    if (initialAction && ["check", "redeem", "history"].includes(initialAction)) {
      setActiveTab(initialAction);
    }
  }, [initialAction]);

  // Clear messages when switching tabs
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [activeTab]);

  // Initialize QR Scanner
  useEffect(() => {
    if (showScanner && !scannerRef.current) {
      // Dynamically import html5-qrcode
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        const scannerId = "manager-qr-reader";
        
        // Wait for DOM element to be ready
        const initScanner = () => {
          const element = document.getElementById(scannerId);
          if (!element) {
            setTimeout(initScanner, 100);
            return;
          }

          const scanner = new Html5Qrcode(scannerId);
          scannerRef.current = scanner;

          scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText: string) => {
              console.log("✅ QR Code scanned:", decodedText);
              handleQrScan(decodedText);
              // Stop scanner after successful scan
              scanner.stop().catch(console.error);
              scannerRef.current = null;
              setShowScanner(false);
            },
            () => {
              // QR scanning in progress - ignore errors
            }
          ).then(() => {
            setScannerReady(true);
          }).catch((err: Error) => {
            console.error("Failed to start scanner:", err);
            setError("Failed to access camera. Please check permissions and try again.");
            setShowScanner(false);
          });
        };

        initScanner();
      }).catch((err) => {
        console.error("Failed to load QR scanner:", err);
        setError("Failed to load QR scanner");
        setShowScanner(false);
      });
    }

    // Cleanup on unmount or when scanner is closed
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
      // Try to parse as SmartWish gift card QR
      const parsed = JSON.parse(scannedData);
      if (parsed.type === "smartwish_giftcard" && parsed.code) {
        setCardCode(scannedData);
        setCardNumber(""); // Clear manual entry
        setSuccess("🎉 Gift card QR scanned successfully! Please enter the PIN to view balance.");
        return;
      }
    } catch {
      // Not JSON, might be card number directly
    }

    // Fallback: treat as card number
    if (scannedData.startsWith("SW") && scannedData.length === 16) {
      setCardNumber(scannedData);
      setCardCode(null);
      setSuccess("🎉 Card number scanned! Please enter the PIN to view balance.");
    } else {
      setError("Invalid QR code. Please scan a SmartWish gift card QR code.");
    }
  };

  // Close scanner handler
  const closeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerReady(false);
    setShowScanner(false);
  };

  // Check Balance Handler
  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setCardInfo(null);

    // Determine payload based on whether we have QR code or manual entry
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
      setSuccess("✅ Balance retrieved successfully");
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
      setError("Please check the card balance first");
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

      setLastRedemption({
        amount: data.amountRedeemed,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
      });

      // Update card info with new balance
      setCardInfo((prev) =>
        prev ? { ...prev, currentBalance: data.newBalance, status: data.cardStatus } : null
      );

      setRedeemAmount("");
      setRedeemDescription("");
      setSuccess(`Successfully redeemed $${amount.toFixed(2)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Transaction History
  const handleFetchHistory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardInfo?.id) {
      setError("Please check a card first to view its history");
      return;
    }

    setLoading(true);
    setError(null);
    setTransactions([]);

    try {
      const response = await fetch(`/api/manager/gift-cards/${cardInfo.id}/transactions`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transactions");
      }

      setTransactions(data.transactions || []);
      setHistoryCardNumber(data.cardNumber);
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
    setLastRedemption(null);
    setTransactions([]);
    setHistoryCardNumber("");
    setError(null);
    setSuccess(null);
    closeScanner();
  };

  const tabs = [
    { id: "check" as TabType, name: "Check Balance", icon: MagnifyingGlassIcon },
    { id: "redeem" as TabType, name: "Redeem", icon: MinusCircleIcon },
    { id: "history" as TabType, name: "History", icon: ClockIcon },
  ];

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gift Card Manager</h1>
        <p className="mt-2 text-sm text-gray-600">
          Check balances, process redemptions, and view transaction history.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }
              `}
            >
              <tab.icon
                className={`mr-2 h-5 w-5 ${
                  activeTab === tab.id ? "text-teal-500" : "text-gray-400"
                }`}
              />
              {tab.name}
            </button>
          ))}
        </nav>
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
            {/* Check Balance Tab */}
            {activeTab === "check" && (
              <form onSubmit={handleCheckBalance} className="space-y-4">
                {/* Scan QR Code Button */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full inline-flex justify-center items-center px-4 py-3 border-2 border-dashed border-teal-300 text-sm font-medium rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                  >
                    <QrCodeIcon className="h-6 w-6 mr-2" />
                    <span>Scan Gift Card QR Code</span>
                    <VideoCameraIcon className="h-5 w-5 ml-2 text-teal-500" />
                  </button>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-gray-500">or enter manually</span>
                  </div>
                </div>

                {/* QR Scanned Indicator */}
                {cardCode && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-green-700 font-medium">QR Code Scanned</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCardCode(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* Card Number (hidden when QR scanned) */}
                {!cardCode && (
                  <div>
                    <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700">
                      Card Number
                    </label>
                    <input
                      type="text"
                      id="cardNumber"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.toUpperCase())}
                      placeholder="SWXXXXXXXXXXXX"
                      maxLength={16}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">16-character card number starting with SW</p>
                  </div>
                )}

                <div>
                  <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
                    PIN
                  </label>
                  <input
                    type="password"
                    id="pin"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="****"
                    maxLength={4}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm font-mono"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">4-digit PIN provided with the gift card</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || (!cardCode && !cardNumber)}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                        Check Balance
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    Reset
                  </button>
                </div>
              </form>
            )}

            {/* Redeem Tab */}
            {activeTab === "redeem" && (
              <div className="space-y-4">
                {!cardInfo ? (
                  <div className="text-center py-8">
                    <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No card loaded</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Please check a card balance first before redeeming.
                    </p>
                    <button
                      onClick={() => setActiveTab("check")}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-teal-600 hover:bg-teal-700"
                    >
                      <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                      Check Balance First
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRedeem} className="space-y-4">
                    <div>
                      <label htmlFor="redeemAmount" className="block text-sm font-medium text-gray-700">
                        Amount to Redeem
                      </label>
                      <div className="mt-1 relative rounded-lg shadow-sm">
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
                          className="block w-full rounded-lg border border-gray-300 pl-7 pr-4 py-2 focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                          required
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Available balance: ${cardInfo.currentBalance.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="redeemDescription" className="block text-sm font-medium text-gray-700">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        id="redeemDescription"
                        value={redeemDescription}
                        onChange={(e) => setRedeemDescription(e.target.value)}
                        placeholder="e.g., Purchase at Store #123"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <MinusCircleIcon className="h-5 w-5 mr-2" />
                            Redeem Amount
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Last Redemption Info */}
                {lastRedemption && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="text-sm font-medium text-green-800 mb-2">Last Redemption</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-green-600">Amount</p>
                        <p className="font-semibold text-green-900">-${lastRedemption.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-green-600">Previous Balance</p>
                        <p className="font-semibold text-green-900">${lastRedemption.previousBalance.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-green-600">New Balance</p>
                        <p className="font-semibold text-green-900">${lastRedemption.newBalance.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {!cardInfo ? (
                  <div className="text-center py-8">
                    <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No card loaded</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Please check a card balance first to view its history.
                    </p>
                    <button
                      onClick={() => setActiveTab("check")}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-teal-600 hover:bg-teal-700"
                    >
                      <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                      Check Balance First
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleFetchHistory}
                      disabled={loading}
                      className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ClockIcon className="h-5 w-5 mr-2" />
                          Load Transaction History
                        </>
                      )}
                    </button>

                    {transactions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Transactions for {historyCardNumber}
                        </h4>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Type
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                  Amount
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                  Balance
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {transactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {new Date(tx.timestamp).toLocaleDateString()}{" "}
                                    <span className="text-xs">
                                      {new Date(tx.timestamp).toLocaleTimeString()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        tx.type === "purchase"
                                          ? "bg-green-100 text-green-800"
                                          : tx.type === "redemption"
                                          ? "bg-red-100 text-red-800"
                                          : tx.type === "refund"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {tx.type}
                                    </span>
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-sm text-right font-medium ${
                                      tx.type === "redemption" ? "text-red-600" : "text-green-600"
                                    }`}
                                  >
                                    {tx.type === "redemption" ? "-" : "+"}${tx.amount.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    ${tx.balanceAfter.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {transactions.length === 0 && !loading && historyCardNumber && (
                      <p className="text-center text-sm text-gray-500 py-4">
                        No transactions found for this card.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Card Information</h3>

            {cardInfo ? (
              <div className="space-y-4">
                {/* Card Visual */}
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl p-4 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs uppercase tracking-wider opacity-80">SmartWish</span>
                    <CreditCardIcon className="h-6 w-6 opacity-80" />
                  </div>
                  <p className="font-mono text-lg tracking-wider mb-4">{cardInfo.cardNumber}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs opacity-80">Balance</p>
                      <p className="text-2xl font-bold">${cardInfo.currentBalance.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-80">{cardInfo.brandName}</p>
                    </div>
                  </div>
                </div>

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

                {cardInfo.currentBalance > 0 && cardInfo.status === "active" && (
                  <button
                    onClick={() => setActiveTab("redeem")}
                    className="w-full mt-4 inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700"
                  >
                    <MinusCircleIcon className="h-5 w-5 mr-2" />
                    Redeem From This Card
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCardIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  Enter card details and check balance to see card information.
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
                  <div className="p-4">
                    <div
                      id="manager-qr-reader"
                      ref={scannerContainerRef}
                      className="w-full rounded-lg overflow-hidden bg-gray-900"
                      style={{ minHeight: 300 }}
                    />
                    
                    {!scannerReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
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
                          Hold the gift card steady and ensure the QR code is clearly visible within the camera view.
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
