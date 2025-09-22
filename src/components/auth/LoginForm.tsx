'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface LoginFormData {
  email: string
  password: string
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState<string>('')
  const { signIn, resendVerification } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>()

  // Handle URL parameters for error messages and success messages
  useEffect(() => {
    const error = searchParams.get('error')
    const message = searchParams.get('message')
    const email = searchParams.get('email')

    if (error === 'verification_failed') {
      setAuthError('Email verification failed. Please try again or resend the verification email.')
    } else if (message) {
      setAuthError(message)
    }

    if (email) {
      setLastEmail(email)
    }
  }, [searchParams])

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setAuthError(null)
    setLastEmail(data.email)
    try {
      const { error } = await signIn(data.email, data.password)

      if (error) {
        setAuthError(error.message)
      } else {
        router.push('/upload')
      }
    } catch (error) {
      setAuthError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!lastEmail) return

    setIsResending(true)

    try {
      const { error } = await resendVerification(lastEmail)

      if (error) {
        setAuthError('Failed to resend verification email. Please try again.')
      } else {
        setAuthError('Verification email sent! Please check your inbox.')
      }
    } catch (error) {
      setAuthError('An unexpected error occurred while resending.')
    } finally {
      setIsResending(false)
    }
  }

  // Check if the error indicates email verification is needed
  const isVerificationError = authError && (
    authError.toLowerCase().includes('email not confirmed') ||
    authError.toLowerCase().includes('email confirmation') ||
    authError.toLowerCase().includes('verify') ||
    authError.toLowerCase().includes('confirmation') ||
    authError.toLowerCase().includes('verification failed')
  )

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
        <p className="mt-2 text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Sign up
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          type="email"
          label="Email"
          placeholder="Enter your email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          error={errors.email?.message}
        />

        <Input
          type="password"
          label="Password"
          placeholder="Enter your password"
          {...register('password', {
            required: 'Password is required'
          })}
          error={errors.password?.message}
        />

        {authError && (
          <div className={`border rounded-md p-4 ${
            authError.includes('sent!')
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm ${
              authError.includes('sent!')
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {authError}
            </p>
            {isVerificationError && (
              <div className="mt-3">
                <Button
                  type="button"
                  onClick={handleResendVerification}
                  loading={isResending}
                  disabled={isResending || !lastEmail}
                  variant="outline"
                  size="sm"
                >
                  {isResending ? 'Resending...' : 'Resend verification email'}
                </Button>
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}