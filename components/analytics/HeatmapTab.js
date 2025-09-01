import React from 'react'

export default function HeatmapTab({ heatmapData, dayNames, windowWidth }) {
  return (
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
                  {rowUsers.map(({ user, userHeatmap, totalEmails }) => {
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
                  const hour = heatmapData.hourRange[0] + index
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
  )
}

