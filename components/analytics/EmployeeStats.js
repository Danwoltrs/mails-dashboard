import React from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'

export default function EmployeeStats({ selectedUsers, toggleUserSelection, clearUserSelection, employeeBreakdown, heatmapData, dayNames, COLORS }) {
  return (
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
                        const hour = heatmapData.hourRange[0] + index
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
  )
}

