import { useState } from 'react'

export default function CsvUpload({ onFileUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileUpload = async (file) => {
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('Please select a CSV file.')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setMessage(`File size ${formatFileSize(file.size)} exceeds the maximum limit of ${formatFileSize(MAX_FILE_SIZE)}.`)
      return
    }

    setSelectedFile(file)
    setUploading(true)
    setMessage('')
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('csvFile', file)

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest()
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(percentComplete)
        }
      })

      // Set up response handling
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } else {
              const error = JSON.parse(xhr.responseText)
              reject(new Error(error.error))
            }
          }
        }
        
        xhr.onerror = () => reject(new Error('Network error'))
      })

      // Start the upload
      xhr.open('POST', '/api/upload-csv')
      xhr.send(formData)

      // Wait for completion
      const result = await uploadPromise
      setUploadProgress(100)
      setMessage(`File "${result.filename}" uploaded successfully!`)
      onFileUploaded && onFileUploaded()
      
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`)
      setUploadProgress(0)
    } finally {
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        setSelectedFile(null)
      }, 2000) // Keep progress visible for 2 seconds after completion
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
      {/* File Size Limit Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <div className="text-blue-600 text-sm">📋</div>
          <div className="text-sm text-blue-700">
            <span className="font-medium">File size limit:</span> {formatFileSize(MAX_FILE_SIZE)} maximum
          </div>
        </div>
      </div>

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
          <div className="space-y-4">
            <div className="text-emerald-600 text-2xl">📤</div>
            <div className="text-sm text-emerald-600">
              Uploading {selectedFile?.name}...
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
              <div 
                className="h-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            
            {/* Progress Percentage and File Size */}
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>{Math.round(uploadProgress)}% complete</span>
              {selectedFile && (
                <span>{formatFileSize(selectedFile.size)}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400 text-2xl">📊</div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-500">CSV files only • Max {formatFileSize(MAX_FILE_SIZE)}</div>
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
          className={`w-full text-center py-3 px-4 rounded-md text-sm font-medium cursor-pointer transition-colors ${
            uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {uploading 
            ? `Uploading... ${Math.round(uploadProgress)}%` 
            : `Select CSV File (Max ${formatFileSize(MAX_FILE_SIZE)})`
          }
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