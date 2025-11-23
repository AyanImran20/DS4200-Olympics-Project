// script.js

// Runs after the HTML is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Olympics visualization site loaded.");

  // Task 0: load the cleaned CSV and log it
  d3.csv("data/olympics_clean.csv")
    .then(data => {
      console.log("Loaded olympics_clean.csv with rows:", data.length);

      // Convert numeric fields to numbers
      data.forEach(d => {
        if (d.Year) d.Year = +d.Year;
        if (d.Population) d.Population = +d.Population;
        if (d["GDP per Capita"]) d["GDP per Capita"] = +d["GDP per Capita"];
      });

      console.log("First few rows:", data.slice(0, 5));

      // Task 1: draw the basic world map
      drawWorldMap(data);
    })
    .catch(err => {
      console.error("Error loading olympics_clean.csv:", err);
    });
});


// Task 1: Basic World Map in the #world-map container
function drawWorldMap(data) {
  const container = document.getElementById("world-map");
  if (!container) {
    console.warn("#world-map container not found.");
    return;
  }

  // Clear any placeholder text
  container.innerHTML = "";

  const width = 800;
  const height = 450;

  const svg = d3
    .select("#world-map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Projection & path
  const projection = d3
    .geoNaturalEarth1()
    .scale(150)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  // Load GeoJSON world map
  d3.json("data/world.geojson")
    .then(world => {
      svg
        .selectAll("path")
        .data(world.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#1e2a47")
        .attr("stroke", "#ffffff33")
        .attr("stroke-width", 0.5);

      console.log("World map drawn.");
    })
    .catch(err => {
      console.error("Error loading world.geojson:", err);
    });
}
