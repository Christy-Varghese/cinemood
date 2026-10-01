export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading movie">
      <div className="skeleton" style={{ height: "min(70vh, 640px)", borderRadius: 0, marginTop: "calc(var(--header-h) * -1)" }} />
      <div className="container" style={{ marginTop: 32 }}>
        <div className="skeleton sk-line" style={{ height: 36, width: "40%" }} />
        <div className="skeleton sk-line" style={{ width: "70%", marginTop: 20 }} />
        <div className="skeleton sk-line" style={{ width: "65%" }} />
        <div className="skeleton sk-line" style={{ width: "50%" }} />
      </div>
    </div>
  );
}
