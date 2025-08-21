import { useState } from 'react'

export default function CsvUpload({ onFileUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState('')

  const handleFileUpload = async (file) => {
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('Please select a CSV file.')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('csvFile', file)

      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setMessage(`File "${result.filename}" uploaded successfully!`)
        onFileUploaded && onFileUploaded()
      } else {
        const error = await response.json()
        setMessage(`Upload failed: ${error.error}`)
      }
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0])
    }
  }

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-gray-300 hover:border-emerald-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        {uploading ? (
          <div className="space-y-2">
            <div className="text-emerald-600 text-2xl">📤</div>
            <div className="text-sm text-emerald-600">Uploading...</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400 text-2xl">📊</div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-500">CSV files only</div>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <label className="block">
        <input
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          disabled={uploading}
          className="hidden"
        />
        <div
          className={`w-full text-center py-2 px-4 rounded-md text-sm font-medium cursor-pointer transition-colors ${
            uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {uploading ? 'Uploading...' : 'Select CSV File'}
        </div>
      </label>

      {/* Status Message */}
      {message && (
        <div className={`p-3 rounded-md text-sm ${
          message.includes('successfully') 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}