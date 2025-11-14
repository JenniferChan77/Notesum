'use client'

import { useCallback, useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { validateFile, formatFileSize, isAudioFile, isVideoFile } from '@/lib/utils/fileValidation'
import { cn } from '@/lib/utils'

interface FileUploadZoneProps {
  onFileSelect?: (file: File) => void
  className?: string
}

export function FileUploadZone({ onFileSelect, className }: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileValidation = useCallback((file: File) => {
    const validation = validateFile(file)
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file')
      setSelectedFile(null)
      return false
    }

    setError(null)
    setSelectedFile(file)
    onFileSelect?.(file)
    return true
  }, [onFileSelect])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileValidation(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileValidation(files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const getFileIcon = (file: File) => {
    if (isAudioFile(file)) {
      return (
        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    }

    if (isVideoFile(file)) {
      return (
        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    }

    return (
      <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-indigo-400 bg-indigo-50 scale-[1.02]"
            : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50",
          error && "border-red-300 bg-red-50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".mp3,.wav,.m4a,.mp4,.mov,.avi,audio/*,video/*"
          onChange={handleFileInputChange}
        />

        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              {getFileIcon(selectedFile)}
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-gray-900 mb-1 truncate">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500">
                {formatFileSize(selectedFile.size)} • {isAudioFile(selectedFile) ? 'Audio' : 'Video'}
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-600 font-medium">Selected</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-base font-medium text-gray-900 mb-2">
                {isDragOver ? 'Drop your file here' : 'Drop files or click to browse'}
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                MP3, WAV, M4A, MP4, MOV, AVI up to 100MB
              </p>
            </div>
            <Button className="mx-auto" size="sm">
              Choose Files
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}