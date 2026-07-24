import Link from "next/link";

export function Logo({
  destination = "/dashboard",
  linked = true,
}: {
  destination?: string;
  linked?: boolean;
}) {
  const wordmark = (
    <span className="logo-wordmark" aria-label="GetEdgePortal">
      <span>GetEdge</span>
      <span className="logo-accent">Portal</span>
    </span>
  );

  return linked ? (
    <Link className="logo" href={destination}>
      {wordmark}
    </Link>
  ) : (
    <div className="logo">{wordmark}</div>
  );
}
