'use client'

import { useState } from 'react'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'

// helper removed (unused)

type SocialState = {
  facebook: string
  instagram: string
  tiktok: string
  snapchat: string
}

// Brand icons (from Simple Icons), sized to fit 24x24 and using currentColor
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.35C0 23.407.593 24 1.325 24H12.82V14.706H9.69V11.09h3.13V8.413c0-3.1 1.893-4.788 4.66-4.788 1.325 0 2.463.097 2.795.141v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.764v2.319h3.59l-.467 3.616h-3.123V24h6.127C23.407 24 24 23.407 24 22.675V1.325C24 .593 23.407 0 22.675 0z"/>
    </svg>
  )
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.35 3.608 1.325.975.975 1.263 2.242 1.325 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.35 2.633-1.325 3.608-.975.975-2.242 1.263-3.608 1.325-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.35-3.608-1.325-.975-.975-1.263-2.242-1.325-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.35-2.633 1.325-3.608C4.533 1.567 5.8 1.279 7.166 1.217 8.432 1.159 8.812 1.147 12 1.147m0-1.147C8.741 0 8.332.014 7.052.072 5.773.13 4.63.428 3.7 1.357 2.772 2.286 2.474 3.429 2.416 4.708 2.358 5.988 2.344 6.397 2.344 9.656v4.688c0 3.259.014 3.668.072 4.948.058 1.279.356 2.422 1.285 3.351.929.928 2.072 1.226 3.351 1.284 1.28.058 1.689.072 4.948.072s3.668-.014 4.948-.072c1.279-.058 2.422-.356 3.351-1.284.928-.929 1.226-2.072 1.284-3.351.058-1.28.072-1.689.072-4.948V9.656c0-3.259-.014-3.668-.072-4.948C21.556 3.429 21.258 2.286 20.33 1.357 19.401.428 18.258.13 16.979.072 15.699.014 15.289 0 12 0z"/>
      <path d="M12 5.838A6.162 6.162 0 1 0 18.162 12 6.169 6.169 0 0 0 12 5.838m0 10.188A4.025 4.025 0 1 1 16.025 12 4.03 4.03 0 0 1 12 16.026"/>
      <circle cx="18.406" cy="5.594" r="1.44"/>
    </svg>
  )
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.5 3h2.665c.213 1.2.77 2.22 1.67 3.06.87.82 1.93 1.326 3.175 1.515V10.5c-1.47-.09-2.85-.53-4.14-1.32v5.415c0 3.7-2.765 6.405-6.36 6.405S3.15 18.295 3.15 14.595c0-3.28 2.315-5.97 5.43-6.36v3.02a3.13 3.13 0 0 0-2.31 3.015c0 1.74 1.41 3.15 3.15 3.15s3.15-1.41 3.15-3.15V3z"/>
    </svg>
  )
}

function SnapchatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2c3.26 0 5.57 2.23 5.57 5.43 0 1.02-.2 1.75-.2 1.75s.73.99 1.9 1.34c.62.19.96.86.69 1.45-.28.6-1.06.7-1.69.81-.52.09-.86.23-.86.23s.31.94 1.62 1.4c.41.15.65.63.53 1.07-.14.5-.64.78-1.15.69-.96-.17-1.65-.15-2.22.15-1 .5-1.9 1.95-3.19 1.95s-2.19-1.45-3.19-1.95c-.57-.3-1.26-.32-2.22-.15-.51.09-1.01-.19-1.15-.69-.12-.44.12-.92.53-1.07 1.31-.46 1.62-1.4 1.62-1.4s-.34-.14-.86-.23c-.63-.11-1.41-.21-1.69-.81-.27-.59.07-1.26.69-1.45 1.17-.35 1.9-1.34 1.9-1.34s-.2-.73-.2-1.75C6.43 4.23 8.74 2 12 2z"/>
    </svg>
  )
}

