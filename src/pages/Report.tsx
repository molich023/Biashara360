import React, { useState, useEffect } from 'react'
import { Share2, TrendingUp, TrendingDown, ShoppingBag, Users, RefreshCw } from 'lucide-react'
import { calculateDailyReport, getSalesByDateRange } from '@/db/local'
import { useAuth } from '@/lib/auth'
import { shareReceiptNative } from '@/lib/mpesa'
import type { DailyReport } from '@/types'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

type Period = 'today' | 'yesterday' | 'week'

export const ReportScreen: React.FC = () => {
  const { shop } = useAuth()
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('today')

  const loadReport = async (p: Period) => {
    if (!shop) return
    setLoading(true)
    try {
      if (p === 'today') {
        const r = await calculateDailyReport(shop.id)
        setReport(r)
      } else if (p === 'yesterday') {
        const yesterday = subDays(new Date(), 1)
        const sales = await getSalesByDateRange(shop.id, startOfDay(yesterday), endOfDay(yesterday))
        // Quick calc for yesterday
        let totalSales = 0, totalCost = 0, cashSales = 0, mpesaSales = 0
        const pMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
        for (const s of sales) {
          totalSales += s.netAmount
          if (s.paymentMethod === 'cash') cashSales += s.netAmount
          else if (s.paymentMethod === 'mpesa') mpesaSales += s.netAmount
          for (const item of s.items) {
            totalCost += item.costAtSale * item.qty
            const existing = pMap.get(item.productId)
            const profit = (item.unitPrice - item.costAtSale) * item.qty
            if (existing) { existing.qty += item.qty; existing.revenue += item.lineTotal; existing.profit += profit }
            else pMap.set(item.productId, { name: item.productName, qty: item.qty, revenue: item.lineTotal, profit })
          }
        }
        const grossProfit = totalSales - totalCost
        setReport({
          date: format(yesterday, 'yyyy-MM-dd'),
          totalSales, totalCost, grossProfit,
          profitMargin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
          totalTransactions: sales.length,
          cashSales, mpesaSales,
          topProducts: Array.from(pMap.entries()).map(([id, v]) => ({ productId: id, productName: v.name, qtySold: v.qty, revenue: v.revenue, profit: v.profit })).sort((a,b) => b.revenue - a.revenue).slice(0,5),
          salesByHour: [],
          voidCount: 0,
          averageSaleValue: sales.length > 0 ? totalSales / sales.length : 0
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReport(period) }, [shop?.id, period])

  const handleShare = () => {
    if (!report || !shop) return
    const dateLabel = period === 'today' ? 'Leo' : period === 'yesterday' ? 'Jana' : 'Wiki hii'
    const message = `📊 *RIPOTI YA ${dateLabel.toUpperCase()} — ${shop.name.toUpperCase()}*
━━━━━━━━━━━━━━━━━━
💰 Mauzo Jumla:  *KSH ${report.totalSales.toLocaleString()}*
📈 Faida Ghafi:   *KSH ${report.grossProfit.toLocaleString()}*
🧾 Miamala:       *${report.totalTransactions}*
💵 Taslimu:       KSH ${report.cashSales.toLocaleString()}
📱 M-Pesa:        KSH ${report.mpesaSales.toLocaleString()}
━━━━━━━━━━━━━━━━━━
🏆 *Bidhaa Bora:*
${report.topProducts.slice(0,3).map((p,i) => `  ${i+1}. ${p.productName} — KSH ${p.revenue.toLocaleString()}`).join('\n')}
━━━━━━━━━━━━━━━━━━
_Ripoti imetolewa na BIASHARA360_ 🚀`
    shareReceiptNative(message, shop.name)
  }

  const fmtKsh = (n: number) => `KSH ${Math.abs(n).toLocaleString()}`

  // ─── HOURLY CHART ─────────────────────────────────
  const maxHourly = Math.max(...(report?.salesByHour.map(h => h.amount) || [1]))

  if (loading) return (
    <div className="page flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Inahesabu ripoti...</p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📊 Ripoti</h1>
        <div className="flex gap-2">
          <button onClick={() => loadReport(period)} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
          <button onClick={handleShare} className="w-9 h-9 rounded-full bg-brand flex items-center justify-center">
            <Share2 size={15} className="text-black" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        {/* Period selector */}
        <div className="flex gap-2 mb-4">
          {(['today','yesterday'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors
                ${period === p ? 'bg-brand text-black border-brand' : 'bg-dark-card border-dark-border text-gray-400'}`}
            >
              {p === 'today' ? 'Leo' : 'Jana'}
            </button>
          ))}
        </div>

        {/* Date label */}
        <p className="text-xs text-gray-500 mb-3">
          {report?.date ? format(new Date(report.date + 'T12:00:00'), 'EEEE, dd MMMM yyyy') : ''}
        </p>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="stat-tile bg-emerald-900/30 border border-emerald-700/40">
            <span className="text-xs text-emerald-400 uppercase tracking-wide">Mauzo Jumla</span>
            <span className="stat-value text-emerald-400">{fmtKsh(report?.totalSales || 0)}</span>
          </div>
          <div className={`stat-tile border ${(report?.grossProfit || 0) >= 0 ? 'bg-blue-900/30 border-blue-700/40' : 'bg-red-900/30 border-red-700/40'}`}>
            <span className={`text-xs uppercase tracking-wide ${(report?.grossProfit || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>Faida Ghafi</span>
            <div className="flex items-center gap-1">
              {(report?.grossProfit || 0) >= 0 ? <TrendingUp size={16} className="text-blue-400" /> : <TrendingDown size={16} className="text-red-400" />}
              <span className={`stat-value ${(report?.grossProfit || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmtKsh(report?.grossProfit || 0)}</span>
            </div>
          </div>
          <div className="stat-tile bg-yellow-900/30 border border-yellow-700/40">
            <span className="text-xs text-yellow-400 uppercase tracking-wide">Miamala</span>
            <div className="flex items-center gap-1">
              <ShoppingBag size={16} className="text-yellow-400" />
              <span className="stat-value text-yellow-400">{report?.totalTransactions || 0}</span>
            </div>
          </div>
          <div className="stat-tile bg-purple-900/30 border border-purple-700/40">
            <span className="text-xs text-purple-400 uppercase tracking-wide">Bei ya Wastani</span>
            <span className="stat-value text-purple-400">{fmtKsh(report?.averageSaleValue || 0)}</span>
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Njia za Malipo</h3>
          <div className="space-y-2">
            {[
              { label: '💵 Taslimu', value: report?.cashSales || 0, color: 'bg-yellow-500' },
              { label: '📱 M-Pesa', value: report?.mpesaSales || 0, color: 'bg-green-500' },
            ].map(({ label, value, color }) => {
              const pct = (report?.totalSales || 0) > 0 ? (value / report!.totalSales) * 100 : 0
              return (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{label}</span>
                    <span className="font-semibold">KSH {value.toLocaleString()} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-dark-surface rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Hourly chart (today only) */}
        {period === 'today' && report?.salesByHour && (
          <div className="card mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Mauzo kwa Saa (Leo)</h3>
            <div className="flex items-end gap-0.5 h-24">
              {report.salesByHour.filter((_, i) => i >= 6 && i <= 22).map(h => {
                const height = maxHourly > 0 ? (h.amount / maxHourly) * 100 : 0
                const isNow = new Date().getHours() === h.hour
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={`w-full rounded-t-sm transition-all ${h.amount > 0 ? (isNow ? 'bg-brand' : 'bg-brand/40') : 'bg-dark-surface'}`}
                      style={{ height: `${Math.max(height, h.amount > 0 ? 8 : 2)}%` }}
                    />
                    {h.hour % 3 === 0 && <span className="text-gray-600" style={{ fontSize: '8px' }}>{h.hour}h</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top products */}
        {(report?.topProducts.length || 0) > 0 && (
          <div className="card mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">🏆 Bidhaa Bora Zaidi</h3>
            <div className="space-y-3">
              {report!.topProducts.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : 'bg-yellow-800/50 text-yellow-600'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.productName}</p>
                    <p className="text-xs text-gray-500">{p.qtySold} vimeuzwa</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand">KSH {p.revenue.toLocaleString()}</p>
                    {p.profit > 0 && <p className="text-xs text-green-400">+{fmtKsh(p.profit)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {report?.totalTransactions === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-400 text-sm">Hakuna mauzo {period === 'today' ? 'leo' : 'jana'} bado.</p>
          </div>
        )}

        {/* Share button at bottom */}
        <button className="btn-primary mb-6" onClick={handleShare}>
          <Share2 size={18} />
          Shiriki Ripoti (WhatsApp)
        </button>
      </div>
    </div>
  )
}
