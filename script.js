// Load the cleaned CSV and then set up the country dropdown

document.addEventListener("DOMContentLoaded", () => {
  d3.csv("data/olympics_clean.csv").then(data => {
    console.log("Loaded olympics_clean.csv with rows:", data.length);

    // convert numeric fields
    data.forEach(d => {
      d.Year = +d.Year;
      if (d.Population) d.Population = +d.Population;
      if (d["GDP per Capita"]) d["GDP per Capita"] = +d["GDP per Capita"];
    });

    console.log("First few rows:", data.slice(0, 5));

    // Task 1A: set up the country dropdown
    setupCountryDropdown(data);

    // optional: save globally for future charts
    window.OlympicsData = data;

  }).catch(err => {
    console.error("Error loading CSV:", err);
  });
});

// === Helper: populate the country dropdown ===
function setupCountryDropdown(data) {
  const dropdown = d3.select("#country-dropdown");

  if (dropdown.empty()) {
    console.warn("No #country-dropdown element found in the DOM.");
    return;
  }

  // Get unique country names
  const countries = [...new Set(data.map(d => d.Country_Name))].sort();

  dropdown
    .selectAll("option")
    .data(countries)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  // Default selection (if present)
  if (countries.includes("United States")) {
    dropdown.property("value", "United States");
  }

  dropdown.on("change", () => {
    const selected = dropdown.property("value");
    console.log("Selected country:", selected);
    // later: call functions to update charts
  });
}
