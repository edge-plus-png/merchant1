import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  sameOrigin: vi.fn(),
  surface: vi.fn(),
}));

vi.mock("@/lib/application-launch", () => ({
  launchPortalApplication: mocks.launch,
}));
vi.mock("@/lib/auth/csrf", () => ({
  isSameOriginRequest: mocks.sameOrigin,
}));
vi.mock("@/lib/surface", () => ({
  requireRequestSurface: mocks.surface,
}));

import { GET } from "@/app/(merchant)/apps/[slug]/route";
import { POST } from "@/app/api/portal/apps/move/open/route";

function request(path: string, method = "GET") {
  return new Request(`https://merchant.example${path}`, {
    method,
    headers: method === "POST" ? { origin: "https://merchant.example" } : {},
  });
}

describe("Portal application launch route transports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.surface.mockReturnValue(true);
    mocks.sameOrigin.mockReturnValue(true);
    mocks.launch.mockResolvedValue(new Response("launching", { status: 200 }));
  });

  it("launches a bookmarkable GET without applying POST-only CSRF checks", async () => {
    const directRequest = request("/apps/move");
    const response = await GET(directRequest, {
      params: Promise.resolve({ slug: "move" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.sameOrigin).not.toHaveBeenCalled();
    expect(mocks.launch).toHaveBeenCalledWith(directRequest, "move", {
      unauthenticated: "login",
      unavailable: "apps",
    });
  });

  it("keeps the existing same-origin POST action on the shared launcher", async () => {
    const postRequest = request("/api/portal/apps/move/open", "POST");
    const response = await POST(postRequest);

    expect(response.status).toBe(200);
    expect(mocks.sameOrigin).toHaveBeenCalledWith(postRequest);
    expect(mocks.launch).toHaveBeenCalledWith(postRequest, "move", {
      unauthenticated: "forbidden",
      unavailable: "forbidden",
    });
  });

  it("rejects cross-origin POST requests before shared launch logic", async () => {
    mocks.sameOrigin.mockReturnValue(false);

    const response = await POST(
      new Request("https://merchant.example/api/portal/apps/move/open", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it("does not expose application routes on the HQ surface", async () => {
    mocks.surface.mockReturnValue(false);

    const response = await GET(request("/apps/move"), {
      params: Promise.resolve({ slug: "move" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});
