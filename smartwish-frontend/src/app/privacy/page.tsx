export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-6 text-gray-700">
        We respect your privacy. This demo application stores minimal data in your browser (such as cookie consent
        preferences) to improve your experience. No personal data is sold or shared.
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
        <p>
          Cookies may be used for essential functionality and performance. You can accept or reject cookies using the
          banner shown at the bottom of the site.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-gray-900">Contact</h2>
        <p>
          For privacy inquiries, please contact our support team.
        </p>
      </section>
    </main>
  )
}

