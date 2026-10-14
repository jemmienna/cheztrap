const hostname = "https://cheztrap.com/";
//const hostname = "http://127.0.0.1:8000/";
const contactUrl = "https://cheztrap.com/contact";

// our own site: always safe (same answer the server gives in home.py)
const OWN_DOMAIN = "cheztrap.com";
const OWN_SITE_RESULT = {
  is_safe: true,
  reason: "This is Cheztrap's own website! It's the home of the Cheztrap scam checker, so you're in safe paws here.",
  website_type: "Online safety tool",
  fun_fact: 'Cheztrap is a cheesy mix of "cheese" and "trap": the cheese lures the rats (scams) so you can stay safe.',
};

function isOwnSite(host) {
  host = (host || "").toLowerCase().replace(/\.$/, "");
  return host === OWN_DOMAIN || host.endsWith("." + OWN_DOMAIN);
}

jQuery(document).ready(function () {
  // runs inside the Gmail tab to read the open email
  function getPageDetails() {
    const title = document.title;
    const possibleSelectors = [
      ".email-body",
      ".ii.gt",
      ".a3s.aXjCH",
      "div[role='main']",
      "body", // Add body as a fallback for general websites
    ];

    let emailBodyElement = null;
    for (const selector of possibleSelectors) {
      emailBodyElement = document.querySelector(selector);
      if (emailBodyElement) {
        break;
      }
    }

    if (!emailBodyElement) {
      emailBodyElement = Array.from(
        document.querySelectorAll("div, span, p")
      ).find((el) => el.textContent.length > 100);
    }

    const bodyText = emailBodyElement
      ? emailBodyElement.innerText.trim()
      : "No body found";
    return { title, bodyText };
  }

  // loading screen: rotate the little status lines until a result arrives
  const lines = [
    "Sniffing out the site...",
    "Checking for rats...",
    "Reading the fine print...",
    "Almost there...",
  ];
  let lineIndex = 0;
  const lineTimer = setInterval(function () {
    lineIndex = (lineIndex + 1) % lines.length;
    $("#msg").text(lines[lineIndex]);
  }, 1100);

  // swap the loading view for a finished result view
  function showResult($content) {
    clearInterval(lineTimer);
    $("#v-load").removeClass("on");
    $("#v-result").empty().append($content).addClass("on");
    $("#body").scrollTop(0);
  }

  // big verdict card at the top; kind is good / bad / idle
  function verdict(kind, title) {
    const $card = $("<div>").addClass("ver " + kind);
    if (kind === "good" || kind === "bad") {
      $card.append(
        '<svg viewBox="0 0 60 70" aria-hidden="true"><use href="#' +
          (kind === "good" ? "shg" : "shb") +
          '"/></svg>'
      );
    }
    return $card.append($("<h1>").text(title));
  }

  // label/value table; rows with no value are skipped
  function facts(rows) {
    const $dl = $("<dl>").addClass("facts");
    rows.forEach(function (row) {
      if (!row[1]) return;
      $("<div>")
        .append($("<dt>").text(row[0]), $("<dd>").text(row[1]))
        .appendTo($dl);
    });
    return $dl.children().length ? $dl : null;
  }

  function wrongLink() {
    return $("<a>")
      .addClass("wrong")
      .attr("href", contactUrl)
      .text("Wrong verdict? Tell us.")
      .on("click", function (e) {
        e.preventDefault();
        chrome.tabs.create({ url: contactUrl });
      });
  }

  function traffic(output) {
    if (!output.traffic_level) return "";
    return output.monthly_visits
      ? output.traffic_level + ", about " + output.monthly_visits + " visits a month"
      : output.traffic_level;
  }

  // the model sometimes invents placeholder founders; don't show those
  function founders(output) {
    if (!Array.isArray(output.founders) || !output.founders.length) return "";
    const names = output.founders.join(", ");
    return names === "John Doe, Jane Smith" ? "" : names;
  }

  function showMessage(title, text) {
    showResult(
      $("<div>").append(verdict("idle", title), $("<p>").addClass("sum").text(text))
    );
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab.url || "";
    const urlElement = document.createElement("a");
    urlElement.href = currentUrl;
    const gmailSections = [
      "#inbox",
      "#starred",
      "#snoozed",
      "#sent",
      "#drafts",
      "#important",
      "#chats",
      "#spam",
      "#trash",
    ];

    const isGmail = currentUrl.startsWith("https://mail.google.com");
    let isGmailSection = gmailSections.some(
      (section) => isGmail && currentUrl.endsWith(section)
    );

    let isGmailDetailPage = isGmail && !isGmailSection;

    // "Take me back to safety": go back a page, or to a new tab if there's no history
    function leaveButton() {
      return $("<button>")
        .addClass("leave")
        .attr("type", "button")
        .text("Take me back to safety")
        .on("click", function () {
          chrome.tabs.goBack(currentTab.id, function () {
            if (chrome.runtime.lastError) {
              chrome.tabs.update(currentTab.id, { url: "chrome://newtab" });
            }
            window.close();
          });
        });
    }

    if (isGmailSection) {
      showMessage("Open an email", "Open the email you want to check, then click the cheese again.");
    } else if (isGmailDetailPage) {
      console.log("This gmail detail page is valid");

      setTimeout(() => {
        chrome.scripting.executeScript(
          {
            target: { tabId: currentTab.id },
            func: getPageDetails,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error executing script:",
                chrome.runtime.lastError
              );
              showMessage("Couldn't read this email", "Try refreshing Gmail, then click the cheese again.");
              return;
            }

            if (results && results[0] && results[0].result) {
              const { title, bodyText } = results[0].result;

              $.post(
                hostname + "/api/check/result/gmail",
                { title: title, bodyText: bodyText },
                function (output) {
                  const safe = output.is_safe === true;
                  const $view = $("<div>").append(
                    verdict(safe ? "good" : "bad", safe ? "This email is safe!" : "This email may NOT be safe!"),
                    $("<div>").addClass("url").text(title || "Gmail"),
                    $("<p>").addClass("sum").text(output.reason || "")
                  );
                  if (!safe) $view.append(leaveButton());
                  showResult($view.append(wrongLink()));
                }
              ).fail(function () {
                showMessage("Couldn't check this email", "Something went wrong on our end. Try again in a moment.");
              });
            }
          }
        );
      }, 3000);
    } else if (
      currentUrl.startsWith("http://") ||
      currentUrl.startsWith("https://")
    ) {
      function showSite(output) {
        console.log("output", output);
        const safe = output.is_safe === true;
        const $view = $("<div>").append(
          verdict(safe ? "good" : "bad", safe ? "Website is safe!" : "Rat territory!"),
          $("<div>").addClass("url").text(urlElement.hostname),
          $("<p>").addClass("sum").text(output.reason || "")
        );

        const $facts = safe
          ? facts([
              ["Website type", output.website_type],
              ["Founders", founders(output)],
              ["Founded", output.founded_year],
              ["HQ", output.hq],
              ["Traffic", traffic(output)],
              ["Money raised", output.money_raised],
            ])
          : facts([
              ["Website type", output.website_type],
              ["Founders", founders(output)],
              ["Founded", output.founded_year],
              ["HQ", output.hq],
              ["Traffic", traffic(output)],
              ["Registrar", output.registrar],
              ["Created", output.domain_created],
              ["Registrant", output.domain_registrant],
              ["Money raised", output.money_raised],
            ]);
        if ($facts) {
          $view.append($("<h2>").text(safe ? "More about this site" : "What we found"), $facts);
        }

        if (safe && output.fun_fact) {
          $view.append(
            $("<div>")
              .addClass("fun")
              .append(
                '<svg viewBox="0 0 54 40" aria-hidden="true"><use href="#wedge"/></svg>',
                $("<div>").append($("<h3>").text("Fun fact"), $("<p>").text(output.fun_fact))
              )
          );
        }
        if (!safe) $view.append(leaveButton());
        showResult($view.append(wrongLink()));
      }

      // cheztrap.com is our own site, so skip the check and mark it safe
      if (isOwnSite(urlElement.hostname)) {
        showSite(OWN_SITE_RESULT);
      } else {
        $.post(hostname + "/api/check/website", { url: currentUrl }, showSite).fail(function () {
          showMessage("Couldn't check this site", "Something went wrong on our end. Try again in a moment.");
        });
      }
    } else {
      // chrome://, new tab, extension pages, etc.
      showMessage("Nothing to check here", "Open a website or an email, then click the cheese again.");
    }
  });
});
