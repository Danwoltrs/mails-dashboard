import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { parseCsv, mergeCsvData } from './csv'
import { createRecipientIndex, indexRecipients } from './analytics'
import { decodeCsvBuffer } from './prepareCsv'

const CONCURRENCY = 4

const EMPTY = { data: null, recipientIndex: null, loading: false, error: null, progress: null }

/**
 * Loads the selected CSV blobs, parses them, indexes recipients from the
 * pre-dedup rows, then merges (which is where deduplication happens).
 *
 * Results from a superseded selection are discarded rather than raced into
 * state.
 */
export function useEmailData(files) {
  const { data: session } = useSession()
  const [state, setState] = useState(EMPTY)
  const runRef = useRef(0)

  const fileKey = (files || [])
    .map((file) => file.name)
    .sort()
    .join('|')

  const filesRef = useRef(files)
  filesRef.current = files

  useEffect(() => {
    const list = filesRef.current || []
    const run = runRef.current + 1
    runRef.current = run

    if (!list.length || !session) {
      setState(EMPTY)
      return
    }

    let cancelled = false
    setState({ ...EMPTY, loading: true, progress: { done: 0, total: list.length } })

    const load = async () => {
      const parsed = []
      const recipientIndex = createRecipientIndex()
      let done = 0
      let cursor = 0

      const worker = async () => {
        while (cursor < list.length) {
          const file = list[cursor]
          cursor += 1
          try {
            const response = await fetch(file.url)
            if (!response.ok) throw new Error(`Failed to load ${file.name}`)
            // Decoded rather than response.text(): anything stored before
            // upload-time preparation may still be UTF-16, which decodes to
            // unusable headers as UTF-8.
            const text = decodeCsvBuffer(await response.arrayBuffer())
            const result = parseCsv(text, file.name, session)
            if (result) {
              // Index recipients before the merge, while every event row for a
              // message is still present.
              indexRecipients(result.rows, recipientIndex)
              parsed.push(result)
            }
          } catch (error) {
            console.error(`Error loading ${file.name}:`, error.message)
          }
          done += 1
          if (!cancelled && runRef.current === run) {
            setState((prev) =>
              prev.loading ? { ...prev, progress: { done, total: list.length } } : prev
            )
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker())
      )

      if (cancelled || runRef.current !== run) return

      if (!parsed.length) {
        setState({
          ...EMPTY,
          error: 'No valid CSV files could be loaded',
        })
        return
      }

      setState({
        data: mergeCsvData(parsed),
        recipientIndex,
        loading: false,
        error: null,
        progress: null,
      })
    }

    load().catch((error) => {
      if (cancelled || runRef.current !== run) return
      setState({ ...EMPTY, error: error.message || 'Failed to load email data' })
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey, session])

  return state
}
