?// -- Persona switcher ----------------------------------------------
const personas = {
  company:     { label:"For companies",            text:"Use Collekt to discover tender opportunities, identify verified specialists and assemble a delivery team before the bid window closes." },
  consultant:  { label:"For consultants",          text:"Use Collekt to showcase your expertise, receive relevant opportunity alerts and connect with companies that need specialist support." },
  engineer:    { label:"For engineers",            text:"Use Collekt to find project work that matches your experience, join delivery teams and increase your visibility across industries." },
  procurement: { label:"For procurement teams",    text:"Use Collekt to find vendor registrations, supplier relationships, RFQ support and qualified project stakeholders in one place." },
  bd:          { label:"For business development", text:"Use Collekt to spot new opportunities, build partnerships, track industry signals and expand your network faster." },
};
const roleMap = {
  company:"Company", consultant:"Consultant", engineer:"Engineer",
  procurement:"Procurement Professional", bd:"Business Development Professional"
};

document.querySelectorAll(".pcard").forEach(card => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".pcard").forEach(c => c.classList.remove("on"));
    card.classList.add("on");
    const p = personas[card.dataset.p];
    document.getElementById("pLabel").textContent = p.label;
    document.getElementById("pText").textContent  = p.text;
    const roleEl = document.getElementById("role");
    if (roleEl && roleMap[card.dataset.p]) { roleEl.value = roleMap[card.dataset.p]; updatePreview(); }
  });
});

// -- Form: preview update -----------------------------------------
const fieldIds = ["fullName","email","phone","company","jobTitle","country","role","industry","experience","linkedin","preferredContact","comments"];
const totalFields = fieldIds.length + 1; // +1 for interests

function getInterests() {
  return [...document.querySelectorAll("input[name='interests']:checked")].map(c => c.value);
}

function setPreview(id, val, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  const empty = !val || val.trim() === "";
  el.textContent = empty ? placeholder : val;
  el.className = empty ? "mt" : "";
}

function updatePreview() {
  const fd = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  setPreview("sName",      fd("fullName"),  "Not filled yet");
  setPreview("sEmail",     fd("email"),     "&rarr;");
  setPreview("sPhone",     fd("phone"),     "&rarr;");
  setPreview("sContact",   fd("preferredContact"), "Email and phone");
  setPreview("sRole",      fd("role"),      "Select role");
  setPreview("sIndustry",  fd("industry"),  "Select industry");
  setPreview("sCountry",   fd("country"),   "&rarr;");
  const ints = getInterests();
  setPreview("sInterests", ints.length ? ints.join(", ") : "", "Choose below");
  setPreview("sGoal",      fd("comments"),  "Tell us your goal");

  const filled = fieldIds.filter(i => fd(i)).length + (ints.length ? 1 : 0);
  const pct    = Math.min(100, Math.round((filled / totalFields) * 100));
  document.getElementById("progBar").style.width = pct + "%";
  document.getElementById("progPct").textContent = pct + "%";

  // Mirror email to hidden reply-to field
  document.getElementById("hidReply").value = fd("email");
}

const wlForm = document.getElementById("wlForm");
wlForm.addEventListener("input",  updatePreview);
wlForm.addEventListener("change", updatePreview);

// -- Toast helper -------------------------------------------------
const toastEl = document.getElementById("toast");
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 4000);
}

// -- Form submit ? Formspree ? collektng@gmail.com ----------------
const subBtn     = document.getElementById("subBtn");
const formMsg    = document.getElementById("formMsg");
const successWrap= document.getElementById("successWrap");


function setMsg(text, type) {
  formMsg.textContent = text;
  formMsg.className   = "form-msg" + (type ? " "+type : "");
}

wlForm.addEventListener("submit", async e => {
  e.preventDefault();

  // Required field validation
  const required = ["fullName","email","phone","role","industry","followupConsent"];
  let valid = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    const empty = !el || (el.type === "checkbox" ? !el.checked : !el.value.trim());
    if (empty) {
      el && el.classList.add("err");
      valid = false;
    } else {
      el && el.classList.remove("err");
    }
  });

  if (!valid) {
    setMsg("Please fill in all required fields marked with *.", "bad");
    document.querySelector(".err")?.scrollIntoView({ behavior:"smooth", block:"center" });
    return;
  }

  // Populate hidden meta fields
  document.getElementById("hidTime").value      = new Date().toLocaleString("en-NG", { timeZone:"Africa/Lagos" });
  document.getElementById("hidInterests").value = getInterests().join(", ") || "None selected";
  document.getElementById("hidUrl").value       = window.location.href;

  // Save to localStorage
  const snapshot = {};
  fieldIds.forEach(id => { const el = document.getElementById(id); if (el) snapshot[id] = el.value; });
  snapshot.interests = getInterests();
  localStorage.setItem("collekt_wl", JSON.stringify(snapshot));

  // Submit
  const orig = subBtn.innerHTML;
  subBtn.disabled = true;
  subBtn.innerHTML = "Sending &rarr;";
  setMsg("Sending your registration to collektng@gmail.com&rarr;", "");

  try {
    const res = await fetch(wlForm.dataset.endpoint, {
      method: "POST",
      body:   new FormData(wlForm),
      headers:{ Accept: "application/json" }
    });

    if (res.ok) {
      // Hide form, show success
      wlForm.style.display          = "none";
      successWrap.style.display     = "flex";
      successWrap.classList.add("show");
      document.getElementById("progBar").style.width  = "100%";
      document.getElementById("progPct").textContent  = "100%";
      setMsg("", "");
      showToast("&#x2705; Registration sent to collektng@gmail.com &rarr; welcome!");
      // Increment live count
      liveCount++;
      localStorage.setItem("collekt_count", liveCount);
      animateWlCount(liveCount);
      const joinName2 = document.getElementById("fullName")?.value?.trim() || "New member";
      const joinRole2 = document.getElementById("role")?.value || "Professional";
      const joinCity2 = document.getElementById("country")?.value || "Nigeria";
      addJoinFeedItem({name: joinName2, role: joinRole2, city: joinCity2});
    } else {
      const data = await res.json().catch(() => ({}));
      const hint = data.errors?.map(e => e.message).join(", ") || "Unknown error";
      throw new Error(hint);
    }
  } catch (err) {
    setMsg(`Submission failed: ${err.message}. Please try again or email collektng@gmail.com directly.`, "bad");
    showToast("Submission failed &rarr; please try again.");
  } finally {
    subBtn.disabled = false;
    subBtn.textContent = orig;
  }
});

