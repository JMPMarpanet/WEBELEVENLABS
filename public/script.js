document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("isAdmin", data.is_admin);
    localStorage.setItem("loggedIn", true);
    window.location.href = data.is_admin ? "/admin" : "/dashboard";
  } else {
    document.getElementById("error").innerText = data.error || "Error de login";
  }
});
