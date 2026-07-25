import Link from "next/link";
import Image from "next/image";

export function Logo({
  destination = "/dashboard",
  linked = true,
}: {
  destination?: string;
  linked?: boolean;
}) {
  const wordmark = (
    <Image
      alt="Edge Portal"
      className="logo-image"
      height={125}
      priority
      src="/branding/portal-app-black-bk.png"
      width={250}
    />
  );

  return linked ? (
    <Link className="logo" href={destination}>
      {wordmark}
    </Link>
  ) : (
    <div className="logo">{wordmark}</div>
  );
}
