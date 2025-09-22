'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface SignupFormData {
  email: string
  password: string
  confirmPassword: string
}

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const { signUp } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>()

  const password = watch('password')

  // Password validation rules
  const validatePassword = (value: string) => {
    if (value.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[a-zA-Z]/.test(value)) {
      return 'Password must contain at least one letter'
    }
    if (!/\d/.test(value)) {
      return 'Password must contain at least one number'
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
      return 'Password must contain at least one special character'
    }
    return true
  }

  const onSubmit = async (data: SignupFormData) => {
    if (data.password !== data.confirmPassword) {
      return
    }

    setIsLoading(true)
    setAuthError(null)

    try {
      const { data: signUpData, error } = await signUp(data.email, data.password)

      if (error) {
        setAuthError(error.message)
      } else {
        router.push(`/auth/callback?status=pending&email=${encodeURIComponent(data.email)}`)
      }
    } catch (error) {
      setAuthError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Create your account</h2>
        <p className="mt-2 text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Sign in
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
          placeholder="Create a password"
          {...register('password', {
            required: 'Password is required',
            validate: validatePassword
          })}
          error={errors.password?.message}
          helperText="Must be 8+ characters with 1 letter, 1 number, and 1 special character"
        />

        <Input
          type="password"
          label="Confirm Password"
          placeholder="Confirm your password"
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (value) => value === password || 'Passwords do not match'
          })}
          error={errors.confirmPassword?.message}
        />

        {authError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{authError}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </div>
  )
}