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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-foreground">DocRecover</span>
          </Link>
          {children}
        </div>
      </div>
      
      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-12 relative overflow-hidden">
        {/* Background Image */}
        <Image
          src="/images/auth-illustration.jpg"
          alt="Document recovery illustration"
          fill
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
        
        <div className="relative z-10 max-w-lg text-center">
          <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/20">
            <FileText className="w-16 h-16 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Transform Your Documents
          </h2>
          <p className="text-muted-foreground">
            Upload blurry, noisy documents and watch as our AI transforms them into crystal clear, editable text with intelligent correction suggestions.
          </p>
          
          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-card/80 backdrop-blur border border-border">
              <div className="text-2xl font-bold text-primary">50K+</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </div>
            <div className="p-4 rounded-xl bg-card/80 backdrop-blur border border-border">
              <div className="text-2xl font-bold text-primary">98%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
            <div className="p-4 rounded-xl bg-card/80 backdrop-blur border border-border">
              <div className="text-2xl font-bold text-primary">10s</div>
              <div className="text-xs text-muted-foreground">Avg Time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
