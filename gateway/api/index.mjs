import { handleGatewayRequest, parseGatewayConfig } from "../src/gateway.mjs";

function requestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export default async function gateway(request, response) {
  try {
    const publicOrigin = new URL(
      process.env.PORTAL_PUBLIC_ORIGIN,
    ).origin;
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await requestBody(request);
    const webRequest = new Request(
      new URL(request.url ?? "/", publicOrigin),
      {
        body,
        headers: request.headers,
        method: request.method,
        duplex: body ? "half" : undefined,
      },
    );
    const result = await handleGatewayRequest(
      webRequest,
      parseGatewayConfig(),
    );
    response.statusCode = result.status;
    for (const [name, value] of result.headers) {
      if (name.toLowerCase() !== "set-cookie") response.setHeader(name, value);
    }
    const setCookies =
      typeof result.headers.getSetCookie === "function"
        ? result.headers.getSetCookie()
        : [];
    if (setCookies.length) response.setHeader("set-cookie", setCookies);
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    response.statusCode = 502;
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("Bad Gateway");
  }
}
