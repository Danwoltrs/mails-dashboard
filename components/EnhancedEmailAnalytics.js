import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts'
import { filterDataByUser, canAccessAllData } from '../utils/permissions'

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
          const parsedData = parseEmailCSV(csvText, file.name)
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
      const mergedData = mergeMultipleCSVData(validResults)
      setData(mergedData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const mergeMultipleCSVData = (parsedDataArray) => {
    if (parsedDataArray.length === 0) return null
    if (parsedDataArray.length === 1) return parsedDataArray[0]

    // Combine all headers (union of all headers)
    const allHeaders = new Set()
    parsedDataArray.forEach(data => {
      data.headers.forEach(header => allHeaders.add(header))
    })
    const mergedHeaders = Array.from(allHeaders)

    // Combine all rows
    const allRows = []
    const allUnfilteredRows = []
    
    parsedDataArray.forEach(data => {
      allRows.push(...data.rows)
      allUnfilteredRows.push(...data.allRows)
    })

    return {
      headers: mergedHeaders,
      rows: allRows,
      allRows: allUnfilteredRows,
      isFiltered: parsedDataArray[0].isFiltered,
      userRole: parsedDataArray[0].userRole,
      fileCount: parsedDataArray.length,
      totalRecords: allRows.length
    }
  }

  const parseEmailCSV = (csvText, fileName = 'unknown') => {
    const lines = csvText.split('\n').filter(line => line.trim())
    if (lines.length === 0) return null

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    console.log('CSV Headers for', fileName, ':', headers);
    
    // Validate this is an email tracking CSV
    const requiredEmailHeaders = ['date_time_utc', 'sender_address'];
    const hasEmailHeaders = requiredEmailHeaders.some(header => 
      headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
    );
    
    if (!hasEmailHeaders) {
      console.warn('Skipping non-email CSV file:', fileName, 'Headers:', headers);
      return null;
    }
    
    const rows = lines.slice(1).map(line => {
      const values = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/"/g, ''))
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim().replace(/"/g, ''))

      const row = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      // Add source file information
      row._source_file = fileName
      return row
    })

    // Apply user-based filtering
    const filteredRows = filterDataByUser(rows, session)
    
    console.log('Sample parsed data for', fileName, ':', filteredRows.slice(0, 2));
    console.log('Total rows parsed:', filteredRows.length);
    
    return {
      headers,
      rows: filteredRows,
      allRows: rows,
      isFiltered: !canAccessAllData(session),
      userRole: session?.user?.role || 'user',
      sourceFile: fileName
    }
  }

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
  const maxHeatmapValue = Math.max(...heatmapData.heatmap.flat())

  return (
    <div className="space-y-6">
      {/* User Role and Data Filter Indicator */}
      {data && (
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
        <div className="space-y-6">
          {/* Quick Stats - Moved to top */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-700">{heatmapData.totalEmails}</div>
              <div className="text-sm text-gray-600">Total Emails</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {Object.keys(heatmapData.employeeStats).length}
              </div>
              <div className="text-sm text-gray-600">Active Employees</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {Math.round(heatmapData.totalEmails / Object.keys(heatmapData.employeeStats).length || 0)}
              </div>
              <div className="text-sm text-gray-600">Avg per Employee</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">
                {Math.max(...heatmapData.heatmap.flat())}
              </div>
              <div className="text-sm text-gray-600">Peak Hour Volume</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual User Activity Heatmaps</h3>
            <p className="text-sm text-gray-600 mb-6">Email volume by day of week and hour of day for each user</p>
            
            {/* Individual User Heatmaps - Flexible Responsive Layout */}
            <div className="overflow-x-auto">
              {(() => {
                // Get active users and sort by total email count (highest to lowest)
                const activeUsers = Object.entries(heatmapData.userHeatmaps)
                  .filter(([_, userHeatmap]) => Math.max(...userHeatmap.flat()) > 0)
                  .map(([user, userHeatmap]) => ({
                    user,
                    userHeatmap,
                    totalEmails: userHeatmap.flat().reduce((sum, val) => sum + val, 0)
                  }))
                  .sort((a, b) => b.totalEmails - a.totalEmails)
                
                // Determine responsive columns per row based on screen width
                const getColumnsPerRow = () => {
                  if (windowWidth >= 1800) return 5  // Extra large screens - fit 5 columns
                  if (windowWidth >= 1400) return 4  // Large screens - fit 4 columns
                  if (windowWidth >= 1024) return 3  // Medium screens - fit 3 columns
                  if (windowWidth >= 768) return 2   // Small screens - fit 2 columns
                  return 1                           // Mobile - fit 1 column
                }
                
                const usersPerRow = getColumnsPerRow()
                const userRows = []
                for (let i = 0; i < activeUsers.length; i += usersPerRow) {
                  userRows.push(activeUsers.slice(i, i + usersPerRow))
                }
                
                return userRows.map((rowUsers, rowIndex) => (
                  <div key={rowIndex} className="mb-8">
                    {/* User names centered and capitalized */}
                    <div className="flex mb-2">
                      <div className="w-12"></div>
                      {rowUsers.map(({ user, totalEmails }) => {
                        const userName = user.split('@')[0]
                        const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()
                        
                        return (
                          <div key={user} className="flex flex-col items-center mr-6" style={{ width: '308px' }}>
                            <div className="text-lg font-semibold text-gray-800 text-center mb-1">
                              {capitalizedName}
                            </div>
                            <div className="text-sm text-gray-600 text-center mb-2">
                              ({totalEmails} emails)
                            </div>
                            {/* Daily totals row - sum of all emails per weekday - styled as small charcoal numbers */}
                            <div className="flex mb-1" style={{ width: '308px' }}>
                              {dayNames.map((day, dayIndex) => {
                                const dailyTotal = userHeatmap[dayIndex].reduce((daySum, hourCount) => daySum + hourCount, 0)
                                
                                return (
                                  <div key={`total-${day}`} className="text-xs font-medium text-gray-600 text-center flex items-center justify-center" style={{ width: '44px', height: '20px' }}>
                                    {dailyTotal > 0 ? dailyTotal : ''}
                                  </div>
                                )
                              })}
                            </div>
                            {/* Day labels (S M T W T F S) below totals, above squares */}
                            <div className="flex mb-1" style={{ width: '308px' }}>
                              {dayNames.map((day) => (
                                <div key={day} className="text-sm font-bold text-gray-700 text-center flex items-center justify-center" style={{ width: '44px', height: '20px' }}>
                                  {day.slice(0, 1)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Heatmap grid - hours vertical, all squares aligned */}
                    {Array.from({length: heatmapData.hourRange[1] - heatmapData.hourRange[0] + 1}, (_, index) => {
                      const hour = heatmapData.hourRange[0] + index;
                      return (
                        <div key={hour} className="flex mb-1">
                          <div className="w-12 text-sm text-gray-700 font-medium pr-2 text-right flex items-center justify-end" style={{height: '44px'}}>
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                          {rowUsers.map(({ user, userHeatmap }) => {
                            const userMaxValue = Math.max(...userHeatmap.flat())
                            
                            return (
                              <div key={user} className="flex mr-6">
                                {dayNames.map((day, dayIndex) => {
                                  const value = userHeatmap[dayIndex][hour]
                                  const intensity = userMaxValue > 0 ? value / userMaxValue : 0
                                  return (
                                    <div
                                      key={`${user}-${dayIndex}-${hour}`}
                                      className="flex items-center justify-center font-bold border border-gray-300 rounded"
                                      style={{
                                        width: '44px',
                                        height: '44px',
                                        backgroundColor: `rgba(5, 150, 105, ${intensity * 0.8 + 0.1})`,
                                        color: intensity > 0.5 ? 'white' : '#374151',
                                        fontSize: '12px'
                                      }}
                                      title={`${user} - ${day} ${hour}:00 - ${value} emails`}
                                    >
                                      {value > 0 ? value : ''}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Employee Stats Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-6">
          {/* User Selection Controls */}
          {selectedUsers.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-medium text-blue-800">
                    Selected Users ({selectedUsers.length})
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedUsers.map(email => (
                      <span key={email} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {email.split('@')[0]}
                        <button
                          onClick={() => toggleUserSelection(email)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={clearUserSelection}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Employee Email Activity</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={employeeBreakdown.slice(0, 15)} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    tick={{fontSize: 11}}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, 'Emails']}
                    labelFormatter={(label) => {
                      const employee = employeeBreakdown.find(emp => emp.name === label)
                      return employee ? employee.email : label
                    }}
                  />
                  <Bar dataKey="count">
                    {employeeBreakdown.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isSelected ? "#dc2626" : "#059669"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={employeeBreakdown.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    label={({name, count}) => `${name}: ${count}`}
                  >
                    {employeeBreakdown.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Individual User Comparison Heatmaps */}
          {selectedUsers.length > 0 && (
            <div className="bg-white rounded-lg border border-emerald-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Selected Users Comparison ({selectedUsers.length} users)
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {selectedUsers.map(userEmail => {
                  const userHeatmap = heatmapData.userHeatmaps[userEmail]
                  if (!userHeatmap) return null
                  
                  const userMaxValue = Math.max(...userHeatmap.flat())
                  if (userMaxValue === 0) return null
                  
                  return (
                    <div key={userEmail} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-md font-medium text-gray-800 mb-3">
                        {userEmail.split('@')[0]} ({userHeatmap.flat().reduce((sum, val) => sum + val, 0)} emails)
                      </h4>
                      
                      <div className="overflow-x-auto">
                        <div className="inline-flex flex-col gap-1" style={{ minWidth: '372px' }}>
                          {/* Header with days - horizontal */}
                          <div className="flex">
                            <div className="w-12 text-xs text-gray-500 text-center py-1"></div>
                            {dayNames.map((day) => (
                              <div key={day} className="text-xs text-gray-700 font-medium text-center py-1 flex items-center justify-center" style={{ width: '44px' }}>
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Heatmap rows - hours vertical */}
                          {Array.from({length: heatmapData.hourRange[1] - heatmapData.hourRange[0] + 1}, (_, index) => {
                            const hour = heatmapData.hourRange[0] + index;
                            return (
                            <div key={hour} className="flex">
                              <div className="w-12 text-xs text-gray-700 font-medium py-1 pr-1 text-right flex items-center justify-end">
                                {hour.toString().padStart(2, '0')}
                              </div>
                              {dayNames.map((day, dayIndex) => {
                                const value = userHeatmap[dayIndex][hour]
                                const intensity = userMaxValue > 0 ? value / userMaxValue : 0
                                return (
                                  <div
                                    key={`${userEmail}-${dayIndex}-${hour}`}
                                    className="rounded border border-gray-200 flex items-center justify-center text-xs font-medium"
                                    style={{
                                      width: '44px',
                                      height: '32px',
                                      backgroundColor: `rgba(5, 150, 105, ${intensity * 0.8 + 0.1})`,
                                      color: intensity > 0.5 ? 'white' : '#374151'
                                    }}
                                    title={`${userEmail} - ${day} ${hour}:00 - ${value} emails`}
                                  >
                                    {value > 0 ? value : ''}
                                  </div>
                                )
                              })}
                            </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Year Comparison Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Year-over-Year Comparison</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="thisYear" 
                    stroke="#059669" 
                    strokeWidth={3}
                    name="This Year"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="lastYear" 
                    stroke="#6b7280" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Last Year"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Trend Analysis</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="thisYear" 
                    stackId="1"
                    stroke="#059669" 
                    fill="rgba(5, 150, 105, 0.6)"
                    name="This Year"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Breakdown Tab */}
      {activeTab === 'breakdown' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-emerald-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Daily Distribution
                {selectedUsers.length > 0 && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({selectedUsers.length} selected users)
                  </span>
                )}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    if (selectedUsers.length === 0) {
                      // Show combined data when no users selected
                      return dayNames.map((day, index) => ({
                        day,
                        emails: heatmapData.heatmap[index].reduce((a, b) => a + b, 0)
                      }))
                    } else {
                      // Show individual user data when users are selected
                      return dayNames.map((day, dayIndex) => {
                        const dayData = { day }
                        selectedUsers.forEach((userEmail, userIndex) => {
                          const userHeatmap = heatmapData.userHeatmaps[userEmail]
                          if (userHeatmap) {
                            const userName = userEmail.split('@')[0]
                            dayData[userName] = userHeatmap[dayIndex].reduce((a, b) => a + b, 0)
                          }
                        })
                        return dayData
                      })
                    }
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    {selectedUsers.length === 0 ? (
                      <Bar dataKey="emails" fill="#059669" />
                    ) : (
                      selectedUsers.map((userEmail, index) => {
                        const userName = userEmail.split('@')[0]
                        return (
                          <Bar 
                            key={userEmail}
                            dataKey={userName} 
                            fill={COLORS[index % COLORS.length]} 
                          />
                        )
                      })
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-emerald-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Hourly Distribution
                {selectedUsers.length > 0 && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({selectedUsers.length} selected users)
                  </span>
                )}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(() => {
                    if (selectedUsers.length === 0) {
                      // Show combined data when no users selected
                      return Array.from({length: heatmapData.hourRange[1] - heatmapData.hourRange[0] + 1}, (_, index) => {
                        const hour = heatmapData.hourRange[0] + index;
                        return {
                          hour: hour.toString().padStart(2, '0') + ':00',
                          emails: heatmapData.heatmap.reduce((sum, day) => sum + day[hour], 0)
                        };
                      })
                    } else {
                      // Show individual user data when users are selected
                      return Array.from({length: heatmapData.hourRange[1] - heatmapData.hourRange[0] + 1}, (_, index) => {
                        const hour = heatmapData.hourRange[0] + index;
                        const hourData = {
                          hour: hour.toString().padStart(2, '0') + ':00'
                        }
                        selectedUsers.forEach((userEmail) => {
                          const userHeatmap = heatmapData.userHeatmaps[userEmail]
                          if (userHeatmap) {
                            const userName = userEmail.split('@')[0]
                            hourData[userName] = userHeatmap.reduce((sum, day) => sum + day[hour], 0)
                          }
                        })
                        return hourData
                      })
                    }
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    {selectedUsers.length === 0 ? (
                      <Line 
                        type="monotone" 
                        dataKey="emails" 
                        stroke="#059669" 
                        strokeWidth={3}
                      />
                    ) : (
                      selectedUsers.map((userEmail, index) => {
                        const userName = userEmail.split('@')[0]
                        return (
                          <Line 
                            key={userEmail}
                            type="monotone" 
                            dataKey={userName} 
                            stroke={COLORS[index % COLORS.length]} 
                            strokeWidth={3}
                          />
                        )
                      })
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Employees Table */}
          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Top Email Senders</h3>
              {selectedUsers.length > 0 && (
                <div className="text-sm text-blue-600">
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">Click on employees to select/deselect them for comparison</p>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-emerald-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Email Count</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">% of Total</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeBreakdown.slice(0, 15).map((employee, index) => (
                    <tr 
                      key={employee.email} 
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        employee.isSelected 
                          ? 'bg-blue-50 hover:bg-blue-100' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleUserSelection(employee.email)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${
                            employee.isSelected ? 'bg-blue-500' : 'bg-gray-300'
                          }`}></div>
                          <div>
                            <div className="font-medium text-gray-800">{employee.name}</div>
                            <div className="text-xs text-gray-500">{employee.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{employee.count}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {((employee.count / heatmapData.totalEmails) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          employee.isSelected 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.isSelected ? 'Selected' : 'Click to select'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}