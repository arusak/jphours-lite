import styles from './Stepper.module.css'

interface StepperProps {
  label: string
  value: string
  onDecrease(): void
  onIncrease(): void
}

export function Stepper({ label, value, onDecrease, onIncrease }: StepperProps) {
  return (
    <div className={styles.settingStepper}>
      <span>{label}</span>
      <button aria-label={`Decrease ${label}`} onClick={onDecrease}>
        −
      </button>
      <output>{value}</output>
      <button aria-label={`Increase ${label}`} onClick={onIncrease}>
        +
      </button>
    </div>
  )
}
