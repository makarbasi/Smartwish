'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Printer {
  name: string;
  status: string;
  isDefault?: boolean;
}

interface PrinterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (printerName: string) => void;
  pdfBlob: Blob | null;
  cardName: string;
}

export default function PrinterSelectionModal({
  isOpen,
  onClose,
  onPrint,
  pdfBlob,
  cardName
}: PrinterSelectionModalProps) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Get available printers when modal opens
  useEffect(() => {
    if (isOpen) {
      getAvailablePrinters();
    }
  }, [isOpen]);

  const getAvailablePrinters = async () => {
    setLoading(true);
    setError('');
    
    try {
      // For web browsers, we can't directly access system printers
      // We'll simulate common printer options and use the browser's print dialog
      const mockPrinters: Printer[] = [
        { name: 'Default Printer', status: 'Ready', isDefault: true },
        { name: 'Microsoft Print to PDF', status: 'Ready' },
        { name: 'Microsoft XPS Document Writer', status: 'Ready' },
      ];
      
      // In a real implementation, you might call a backend API or use Electron APIs
      // to get actual system printers
      setPrinters(mockPrinters);
      setSelectedPrinter(mockPrinters[0]?.name || '');
    } catch (err) {
      setError('Failed to load printers');
      console.error('Error loading printers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedPrinter || !pdfBlob) {
      setError('Please select a printer and ensure PDF is ready');
      return;
    }

    try {
      setLoading(true);
      
      // Create a URL for the PDF blob
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open the PDF in a new window for printing
      const printWindow = window.open(pdfUrl, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          // Trigger print dialog
          printWindow.print();
          
          // Clean up the URL after a longer delay to allow user control
          setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
            // Don't auto-close the window - let user control it
          }, 5000);
        };
        
        // Complete the print process
        setTimeout(() => {
          setLoading(false);
          onPrint(selectedPrinter);
          onClose();
        }, 1000);
      } else {
        // Fallback: create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `${cardName}_print.pdf`;
        downloadLink.click();
        URL.revokeObjectURL(pdfUrl);
        
        setLoading(false);
        alert('Print dialog was blocked. PDF has been downloaded instead.');
        onPrint(selectedPrinter);
        onClose();
      }
    } catch (err) {
      setLoading(false);
      setError('Failed to print. Please try again.');
      console.error('Print error:', err);
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfBlob) return;
    
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = pdfUrl;
    downloadLink.download = `${cardName}_print.pdf`;
    downloadLink.click();
    URL.revokeObjectURL(pdfUrl);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-md space-y-4 bg-white p-6 rounded-lg shadow-xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <PrinterIcon className="h-6 w-6 mr-2 text-indigo-600" />
              Print Card
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Card: <span className="font-medium">{cardName}</span>
              </p>
              <p className="text-sm text-gray-600">
                PDF generated successfully. Select a printer to continue.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-sm text-gray-600">Loading printers...</span>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Printer:
                </label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Default)' : ''} - {printer.status}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
            >
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={!selectedPrinter || loading}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Print
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}