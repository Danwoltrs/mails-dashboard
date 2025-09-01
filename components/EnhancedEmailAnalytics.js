import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { parseCsv, mergeCsvData } from '../utils/csv'
import HeatmapTab from './analytics/HeatmapTab'
import EmployeeStats from './analytics/EmployeeStats'
import YearComparison from './analytics/YearComparison'
import DetailedBreakdown from './analytics/DetailedBreakdown'

const COLORS = ['#059669', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#7c3aed', '#db2777', '#dc2626']

export default function EnhancedEmailAnalytics({ files }) {
  const { data: session } = useSession()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('heatmap')
  const [timeFilter, setTimeFilter] = useState('all')
  const [emailDirectionFilter, setEmailDirectionFilter] = useState('both') // 'sent', 'received', 'both'
  const [selectedUsers, setSelectedUsers] = useState([]) // For user comparison
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)

  useEffect(() => {
    if (files && files.length > 0) {
      loadAndParseAllCSVs()
    }
  }, [files])

  // Handle window resize for responsive heatmap layout
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  const getDateRange = (filter) => {
    const now = new Date()
    const ranges = {
      'this-week': {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6)
      },
      'last-week': {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 1)
      },
      'this-month': {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      },
      'last-month': {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0)
      },
      'ytd': {
        start: new Date(now.getFullYear(), 0, 1),
        end: now
      },
      'last-year': {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31)
      }
    }
    return ranges[filter] || null
  }

  const filterDataByDateRange = (rows, filter) => {
    if (filter === 'all') return rows
    
    const range = getDateRange(filter)
    if (!range) return rows

    return rows.filter(row => {
      const timestamp = row['date_time_utc'] || row['origin_timestamp_utc']
      if (!timestamp) return false
      
      try {
        const date = new Date(timestamp)
        return date >= range.start && date <= range.end
      } catch (e) {
        return false
      }
    })
  }

  const filterDataByEmailDirection = (rows, filter, userEmail = null) => {
    if (filter === 'both') return rows
    
    if (!userEmail && session?.user?.email) {
      userEmail = session.user.email
    }
    
    if (!userEmail) return rows // Can't filter without knowing user's email
    
    return rows.filter(row => {
      const sender = row['sender_address']
      const recipient = row['recipient_address'] || row['recipients'] || ''
      
      if (filter === 'sent') {
        return sender && sender.toLowerCase().includes(userEmail.toLowerCase())
      } else if (filter === 'received') {
        return recipient && recipient.toLowerCase().includes(userEmail.toLowerCase())
      }
      
      return true
    })
  }

  const applyAllFilters = (rows, timeFilter, emailDirectionFilter) => {
    let filteredRows = filterDataByDateRange(rows, timeFilter)
    filteredRows = filterDataByEmailDirection(filteredRows, emailDirectionFilter)
    return filteredRows
  }

  const loadAndParseAllCSVs = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('Loading CSV files:', files.length);
      // Load all CSV files
      const allParsedData = []
      const loadPromises = files.map(async (file) => {
        try {
          const response = await fetch(file.url)
          if (!response.ok) {
            throw new Error(`Failed to load ${file.name}`)
          }
          const csvText = await response.text()
          const parsedData = parseCsv(csvText, file.name, session)
          return parsedData
        } catch (err) {
          console.error(`Error loading ${file.name}:`, err.message)
          return null
        }
      })

      const results = await Promise.all(loadPromises)
      const validResults = results.filter(result => result !== null)

      if (validResults.length === 0) {
        throw new Error('No valid CSV files could be loaded')
      }

      // Merge all data together
      const mergedData = mergeCsvData(validResults)
      setData(mergedData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // CSV parsing is handled in utils/csv.js

  const generateHeatmapData = (rows, timeFilter = 'all', emailDirectionFilter = 'both') => {
    const filteredRows = applyAllFilters(rows, timeFilter, emailDirectionFilter)
    const heatmap = Array(7).fill(null).map(() => Array(24).fill(0))
    const employeeStats = {}
    const userHeatmaps = {}

    console.log('Processing', filteredRows.length, 'rows for heatmap');
    let processedCount = 0;
    let hasEarlyEmails = false; // Before 6am
    let hasLateEmails = false; // After 10pm
    
    filteredRows.forEach((row, index) => {
      const timestamp = row['date_time_utc'] || row['origin_timestamp_utc']
      const sender = row['sender_address'] || 'Unknown'
      
      if (timestamp) {
        try {
          const date = new Date(timestamp)
          const day = date.getDay() // 0 = Sunday, 6 = Saturday
          const hour = date.getHours()
          
          // Check for emails outside normal range
          if (hour < 6) hasEarlyEmails = true;
          if (hour > 22) hasLateEmails = true;
          
          // Only log first few for debugging
          if (index < 5) {
            console.log('Processing email:', { timestamp, sender, day, hour, isValidDate: !isNaN(date.getTime()) });
          }
          
          // Combined heatmap
          heatmap[day][hour]++
          processedCount++;
          
          // Individual user heatmaps
          if (!userHeatmaps[sender]) {
            userHeatmaps[sender] = Array(7).fill(null).map(() => Array(24).fill(0))
          }
          userHeatmaps[sender][day][hour]++
          
          // Employee stats
          if (!employeeStats[sender]) {
            employeeStats[sender] = { total: 0, byDay: Array(7).fill(0), byHour: Array(24).fill(0) }
          }
          employeeStats[sender].total++
          employeeStats[sender].byDay[day]++
          employeeStats[sender].byHour[hour]++
        } catch (e) {
          console.log('Invalid timestamp:', timestamp, e);
        }
      }
    })

    // Determine hour range to display
    const showAllHours = hasEarlyEmails || hasLateEmails;
    const hourRange = showAllHours ? [0, 23] : [6, 22];

    console.log('Heatmap processing complete:', { 
      totalRows: filteredRows.length, 
      processedCount, 
      heatmapTotal: heatmap.flat().reduce((sum, val) => sum + val, 0),
      userCount: Object.keys(userHeatmaps).length,
      hasEarlyEmails,
      hasLateEmails,
      showAllHours,
      hourRange
    });

    return { heatmap, employeeStats, userHeatmaps, totalEmails: filteredRows.length, hourRange }
  }

  const generateYearComparison = (rows) => {
    const thisYear = new Date().getFullYear()
    const lastYear = thisYear - 1
    
    const thisYearData = {}
    const lastYearData = {}
    
    rows.forEach(row => {
      const timestamp = row['date_time_utc'] || row['origin_timestamp_utc']
      if (!timestamp) return
      
      try {
        const date = new Date(timestamp)
        const year = date.getFullYear()
        const month = date.getMonth()
        
        if (year === thisYear) {
          thisYearData[month] = (thisYearData[month] || 0) + 1
        } else if (year === lastYear) {
          lastYearData[month] = (lastYearData[month] || 0) + 1
        }
      } catch (e) {
        // Invalid timestamp
      }
    })

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const comparisonData = months.map((month, index) => ({
      month,
      thisYear: thisYearData[index] || 0,
      lastYear: lastYearData[index] || 0
    }))

    return comparisonData
  }

  const toggleUserSelection = (userEmail) => {
    setSelectedUsers(prev => {
      if (prev.includes(userEmail)) {
        return prev.filter(email => email !== userEmail)
      } else {
        return [...prev, userEmail]
      }
    })
  }

  const clearUserSelection = () => {
    setSelectedUsers([])
  }

  const getEmployeeBreakdown = (rows, timeFilter = 'all', emailDirectionFilter = 'both') => {
    const filteredRows = applyAllFilters(rows, timeFilter, emailDirectionFilter)
    const breakdown = {}
    
    filteredRows.forEach(row => {
      const sender = row['sender_address']
      if (sender) {
        breakdown[sender] = (breakdown[sender] || 0) + 1
      }
    })

    return Object.entries(breakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([email, count]) => ({ 
        email, 
        count, 
        name: email.split('@')[0],
        isSelected: selectedUsers.includes(email)
      }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-700">Error: {error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        No data to display
      </div>
    )
  }

  const heatmapData = generateHeatmapData(data.rows, timeFilter, emailDirectionFilter)
  const yearComparison = generateYearComparison(data.allRows)
  const employeeBreakdown = getEmployeeBreakdown(data.rows, timeFilter, emailDirectionFilter)

  const tabs = [
    { id: 'heatmap', label: 'Activity Heatmap' },
    { id: 'employees', label: 'Employee Stats' },
    { id: 'trends', label: 'Year Comparison' },
    { id: 'breakdown', label: 'Detailed Analysis' }
  ]

  const timeFilters = [
    { id: 'all', label: 'All Time' },
    { id: 'this-week', label: 'This Week' },
    { id: 'last-week', label: 'Last Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'last-month', label: 'Last Month' },
    { id: 'ytd', label: 'Year to Date' },
    { id: 'last-year', label: 'Last Year' }
  ]

  const emailDirectionFilters = [
    { id: 'both', label: 'All Emails' },
    { id: 'sent', label: 'Sent Only' },
    { id: 'received', label: 'Received Only' }
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-6">
      {/* User Role and Data Filter Indicator */}
      {data && (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 border border-emerald-100">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Viewing as: <span className="font-medium text-gray-800">{data.userRole}</span>
              </span>
              {data.fileCount && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-gray-800 border">
                  {data.fileCount} file{data.fileCount !== 1 ? 's' : ''} merged
                </span>
              )}
              {data.isFiltered && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-gray-800 border">
                  Filtered to your data only
                </span>
              )}
              {!data.isFiltered && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-gray-800 border">
                  Viewing all data
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {heatmapData.totalEmails} emails ({timeFilter === 'all' ? 'all time' : timeFilters.find(f => f.id === timeFilter)?.label})
            </div>
          </div>

          {/* Deduplication Statistics */}
          {data.deduplicationStats && data.fileCount > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800 min-w-0">
                  <div className="font-medium mb-1">Duplicate Detection Applied</div>
                  <div className="space-y-1">
                    {data.isFiltered ? (
                      <div>
                        Processed <span className="font-medium">{data.deduplicationStats.filtered.originalCount}</span> emails, 
                        removed <span className="font-medium text-blue-900">{data.deduplicationStats.filtered.duplicatesRemoved}</span> duplicates, 
                        showing <span className="font-medium text-blue-900">{data.deduplicationStats.filtered.uniqueCount}</span> unique emails
                      </div>
                    ) : (
                      <div>
                        Processed <span className="font-medium">{data.deduplicationStats.unfiltered.originalCount}</span> emails, 
                        removed <span className="font-medium text-blue-900">{data.deduplicationStats.unfiltered.duplicatesRemoved}</span> duplicates, 
                        showing <span className="font-medium text-blue-900">{data.deduplicationStats.unfiltered.uniqueCount}</span> unique emails
                      </div>
                    )}
                    {(data.deduplicationStats.filtered.duplicatesRemoved > 0 || data.deduplicationStats.unfiltered.duplicatesRemoved > 0) && (
                      <div className="text-xs text-blue-700">
                        Duplicates were identified using message IDs and email timestamps to prevent double counting across overlapping CSV files.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time Filter Buttons */}
        <div className="bg-white rounded-lg border border-emerald-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Time Period</h3>
          <div className="flex flex-wrap gap-2">
            {timeFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTimeFilter(filter.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  timeFilter === filter.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Email Direction Filter */}
        <div className="bg-white rounded-lg border border-emerald-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Email Direction</h3>
          <div className="flex flex-wrap gap-2">
            {emailDirectionFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setEmailDirectionFilter(filter.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  emailDirectionFilter === filter.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-emerald-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Heatmap Tab */}
      {activeTab === 'heatmap' && (
        <HeatmapTab heatmapData={heatmapData} dayNames={dayNames} windowWidth={windowWidth} />
      )}

      {/* Employee Stats Tab */}
      {activeTab === 'employees' && (
        <EmployeeStats
          selectedUsers={selectedUsers}
          toggleUserSelection={toggleUserSelection}
          clearUserSelection={clearUserSelection}
          employeeBreakdown={employeeBreakdown}
          heatmapData={heatmapData}
          dayNames={dayNames}
          COLORS={COLORS}
        />
      )}

      {/* Year Comparison Tab */}
      {activeTab === 'trends' && (
        <YearComparison yearComparison={yearComparison} />
      )}

      {/* Detailed Breakdown Tab */}
      {activeTab === 'breakdown' && (
        <DetailedBreakdown
          selectedUsers={selectedUsers}
          toggleUserSelection={toggleUserSelection}
          employeeBreakdown={employeeBreakdown}
          heatmapData={heatmapData}
          dayNames={dayNames}
          COLORS={COLORS}
        />
      )}
    </div>
  )
}
