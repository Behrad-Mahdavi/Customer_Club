import { forwardRef, type ChangeEvent, type ComponentProps } from 'react'
import { TextInput } from '@carbon/react'
import { formatAmountHint } from '../lib/format'
import { normalizeAmountInput } from '../lib/normalize'

type MoneyTextInputProps = Omit<ComponentProps<typeof TextInput>, 'helperText'> & {
  value: string
  showHint?: boolean
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyTextInputProps>(
  function MoneyInput({ value, className, showHint = true, onChange, ...props }, ref) {
    const hint = showHint ? formatAmountHint(value) : ''

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const digits = normalizeAmountInput(e.target.value)
      onChange?.({
        ...e,
        target: { ...e.target, value: digits },
        currentTarget: { ...e.currentTarget, value: digits },
      })
    }

    return (
      <TextInput
        ref={ref}
        {...props}
        value={value}
        onChange={handleChange}
        helperText={hint || undefined}
        className={['money-input', 'numeric', className].filter(Boolean).join(' ')}
      />
    )
  },
)

interface MoneyNumberInputProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  disabled?: boolean
}

export function MoneyNumberInput({ id, label, value, onChange, disabled }: MoneyNumberInputProps) {
  const str = value > 0 ? String(value) : ''

  return (
    <MoneyInput
      id={id}
      labelText={label}
      value={str}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      disabled={disabled}
      inputMode="numeric"
    />
  )
}