export default function SettingsPage() {
  const [social, setSocial] = useState<SocialState>({ facebook: '', instagram: '', tiktok: '', snapchat: '' })
  const [interests, setInterests] = useState<string[]>([])
  const [interestInput, setInterestInput] = useState('')
  const email = 'user@example.com'

  const addInterest = () => {
    const trimmed = interestInput.trim()
    if (!trimmed) return
    if (!interests.includes(trimmed)) setInterests([...interests, trimmed])
    setInterestInput('')
  }
  const removeInterest = (value: string) => {
    setInterests((vals) => vals.filter((v) => v !== value))
  }
  const handleInterestKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addInterest()
    }
  }

  return (
    <section className="w-full md:pl-16 lg:pl-20">
      <Sidebar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <main className="py-12 sm:py-16 lg:py-20">
          <h1 className="sr-only">Account Settings</h1>

          <div className="divide-y divide-gray-200 space-y-12">
            {/* Personal Information */}
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
              <div>
                <h2 className="text-base/7 font-semibold text-gray-900">Personal Information</h2>
                <p className="mt-1 text-sm/6 text-gray-500">Use a permanent address where you can receive mail.</p>
              </div>

              <form className="md:col-span-2">
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                  <div className="col-span-full flex items-center gap-x-8">
                    <Image
                      alt=""
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      width={96}
                      height={96}
                      className="size-24 flex-none rounded-lg bg-gray-100 object-cover outline -outline-offset-1 outline-black/5"
                    />
                    <div>
                      <button
                        type="button"
                        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-100"
                      >
                        Change avatar
                      </button>
                      <p className="mt-2 text-xs/5 text-gray-500">JPG, GIF or PNG. 1MB max.</p>
                    </div>
                  </div>

                  {/* Email (read-only) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Email address</label>
                    <p className="mt-2 text-base text-gray-900">{email}</p>
                  </div>

                  {/* Names */}
                  <div className="sm:col-span-3">
                    <label htmlFor="first-name" className="block text-sm/6 font-medium text-gray-900">
                      First name
                    </label>
                    <div className="mt-2">
                      <input
                        id="first-name"
                        name="first-name"
                        type="text"
                        autoComplete="given-name"
                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="last-name" className="block text-sm/6 font-medium text-gray-900">
                      Last name
                    </label>
                    <div className="mt-2">
                      <input
                        id="last-name"
                        name="last-name"
                        type="text"
                        autoComplete="family-name"
                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>

                  {/* Social media (fixed platforms with logos) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Social profiles</label>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-[#1877F2]"><FacebookIcon className="h-5 w-5" /></span>
                        <input
                          value={social.facebook}
                          onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
                          placeholder="Facebook profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-[#E4405F]"><InstagramIcon className="h-5 w-5" /></span>
                        <input
                          value={social.instagram}
                          onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
                          placeholder="Instagram profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-black"><TikTokIcon className="h-5 w-5" /></span>
                        <input
                          value={social.tiktok}
                          onChange={(e) => setSocial({ ...social, tiktok: e.target.value })}
                          placeholder="TikTok profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#FFFC00] ring-1 ring-gray-200 text-black"><SnapchatIcon className="h-5 w-5" /></span>
                        <input
                          value={social.snapchat}
                          onChange={(e) => setSocial({ ...social, snapchat: e.target.value })}
                          placeholder="Snapchat profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Interests (tags) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Interests</label>
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {interests.map((it) => (
                          <span key={it} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                            {it}
                            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => removeInterest(it)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={interestInput}
                          onChange={(e) => setInterestInput(e.target.value)}
                          onKeyDown={handleInterestKey}
                          placeholder="Add interest and press Enter"
                          className="block min-w-0 grow rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                        />
                        <button type="button" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-100" onClick={addInterest}>
                          Add
                        </button>
                      </div>
                      <p className="mt-1 text-xs/5 text-gray-500">Use Enter or comma to add. You can add many.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex">
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>

            {/* Change password */}
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3 py-12">
              <div>
                <h2 className="text-base/7 font-semibold text-gray-900">Change password</h2>
                <p className="mt-1 text-sm/6 text-gray-500">Update your password associated with your account.</p>
              </div>

              <form className="md:col-span-2">
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                  <div className="col-span-full">
                    <label htmlFor="current-password" className="block text-sm/6 font-medium text-gray-900">
                      Current password
                    </label>
                    <div className="mt-2">
                      <input
                        id="current-password"
                        name="current_password"
                        type="password"
                        autoComplete="current-password"
                        className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>

                  <div className="col-span-full">
                    <label htmlFor="new-password" className="block text-sm/6 font-medium text-gray-900">
                      New password
                    </label>
                    <div className="mt-2">
                      <input
                        id="new-password"
                        name="new_password"
                        type="password"
                        autoComplete="new-password"
                        className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>

                  <div className="col-span-full">
                    <label htmlFor="confirm-password" className="block text-sm/6 font-medium text-gray-900">
                      Confirm password
                    </label>
                    <div className="mt-2">
                      <input
                        id="confirm-password"
                        name="confirm_password"
                        type="password"
                        autoComplete="new-password"
                        className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex">
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>

            {/* Delete account */}
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3 py-12">
              <div>
                <h2 className="text-base/7 font-semibold text-gray-900">Delete account</h2>
                <p className="mt-1 text-sm/6 text-gray-500">
                  No longer want to use our service? You can delete your account here. This action is not reversible. All information related to this account will be deleted permanently.
                </p>
              </div>

              <form className="flex items-start md:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500"
                >
                  Yes, delete my account
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </section>
  )
}