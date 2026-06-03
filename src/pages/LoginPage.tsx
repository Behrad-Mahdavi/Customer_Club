import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TextInput, Button, Tile, Theme } from '@carbon/react'
import { toast } from 'sonner'
import { useAppStore } from '../store/app-store'
import { normalizePin } from '../lib/normalize'

export function LoginPage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuthenticated = useAppStore((s) => s.setAuthenticated)

  const handleLogin = async () => {
    const normalizedPin = normalizePin(pin)

    if (!normalizedPin) {
      toast.error('رمز ورود را وارد کنید')
      return
    }

    if (!window.api) {
      toast.error('اتصال به سیستم برقرار نیست — صفحه را refresh کنید')
      return
    }

    setLoading(true)
    try {
      const valid = await window.api.settings.verifyPin(normalizedPin)
      if (valid) {
        setAuthenticated(true)
        navigate('/pos')
      } else {
        toast.error('رمز ورود اشتباه است — از 1234 یا ۱۲۳۴ استفاده کنید')
      }
    } catch (err) {
      console.error('[login]', err)
      toast.error('خطا در اتصال به دیتابیس — Electron را restart کنید')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Theme theme="g100">
      <div className="login-page">
        <Tile className="login-card">
          <h1>باشگاه مشتریان</h1>
          <p>برای ورود، رمز PIN را وارد کنید</p>
          <p className="login-pin-hint">رمز پیش‌فرض: 1234</p>
          <TextInput
            id="pin"
            labelText="رمز ورود"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            size="lg"
          />
          <Button kind="primary" size="lg" onClick={handleLogin} disabled={loading}>
            {loading ? 'در حال ورود...' : 'ورود'}
          </Button>
        </Tile>
      </div>
    </Theme>
  )
}
