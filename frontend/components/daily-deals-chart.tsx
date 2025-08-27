"use client"

import { TrendingUp, TrendingDown } from 'lucide-react' // Import TrendingDown for potential downtrends
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts" // Added YAxis and Tooltip
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

// Generate dummy data for the last 30 days
const generateDailyDealsData = () => {
  const data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const deals = Math.floor(Math.random() * 50) + 10 // Random deals between 10 and 60
    data.push({ date: date.toISOString().split('T')[0], deals }) // Format date as YYYY-MM-DD
  }
  return data
}

const chartData = generateDailyDealsData()

const chartConfig = {
  deals: {
    label: "Deals",
    color: "var(--chart-1)", // Using chart-1 for orange
  },
} satisfies ChartConfig

export function DailyDealsChart() {
  const firstDayDeals = chartData[0]?.deals || 0;
  const lastDayDeals = chartData[chartData.length - 1]?.deals || 0;
  const percentageChange = ((lastDayDeals - firstDayDeals) / firstDayDeals) * 100;
  const isTrendingUp = percentageChange >= 0;

  return (
    <Card className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-xl font-semibold text-white">Daily Deals</CardTitle>
        <CardDescription className="text-gray-400 text-sm">
          Showing total deals for the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 10,
                bottom: 0,
              }}
            >
                
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`; // Format as MM/DD
                }}
                className="text-xs text-gray-400"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs text-gray-400"
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Area
                dataKey="deals"
                type="natural"
                fill="var(--color-deals)" // Use --color-deals for consistency
                fillOpacity={0.4}
                stroke="var(--color-deals)"
                strokeWidth={2}
                dot={{
                  fill: "var(--color-deals)",
                  stroke: "var(--color-deals)",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "var(--color-deals)",
                  stroke: "var(--color-deals)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm p-0 pt-4">
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium text-white">
              {isTrendingUp ? (
                <>
                  Trending up by {percentageChange.toFixed(2)}% this month <TrendingUp className="h-4 w-4 text-green-400" />
                </>
              ) : (
                <>
                  Trending down by {Math.abs(percentageChange).toFixed(2)}% this month <TrendingDown className="h-4 w-4 text-red-400" />
                </>
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none text-gray-400">
              Last 30 days
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
