import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("Move multi-zone proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the Portal-owned entry route inside Merchant Portal", () => {
    vi.stubEnv("MOVE_UPSTREAM_ORIGIN", "https://move-staging.getedgeportal.app");
    vi.stubEnv("MOVE_PROXY_SECRET", "test-move-proxy-secret-that-is-long-enough");
    const response = proxy(
      new NextRequest("https://merchant.getedgeportal.app/apps/move"),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites deeper paths to Move and never forwards Portal cookies", () => {
    vi.stubEnv("MOVE_UPSTREAM_ORIGIN", "https://move-staging.getedgeportal.app");
    vi.stubEnv("MOVE_PROXY_SECRET", "test-move-proxy-secret-that-is-long-enough");
    const response = proxy(
      new NextRequest(
        "https://merchant.getedgeportal.app/apps/move/ops/catalogue?stage=products",
        {
          headers: {
            cookie:
              "getedge_portal_session=portal-secret; counter_ops_session=move-secret; getedge_hq_support_session=hq-secret",
          },
        },
      ),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://move-staging.getedgeportal.app/apps/move/ops/catalogue?stage=products",
    );
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      "counter_ops_session=move-secret",
    );
    expect(
      response.headers.get("x-middleware-request-x-getedge-move-public-origin"),
    ).toBe("https://merchant.getedgeportal.app");
    expect(
      response.headers.get("x-middleware-request-x-getedge-move-proxy-secret"),
    ).toBe(
      "test-move-proxy-secret-that-is-long-enough",
    );
  });
});
