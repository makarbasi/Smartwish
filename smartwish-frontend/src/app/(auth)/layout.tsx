import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="flex justify-center pt-12">
        <Image src="/resources/logo/logo.png" alt="Smartwish" width={240} height={48} className="w-auto h-16 object-contain" />
      </div>
      {children}
    </div>
  )
}

