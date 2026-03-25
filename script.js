/* global document, window, fetch */

(() => {
  const donateForm = document.getElementById("donateForm");
  const submitBtn = document.getElementById("submitBtn");
  const submitLabel = submitBtn?.querySelector(".btn__label");
  const foodNameInput = document.getElementById("foodName");
  const quantityInput = document.getElementById("quantity");
  const locationInput = document.getElementById("location");

  const successAlert = document.getElementById("successAlert");
  const errorAlert = document.getElementById("errorAlert");
  const successMsg = document.getElementById("successMsg");
  const errorMsg = document.getElementById("errorMsg");

  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");

  const donationsLoading = document.getElementById("donationsLoading");
  const donationsEmpty = document.getElementById("donationsEmpty");
  const donationsCards = document.getElementById("donationsCards");
  const donationsTbody = document.getElementById("donationsTbody");
  const donationsTableWrap = document.getElementById("donationsTableWrap");

  const donationsBadge = document.getElementById("donationsBadge");
  const donationsCountHero = document.getElementById("donationsCountHero");
  const donationsCountSide = document.getElementById("donationsCountSide");
  const donationsCountMeta = document.getElementById("donationsCountMeta");

  const refreshDonationsBtn = document.getElementById("refreshDonationsBtn");
  const refreshStatsBtn = document.getElementById("refreshStatsBtn");

  const donateHeroBtn = document.getElementById("donateHeroBtn");
  const heroDonateTarget = document.getElementById("donate");

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showEl = (el) => {
    if (!el) return;
    el.hidden = false;
  };
  const hideEl = (el) => {
    if (!el) return;
    el.hidden = true;
  };

  const showToast = (text) => {
    if (!toast) return;
    if (toastText) toastText.textContent = text;
    toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  };

  const setButtonLoading = (isLoading) => {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (isLoading && submitLabel) submitLabel.textContent = "Submitting…";
    if (!isLoading && submitLabel) submitLabel.textContent = "Submit Donation";
  };

  function validateClientPayload() {
    const foodName = foodNameInput?.value?.trim() ?? "";
    const location = locationInput?.value?.trim() ?? "";
    const quantityRaw = quantityInput?.value ?? "";

    const errors = [];
    if (!foodName || foodName.length < 2) errors.push("Food Name cannot be empty.");
    if (!location || location.length < 2) errors.push("Location cannot be empty.");

    const q =
      typeof quantityRaw === "string" || typeof quantityRaw === "number"
        ? Number(quantityRaw)
        : NaN;
    const quantityInt = Number.isFinite(q) ? Math.floor(q) : NaN;
    if (!Number.isFinite(quantityInt) || quantityInt < 1)
      errors.push("Quantity must be a positive whole number.");

    const payload = {
      foodName,
      location,
      quantity: quantityInt,
    };

    return { ok: errors.length === 0, errors, payload };
  }

  function updateCountUI(count) {
    if (donationsBadge) donationsBadge.textContent = String(count);
    if (donationsCountHero) donationsCountHero.textContent = String(count);
    if (donationsCountSide) donationsCountSide.textContent = String(count);
    if (donationsCountMeta) donationsCountMeta.textContent = String(count);
  }

  function renderDonations(donations) {
    const list = Array.isArray(donations) ? donations : [];

    // Table
    if (donationsTbody) {
      donationsTbody.innerHTML = "";
      for (const d of list) {
        const tr = document.createElement("tr");

        const foodTd = document.createElement("td");
        foodTd.textContent = d.foodName ?? "";

        const qtyTd = document.createElement("td");
        qtyTd.innerHTML = `<span style="font-weight:1000">${d.quantity ?? 0}</span>`;

        const locTd = document.createElement("td");
        locTd.textContent = d.location ?? "";

        const dateTd = document.createElement("td");
        dateTd.className = "date";
        dateTd.textContent = fmtDate(d.createdAt);

        tr.appendChild(foodTd);
        tr.appendChild(qtyTd);
        tr.appendChild(locTd);
        tr.appendChild(dateTd);
        donationsTbody.appendChild(tr);
      }
    }

    // Cards
    if (donationsCards) {
      donationsCards.innerHTML = "";
      for (const d of list) {
        const card = document.createElement("div");
        card.className = "donation-card";

        card.innerHTML = `
          <div class="donation-card__top">
            <div>
              <div class="donation-card__food">${escapeHtml(d.foodName ?? "")}</div>
              <div style="margin-top:6px" class="tag">
                <span aria-hidden="true">🍴</span>
                Qty <strong style="color:rgba(231,238,252,0.95)">${escapeHtml(
                  String(d.quantity ?? 0)
                )}</strong>
              </div>
            </div>
            <div class="tag" style="opacity:.95">
              <span aria-hidden="true">📍</span>
              ${escapeHtml(d.location ?? "")}
            </div>
          </div>

          <div class="donation-card__grid">
            <div class="kv">
              <div class="kv__k">Date</div>
              <div class="date">${escapeHtml(fmtDate(d.createdAt))}</div>
            </div>
          </div>
        `;
        donationsCards.appendChild(card);
      }
    }

    const isEmpty = list.length === 0;
    if (donationsEmpty) {
      if (isEmpty) showEl(donationsEmpty);
      else hideEl(donationsEmpty);
    }
    if (donationsCards) {
      if (isEmpty) hideEl(donationsCards);
      else showEl(donationsCards);
    }
    if (donationsTableWrap) {
      if (isEmpty) hideEl(donationsTableWrap);
      else showEl(donationsTableWrap);
    }
  }

  // Prevent HTML injection when rendering donations
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadDonations() {
    try {
      hideEl(successAlert);
      hideEl(errorAlert);

      showEl(donationsLoading);
      hideEl(donationsEmpty);

      // Clear old content while loading.
      if (donationsTbody) donationsTbody.innerHTML = "";
      if (donationsCards) donationsCards.innerHTML = "";

      const res = await fetch("/data", { method: "GET", cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load donations.");
      }

      const donations = Array.isArray(data.donations) ? data.donations : [];
      updateCountUI(data.count ?? donations.length);
      renderDonations(donations);

      hideEl(donationsLoading);
    } catch (err) {
      hideEl(donationsLoading);
      showEl(donationsEmpty);
      if (donationsCards) hideEl(donationsCards);
      if (donationsTableWrap) hideEl(donationsTableWrap);
      if (donationsEmpty) {
        const t = donationsEmpty.querySelector(".empty__desc");
        if (t) t.textContent = "Could not load donations right now. Please try again.";
      }
      if (donationsTbody) donationsTbody.innerHTML = "";
      if (donationsCards) donationsCards.innerHTML = "";
      console.error(err);
    }
  }

  if (donateHeroBtn && heroDonateTarget) {
    donateHeroBtn.addEventListener("click", () => {
      heroDonateTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => foodNameInput?.focus?.(), 350);
    });
  }

  if (refreshDonationsBtn) {
    refreshDonationsBtn.addEventListener("click", () => loadDonations());
  }

  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener("click", () => loadDonations());
  }

  if (donateForm) {
    donateForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Hide prior alerts
      if (successAlert) hideEl(successAlert);
      if (errorAlert) hideEl(errorAlert);

      const validation = validateClientPayload();
      if (!validation.ok) {
        setButtonLoading(false);
        if (errorAlert) showEl(errorAlert);
        if (errorMsg) errorMsg.textContent = validation.errors.join(" ");
        return;
      }

      setButtonLoading(true);

      try {
        const res = await fetch("/donate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          const msg = Array.isArray(data?.errors) && data.errors.length > 0 ? data.errors.join(" ") : data?.message;
          throw new Error(msg || "Donation submission failed.");
        }

        successMsg.textContent = "Thanks! Your donation has been saved successfully.";
        if (successAlert) showEl(successAlert);
        showToast("Donation saved. Thank you.");
        donateForm.reset();

        // Immediately update dashboard + count.
        await loadDonations();

        // Move user attention to the dashboard area.
        const donationsSection = document.getElementById("donations");
        donationsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        const message = err?.message || "Something went wrong while submitting.";
        if (errorMsg) errorMsg.textContent = message;
        if (errorAlert) showEl(errorAlert);
      } finally {
        setButtonLoading(false);
      }
    });
  }

  // Initial load
  window.addEventListener("DOMContentLoaded", () => {
    loadDonations();
  });
})();

