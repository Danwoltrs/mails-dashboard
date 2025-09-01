import React from 'react'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'

export default function YearComparison({ yearComparison }) {
  return (
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
  )
}

