// "Rats caught": counts the unsafe sites and emails Cheztrap has flagged for this user.
// Everything stays in chrome.storage.local and is never sent anywhere. To avoid counting the same
// site or email twice without keeping browsing history, only a SHA-256 hash of each one is stored.
const Rats = (function () {
  const DEFAULTS = { ratsCaught: 0, sitesCaught: 0, emailsCaught: 0, seenHashes: [], milestonesShown: [] };
  const MAX_HASHES = 500;
  const MILESTONES = {
    1: "First rat caught!",
    10: "10 rats caught. Nice trap!",
    50: "50 rats caught. Your trap is legendary!",
    100: "100 rats caught. Cheese champion!",
  };

  function storageGet() {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.get(DEFAULTS, function (data) {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(data);
      });
    });
  }

  function storageSet(data) {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.set(data, function () {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  // reads and writes run one at a time, so a verdict arriving while the pill loads can't be lost
  let queue = Promise.resolve();
  function update(change) {
    const run = queue.then(function () {
      return storageGet().then(function (data) {
        const result = change(data);
        return (result && result.save ? storageSet(data) : Promise.resolve()).then(function () {
          return Object.assign({ data: data }, result);
        });
      });
    });
    queue = run.catch(function () {});
    return run;
  }

  // kind is "site" (the URL without its query string) or "email" (the message ID, or sender + subject)
  function hash(kind, id) {
    const bytes = new TextEncoder().encode(kind + ":" + id);
    return crypto.subtle.digest("SHA-256", bytes).then(function (digest) {
      return Array.from(new Uint8Array(digest))
        .map(function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  // count an unsafe verdict; resolves to { isNew, milestone, data }
  function caught(kind, id) {
    return hash(kind, id).then(function (h) {
      return update(function (data) {
        if (data.seenHashes.indexOf(h) !== -1) return { isNew: false };
        data.ratsCaught += 1;
        data[kind + "sCaught"] += 1;
        data.seenHashes = data.seenHashes.concat(h).slice(-MAX_HASHES);
        let milestone = "";
        if (MILESTONES[data.ratsCaught] && data.milestonesShown.indexOf(data.ratsCaught) === -1) {
          milestone = MILESTONES[data.ratsCaught];
          data.milestonesShown = data.milestonesShown.concat(data.ratsCaught);
        }
        return { save: true, isNew: true, milestone: milestone };
      });
    });
  }

  // "Wrong verdict?" on a counted rat: take it back out so the number stays honest
  function release(kind, id) {
    return hash(kind, id).then(function (h) {
      return update(function (data) {
        const index = data.seenHashes.indexOf(h);
        if (index === -1) return {};
        data.seenHashes.splice(index, 1);
        data.ratsCaught = Math.max(0, data.ratsCaught - 1);
        data[kind + "sCaught"] = Math.max(0, data[kind + "sCaught"] - 1);
        return { save: true };
      });
    });
  }

  // milestones stay marked as shown, so they never repeat after a reset
  function reset() {
    return update(function (data) {
      data.ratsCaught = data.sitesCaught = data.emailsCaught = 0;
      data.seenHashes = [];
      return { save: true };
    });
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  // the pill for the bottom of the popup; it removes itself if storage can't be read
  let $box = null;
  function pill() {
    $box = $("<div>").addClass("rats").hide();
    const $button = $("<button>")
      .addClass("rat-pill")
      .attr({ type: "button", "aria-expanded": "false" })
      .append('<svg viewBox="0 0 44 30" aria-hidden="true"><use href="#rat"/></svg>', $("<span>").addClass("rat-count"));
    const $more = $("<div>").addClass("rat-more").hide().append(
      $("<p>").addClass("rat-split"),
      $("<button>").addClass("rat-link").attr("type", "button").text("Reset counter").on("click", function () {
        $(this).hide();
        $confirm.show();
      })
    );
    const $confirm = $("<p>").addClass("rat-confirm").hide().append(
      "Reset to 0? ",
      $("<button>").addClass("rat-link").attr("type", "button").text("Yes, reset").on("click", function () {
        reset().then(function (result) { render(result.data); }, hide);
        $confirm.hide();
        $more.find(".rat-link").show();
      }),
      " · ",
      $("<button>").addClass("rat-link").attr("type", "button").text("Cancel").on("click", function () {
        $confirm.hide();
        $more.find(".rat-link").show();
      })
    );
    $more.append($confirm);
    $button.on("click", function () {
      const open = $more.is(":hidden");
      $more.toggle(open);
      $button.attr("aria-expanded", String(open));
    });
    $box.append($button, $more);

    update(function () { return {}; }).then(function (result) { render(result.data); }, hide);
    return $box;
  }

  function render(data) {
    if (!$box) return;
    $box.find(".rat-count").text(data.ratsCaught ? "Rats caught: " + data.ratsCaught : "No rats caught yet");
    $box.find(".rat-split").text(plural(data.sitesCaught, "site") + ", " + plural(data.emailsCaught, "email"));
    $box.show();
  }

  function hide() {
    if ($box) $box.remove();
    $box = null;
  }

  // count it, and if it's new: bounce the pill, float a +1, and flash "Rat caught!" on the warning banner
  function record(kind, id) {
    caught(kind, id).then(function (result) {
      render(result.data);
      if (!result.isNew || !$box) return;
      const $pill = $box.find(".rat-pill").removeClass("bounce");
      void $pill[0].offsetWidth; // restart the animation
      $pill.addClass("bounce").append($("<span>").addClass("rat-plus").attr("aria-hidden", "true").text("+1"));
      $(".ver.bad").first().append($("<span>").addClass("caught").text("Rat caught!"));
      if (result.milestone) $box.append($("<p>").addClass("rat-milestone").text(result.milestone));
    }, hide);
  }

  return { pill: pill, record: record, release: release };
})();
