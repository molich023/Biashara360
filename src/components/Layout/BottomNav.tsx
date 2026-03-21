import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, Package, BarChart2, Settings } from 'lucide-react'

const tabs = [
  { path: '/sell',     label: 'Uza',    icon: ShoppingCart },
  { path: '/stock',    label: 'Stoki',  icon: Package      },
  { path: '/report',  label: 'Ripoti', icon: BarChart2    },
  { path: '/settings', label: 'Zaidi',  icon: Settings     },
]

export const BottomNav: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav safe-area-bottom">
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span className="nav-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
