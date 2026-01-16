'use client'

import { useState } from 'react'
import { VirtualInput, VirtualTextarea } from '@/components/VirtualInput'

export default function KeyboardTestPage() {
  const [textInput, setTextInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [numberInput, setNumberInput] = useState('')
  const [telInput, setTelInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [textareaInput, setTextareaInput] = useState('')

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 pb-96">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🎹 Virtual Keyboard Test
          </h1>
          <p className="text-lg text-gray-600">
            Tap on any input field below to test the virtual keyboard
          </p>
          <div className="mt-4 inline-block bg-green-100 border border-green-300 rounded-lg px-4 py-2">
            <p className="text-sm text-green-800 font-medium">
              ✅ Backend not required - Pure frontend feature!
            </p>
          </div>
        </div>

        {/* Test Inputs */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {/* Text Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              📝 Text Input (Full QWERTY Keyboard)
            </label>
            <VirtualInput
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Tap here to test text input..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            {textInput && (
              <p className="mt-2 text-sm text-gray-600">
                You typed: <span className="font-mono font-bold">{textInput}</span>
              </p>
            )}
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              📧 Email Input (Email-Optimized Keyboard)
            </label>
            <VirtualInput
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Tap to enter email (notice @ and . keys)..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            {emailInput && (
              <p className="mt-2 text-sm text-gray-600">
                Email: <span className="font-mono font-bold">{emailInput}</span>
              </p>
            )}
          </div>

          {/* Number Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              🔢 Number Input (Numeric Keypad)
            </label>
            <VirtualInput
              type="number"
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="Tap to see numeric keypad..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            {numberInput && (
              <p className="mt-2 text-sm text-gray-600">
                Number: <span className="font-mono font-bold">{numberInput}</span>
              </p>
            )}
          </div>

          {/* Tel Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              📱 Phone Input (Numeric Keypad)
            </label>
            <VirtualInput
              type="tel"
              value={telInput}
              onChange={(e) => setTelInput(e.target.value)}
              placeholder="Tap to enter phone number..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            {telInput && (
              <p className="mt-2 text-sm text-gray-600">
                Phone: <span className="font-mono font-bold">{telInput}</span>
              </p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              🔒 Password Input (Full Keyboard)
            </label>
            <VirtualInput
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Tap to enter password..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            {passwordInput && (
              <p className="mt-2 text-sm text-gray-600">
                Password length: <span className="font-mono font-bold">{passwordInput.length} characters</span>
              </p>
            )}
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              📄 Textarea (Multi-line Text)
            </label>
            <VirtualTextarea
              value={textareaInput}
              onChange={(e) => setTextareaInput(e.target.value)}
              placeholder="Tap to enter multi-line text..."
              rows={4}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
            />
            {textareaInput && (
              <p className="mt-2 text-sm text-gray-600">
                Character count: <span className="font-mono font-bold">{textareaInput.length}</span>
              </p>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-blue-900 mb-3">
            🧪 Testing Instructions
          </h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">1️⃣</span>
              <span>Tap on any input field above to trigger the virtual keyboard</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2️⃣</span>
              <span>Notice different keyboard layouts for different input types</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3️⃣</span>
              <span>Type on the virtual keyboard and see the input update in real-time</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4️⃣</span>
              <span>Use the red "Close" button to dismiss the keyboard</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">5️⃣</span>
              <span>Try switching between inputs to test keyboard transitions</span>
            </li>
          </ul>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm text-center">
            <div className="text-2xl mb-2">⌨️</div>
            <div className="text-sm font-semibold text-gray-900">Full QWERTY</div>
            <div className="text-xs text-gray-600 mt-1">Complete keyboard layout</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm text-center">
            <div className="text-2xl mb-2">📱</div>
            <div className="text-sm font-semibold text-gray-900">Touch-Friendly</div>
            <div className="text-xs text-gray-600 mt-1">Large buttons for kiosks</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm text-center">
            <div className="text-2xl mb-2">🎯</div>
            <div className="text-sm font-semibold text-gray-900">Smart Layouts</div>
            <div className="text-xs text-gray-600 mt-1">Auto-adapts to input type</div>
          </div>
        </div>
      </div>
    </div>
  )
}

