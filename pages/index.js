import { useSession, signIn, signOut } from "next-auth/react"
import { useState, useEffect } from 'react'
import Head from 'next/head'
import CsvUpload from '../components/CsvUpload'
import EmailAnalytics from '../components/EmailAnalytics'
import AdminPanel from '../components/AdminPanel'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [csvFiles, setCsvFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) {
      loadCsvFiles()
    }
  }, [session])

  const loadCsvFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/list-csv-files')
      if (response.ok) {
        const data = await response.json()
        setCsvFiles(data.files)
      }
    } catch (error) {
      console.error('Error loading CSV files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUploaded = () => {
    loadCsvFiles() // Refresh file list after upload
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Head>
          <title>Email Analytics - Sign In</title>
          <meta name="description" content="Email Analytics Dashboard for Wolthers & Associates" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Analytics</h1>
              <p className="text-gray-600">Wolthers & Associates</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => signIn('azure-ad')}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-semibold"
              >
                Sign in with Microsoft
              </button>
              <p className="text-xs text-gray-500 text-center">
                Or try: <a href="/api/auth/signin/azure-ad" className="text-blue-600 hover:underline">Direct Microsoft Sign-in</a>
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Email Analytics Dashboard - Wolthers & Associates</title>
        <meta name="description" content="Email Analytics Dashboard for Wolthers & Associates" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Email Analytics Dashboard</h1>
                <p className="text-sm text-gray-600">Wolthers & Associates</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Welcome, {session.user?.name || session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Admin Panel - Only visible to admins */}
          {session?.user?.isAdmin && (
            <div className="mb-8">
              <AdminPanel />
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - File Management */}
            <div className="lg:col-span-1 space-y-6">
              {/* CSV Upload */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h2>
                <CsvUpload onFileUploaded={handleFileUploaded} />
              </div>

              {/* File List */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Files</h2>
                {loading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-600">Loading files...</div>
                  </div>
                ) : csvFiles.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No CSV files uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {csvFiles.map((file) => (
                      <div
                        key={file.name}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFile?.name === file.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedFile(file)}
                      >
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(file.modified).toLocaleDateString()} • {Math.round(file.size / 1024)} KB
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Analytics */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Analytics</h2>
                {selectedFile ? (
                  <EmailAnalytics file={selectedFile} />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Select a CSV file from the list to view analytics
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}