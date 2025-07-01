const hostname = "https://cheztrap.com/";
//const hostname = "http://127.0.0.1:8000/";

jQuery(document).ready(function () {
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

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab.url;
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

    let isGmailSection = gmailSections.some(
      (section) =>
        currentUrl.startsWith("https://mail.google.com") &&
        currentUrl.endsWith(section)
    );

    const websiteNameDisplay = $("#website_name");
    const isSafeDisplay = $("#is_safe");


    let isGmailDetailPage =
      currentUrl.startsWith("https://mail.google.com") && !isGmailSection;

    if (isGmailDetailPage) {
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
              return;
            }

            if (results && results[0] && results[0].result) {
              const { title, bodyText } = results[0].result;

              console.log("Page Title:", title);
              console.log("Page Body:", bodyText);

              const mainElement = $("#main");

              $.post(
                hostname + "/api/check/result/gmail",
                { title: title, bodyText: bodyText },
                function (output) {
                  if (output.is_safe) {
                    isSafeDisplay.html(
                      "<div class='gmail_result_container'>" +
                      "<div class='result_img'><img src='/static/images/insurance.png' style='width: 2.8rem;'></div>" + 
                      "<div class='result_header'>This Gmail is Safe!</div>" + 
                      "</div>" 
                    );
                    websiteNameDisplay.html(
                      "<div><img src='/static/images/rat.svg' style='width: 200px; padding-top:20%;'></div>" +
                      "<div class='gmail_reason_desc'>" + output.reason +
                      "</div>"
                    );

                  } else {
                    isSafeDisplay.html(
                      "<div class='result_container'>" +
                      "<div class='result_img'><img src='/static/images/warning.png' style='width: 2.8rem;'></div>" + 
                      "<div class='result_header'>This Gmail may NOT be safe!</div>" +
                      "</div>"
                    );
                    websiteNameDisplay.html(
                      "<div style='margin-top: -15px;'><img src='/static/images/bad_rat.svg' style='width: 300px; padding-top:7%;'></div>" +
                      "<div class='gmail_reason_desc'>" + output.reason +
                      "</div>"
                    );
                    
                  }
                }
              );
            }
          }
        );
      }, 3000);
    } else if (
      currentUrl.startsWith("http://") ||
      currentUrl.startsWith("https://") ||
      currentUrl.startsWith("chrome://") ||
      currentUrl.startsWith("http://192.168") ||
      currentUrl.startsWith("http://127.")
    ) {
      $.post(
        hostname + "/api/check/website",
        { url: currentUrl },
        function (output) { 
          console.log("output", output);

          console.log(urlElement);
          if (output.is_safe) {
            isSafeDisplay.html(
              "<div class='result_container'>" +
              "<div class='result_img'><img src='/static/images/insurance.png' style='width: 2.8rem;'></div>" + 
              "<div class='result_header'>Website is Safe!</div>" + 
              "</div>"
            );
            websiteNameDisplay.html(
              "<div class='website_title'>" +
                urlElement.hostname + "</div>" + 
                "<div class='reason_desc'>" + output.reason +
                "</div>" + 

               

                //table
                "<div class='table_title'>More About This Site</div>" +
                "<table id='customers'>" +
                  "<tr>" +
                    "<td>Website Type</td>" + 
                    "<td>" + output.website_type + "</td>" +
                  "</tr>" +
                  "<tr>" +
                    "<td>Founders</td>" +
                    "<td>" + output.founders.join(', ') + "</td>" +
                  "</tr>" +
                  "<tr>" +
                    "<td>Founded Year</td>" +
                    "<td>" + output.founded_year + "</td>" +
                  "</tr>" +
                  "<tr>" +
                    "<td>HQ</td>" +
                    "<td>" + output.hq + "</td>" +
                  "</tr>" +
                  "<tr>" +
                    "<td>Traffic Level</td>" +
                    "<td>" + output.traffic_level + "- " + output.monthly_visits + " monthly visits" + "</td>" +
                  "</tr>" +
                  "<tr>" +
                    "<td>Money Raised</td>" +
                    "<td>" + output.money_raised + "</td>" +
                  "</tr>" +
                  "<tr>" +
                    "<td>Fun Fact</td>" +
                    "<td>" + output.fun_fact + "</td>" +
                  "</tr>" +
                "</table>"
            );

          } else {
            isSafeDisplay.html(
              "<div class='result_container'>" +
              "<div class='result_img'><img src='/static/images/warning.png' style='width: 2.8rem;'></div>" + 
              "<div class='result_header'>BE CAUTIOUS!</div>" +
              "</div>"
            );
            let html = 
            "<div class='website_title'>" + urlElement.hostname + "</div>" +
            "<div class='reason_desc'>" + output.reason + "</div>" +

            "<div class='table_title'>More About This Site</div>" +
            "<table id='customers'>";

            // Add Website Type row if exists
            if (output.website_type) {
              html += "<tr><td>Website Type</td><td>" + output.website_type + "</td></tr>";
            }

            // Add Founders row if exists
            if (output.founders && output.founders!="" && output.founders.join(', ')!=="John Doe, Jane Smith") {
              html += "<tr><td>Founders</td><td>" + output.founders.join(', ') + "</td></tr>";
            }

            // Add Founded Year row if exists
            if (output.founded_year) {
              html += "<tr><td>Founded Year</td><td>" + output.founded_year + "</td></tr>";
            }

            // Add HQ row if exists
            if (output.hq) {
              html += "<tr><td>HQ</td><td>" + output.hq + "</td></tr>";
            }

            if (output.traffic_level) {
              html += "<tr><td>Traffic Level</td><td>" + output.traffic_level + "- " + output.monthly_visits + " monthly visits" + "</td></tr>";
            }

            if (output.registrar) {
              html += "<tr><td>Registrar</td><td>" + output.registrar + "</td></tr>";
            }

            if (output.domain_created) {
              html += "<tr><td>Domain Created</td><td>" + output.domain_created + "</td></tr>";
            }

            if (output.domain_registrant) {
              html += "<tr><td>Domain Registrant</td><td>" + output.domain_registrant + "</td></tr>";
            }

            // Add Money Raised row if exists
            if (output.money_raised) {
              html += "<tr><td>Money Raised</td><td>" + output.money_raised + "</td></tr>";
            }

            html += "</table>";

            websiteNameDisplay.html(html);

          }
        }
      );
    }
  });
});
