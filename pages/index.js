import { useSession, signIn, signOut } from "next-auth/react"
import { useState, useEffect } from 'react'
import Head from 'next/head'
import CsvUpload from '../components/CsvUpload'
import EnhancedEmailAnalytics from '../components/EnhancedEmailAnalytics'
import AdminModal from '../components/AdminModal'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [csvFiles, setCsvFiles] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([]) // Changed from selectedFile to selectedFiles (array)
  const [loading, setLoading] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [analyticsMode, setAnalyticsMode] = useState('all') // 'all' or 'selected'

  useEffect(() => {
    if (session) {
      loadCsvFiles()
    }
  }, [session])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu')) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  const loadCsvFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/list-csv-files')
      if (response.ok) {
        const data = await response.json()
        setCsvFiles(data.files)
        // Auto-select all files for analytics
        setSelectedFiles(data.files)
        setAnalyticsMode('all')
      }
    } catch (error) {
      console.error('Error loading CSV files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileToggle = (file) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.name === file.name)
      let newSelection
      if (isSelected) {
        newSelection = prev.filter(f => f.name !== file.name)
      } else {
        newSelection = [...prev, file]
      }
      
      // Update analytics mode based on selection
      if (newSelection.length === csvFiles.length) {
        setAnalyticsMode('all')
      } else {
        setAnalyticsMode('selected')
      }
      
      return newSelection
    })
  }

  const selectAllFiles = () => {
    setSelectedFiles(csvFiles)
    setAnalyticsMode('all')
  }

  const deselectAllFiles = () => {
    setSelectedFiles([])
    setAnalyticsMode('selected')
  }

  const handleFileUploaded = () => {
    loadCsvFiles() // Refresh file list after upload
  }

  const formatDateRange = (dateRange) => {
    if (!dateRange || !dateRange.earliest || !dateRange.latest) {
      return 'No date info'
    }
    
    const earliest = new Date(dateRange.earliest)
    const latest = new Date(dateRange.latest)
    const formatOptions = { year: 'numeric', month: 'short' }
    
    const earliestStr = earliest.toLocaleDateString('en-US', formatOptions)
    const latestStr = latest.toLocaleDateString('en-US', formatOptions)
    
    if (earliestStr === latestStr) {
      return earliestStr
    }
    
    return `${earliestStr} - ${latestStr}`
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
              <div className="mb-6">
                <div className="inline-block bg-emerald-800 rounded-lg p-4">
                  <img 
                    src="https://wolthers.com/images/wolthers-logo-off-white.svg" 
                    alt="Wolthers & Associates" 
                    className="h-8 w-auto"
                  />
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
          <div className="px-6">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <img 
                  src="https://wolthers.com/images/wolthers-logo-off-white.svg" 
                  alt="Wolthers & Associates" 
                  className="h-8 w-auto"
                />
                <div className="text-white">
                  <h1 className="text-xl font-semibold">Email Analytics</h1>
                  <p className="text-emerald-200 text-sm">Staff Communication Analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative user-menu">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 text-emerald-100 hover:text-white transition duration-200"
                  >
                    <span className="text-sm">
                      {session.user?.name || session.user?.email}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                          {session.user?.email}
                        </div>
                        {session?.user?.isAdmin && (
                          <button
                            onClick={() => {
                              setShowAdminModal(true)
                              setShowUserMenu(false)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            Admin Panel
                          </button>
                        )}
                        <button
                          onClick={() => signOut()}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Column - File Management */}
            <div className="lg:col-span-1 space-y-6">
              {/* CSV Upload */}
              <div className="bg-white rounded-lg shadow-md border border-emerald-100 p-6">
                <h2 className="text-lg font-semibold text-emerald-800 mb-4 border-b border-emerald-100 pb-2">Upload CSV File</h2>
                <CsvUpload onFileUploaded={handleFileUploaded} />
              </div>

              {/* File List */}
              <div className="bg-white rounded-lg shadow-md border border-emerald-100 p-6">
                <div className="flex justify-between items-center mb-4 border-b border-emerald-100 pb-2">
                  <h2 className="text-lg font-semibold text-emerald-800">Available Files</h2>
                  {csvFiles.length > 0 && (
                    <div className="flex space-x-2">
                      <button
                        onClick={selectAllFiles}
                        className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                      >
                        All
                      </button>
                      <button
                        onClick={deselectAllFiles}
                        className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                      >
                        None
                      </button>
                    </div>
                  )}
                </div>
                
                {loading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-600">Loading files...</div>
                  </div>
                ) : csvFiles.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No CSV files uploaded yet.
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-700">
                        <div className="font-medium">Selected: {selectedFiles.length} of {csvFiles.length} files</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {analyticsMode === 'all' ? 'Showing all files' : 'Showing selected files only'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {csvFiles.map((file) => {
                        const isSelected = selectedFiles.some(f => f.name === file.name)
                        return (
                          <div
                            key={file.name}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-gray-200 hover:border-emerald-200'
                            }`}
                            onClick={() => handleFileToggle(file)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">
                                  {file.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Uploaded: {new Date(file.modified).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Size: {Math.round(file.size / 1024)} KB • Records: {file.recordCount || 0}
                                </div>
                                <div className="text-xs text-emerald-600 font-medium mt-1">
                                  {formatDateRange(file.dateRange)}
                                </div>
                              </div>
                              <div className="ml-2">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  isSelected 
                                    ? 'border-emerald-500 bg-emerald-500' 
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Column - Analytics */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-md border border-emerald-100 p-6">
                <h2 className="text-lg font-semibold text-emerald-800 mb-4 border-b border-emerald-100 pb-2">
                  Email Analytics
                  {selectedFiles.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      ({selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </h2>
                {selectedFiles.length > 0 ? (
                  <EnhancedEmailAnalytics files={selectedFiles} />
                ) : csvFiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Upload CSV files to view email analytics
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Select at least one CSV file to view analytics
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