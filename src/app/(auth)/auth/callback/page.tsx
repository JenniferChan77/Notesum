'use client'

import { useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const email = searchParams.get('email')

  if (status === 'verified') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Email verified!</h2>
          <p className="text-gray-600 mb-8">
            Your email has been successfully verified. You can now sign in to your account.
          </p>
          <Link href="/login">
            <Button className="w-full">
              Continue to Sign In
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Verification failed</h2>
          <p className="text-gray-600 mb-8">
            Email verification failed. Please try signing up again or contact support.
          </p>
          <div className="space-y-4">
            <Link href="/signup">
              <Button className="w-full">
                Try Again
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // Default: status=pending or no status
  return (
    <AuthLayout>
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Check your email</h2>
        <p className="text-gray-600 mb-2">
          We&apos;ve sent a verification link to
        </p>
        {email && (
          <p className="text-indigo-600 font-medium mb-6">{email}</p>
        )}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-8">
          <p className="text-sm text-blue-600">
            Click the verification link in your email to activate your account.
            If you don&apos;t see the email, check your spam folder.
          </p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            Back to Sign In
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}