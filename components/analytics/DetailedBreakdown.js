import React from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'

export default function DetailedBreakdown({ selectedUsers, toggleUserSelection, employeeBreakdown, heatmapData, dayNames, COLORS }) {
  return (
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
                    const hour = heatmapData.hourRange[0] + index
                    return {
                      hour: hour.toString().padStart(2, '0') + ':00',
                      emails: heatmapData.heatmap.reduce((sum, day) => sum + day[hour], 0)
                    }
                  })
                } else {
                  // Show individual user data when users are selected
                  return Array.from({length: heatmapData.hourRange[1] - heatmapData.hourRange[0] + 1}, (_, index) => {
                    const hour = heatmapData.hourRange[0] + index
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
  )
}

