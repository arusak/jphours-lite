import styles from "./SessionPlayer.module.css";

interface EndScreenProps {
  title: string;
  copy: string;
  onExit(): void;
}
export function EndScreen({ title, copy, onExit }: EndScreenProps) {
  return (
    <main className={`${styles.sessionPlayer} ${styles.completion}`}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <button className={styles.primary} onClick={onExit}>
        Return to routine
      </button>
    </main>
  );
}
