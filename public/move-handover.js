"use strict";

const handoverForm = document.getElementById("move-handover");
if (handoverForm instanceof HTMLFormElement) {
  history.replaceState(null, "", "/apps");
  handoverForm.submit();
}
