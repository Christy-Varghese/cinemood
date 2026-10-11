import { RailSkeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="container">
      <div className="page-head">
        <div className="skeleton sk-line" style={{ height: 48, width: 220 }} />
      </div>
      <div className="skeleton" style={{ height: 420, marginTop: 28, borderRadius: 22 }} />
      <div className="section">
        <RailSkeleton />
      </div>
    </div>
  );
}
