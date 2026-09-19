'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { Button } from '@/components/ui/Button'
import { FileUploadZone } from '@/components/upload/FileUploadZone'
import { Tabs } from '@/components/ui/Tabs'
import { uploadFile } from '@/components/upload/uploadFile'
import type { ProcessingStatus, TranscriptSegment, UploadRecord } from '@/types/upload'
import Link from 'next/link'

const POLL_INTERVAL_MS = 4000

// Summarization isn't built yet; flip to true to bring the Summary tab back
const SHOW_SUMMARY = false

const STATUS_TEXT: Record<ProcessingStatus, string> = {
  uploading: 'Uploading file…',
  queued: 'Waiting in queue…',
  processing: 'Extracting audio…',
  transcribing: 'Transcribing… this can take a few minutes',
  completed: 'Transcript ready',
  failed: 'Transcription failed',
}

// 75.4 -> "01:15", 3725 -> "1:02:05"
function formatTime(seconds: number) {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function TranscriptView({ text, segments }: { text: string, segments: TranscriptSegment[] | null }) {
  return (
    <div className="max-h-[500px] overflow-y-auto space-y-2 text-left">
      {segments?.length ? (
        // Index as key: segment ids restart at 0 for each chunk of a long file
        segments.map((seg, i) => (
          <p key={i} className="text-gray-800 leading-relaxed">
            <span className="mr-2 font-mono text-xs text-indigo-600">[{formatTime(seg.start)}]</span>
            {seg.text.trim()}
          </p>
        ))
      ) : (
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
    </div>
  )
}

export default function UploadPage() {
  const { user, signOut } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadFileId, setUploadFileId] = useState<string | null>(null)
  const [record, setRecord] = useState<UploadRecord | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(SHOW_SUMMARY ? 'summary' : 'transcript')
  // Bumped to remount FileUploadZone, which clears the file it shows
  const [uploadZoneKey, setUploadZoneKey] = useState(0)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setUploadFileId(null)
    setRecord(null)
    setErrorMessage(null)
  }

  const handleNewUpload = () => {
    setSelectedFile(null)
    setUploadFileId(null)
    setRecord(null)
    setErrorMessage(null)
    setUploadZoneKey(k => k + 1)
  }

  const startUpload = async (file: File) => {
    setLoading(true)
    setUploadFileId(null)
    setRecord(null)
    setErrorMessage(null)
    try {
      const id = await uploadFile(file)
      setUploadFileId(id) // starts polling
    } catch (err) {
      console.error('Upload failed:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
      setLoading(false)
    }
  }

  // Poll the upload's status until the worker finishes or fails
  useEffect(() => {
    if (!uploadFileId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const res = await fetch(`/api/uploads/${uploadFileId}`)
        const data = await res.json()
        if (cancelled) return

        // 4xx/5xx won't fix itself by asking again: stop and show it
        if (!res.ok) {
          setErrorMessage(data.error ?? `Status check failed (${res.status})`)
          setLoading(false)
          return
        }

        setRecord(data)
        if (data.status === 'completed' || data.status === 'failed') {
          setLoading(false)
          return
        }
      } catch (err) {
        // Network blip: keep polling
        console.error('Status check failed, retrying:', err)
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [uploadFileId])

  const statusText = errorMessage
    ? `Error: ${errorMessage}`
    : record
      ? record.status === 'failed' && record.error
        ? `${STATUS_TEXT.failed}: ${record.error}`
        : STATUS_TEXT[record.status]
      : loading
        ? STATUS_TEXT.uploading
        : null
  const isError = !!errorMessage || record?.status === 'failed'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href='/' className="flex items-center">
              <h1 className="text-2xl font-bold text-indigo-600">Notesum</h1>
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

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Upload Your Audio File
          </h2>
          <p className="text-lg text-gray-600">
            Upload your lecture recordings and get AI-powered transcriptions and summaries
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[500px]">
          {/* Left Panel - File Upload (1/3 width) */}
          <div className="lg:col-span-1 h-full">
            <div className="bg-white rounded-lg shadow-xl p-6 h-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload File</h3>
              {/* Locked while a job runs, so picking a new file can't orphan it */}
              <div className={loading ? 'pointer-events-none opacity-50' : undefined}>
                <FileUploadZone key={uploadZoneKey} onFileSelect={handleFileSelect} />
              </div>

              {selectedFile && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {/* Hidden once done: clicking again would re-transcribe (and re-bill) the same file */}
                  {user?.id && record?.status !== 'completed' && (
                    <Button className="w-full mt-4" size="sm" loading={loading} onClick={()=>startUpload(selectedFile)}>
                      Start Transcription
                    </Button>
                  )}

                  {statusText && (
                    <p className={`mt-3 text-sm ${isError ? 'text-red-600' : 'text-gray-600'}`}>
                      {statusText}
                    </p>
                  )}

                  {record?.status === 'completed' && (
                    <div className="mt-3 space-y-2">
                      {/* Only needed when there's a Summary tab to switch away from */}
                      {SHOW_SUMMARY && (
                        <Button
                          variant="outline"
                          className="w-full"
                          size="sm"
                          onClick={() => setActiveTab('transcript')}
                        >
                          View transcript
                        </Button>
                      )}
                      <Button className="w-full" size="sm" onClick={handleNewUpload}>
                        Upload a new file
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Tabs (2/3 width) */}
          <div className="lg:col-span-2 h-full">
            <div className="bg-white rounded-lg shadow-xl p-6 h-full">
              <Tabs
                tabs={[
                  {
                    id: 'summary',
                    label: 'Summary',
                    content: (
                      <div className="space-y-4">
                        {selectedFile ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for processing</h3>
                            <p className="text-gray-600">Click &quot;Start Transcription&quot; to generate an AI summary</p>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No file selected</h3>
                            <p className="text-gray-600">Upload a file to see the AI-generated summary</p>
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    id: 'transcript',
                    label: 'Transcript',
                    content: (
                      <div className="space-y-4">
                        {record?.transcript ? (
                          <TranscriptView text={record.transcript.text} segments={record.transcript.segments} />
                        ) : selectedFile ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for processing</h3>
                            <p className="text-gray-600">Click &quot;Start Transcription&quot; to generate the full transcript</p>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No file selected</h3>
                            <p className="text-gray-600">Upload a file to see the full transcript</p>
                          </div>
                        )}
                      </div>
                    )
                  }
                ].filter(tab => SHOW_SUMMARY || tab.id !== 'summary')}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}