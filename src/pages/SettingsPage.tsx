import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  TextInput,
  NumberInput,
  Tile,
  Loading,
  Grid,
  Column,
} from '@carbon/react'
import { Download, Upload, Save } from '@carbon/icons-react'
import { toast } from 'sonner'
import { useAppStore } from '../store/app-store'
import { downloadFile } from '../lib/format'
import { MoneyNumberInput } from '../components/MoneyInput'

const schema = z.object({
  businessName: z.string().min(1),
  branchName: z.string().min(1),
  vipOrderThreshold: z.number().min(1),
  vipSpendingThreshold: z.number().min(0),
  authPin: z.string().min(4).max(8),
})

type FormData = z.infer<typeof schema>

export function SettingsPage() {
  const setSettings = useAppStore((s) => s.setSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { register, setValue, watch, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const values = watch()

  useEffect(() => {
    window.api.settings.get().then((s) => {
      reset({
        businessName: s.businessName,
        branchName: s.branchName,
        vipOrderThreshold: s.vipOrderThreshold,
        vipSpendingThreshold: s.vipSpendingThreshold,
        authPin: s.authPin,
      })
    }).finally(() => setLoading(false))
  }, [reset])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const updated = await window.api.settings.update(data)
      setSettings(updated)
      toast.success('تنظیمات ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      const json = await window.api.database.export()
      downloadFile(json, `customer-club-backup-${Date.now()}.json`, 'application/json')
      toast.success('پشتیبان‌گیری انجام شد')
    } catch {
      toast.error('خطا در پشتیبان‌گیری')
    }
  }

  const handleBackup = async () => {
    try {
      const path = await window.api.database.backup()
      toast.success(`پشتیبان در ${path} ذخیره شد`)
    } catch {
      toast.error('خطا در پشتیبان‌گیری')
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        await window.api.database.import(text)
        toast.success('داده‌ها با موفقیت وارد شدند')
        window.location.reload()
      } catch {
        toast.error('خطا در وارد کردن داده‌ها')
      }
    }
    input.click()
  }

  if (loading) return <Loading withOverlay={false} description="در حال بارگذاری..." />

  return (
    <div className="page">
      <h1 className="page-title">تنظیمات</h1>

      <Grid narrow>
        <Column lg={8} md={4} sm={4}>
          <Tile className="form-tile">
            <h3>اطلاعات کسب‌وکار</h3>
            <form onSubmit={handleSubmit(onSubmit)}>
              <TextInput
                id="businessName"
                labelText="نام کسب‌وکار"
                {...register('businessName')}
                value={values.businessName ?? ''}
                onChange={(e) => setValue('businessName', e.target.value)}
              />
              <TextInput
                id="branchName"
                labelText="نام شعبه"
                {...register('branchName')}
                value={values.branchName ?? ''}
                onChange={(e) => setValue('branchName', e.target.value)}
              />

              <h3>آستانه VIP</h3>
              <NumberInput
                id="vipOrderThreshold"
                label="حداقل تعداد سفارش"
                value={values.vipOrderThreshold ?? 10}
                onChange={(_, { value }) => setValue('vipOrderThreshold', Number(value))}
                min={1}
              />
              <MoneyNumberInput
                id="vipSpendingThreshold"
                label="حداقل مبلغ خرید (تومان)"
                value={values.vipSpendingThreshold ?? 0}
                onChange={(v) => setValue('vipSpendingThreshold', v)}
                min={0}
              />

              <h3>امنیت</h3>
              <TextInput
                id="authPin"
                labelText="رمز ورود (PIN)"
                type="password"
                {...register('authPin')}
                value={values.authPin ?? ''}
                onChange={(e) => setValue('authPin', e.target.value)}
              />

              <Button type="submit" kind="primary" renderIcon={Save} disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
              </Button>
            </form>
          </Tile>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <Tile className="form-tile">
            <h3>پشتیبان‌گیری</h3>
            <p className="field-info">تمام داده‌ها به صورت محلی ذخیره می‌شوند</p>
            <div className="settings-actions">
              <Button kind="secondary" renderIcon={Download} onClick={handleExport}>
                خروجی JSON
              </Button>
              <Button kind="secondary" renderIcon={Save} onClick={handleBackup}>
                پشتیبان دیتابیس
              </Button>
              <Button kind="tertiary" renderIcon={Upload} onClick={handleImport}>
                وارد کردن JSON
              </Button>
            </div>
          </Tile>
        </Column>
      </Grid>
    </div>
  )
}
