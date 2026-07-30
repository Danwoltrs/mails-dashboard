import { useCallback, useState } from 'react'
import { prepareCsvFile } from './prepareCsv'

// What the upload endpoint accepts, after the file has been condensed in the
// browser. A raw 46 MB export condenses to well under a megabyte.
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024

// Ceiling on the raw file we are willing to pull into memory and parse.
export const MAX_FILE_SIZE = 120 * 1024 * 1024

function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100)
    })

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (parseError) {
          reject(new Error('Invalid response from server'))
        }
        return
      }
      let errorMessage = `Upload failed with status ${xhr.status}`
      try {
        const parsed = JSON.parse(xhr.responseText || '{}')
        errorMessage = parsed.error || errorMessage
      } catch (parseError) {
        if (xhr.responseText) {
          const textContent = xhr.responseText.replace(/<[^>]*>/g, '').trim()
          if (textContent.length > 0 && textContent.length < 200) errorMessage = textContent
          else errorMessage = `${errorMessage}: ${xhr.statusText || 'Server error'}`
        }
      }
      reject(new Error(errorMessage))
    }

    xhr.onerror = () => reject(new Error('Network error'))
    xhr.ontimeout = () => reject(new Error('Upload timeout - file may be too large'))

    xhr.open('POST', '/api/upload-csv')
    xhr.timeout = 300000
    xhr.send(formData)
  })
}

/**
 * Upload behaviour lifted out of the old CsvUpload component so the drawer can
 * render a compact dropzone over the same logic.
 */
export function useCsvUpload(onUploaded) {
  const [uploading, setUploading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const upload = useCallback(
    async (files) => {
      const list = Array.from(files || [])
      if (!list.length) return

      const invalid = list.filter(
        (file) => !file.name.toLowerCase().endsWith('.csv') || file.size > MAX_FILE_SIZE
      )
      if (invalid.length) {
        setMessage(
          `Not uploaded: ${invalid.map((f) => f.name).join(', ')} — CSV only, ${formatFileSize(
            MAX_FILE_SIZE
          )} max.`
        )
        return
      }

      setQueue(list)
      setUploading(true)
      setMessage('')
      setProgress(0)
      setCurrentIndex(0)

      let success = 0
      let failed = 0
      let collapsed = 0
      let firstError = ''

      for (let i = 0; i < list.length; i += 1) {
        setCurrentIndex(i)
        const base = (i / list.length) * 100

        try {
          // Decode (exports are UTF-16), drop the columns nothing reads, and
          // collapse the per-event rows to one row per email.
          setPreparing(true)
          const prepared = await prepareCsvFile(list[i])
          setPreparing(false)
          if (prepared.stats) collapsed += prepared.stats.collapsed

          if (prepared.blob.size > MAX_UPLOAD_SIZE) {
            throw new Error(
              `${list[i].name} is still ${formatFileSize(
                prepared.blob.size
              )} after condensing — split it by month first`
            )
          }

          const formData = new FormData()
          formData.append('csvFile', prepared.blob, list[i].name)

          try {
            await uploadWithProgress(formData, (fileProgress) => {
              setProgress(base + fileProgress / list.length)
            })
            success += 1
          } catch (xhrError) {
            const response = await fetch('/api/upload-csv', { method: 'POST', body: formData })
            if (!response.ok) {
              let errorMessage = `Upload failed with status ${response.status}`
              try {
                const parsed = await response.json()
                errorMessage = parsed.error || errorMessage
              } catch (parseError) {
                errorMessage = `${errorMessage}: ${response.statusText || 'Server error'}`
              }
              throw new Error(errorMessage)
            }
            success += 1
          }
        } catch (error) {
          console.error(`Upload error for ${list[i].name}:`, error)
          setPreparing(false)
          failed += 1
          if (!firstError) firstError = error.message
        }
      }

      setProgress(100)
      const collapsedNote = collapsed
        ? ` ${collapsed.toLocaleString('en-US')} event rows collapsed.`
        : ''
      if (failed === 0) {
        setMessage(`${success} file${success === 1 ? '' : 's'} uploaded.${collapsedNote}`)
      } else if (success > 0) {
        setMessage(`${success} uploaded, ${failed} failed. ${firstError || ''}`)
      } else {
        setMessage(firstError || `${failed} file${failed === 1 ? '' : 's'} failed to upload.`)
      }

      if (success > 0 && onUploaded) onUploaded()

      setTimeout(() => {
        setUploading(false)
        setProgress(0)
        setQueue([])
        setCurrentIndex(0)
      }, 2500)
    },
    [onUploaded]
  )

  return { uploading, preparing, progress, message, queue, currentIndex, upload, formatFileSize }
}
