import Link from "next/link";

export function Logo({ linked = true }: { linked?: boolean }) {
  const wordmark = (
    <span className="logo-wordmark" aria-label="GetEdgePortal">
      <span>GetEdge</span>
      <span className="logo-accent">Portal</span>
    </span>
  );

  return linked ? (
    <Link className="logo" href="/portal">
      {wordmark}
    </Link>
  ) : (
    <div className="logo">{wordmark}</div>
  );
}
