import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { filterDataByUser, canAccessAllData } from '../utils/permissions'

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280']

export default function EmailAnalytics({ file }) {
  const { data: session } = useSession()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (file) {
      loadAndParseCSV()
    }
  }, [file])

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
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
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
      allRows: rows, // Keep original for admin comparison
      summary: generateSummary(filteredRows, headers),
      isFiltered: !canAccessAllData(session),
      userRole: session?.user?.role || 'user'
    }
  }

  const generateSummary = (rows, headers) => {
    const summary = {
      totalEmails: rows.length,
      dateRange: null,
      topSenders: {},
      topRecipients: {},
      dailyVolume: {},
      statusBreakdown: {},
      hourlyDistribution: {}
    }

    // Find date/time related columns
    const timeColumns = headers.filter(h => 
      h.toLowerCase().includes('time') || 
      h.toLowerCase().includes('date') ||
      h.toLowerCase().includes('timestamp')
    )

    // Find sender/recipient columns
    const senderColumns = headers.filter(h => 
      h.toLowerCase().includes('sender') || 
      h.toLowerCase().includes('from')
    )
    const recipientColumns = headers.filter(h => 
      h.toLowerCase().includes('recipient') || 
      h.toLowerCase().includes('to')
    )

    // Find status columns
    const statusColumns = headers.filter(h => 
      h.toLowerCase().includes('status') || 
      h.toLowerCase().includes('result')
    )

    rows.forEach(row => {
      // Process senders
      senderColumns.forEach(col => {
        const sender = row[col]
        if (sender) {
          summary.topSenders[sender] = (summary.topSenders[sender] || 0) + 1
        }
      })

      // Process recipients
      recipientColumns.forEach(col => {
        const recipient = row[col]
        if (recipient) {
          summary.topRecipients[recipient] = (summary.topRecipients[recipient] || 0) + 1
        }
      })

      // Process timestamps
      timeColumns.forEach(col => {
        const timestamp = row[col]
        if (timestamp) {
          try {
            const date = new Date(timestamp)
            const dateStr = date.toISOString().split('T')[0]
            const hour = date.getHours()
            
            summary.dailyVolume[dateStr] = (summary.dailyVolume[dateStr] || 0) + 1
            summary.hourlyDistribution[hour] = (summary.hourlyDistribution[hour] || 0) + 1
          } catch (e) {
            // Invalid date format
          }
        }
      })

      // Process status
      statusColumns.forEach(col => {
        const status = row[col]
        if (status) {
          summary.statusBreakdown[status] = (summary.statusBreakdown[status] || 0) + 1
        }
      })
    })

    return summary
  }

  const formatChartData = (obj, limit = 10) => {
    return Object.entries(obj)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([name, value]) => ({ name, value }))
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

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'senders', label: 'Top Senders' },
    { id: 'recipients', label: 'Top Recipients' },
    { id: 'timeline', label: 'Timeline' },
  ]

  return (
    <div className="space-y-6">
      {/* User Role and Data Filter Indicator */}
      {data && (
        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Viewing as: <span className="font-medium text-gray-900">{data.userRole}</span>
            </span>
            {data.isFiltered && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Filtered to your data only
              </span>
            )}
            {!data.isFiltered && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Viewing all data
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {data.rows.length} of {data.allRows?.length || data.rows.length} emails
          </div>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">{data.summary.totalEmails}</div>
            <div className="text-sm text-green-600">Total Emails</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">
              {Object.keys(data.summary.topSenders).length}
            </div>
            <div className="text-sm text-blue-600">Unique Senders</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-700">
              {Object.keys(data.summary.topRecipients).length}
            </div>
            <div className="text-sm text-purple-600">Unique Recipients</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-700">
              {Object.keys(data.summary.dailyVolume).length}
            </div>
            <div className="text-sm text-orange-600">Active Days</div>
          </div>
        </div>
      )}

      {activeTab === 'senders' && Object.keys(data.summary.topSenders).length > 0 && (
        <div className="h-96">
          <h3 className="text-lg font-semibold mb-4">Top Email Senders</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatChartData(data.summary.topSenders)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'recipients' && Object.keys(data.summary.topRecipients).length > 0 && (
        <div className="h-96">
          <h3 className="text-lg font-semibold mb-4">Top Email Recipients</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatChartData(data.summary.topRecipients)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'timeline' && Object.keys(data.summary.dailyVolume).length > 0 && (
        <div className="h-96">
          <h3 className="text-lg font-semibold mb-4">Daily Email Volume</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatChartData(data.summary.dailyVolume, 30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status Breakdown */}
      {Object.keys(data.summary.statusBreakdown).length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Email Status Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formatChartData(data.summary.statusBreakdown)}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, value}) => `${name}: ${value}`}
                >
                  {formatChartData(data.summary.statusBreakdown).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Raw Data Preview */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Raw Data Preview</h3>
        <div className="bg-gray-50 rounded-lg p-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {data.headers.slice(0, 5).map((header, index) => (
                  <th key={index} className="text-left py-2 px-3 font-medium text-gray-900">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 5).map((row, index) => (
                <tr key={index} className="border-b border-gray-100">
                  {data.headers.slice(0, 5).map((header, cellIndex) => (
                    <td key={cellIndex} className="py-2 px-3 text-gray-700 truncate max-w-xs">
                      {row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 5 && (
            <div className="text-center py-3 text-gray-500 text-sm">
              ... and {data.rows.length - 5} more rows
            </div>
          )}
        </div>
      </div>
    </div>
  )
}