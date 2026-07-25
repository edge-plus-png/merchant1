export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    const originHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const requestHost = forwardedHost ?? request.headers.get("host");

    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}
