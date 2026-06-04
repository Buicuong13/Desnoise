import Link from 'next/link'
import Image from 'next/image'
import { FileText } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link href="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gradient-start to-gradient-end flex items-center justify-center shadow-sm">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tight text-foreground">DocRecover</span>
          </Link>
          {children}
        </div>
      </div>
      
      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-gradient-start via-gradient-middle to-gradient-end p-12 relative overflow-hidden">
        {/* Background Image */}
        <Image
          src="/images/auth-illustration.jpg"
          alt="Document recovery illustration"
          fill
          className="object-cover opacity-15 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20" />

        <div className="relative z-10 max-w-lg text-center">
          <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center shadow-2xl shadow-black/20 ring-1 ring-white/20">
            <FileText className="w-16 h-16 text-white" />
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white mb-4">
            Digitize documents intelligently
          </h2>
          <p className="text-white/80">
            Upload blurry, noisy documents and watch our AI denoise, OCR, and suggest corrections —
            with you in control of every change.
          </p>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { v: '50K+', l: 'Documents' },
              { v: '98%', l: 'Accuracy' },
              { v: '10s', l: 'Avg Time' },
            ].map((s) => (
              <div key={s.l} className="p-4 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/15">
                <div className="font-display text-2xl font-extrabold text-white">{s.v}</div>
                <div className="text-xs text-white/70">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
