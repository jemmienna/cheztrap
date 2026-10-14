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
  // runs inside the Gmail tab: reads the open email's subject, real sender, link destinations and attachments
  function getPageDetails() {
    // in a thread, check the newest expanded message
    const messages = document.querySelectorAll("div.adn");
    const message = messages.length ? messages[messages.length - 1] : document;

    const bodyElement =
      message.querySelector(".a3s") ||
      message.querySelector(".ii.gt") ||
      document.querySelector("div[role='main']") ||
      document.body;

    // Gmail keeps the real address in the sender's "email" attribute, even when only the display name shows
    const senderElement = message.querySelector("span.gD[email]") || document.querySelector("span.gD[email]");
    const subjectElement = document.querySelector("h2.hP");

    // the visible link text can say anything; href is where it really goes
    const seen = new Set();
    const links = [];
    bodyElement.querySelectorAll("a[href]").forEach(function (a) {
      const href = a.getAttribute("href") || "";
      if (!/^https?:/i.test(href) || links.length >= 40) return;
      const text = (a.innerText || "").trim().slice(0, 120);
      const key = href + "|" + text;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ text: text, href: href.slice(0, 500) });
    });

    // emails made of images (text baked into a picture) need a screenshot to be read
    const images = Array.from(bodyElement.querySelectorAll("img")).filter(function (img) {
      return img.width >= 80 && img.height >= 40; // on-screen size, so 1x1 tracking pixels are skipped
    });
    const altText = images
      .map(function (img) { return (img.getAttribute("alt") || "").trim(); })
      .filter(Boolean)
      .join(" | ")
      .slice(0, 500);
    const box = (message === document ? bodyElement : message).getBoundingClientRect();
    const bodyText = bodyElement ? bodyElement.innerText.trim().slice(0, 8000) : "No body found";
    // the message is probably inside pictures when there's little text, or when pictures take up most of the email
    // (image emails often still have a long legal footer underneath)
    const bodyBox = bodyElement.getBoundingClientRect();
    const imageArea = images.reduce(function (sum, img) { return sum + img.width * img.height; }, 0);
    const mostlyImages = images.length > 0 && (bodyText.length < 400 || imageArea > 0.4 * bodyBox.width * bodyBox.height);
    // Gmail shows email pictures through its image proxy; the server downloads them so the AI sees each one whole
    const imageUrls = Array.from(new Set(images.map(function (img) { return img.currentSrc || img.src; })))
      .filter(function (src) { return /^https:/.test(src); })
      .slice(0, 4);

    const attachments = Array.from(message.querySelectorAll(".aV3"))
      .map(function (el) { return el.innerText.trim(); })
      .filter(Boolean)
      .slice(0, 10);

    const idElement = message === document ? null :
      message.hasAttribute("data-message-id") ? message : message.querySelector("[data-message-id]");

    return {
      // only used by the "Rats caught" counter (hashed, kept on this device); the popup removes it before sending
      messageId: idElement ? idElement.getAttribute("data-message-id") : "",
      // the tab title also contains the user's own address, so prefer the subject line
      title: subjectElement ? subjectElement.innerText.trim() : document.title.split(" - ")[0],
      bodyText: bodyText,
      senderName: senderElement ? senderElement.getAttribute("name") || senderElement.innerText.trim() : "",
      senderEmail: senderElement ? senderElement.getAttribute("email") : "",
      links: JSON.stringify(links),
      attachments: JSON.stringify(attachments),
      imageCount: images.length,
      mostlyImages: mostlyImages,
      imageUrls: JSON.stringify(mostlyImages ? imageUrls : []),
      altText: altText,
      // where the email is on screen, in screenshot pixels, so we can crop out the rest of Gmail
      crop: JSON.stringify({
        x: Math.max(0, box.left) * devicePixelRatio,
        y: Math.max(0, box.top) * devicePixelRatio,
        w: Math.min(box.right, innerWidth) * devicePixelRatio - Math.max(0, box.left) * devicePixelRatio,
        h: Math.min(box.bottom, innerHeight) * devicePixelRatio - Math.max(0, box.top) * devicePixelRatio,
      }),
    };
  }

  // runs in Gmail's own page (so it can use the Gmail session): downloads the open email's "Show original"
  // page, which holds the headers that say whether it passed SPF/DKIM/DMARC and where replies go.
  // Returns the start of that page as text, or null. Parsing happens in the popup because Gmail blocks DOMParser.
  async function fetchOriginal() {
    try {
      const messages = document.querySelectorAll("div.adn");
      const message = messages[messages.length - 1];
      if (!message) return null;
      const find = function (attr) {
        const el = message.hasAttribute(attr) ? message : message.querySelector("[" + attr + "]");
        return el ? el.getAttribute(attr).replace(/^#/, "") : "";
      };
      const id = find("data-message-id");
      const legacyId = find("data-legacy-message-id");
      if (!id && !legacyId) return null;

      const account = (location.pathname.match(/\/mail\/u\/\d+/) || ["/mail/u/0"])[0];
      const ik = window.GLOBALS && window.GLOBALS[9];
      const url =
        account + "/?" + (ik ? "ik=" + encodeURIComponent(ik) + "&" : "") + "view=om&" +
        (id ? "permmsgid=" + encodeURIComponent(id) : "th=" + encodeURIComponent(legacyId));

      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, 5000);
      const res = await fetch(url, { credentials: "include", signal: controller.signal });
      if (!res.ok) return null;
      // the headers are at the top and the whole message can be huge (attachments), so stop early
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      while (html.length < 300000) {
        const chunk = await reader.read();
        if (chunk.done) break;
        html += decoder.decode(chunk.value, { stream: true });
      }
      reader.cancel();
      clearTimeout(timer);
      return html;
    } catch (e) {
      return null;
    }
  }

  // pulls Authentication-Results and Reply-To out of the "Show original" page
  function parseEmailHeaders(html) {
    if (!html) return { authResults: "", replyTo: "" };
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pre = doc.querySelector("#raw_message_text") || doc.querySelector("pre");
    if (!pre) return { authResults: "", replyTo: "" };
    // headers end at the first blank line; long headers continue on indented lines
    const lines = pre.textContent.replace(/\r\n/g, "\n").trim().split("\n\n")[0].replace(/\n[ \t]+/g, " ").split("\n");
    const header = function (name) {
      return lines
        .filter(function (l) { return l.toLowerCase().startsWith(name.toLowerCase() + ":"); })
        .map(function (l) { return l.slice(name.length + 1).trim(); });
    };
    const auth = header("Authentication-Results");
    // Gmail's own result is the one to trust; others may have been added by whoever sent it
    const gmailAuth = auth.find(function (a) { return a.indexOf("mx.google.com") === 0; }) || auth[0] || "";
    return { authResults: gmailAuth.slice(0, 2000), replyTo: (header("Reply-To")[0] || "").slice(0, 300) };
  }

  // runs in the site's tab: its title, description and visible text (not anything typed into forms)
  function readPage() {
    const meta = document.querySelector('meta[name="description"]');
    return {
      pageTitle: document.title.slice(0, 200),
      pageDescription: meta ? (meta.getAttribute("content") || "").slice(0, 300) : "",
      pageText: (document.body ? document.body.innerText : "").replace(/\s+/g, " ").trim().slice(0, 4000),
    };
  }

  // screenshot the visible tab, cropped to the email and shrunk, as a JPEG data URL (null if it fails)
  function captureEmail(windowId, crop, done) {
    chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 85 }, function (dataUrl) {
      if (chrome.runtime.lastError || !dataUrl) return done(null);
      const img = new Image();
      img.onload = function () {
        let c = { x: 0, y: 0, w: img.width, h: img.height };
        try {
          const box = JSON.parse(crop);
          if (box.w > 100 && box.h > 100) c = box;
        } catch (e) {}
        const scale = Math.min(1, 1280 / c.w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(c.w * scale);
        canvas.height = Math.round(c.h * scale);
        canvas.getContext("2d").drawImage(img, c.x, c.y, c.w, c.h, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = function () { done(null); };
      img.src = dataUrl;
    });
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

  // swap the loading view for a finished result view; the "Rats caught" pill sits just above "Wrong verdict?"
  function showResult($content) {
    const $wrong = $content.find(".wrong");
    if ($wrong.length) $wrong.before(Rats.pill());
    else $content.append(Rats.pill());
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

  // why each check matters, shown under "See details" so people can weigh the evidence themselves
  const WHY = {
    "Sender": "The display name can say anything. What matters is whether the actual address belongs to that person or company.",
    "Verification": "Email has a built-in ID check (SPF, DKIM and DMARC). Scammers can copy a company's name and logo, but they can't pass this check for the company's real address.",
    "Links": "Phishing almost always happens through links. We compare where each link really goes with what it says and with who sent the email.",
    "Language": "Scams use pressure, like threats, deadlines or countdown timers, to rush you into acting before you think.",
    "Asks for": "Real companies rarely ask for passwords, codes, card details or payment by email. That's what scammers are after.",
    "Domain age": "Scammers often set up new web addresses right before an attack. One that has been around for years is a good sign.",
    "Greeting": "Companies you have an account with usually use your name. \"Dear customer\" is common in mass scam emails, though some real newsletters use it too.",
    "Reply-To": "Some scams send from one address but route your replies to another, so they can keep the conversation going.",
    "Attachments": "Some file types can run programs or open fake login pages. Only open files you were expecting.",
    "Also noticed": "Something else the AI spotted while reading the email.",
    "Reviewed by Cheztrap": "Someone on the Cheztrap team checked this sender by hand after a report.",
    "Domain": "Scam sites often use addresses that look like a real brand's, with an extra word, a swapped letter, or odd characters.",
    "Payment": "Gift cards, crypto and wire transfers can't be reversed, which is why scam shops ask for them.",
    "Prices": "Huge discounts on popular items are the most common bait used by fake shops.",
    "Contact info": "Real businesses list a way to reach them, like an address, phone number or company details. Scam sites usually hide behind a web form.",
    "Reviews": "Fake shops copy or invent reviews. Many identical 5-star reviews are a warning sign.",
    "Security": "HTTPS keeps what you type private on the way to the site. Scam sites use it too, so it doesn't prove a site is honest, but a site without it is risky for anything you type.",
  };

  // the key evidence up front, in the same label/value table as the site facts, with a ✓ ! ✕ before each answer
  function evidenceTable(items) {
    const $dl = $("<dl>").addClass("facts evidence");
    items.forEach(function (item) {
      $("<div>")
        .addClass(item.status || "")
        .append($("<dt>").text(item.label), $("<dd>").text(item.short || item.text))
        .appendTo($dl);
    });
    return $dl;
  }

  // "What we checked" under "See details": the full finding for each check, and why it matters
  function explained(items) {
    const $list = $("<ul>").addClass("checks");
    items.forEach(function (item) {
      const $li = $("<li>").addClass(item.status).appendTo($list);
      if (item.label) $("<b>").text(item.label).appendTo($li);
      $("<span>").text(item.text).appendTo($li);
      if (WHY[item.label]) $("<small>").text(WHY[item.label]).appendTo($li);
    });
    return $list;
  }

  // a risky result leads with what went wrong
  function failuresFirst(items) {
    const rank = { fail: 0, warn: 1, pass: 2, info: 3 };
    return items.slice().sort(function (a, b) { return (rank[a.status] || 0) - (rank[b.status] || 0); });
  }

  // "Why it looks off" / "Why it looks safe" above the evidence table
  function whyHeading(safe) {
    return $("<h2>").text(safe ? "Why it looks safe" : "Why it looks off");
  }

  // paypal.com for both paypal.com and mail.paypal.com (and paypal.co.uk style addresses), like the server does
  function baseDomain(host) {
    const parts = (host || "").toLowerCase().replace(/^www\./, "").split(".");
    const ccSecond = ["co", "com", "org", "net", "ac", "gov", "edu"];
    const n = parts.length >= 3 && parts[parts.length - 1].length === 2 && ccSecond.indexOf(parts[parts.length - 2]) !== -1 ? 3 : 2;
    return parts.slice(-n).join(".");
  }

  function parseList(json) {
    try {
      const value = JSON.parse(json || "[]");
      return Array.isArray(value) ? value : [];
    } catch (e) {
      return [];
    }
  }

  function andList(items) {
    return items.length > 1 ? items.slice(0, -1).join(", ") + " and " + items[items.length - 1] : items.join("");
  }

  function count(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  // the rows the extension can work out on its own (Sender, Verification, Links, Attachments), for servers that
  // don't send checks yet. Language and "Asks for" need the AI, so they only come from the server
  function localEmailChecks(email) {
    const domain = (email.senderEmail || "").split("@")[1] || "";
    const rows = [];
    if (email.senderEmail) {
      rows.push({ label: "Sender", status: "info", text: "Sent from " + email.senderEmail, short: email.senderEmail });
    }

    const auth = (email.authResults || "").toLowerCase();
    const result = function (name) {
      const match = auth.match(new RegExp("\\b" + name + "=(\\w+)"));
      return match ? match[1] : "";
    };
    const results = { SPF: result("spf"), DKIM: result("dkim"), DMARC: result("dmarc") };
    const passed = Object.keys(results).filter(function (k) { return results[k] === "pass"; });
    const failed = Object.keys(results).filter(function (k) { return results[k] && results[k] !== "pass"; });
    if (!auth) {
      rows.push({ label: "Verification", status: "warn", text: "Couldn't check", short: "Couldn't check" });
    } else if (results.DMARC === "pass") {
      rows.push({ label: "Verification", status: "pass", text: "Sent from " + domain + "'s real servers", short: "Passed " + andList(passed) });
    } else if (results.DMARC === "fail" || failed.length) {
      rows.push({ label: "Verification", status: "fail", text: "Couldn't confirm this came from " + domain + ". The sender may be faked.", short: "Failed " + andList(failed) + " checks" });
    } else {
      rows.push({ label: "Verification", status: "warn", text: "Couldn't confirm the sender", short: "Not confirmed" });
    }

    const hosts = parseList(email.links)
      .map(function (link) {
        try { return baseDomain(new URL(link.href).hostname); } catch (e) { return ""; }
      })
      .filter(Boolean);
    const sites = hosts.filter(function (h, i) { return hosts.indexOf(h) === i; });
    const elsewhere = hosts.filter(function (h) { return h !== baseDomain(domain); });
    if (!hosts.length) {
      rows.push({ label: "Links", status: "pass", text: "No links", short: "No links" });
    } else if (!elsewhere.length || sites.length === 1) {
      const text = count(hosts.length, "link") + ", all go to " + sites[0];
      rows.push({ label: "Links", status: elsewhere.length ? "warn" : "pass", text: text, short: text });
    } else {
      rows.push({
        label: "Links", status: "warn",
        text: count(hosts.length, "link") + " going to " + sites.length + " sites: " + sites.slice(0, 3).join(", "),
        short: count(hosts.length, "link") + ", " + (elsewhere.length === hosts.length ? "all go" : elsewhere.length + (elsewhere.length === 1 ? " goes" : " go")) + " to other sites",
      });
    }

    const files = parseList(email.attachments).map(String);
    const risky = files.filter(function (name) {
      return /\.(exe|scr|bat|cmd|com|js|vbs|jar|msi|ps1|hta|html?|shtml|iso|img|lnk|docm|xlsm|pptm|zip|rar|7z|gz|tar)$/i.test(name);
    });
    if (!files.length) {
      rows.push({ label: "Attachments", status: "pass", text: "No attachments", short: "None" });
    } else if (risky.length) {
      rows.push({ label: "Attachments", status: "fail", text: "Contains " + risky.join(", ") + ", a file type that can run programs or hide malware.", short: count(risky.length, "risky file") });
    } else {
      rows.push({ label: "Attachments", status: "pass", text: count(files.length, "attachment") + ", all normal file types", short: count(files.length, "normal file") });
    }
    return rows;
  }

  // the email result: verdict, summary and the key evidence table up front; the sender's description and
  // a deeper explanation of every check behind "See details"
  function emailView(email, output, leaveButton, rat) {
    const safe = output.is_safe === true;
    const $view = $("<div>").append(
      verdict(safe ? "good" : "bad", safe ? "Looks safe" : "This email may NOT be safe!"),
      // who it's from, the way Gmail's inbox list shows it (e.g. "GitHub", "Venmo"), flagged when it's an impostor
      $("<div>").addClass("url").text(
        (email.senderName || email.senderEmail || email.title || "Gmail") + (output.impersonating && !safe ? " (pretending)" : "")
      ),
      // a short take on whether it's safe; the table below gives the reasons. Older servers write a whole
      // paragraph, so only its first sentence is shown
      $("<p>").addClass("sum").text(
        Array.isArray(output.checks) ? output.reason || "" : (output.reason || "").split(/(?<=[.!?])\s+/)[0]
      )
    );

    // every check gets a row; the AI's extra findings are explained under "See details"
    // (older servers' red flags become rows of their own)
    const checks = Array.isArray(output.checks)
      ? output.checks
      : localEmailChecks(email).concat((output.red_flags || []).map(function (text) {
          return { label: "Red flag", status: "fail", text: text, short: text };
        }));
    const rows = checks.filter(function (c) { return c.label && c.label !== "Also noticed"; });
    if (rows.length) $view.append(whyHeading(safe), evidenceTable(safe ? rows : failuresFirst(rows)));

    if (!safe) {
      $view.append(
        $("<p>").addClass("todo").append(
          $("<b>").text("What to do: "),
          "Don't click the links. Report it as phishing (⋮ next to Reply in Gmail), then delete it."
        ),
        leaveButton()
      );
    }

    const $more = $("<details>").addClass("more").append($("<summary>").text("See details"));
    if (output.sender_description) {
      $more.append($("<h3>").text("About the sender"), $("<p>").addClass("about").text(output.sender_description));
    }
    if (checks.length) {
      $more.append($("<h3>").text("What we checked"), explained(safe ? checks : failuresFirst(checks)));
    }
    if ($more.children().length > 1) $view.append($more);

    if (safe) $view.append($("<p>").addClass("note").text("No checker is perfect. If something feels off, don't click."));
    const from = email.senderName ? email.senderName + " <" + email.senderEmail + ">" : email.senderEmail;
    return $view.append(wrongLink(
      "Wrong verdict on an email",
      "Cheztrap said the email from " + (from || "an unknown sender") +
        (email.title ? ' (subject: "' + email.title + '")' : "") +
        " is " + (safe ? "safe" : "NOT safe") + ", but I think that's wrong.\n\nWhy I think so: ",
      rat
    ));
  }

  // opens the contact form with the topic and what we checked already filled in, so reporting takes seconds.
  // rat is the counted unsafe result ({ kind, id }), taken back out of the counter when the user disputes it
  function wrongLink(topic, message, rat) {
    const url = contactUrl + "?topic=" + encodeURIComponent(topic) + "&message=" + encodeURIComponent(message);
    return $("<a>")
      .addClass("wrong")
      .attr("href", url)
      .text("Wrong verdict? Tell us.")
      .on("click", function (e) {
        e.preventDefault();
        // opening the tab closes the popup, so finish the uncount first
        const open = function () { chrome.tabs.create({ url: url }); };
        if (rat) Rats.release(rat.kind, rat.id).then(open, open);
        else open();
      });
  }

  function traffic(output) {
    if (!output.traffic_level) return "";
    const level = String(output.traffic_level);
    const text = level.charAt(0).toUpperCase() + level.slice(1);
    const visits = typeof output.monthly_visits === "number" ? output.monthly_visits.toLocaleString("en-US") : output.monthly_visits;
    return visits ? text + ", about " + visits + " visits a month" : text;
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
              const email = results[0].result;
              // the counter's ID for this email stays in the popup and is never sent to the server
              const emailId = email.messageId || (email.senderEmail + "|" + email.title);
              delete email.messageId;

              // the sender checks (SPF/DKIM/DMARC) and Reply-To live in the original headers; if this fails we just skip them
              chrome.scripting.executeScript(
                { target: { tabId: currentTab.id }, world: "MAIN", func: fetchOriginal },
                function (headerResults) {
                  let headers = { authResults: "", replyTo: "" };
                  if (!chrome.runtime.lastError && headerResults && headerResults[0]) {
                    try {
                      headers = parseEmailHeaders(headerResults[0].result);
                    } catch (e) {}
                  }
                  email.authResults = headers.authResults;
                  email.replyTo = headers.replyTo;
                  readImagesThenCheck();
                }
              );

              // the message is probably inside pictures, so also send a screenshot of the email as it looks on screen
              function readImagesThenCheck() {
                if (email.mostlyImages) {
                  $("#msg").text("Reading the images...");
                  captureEmail(currentTab.windowId, email.crop, function (screenshot) {
                    if (screenshot) email.screenshot = screenshot;
                    checkEmail();
                  });
                } else {
                  checkEmail();
                }
              }

              function checkEmail() {
                $.post(
                  hostname + "/api/check/result/gmail",
                  email,
                  function (output) {
                    // only a clear "unsafe" verdict counts as a rat
                    const rat = output.is_safe === false ? { kind: "email", id: emailId } : null;
                    showResult(emailView(email, output, leaveButton, rat));
                    if (rat) Rats.record(rat.kind, rat.id);
                  }
                ).fail(function () {
                  showMessage("Couldn't check this email", "Something went wrong on our end. Try again in a moment.");
                });
              }
            }
          }
        );
      }, 3000);
    } else if (
      currentUrl.startsWith("http://") ||
      currentUrl.startsWith("https://")
    ) {
      // Domain and Security rows from the address alone, the same way the server words them
      function localSiteChecks() {
        const host = urlElement.hostname;
        const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(":") !== -1 || host.charAt(0) === "[";
        const lookalike = host.indexOf("xn--") === 0 || host.indexOf(".xn--") !== -1;
        return [
          isIp
            ? { label: "Domain", status: "fail", text: "The address is a raw IP address (" + host + ") instead of a website name.", short: "Raw IP address" }
            : lookalike
            ? { label: "Domain", status: "fail", text: host + " uses look-alike characters (punycode) that can imitate another site.", short: "Look-alike characters" }
            : { label: "Domain", status: "pass", text: "The address doesn't use look-alike characters or a raw IP address.", short: "No odd characters" },
          urlElement.protocol === "https:"
            ? { label: "Security", status: "pass", text: "The connection to this site is encrypted (HTTPS). Scam sites use HTTPS too, so this alone doesn't make a site safe.", short: "Valid HTTPS (scams use it too)" }
            : { label: "Security", status: "warn", text: "This site doesn't use HTTPS, so anything you type on it could be seen by others.", short: "No HTTPS" },
        ];
      }

      function showSite(output) {
        const safe = output.is_safe === true;
        const $view = $("<div>").append(
          verdict(safe ? "good" : "bad", safe ? "Website is safe!" : "Rat territory!"),
          $("<div>").addClass("url").text(urlElement.hostname),
          $("<p>").addClass("sum").text(output.reason || "")
        );
        // the main table: Domain, Domain age, Payment, Prices, Language, Contact info, Reviews, Security.
        // servers that don't send checks yet get the two the extension can work out itself
        const checks = Array.isArray(output.checks) ? output.checks : localSiteChecks();
        if (checks.length) $view.append(whyHeading(safe), evidenceTable(safe ? checks : failuresFirst(checks)));

        // the second table, under "See details": background on the site. Once we know a few things about it,
        // the blanks say "Unknown" so the table reads as complete
        const about = [
          ["Website type", output.website_type],
          ["Founders", founders(output)],
          ["Founded", output.founded_year],
          ["HQ", output.hq],
          ["Traffic", traffic(output)],
          ["Money raised", output.money_raised],
        ];
        const known = about.filter(function (row) { return row[1]; }).length;
        const $facts = facts(
          about
            .map(function (row) { return [row[0], row[1] || (known >= 3 ? "Unknown" : "")]; })
            .concat(safe ? [] : [
              ["Registrar", output.registrar],
              ["Created", output.domain_created],
              ["Registrant", output.domain_registrant],
            ])
        );
        // background info about the site (type, founders, HQ, money raised...) and what each check means;
        // on a safe site it sits above the fun fact, on a risky one below "Take me back to safety"
        const $more = $("<details>").addClass("more").append($("<summary>").text("See details"));
        if ($facts) $more.append($facts);
        if (checks.length) $more.append($("<h3>").text("What we checked"), explained(safe ? checks : failuresFirst(checks)));
        const hasMore = $more.children().length > 1;

        if (safe && hasMore) $view.append($more);
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
        if (!safe && hasMore) $view.append($more);
        // only a clear "unsafe" verdict counts as a rat; the page is identified by its URL without the query string
        const rat = output.is_safe === false ? { kind: "site", id: urlElement.origin + urlElement.pathname } : null;
        showResult($view.append(wrongLink(
          "Wrong verdict on a site",
          "Cheztrap said " + urlElement.hostname + " is " + (safe ? "safe" : "NOT safe") +
            ", but I think that's wrong.\n\nWhy I think so: ",
          rat
        )));
        if (rat) Rats.record(rat.kind, rat.id);
      }

      // cheztrap.com is our own site, so skip the check and mark it safe
      if (isOwnSite(urlElement.hostname)) {
        showSite(OWN_SITE_RESULT);
      } else {
        // read what the page shows (title, description, visible text) so prices, payment and reviews can be judged;
        // some pages (like the Chrome Web Store) can't be read, and then only the address is checked
        chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: readPage }, function (results) {
          const page = !chrome.runtime.lastError && results && results[0] && results[0].result ? results[0].result : {};
          $.post(hostname + "/api/check/website", Object.assign({ url: currentUrl }, page), showSite).fail(function () {
            showMessage("Couldn't check this site", "Something went wrong on our end. Try again in a moment.");
          });
        });
      }
    } else {
      // chrome://, new tab, extension pages, etc.
      showMessage("Nothing to check here", "Open a website or an email, then click the cheese again.");
    }
  });
});
