/* Longhorn Shield — quote form. Progressive enhancement:
   without JS the form still posts normally and the Worker redirects to /thanks.html */

(function () {
    var form = document.getElementById("quote-form");
    if (!form) return;

    var status = document.getElementById("quote-status");
    var button = document.getElementById("quote-submit");

    function setStatus(message, state) {
        status.textContent = message || "";
        if (state) {
            status.setAttribute("data-state", state);
        } else {
            status.removeAttribute("data-state");
        }
    }

    function markInvalid(field, message) {
        field.setAttribute("aria-invalid", "true");
        setStatus(message, "error");
        field.focus();
    }

    form.addEventListener("input", function (event) {
        if (event.target.hasAttribute("aria-invalid")) {
            event.target.removeAttribute("aria-invalid");
            setStatus("");
        }
    });

    function validate() {
        var coverage = form.querySelector('input[name="coverage"]:checked');
        if (!coverage) {
            setStatus("Choose what you need covered.", "error");
            form.querySelector('input[name="coverage"]').focus();
            return false;
        }

        var required = ["name", "zip", "email", "phone"];
        for (var i = 0; i < required.length; i++) {
            var field = form.elements[required[i]];
            if (!field.value.trim()) {
                markInvalid(field, "Fill in your " + (required[i] === "zip" ? "ZIP code" : required[i]) + ".");
                return false;
            }
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.email.value.trim())) {
            markInvalid(form.elements.email, "That email address does not look right.");
            return false;
        }
        if (form.elements.phone.value.replace(/\D/g, "").length < 10) {
            markInvalid(form.elements.phone, "Enter a 10-digit phone number.");
            return false;
        }
        if (!/^\d{5}$/.test(form.elements.zip.value.trim())) {
            markInvalid(form.elements.zip, "Enter a 5-digit ZIP code.");
            return false;
        }
        if (!form.elements.consent.checked) {
            setStatus("Tick the box so we are allowed to contact you.", "error");
            form.elements.consent.focus();
            return false;
        }
        return true;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!validate()) return;

        button.disabled = true;
        var original = button.textContent;
        button.textContent = "Sending\u2026";
        setStatus("");

        fetch(form.action, {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form)
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (result.ok) {
                    window.location.href = "/thanks.html";
                    return;
                }
                throw new Error(result.data && result.data.error ? result.data.error : "Something went wrong.");
            })
            .catch(function (error) {
                button.disabled = false;
                button.textContent = original;
                setStatus(
                    error.message + " You can also reach us on (940) 424-1038 or herve@longhornshield.org.",
                    "error"
                );
                if (window.turnstile) window.turnstile.reset();
            });
    });
})();
