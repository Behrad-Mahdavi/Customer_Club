import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Content,
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
} from '@carbon/react'
import {
  Dashboard,
  UserMultiple,
  Star,
  Receipt,
  Money,
  Settings,
  ShoppingCart,
  Logout,
} from '@carbon/icons-react'
import { useAppStore } from '../store/app-store'

const navItems = [
  { to: '/', label: 'داشبورد', icon: Dashboard },
  { to: '/customers', label: 'مشتریان', icon: UserMultiple },
  { to: '/transactions', label: 'تراکنش‌ها', icon: Receipt },
  { to: '/vip', label: 'مشتریان VIP', icon: Star },
  { to: '/cashback', label: 'قوانین کش‌بک', icon: Money },
  { to: '/settings', label: 'تنظیمات', icon: Settings },
]

interface ShellProps {
  children: React.ReactNode
}

export function Shell({ children }: ShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  const logout = useAppStore((s) => s.logout)
  const [expanded, setExpanded] = useState(true)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <Theme theme="g100">
      <div className="app-shell" dir="rtl">
        <Header aria-label="باشگاه مشتریان" className="app-header">
          <SkipToContent />
          <HeaderName onClick={() => navigate('/')} prefix="">
            {settings?.businessName ?? 'باشگاه مشتریان'}
          </HeaderName>
          <HeaderGlobalBar>
            <span className="header-branch">{settings?.branchName}</span>
            <HeaderGlobalAction aria-label="صندوق فروش" onClick={() => navigate('/pos')} tooltipAlignment="end">
              <ShoppingCart size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction aria-label="خروج" onClick={handleLogout} tooltipAlignment="end">
              <Logout size={20} />
            </HeaderGlobalAction>
          </HeaderGlobalBar>
        </Header>
        <SideNav
          aria-label="منوی اصلی"
          expanded={expanded}
          isFixedNav
          className="app-sidenav"
          onOverlayClick={() => setExpanded(false)}
        >
          <SideNavItems>
            {navItems.map(({ to, label, icon: Icon }) => (
              <SideNavLink
                key={to}
                renderIcon={Icon}
                isActive={location.pathname === to}
                onClick={() => navigate(to)}
              >
                {label}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>
        <Content id="main-content" className="app-content" dir="rtl">
          {children}
        </Content>
      </div>
    </Theme>
  )
}
