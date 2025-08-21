import { useSession, signIn, signOut } from "next-auth/react"
import { useState, useEffect } from 'react'
import Head from 'next/head'
import CsvUpload from '../components/CsvUpload'
import EmailAnalytics from '../components/EmailAnalytics'
import AdminModal from '../components/AdminModal'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [csvFiles, setCsvFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 border border-emerald-200">
            <div className="text-center mb-8">
              <div className="mb-4">
                <div className="inline-block bg-emerald-800 rounded-lg px-4 py-2">
                  <span className="text-white font-bold text-xl">wolthers</span>
                  <span className="text-emerald-200 text-sm ml-1">& associates</span>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Analytics</h1>
              <p className="text-gray-600">Staff Communication Dashboard</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => signIn('azure-ad')}
                className="w-full bg-emerald-700 text-white px-4 py-3 rounded-lg hover:bg-emerald-800 transition duration-200 font-semibold shadow-md"
              >
                Sign in with Microsoft
              </button>
              <p className="text-xs text-gray-500 text-center">
                Or try: <a href="/api/auth/signin/azure-ad" className="text-emerald-700 hover:underline">Direct Microsoft Sign-in</a>
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
        <header className="bg-emerald-800 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="bg-white rounded-lg px-3 py-1">
                  <span className="text-emerald-800 font-bold text-lg">wolthers</span>
                  <span className="text-emerald-600 text-sm ml-1">& associates</span>
                </div>
                <div className="text-white">
                  <h1 className="text-xl font-semibold">Email Analytics</h1>
                  <p className="text-emerald-200 text-sm">Staff Communication Analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {session?.user?.isAdmin && (
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-md transition duration-200 text-sm font-medium border border-emerald-600"
                  >
                    Admin Panel
                  </button>
                )}
                <span className="text-emerald-100 text-sm">
                  {session.user?.name || session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-md transition duration-200 text-sm border border-emerald-600"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - File Management */}
            <div className="lg:col-span-1 space-y-6">
              {/* CSV Upload */}
              <div className="bg-white rounded-lg shadow-md border border-emerald-100 p-6">
                <h2 className="text-lg font-semibold text-emerald-800 mb-4 border-b border-emerald-100 pb-2">Upload CSV File</h2>
                <CsvUpload onFileUploaded={handleFileUploaded} />
              </div>

              {/* File List */}
              <div className="bg-white rounded-lg shadow-md border border-emerald-100 p-6">
                <h2 className="text-lg font-semibold text-emerald-800 mb-4 border-b border-emerald-100 pb-2">Available Files</h2>
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
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-200'
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
              <div className="bg-white rounded-lg shadow-md border border-emerald-100 p-6">
                <h2 className="text-lg font-semibold text-emerald-800 mb-4 border-b border-emerald-100 pb-2">Email Analytics</h2>
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

        {/* Admin Modal */}
        <AdminModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
      </div>
    </>
  )
}