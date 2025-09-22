'use client'

import { useAuth } from '@/contexts/auth'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function UploadPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href='/' className="flex items-center">
              <h1 className="text-2xl font-bold text-indigo-600">TheraNotes</h1>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.email}</span>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Upload Your Audio File
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Upload your lecture recordings and get AI-powered transcriptions and summaries
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors">
            <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop your files here, or click to browse
            </h3>
            <p className="text-gray-500 mb-4">
              Supports MP3, WAV, M4A, MP4, MOV, AVI files up to 100MB
            </p>
            <Button className="mx-auto">
              Choose Files
            </Button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-xl p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Files</h3>
          <div className="text-center py-8 text-gray-500">
            No files uploaded yet. Upload your first file to get started!
          </div>
        </div>
      </div>
    </div>
  )
}