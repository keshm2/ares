export function ComingSoonScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ maxWidth: "32rem" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-3)" }}>{title}</h1>
      <p style={{ color: "var(--text-muted)" }}>{detail}</p>
    </div>
  );
}
