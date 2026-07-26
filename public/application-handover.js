"use strict";

const handoverForm = document.getElementById("application-handover");
if (handoverForm instanceof HTMLFormElement) {
  const heading = document.getElementById("application-handover-heading");
  const message = document.getElementById("application-handover-message");

  handoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = handoverForm.querySelector("button");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    document.body.dataset.handoverState = "pending";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(handoverForm.action, {
        body: new FormData(handoverForm),
        credentials: "same-origin",
        method: "POST",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("handover failed");
      history.replaceState(null, "", "/apps");
      window.location.assign(response.url);
    } catch {
      if (button instanceof HTMLButtonElement) button.disabled = false;
      if (heading instanceof HTMLHeadingElement) {
        heading.textContent = "Move did not open";
      }
      if (message instanceof HTMLParagraphElement) {
        message.textContent =
          "Try again, or return to My Apps.";
      }
      document.body.dataset.handoverState = "failed";
    } finally {
      window.clearTimeout(timeout);
    }
  });
  handoverForm.requestSubmit();
}
