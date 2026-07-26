"use strict";

const handoverForm = document.getElementById("application-handover");
if (handoverForm instanceof HTMLFormElement) {
  handoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = handoverForm.querySelector("button");
    if (button instanceof HTMLButtonElement) button.disabled = true;

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
    }
  });
  handoverForm.requestSubmit();
}
