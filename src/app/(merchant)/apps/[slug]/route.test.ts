import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  surface: vi.fn(),
}));

vi.mock("@/lib/application-launch", () => ({
  launchPortalApplication: mocks.launch,
}));
vi.mock("@/lib/surface", () => ({
  requireRequestSurface: mocks.surface,
}));

import { GET } from "@/app/(merchant)/apps/[slug]/route";

function request(path: string) {
  return new Request(`https://merchant.example${path}`);
}

describe("Portal application launch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.surface.mockReturnValue(true);
    mocks.launch.mockResolvedValue(new Response("launching", { status: 200 }));
  });

  it("uses the shared launcher for the bookmark and application card GET", async () => {
    const directRequest = request("/apps/move");
    const response = await GET(directRequest, {
      params: Promise.resolve({ slug: "move" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.launch).toHaveBeenCalledWith(directRequest, "move", {
      unauthenticated: "login",
      unavailable: "apps",
    });
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
