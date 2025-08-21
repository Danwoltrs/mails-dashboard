import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts'
import { filterDataByUser, canAccessAllData } from '../utils/permissions'

const COLORS = ['#059669', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#7c3aed', '#db2777', '#dc2626']

export default function EnhancedEmailAnalytics({ file }) {
  const { data: session } = useSession()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('heatmap')
  const [timeFilter, setTimeFilter] = useState('all')

  useEffect(() => {
    if (file) {
      loadAndParseCSV()
    }
  }, [file])

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
      const timestamp = row['origin_timestamp_utc']
      if (!timestamp) return false
      
      try {
        const date = new Date(timestamp)
        return date >= range.start && date <= range.end
      } catch (e) {
        return false
      }
    })
  }

  const loadAndParseCSV = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(file.path)
      if (!response.ok) {
        throw new Error('Failed to load CSV file')
      }

      const csvText = await response.text()
      const parsedData = parseEmailCSV(csvText)
      setData(parsedData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const parseEmailCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim())
    if (lines.length === 0) return null

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
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
      return row
    })

    // Apply user-based filtering
    const filteredRows = filterDataByUser(rows, session)
    
    return {
      headers,
      rows: filteredRows,
      allRows: rows,
      isFiltered: !canAccessAllData(session),
      userRole: session?.user?.role || 'user'
    }
  }

  const generateHeatmapData = (rows, filter = 'all') => {
    const filteredRows = filterDataByDateRange(rows, filter)
    const heatmap = Array(7).fill(null).map(() => Array(24).fill(0))
    const employeeStats = {}

    filteredRows.forEach(row => {
      const timestamp = row['origin_timestamp_utc']
      const sender = row['sender_address']
      
      if (timestamp && sender) {
        try {
          const date = new Date(timestamp)
          const day = date.getDay() // 0 = Sunday, 6 = Saturday
          const hour = date.getHours()
          
          heatmap[day][hour]++
          
          if (!employeeStats[sender]) {
            employeeStats[sender] = { total: 0, byDay: Array(7).fill(0), byHour: Array(24).fill(0) }
          }
          employeeStats[sender].total++
          employeeStats[sender].byDay[day]++
          employeeStats[sender].byHour[hour]++
        } catch (e) {
          // Invalid timestamp
        }
      }
    })

    return { heatmap, employeeStats, totalEmails: filteredRows.length }
  }

  const generateYearComparison = (rows) => {
    const thisYear = new Date().getFullYear()
    const lastYear = thisYear - 1
    
    const thisYearData = {}
    const lastYearData = {}
    
    rows.forEach(row => {
      const timestamp = row['origin_timestamp_utc']
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

  const getEmployeeBreakdown = (rows, filter = 'all') => {
    const filteredRows = filterDataByDateRange(rows, filter)
    const breakdown = {}
    
    filteredRows.forEach(row => {
      const sender = row['sender_address']
      if (sender) {
        breakdown[sender] = (breakdown[sender] || 0) + 1
      }
    })

    return Object.entries(breakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([email, count]) => ({ email, count }))
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

  const heatmapData = generateHeatmapData(data.rows, timeFilter)
  const yearComparison = generateYearComparison(data.allRows)
  const employeeBreakdown = getEmployeeBreakdown(data.rows, timeFilter)

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

      {/* Time Filter Buttons */}
      <div className="flex flex-wrap gap-2 p-4 bg-white rounded-lg border border-emerald-100">
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
          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Activity Heatmap</h3>
            <p className="text-sm text-gray-600 mb-6">Email volume by day of week and hour of day</p>
            
            <div className="overflow-x-auto">
              <div className="grid grid-cols-25 gap-1 min-w-full">
                {/* Header with hours */}
                <div className="text-xs text-gray-500 text-center py-1"></div>
                {Array.from({length: 24}, (_, hour) => (
                  <div key={hour} className="text-xs text-gray-500 text-center py-1">
                    {hour.toString().padStart(2, '0')}
                  </div>
                ))}
                
                {/* Heatmap rows */}
                {dayNames.map((day, dayIndex) => (
                  <React.Fragment key={day}>
                    <div className="text-xs text-gray-700 font-medium py-2 pr-2 text-right">
                      {day}
                    </div>
                    {Array.from({length: 24}, (_, hour) => {
                      const value = heatmapData.heatmap[dayIndex][hour]
                      const intensity = maxHeatmapValue > 0 ? value / maxHeatmapValue : 0
                      return (
                        <div
                          key={`${dayIndex}-${hour}`}
                          className="aspect-square rounded border border-gray-200 flex items-center justify-center text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(5, 150, 105, ${intensity * 0.8 + 0.1})`,
                            color: intensity > 0.5 ? 'white' : '#374151'
                          }}
                          title={`${day} ${hour}:00 - ${value} emails`}
                        >
                          {value > 0 ? value : ''}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
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
        </div>
      )}

      {/* Employee Stats Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Employee Email Activity</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeBreakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="email" 
                    angle={-45} 
                    textAnchor="end" 
                    height={80}
                    tick={{fontSize: 12}}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#059669" />
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
                    label={({email, count}) => `${email.split('@')[0]}: ${count}`}
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
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayNames.map((day, index) => ({
                    day,
                    emails: heatmapData.heatmap[index].reduce((a, b) => a + b, 0)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="emails" fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-emerald-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Hourly Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.from({length: 24}, (_, hour) => ({
                    hour: hour.toString().padStart(2, '0') + ':00',
                    emails: heatmapData.heatmap.reduce((sum, day) => sum + day[hour], 0)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="emails" 
                      stroke="#059669" 
                      fill="rgba(5, 150, 105, 0.6)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Employees Table */}
          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Email Senders</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-emerald-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Email Count</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeBreakdown.slice(0, 10).map((employee, index) => (
                    <tr key={employee.email} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-800">{employee.email}</td>
                      <td className="py-3 px-4 text-gray-600">{employee.count}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {((employee.count / heatmapData.totalEmails) * 100).toFixed(1)}%
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