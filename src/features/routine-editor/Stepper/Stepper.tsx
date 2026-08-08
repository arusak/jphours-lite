import styles from './Stepper.module.css'

interface StepperProps {
  label: string
  description: string
  value: string
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
  onDecrease(): void
  onIncrease(): void
}

export function Stepper({
  label,
  description,
  value,
  decreaseDisabled = false,
  increaseDisabled = false,
  onDecrease,
  onIncrease,
}: StepperProps) {
  return (
    <div className={styles.settingStepper}>
      <span className={styles.settingCopy}>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.stepperControls}>
        <button aria-label={`Decrease ${label}`} disabled={decreaseDisabled} onClick={onDecrease}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button aria-label={`Increase ${label}`} disabled={increaseDisabled} onClick={onIncrease}>
          +
        </button>
      </span>
    </div>
  )
}
