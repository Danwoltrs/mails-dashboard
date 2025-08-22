import { useState } from 'react'

export default function CsvUpload({ onFileUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0)
  
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB in bytes

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFilesUpload = async (files) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) return

    // Validate all files
    const invalidFiles = fileList.filter(file => 
      !file.name.toLowerCase().endsWith('.csv') || file.size > MAX_FILE_SIZE
    )

    if (invalidFiles.length > 0) {
      const invalidFileNames = invalidFiles.map(f => f.name).join(', ')
      setMessage(`Invalid files: ${invalidFileNames}. Please ensure all files are CSV and under ${formatFileSize(MAX_FILE_SIZE)}.`)
      return
    }

    setSelectedFiles(fileList)
    setUploading(true)
    setMessage('')
    setUploadProgress(0)
    setCurrentUploadIndex(0)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      setCurrentUploadIndex(i)

      try {
        const formData = new FormData()
        formData.append('csvFile', file)

        // Update progress to show which file we're on
        const baseProgress = (i / fileList.length) * 100
        const progressCallback = (fileProgress) => {
          const totalProgress = baseProgress + (fileProgress / fileList.length)
          setUploadProgress(totalProgress)
        }

        // Try XMLHttpRequest with progress tracking first
        try {
          const result = await uploadWithProgress(formData, progressCallback)
          successCount++
          console.log(`Successfully uploaded: ${result.filename}`)
        } catch (xhrError) {
          console.warn('XMLHttpRequest failed, falling back to fetch:', xhrError)
          
          // Fallback to fetch without progress
          const response = await fetch('/api/upload-csv', {
            method: 'POST',
            body: formData,
          })

          if (response.ok) {
            const result = await response.json()
            successCount++
            console.log(`Successfully uploaded: ${result.filename}`)
          } else {
            let errorMessage = `Upload failed with status ${response.status}`
            
            try {
              const error = await response.json()
              errorMessage = error.error || errorMessage
            } catch (parseError) {
              // Handle non-JSON error responses  
              try {
                const textResponse = await response.text()
                const textContent = textResponse.replace(/<[^>]*>/g, '').trim()
                if (textContent.length > 0 && textContent.length < 200) {
                  errorMessage = textContent
                } else {
                  errorMessage = `${errorMessage}: ${response.statusText || 'Server error'}`
                }
              } catch (textError) {
                errorMessage = `${errorMessage}: ${response.statusText || 'Unknown error'}`
              }
            }
            
            throw new Error(errorMessage)
          }
        }
        
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error)
        errorCount++
      }
    }

    // Final results
    setUploadProgress(100)
    
    if (successCount === fileList.length) {
      setMessage(`All ${successCount} files uploaded successfully!`)
      onFileUploaded && onFileUploaded()
    } else if (successCount > 0) {
      setMessage(`${successCount} files uploaded successfully, ${errorCount} failed.`)
      onFileUploaded && onFileUploaded()
    } else {
      setMessage(`All ${errorCount} files failed to upload.`)
    }

    // Clean up after delay
    setTimeout(() => {
      setUploading(false)
      setUploadProgress(0)
      setSelectedFiles([])
      setCurrentUploadIndex(0)
    }, 3000) // Keep progress visible for 3 seconds for multiple files
  }

  const uploadWithProgress = (formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress(percentComplete)
        }
      })

      // Set up response handling
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          console.log('Upload response:', {
            status: xhr.status,
            responseText: xhr.responseText,
            statusText: xhr.statusText
          })
          
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } catch (parseError) {
              console.error('Failed to parse success response:', parseError, xhr.responseText)
              reject(new Error('Invalid response from server'))
            }
          } else {
            // Handle non-JSON error responses (like HTML error pages)
            let errorMessage = `Upload failed with status ${xhr.status}`
            
            try {
              const errorResponse = JSON.parse(xhr.responseText || '{}')
              errorMessage = errorResponse.error || errorMessage
            } catch (parseError) {
              // If response is not JSON, try to extract meaningful error from HTML/text
              if (xhr.responseText) {
                const textContent = xhr.responseText.replace(/<[^>]*>/g, '').trim()
                if (textContent.length > 0 && textContent.length < 200) {
                  errorMessage = textContent
                } else {
                  errorMessage = `${errorMessage}: ${xhr.statusText || 'Server error'}`
                }
              }
              console.error('Non-JSON error response:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText.substring(0, 500)
              })
            }
            
            reject(new Error(errorMessage))
          }
        }
      }
      
      xhr.onerror = () => {
        console.error('Network error during upload')
        reject(new Error('Network error'))
      }
      
      xhr.ontimeout = () => {
        console.error('Upload timeout')
        reject(new Error('Upload timeout - file may be too large'))
      }

      // Start the upload
      xhr.open('POST', '/api/upload-csv')
      xhr.timeout = 300000 // 5 minutes timeout
      xhr.send(formData)
    })
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files)
    }
  }

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files)
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
          multiple
          onChange={handleInputChange}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        {uploading ? (
          <div className="space-y-4">
            <div className="text-emerald-600 text-2xl">📤</div>
            <div className="text-sm text-emerald-600">
              {selectedFiles.length > 1 
                ? `Uploading ${currentUploadIndex + 1} of ${selectedFiles.length} files...`
                : `Uploading ${selectedFiles[0]?.name || 'file'}...`
              }
            </div>
            {selectedFiles.length > 1 && (
              <div className="text-xs text-gray-500">
                Current: {selectedFiles[currentUploadIndex]?.name}
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
              <div 
                className="h-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            
            {/* Progress Percentage and File Info */}
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>{Math.round(uploadProgress)}% complete</span>
              {selectedFiles.length > 0 && (
                <span>
                  {selectedFiles.length > 1 
                    ? `${selectedFiles.length} files selected`
                    : formatFileSize(selectedFiles[0]?.size || 0)
                  }
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400 text-2xl">📊</div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-500">CSV files only • Multiple files supported • Max {formatFileSize(MAX_FILE_SIZE)} each</div>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <label className="block">
        <input
          type="file"
          accept=".csv"
          multiple
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
            : `Select CSV Files (Max ${formatFileSize(MAX_FILE_SIZE)} each)`
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