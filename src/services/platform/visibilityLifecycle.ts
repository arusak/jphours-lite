export type VisibilityListener = (visible: boolean) => void;

export function observeVisibility(listener: VisibilityListener): () => void {
  const onChange = () => listener(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
