interface EndScreenProps {
  title: string;
  copy: string;
  onExit(): void;
}
export function EndScreen({ title, copy, onExit }: EndScreenProps) {
  return (
    <main className="session-player completion">
      <h1>{title}</h1>
      <p>{copy}</p>
      <button className="primary" onClick={onExit}>
        Return to routine
      </button>
    </main>
  );
}
