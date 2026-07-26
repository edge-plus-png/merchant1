"use strict";

const handoverForm = document.getElementById("application-handover");
if (handoverForm instanceof HTMLFormElement) {
  const message = document.getElementById("application-handover-message");

  handoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = handoverForm.querySelector("button");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    document.body.dataset.handoverState = "pending";

    try {
      const response = await fetch(handoverForm.action, {
        body: new FormData(handoverForm),
        credentials: "same-origin",
        method: "POST",
        redirect: "follow",
      });
      if (!response.ok) throw new Error("handover failed");
      history.replaceState(null, "", "/apps");
      window.location.assign(response.url);
    } catch {
      if (button instanceof HTMLButtonElement) button.disabled = false;
      if (message instanceof HTMLParagraphElement) {
        message.textContent =
          "The app did not open automatically. Continue to try again.";
      }
      document.body.dataset.handoverState = "failed";
    }
  });
  handoverForm.requestSubmit();
}