// -- Clear form ---------------------------------------------------
document.getElementById("clearBtn").addEventListener("click", () => {
  wlForm.reset();
  wlForm.style.display = "";
  successWrap.classList.remove("show");
  successWrap.style.display = "";
  localStorage.removeItem("collekt_wl");
  updatePreview();
  setMsg("", "");
  showToast("Form cleared.");
});

// -- Restore saved ------------------------------------------------
(function restoreSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem("collekt_wl") || "null");
    if (!saved) return;
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id]) el.value = saved[id];
    });
    if (Array.isArray(saved.interests)) {
      document.querySelectorAll("input[name='interests']").forEach(cb => {
        cb.checked = saved.interests.includes(cb.value);
      });
    }
    showToast("Previous draft restored.");
  } catch { localStorage.removeItem("collekt_wl"); }
})();

// -- Waitlist counter &rarr; starts at 0, only increments on real form submission --
let liveCount = parseInt(localStorage.getItem("collekt_count") || "0");

function animateWlCount(target) {
  const el = document.getElementById("wlNum");
  const barEl = document.getElementById("wlBar");
  const spotsEl = document.getElementById("wlSpots");
  if (!el) return;
  let n = parseInt(el.textContent.replace(/,/g, "")) || 0;
  const step = Math.max(1, Math.ceil((target - n) / 30));
  const t = setInterval(() => {
    n = Math.min(n + step, target);
    el.textContent = n.toLocaleString();
    if (barEl) barEl.style.width = Math.min((n / 5000) * 100, 100).toFixed(1) + "%";
    if (spotsEl) spotsEl.textContent = Math.max(0, 5000 - n).toLocaleString();
    if (n >= target) clearInterval(t);
  }, 25);
}

function getInitials(name) {
  return name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
}

function addJoinFeedItem(person) {
  const feed = document.getElementById("joinFeed");
  if (!feed) return;
  const div = document.createElement("div");
  div.className = "join-item";
  div.innerHTML = `
    <div class="join-avatar">${getInitials(person.name)}</div>
    <div class="join-info">
      <div class="join-name">${person.name}</div>
      <div class="join-role">${person.role} &rarr; ${person.city}</div>
    </div>
    <div class="join-time">just now</div>
  `;
  feed.insertBefore(div, feed.firstChild);
  const items = feed.querySelectorAll(".join-item");
  if (items.length > 5) items[items.length - 1].remove();
  setTimeout(() => {
    feed.querySelectorAll(".join-time").forEach((el, i) => {
      if (i > 0) el.textContent = (i * 3) + "m ago";
    });
  }, 400);
}

// Show the saved count on page load &rarr; no auto-increment
setTimeout(() => animateWlCount(liveCount), 900);

// -- Animated stats counters --------------------------------------
function animateCount(el, target) {
  const start = performance.now();
  const dur   = 1800;
  const tick  = now => {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(e * target) + (target >= 50 ? "+" : "");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const statsObs = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  document.querySelectorAll("[data-target]").forEach(el => {
    animateCount(el, parseInt(el.dataset.target));
  });
  statsObs.disconnect();
}, { threshold: 0.3 });
const sg = document.querySelector(".stats-grid");
if (sg) statsObs.observe(sg);

// -- Hamburger / mobile drawer ------------------------------------
const ham    = document.getElementById("ham");
const drawer = document.getElementById("drawer");
function openMenu(open) {
  ham.classList.toggle("open", open);
  ham.setAttribute("aria-expanded", open);
  drawer.classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
}
ham.addEventListener("click", () => openMenu(!ham.classList.contains("open")));
drawer.querySelectorAll(".dlink, .btn").forEach(a => a.addEventListener("click", () => openMenu(false)));

// Floating waitlist shortcut
const floatPill = document.getElementById("floatPill");
floatPill.addEventListener("click", () => {
  document.getElementById("waitlist").scrollIntoView({ behavior:"smooth", block:"start" });
});

// Solid navigation state on scroll
const navbar = document.getElementById("navbar");
function updateNavState() {
  navbar.classList.toggle("solid", window.scrollY > 40);
  floatPill.classList.toggle("show", window.scrollY > 520);
}
window.addEventListener("scroll", updateNavState, { passive:true });
updateNavState();
updatePreview();