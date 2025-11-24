// DS4200 Olympics Project
// Task 1: Interactive map + bar chart + gender summary

document.addEventListener("DOMContentLoaded", () => {
  console.log("Olympics visualization site loaded.");

  if (!window.d3) {
    console.error("D3 library (d3.v7) is not loaded.");
    return;
  }

  // Load main medal data + world GeoJSON
  Promise.all([
    d3.csv("data/olympics_clean.csv"),
    d3.json("data/world.geojson")
  ])
    .then(([data, world]) => {
      // -------- 1. Clean / parse data --------------------------------------
      data.forEach(d => {
        // numeric year
        d.Year = +d.Year;

        // if there is an explicit medal count column, use it,
        // otherwise treat each row as 1 medal
        if (d.Medal_Count !== undefined && d.Medal_Count !== "") {
          d.Medal_Count = +d.Medal_Count;
        } else {
          d.Medal_Count = 1;
        }
      });

      console.log("Loaded olympics_clean.csv rows:", data.length);
      console.log("Sample rows:", data.slice(0, 5));
      console.log(
        "World features:",
        world && world.features ? world.features.length : "no features"
      );

      // Quick debug: show a few rows for a modern year
      console.log(
        "Sample rows for 2012:",
        data.filter(d => d.Year === 2012).slice(0, 10)
      );

      // Get unique years that actually appear in the dataset
      const years = Array.from(
        new Set(data.map(d => d.Year).filter(y => !Number.isNaN(y)))
      ).sort((a, b) => a - b);

      let currentYear = years[years.length - 1]; // default: latest

      // -------- 2. Controls (Year dropdown, inside map card) ---------------
      const mapContainer = d3.select("#world-map");

      const controls = mapContainer
        .insert("div", ":first-child")
        .attr("class", "viz-controls");

      controls
        .append("label")
        .attr("for", "year-select")
        .attr("class", "viz-label")
        .text("Year:");

      const yearSelect = controls
        .append("select")
        .attr("id", "year-select")
        .attr("class", "year-select")
        .on("change", event => {
          const val = event.target.value;
          currentYear = val === "All" ? "All" : +val;
          updateAll();
        });

      const yearOptions = ["All"].concat(years);
      yearSelect
        .selectAll("option")
        .data(yearOptions)
        .join("option")
        .attr("value", d => d)
        .property("selected", d => d === currentYear)
        .text(d => (d === "All" ? "All years" : d));

      // -------- 3. World map setup ----------------------------------------
      const mapWidth = 750;
      const mapHeight = 380;

      const svgMap = mapContainer
        .append("svg")
        .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
        .attr("class", "viz-svg");

      const projection = d3
        .geoNaturalEarth1()
        .fitSize([mapWidth, mapHeight], world);

      const path = d3.geoPath(projection);

      const countries = world.features || world.geometries || [];
      const mapG = svgMap.append("g").attr("class", "map-layer");

      // helper: get ISO3 code from GeoJSON feature
      function featureIso3(f) {
        const p = f.properties || {};
        return (
          p.ISO_A3 ||
          p.iso_a3 ||
          p.ADM0_A3 ||
          f.id ||
          p.name || // last resort: country name
          ""
        );
      }

      // -------- 4. Bar chart setup ----------------------------------------
      const barContainer = d3.select("#bar-race");
      const barWidth = 750;
      const barHeight = 380;

      const svgBar = barContainer
        .append("svg")
        .attr("viewBox", `0 0 ${barWidth} ${barHeight}`)
        .attr("class", "viz-svg");

      const barMargin = { top: 35, right: 20, bottom: 40, left: 150 };
      const barInnerWidth = barWidth - barMargin.left - barMargin.right;
      const barInnerHeight = barHeight - barMargin.top - barMargin.bottom;

      const barG = svgBar
        .append("g")
        .attr(
          "transform",
          `translate(${barMargin.left},${barMargin.top})`
        );

      const xScale = d3.scaleLinear().range([0, barInnerWidth]);
      const yScale = d3
        .scaleBand()
        .range([0, barInnerHeight])
        .padding(0.2);

      const xAxisG = barG
        .append("g")
        .attr("transform", `translate(0,${barInnerHeight})`)
        .attr("class", "axis axis-x");

      const yAxisG = barG.append("g").attr("class", "axis axis-y");

      svgBar
        .append("text")
        .attr("x", barWidth / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("class", "viz-title-small")
        .text("Top Countries by Medal Count");

      // -------- 5. Gender summary block -----------------------------------
      const genderContainer = d3.select("#gender-dashboard");
      const genderSummary = genderContainer
        .append("div")
        .attr("class", "gender-summary-text");

      // -------- 6. Filtering helper ---------------------------------------
      function computeFilteredData() {
        if (currentYear === "All") return data;
        return data.filter(d => d.Year === currentYear);
      }

      // -------- 7. Main update function -----------------------------------
      function updateAll() {
        const filtered = computeFilteredData();

        // If no data for this year (or all years), show "no data" messages
        if (!filtered.length) {
          mapG
            .selectAll("path.country")
            .transition()
            .duration(300)
            .attr("fill", "#e5e7eb");

          barG.selectAll("rect.bar").remove();
          barG.selectAll("text.bar-label").remove();
          xAxisG.call(d3.axisBottom(xScale).tickValues([]));
          yAxisG.call(d3.axisLeft(yScale).tickValues([]));

          genderSummary.text(
            currentYear === "All"
              ? "No data available in this dataset for the selected range."
              : `Year ${currentYear}: no data available in this dataset.`
          );

          console.warn("No data for selected year:", currentYear);
          return;
        }

        // ---------- MAP: medals aggregated by ISO/NOC ---------------------
        const medalsByIso = d3.rollup(
          filtered,
          v => d3.sum(v, r => r.Medal_Count || 1),
          d =>
            (d.ISO_Code || d.NOC || d.Country_Code || d.Country_Name || d.Country || "").toUpperCase()
        );

        // debug: show how many distinct keys we have for this year
        console.log(
          `Year ${currentYear} – distinct country keys for map:`,
          medalsByIso.size
        );

        // figure out max medal count so we can scale the colors
        const maxMedals =
          d3.max(Array.from(medalsByIso.values())) || 0;

        const color = d3
          .scaleLinear()
          .domain([0, maxMedals * 0.2, maxMedals]) // more contrast at low end
          .range(["#edf2ff", "#9ab6ff", "#1d4ed8"]);

        const countryPaths = mapG
          .selectAll("path.country")
          .data(
            countries,
            d => featureIso3(d) // key by ISO3
          );

        countryPaths
          .enter()
          .append("path")
          .attr("class", "country")
          .attr("d", path)
          .attr("stroke", "#9ca3af")
          .attr("stroke-width", 0.5)
          .on("mouseover", function () {
            d3.select(this)
              .attr("stroke-width", 1.2)
              .attr("stroke", "#111827");
          })
          .on("mouseout", function () {
            d3.select(this)
              .attr("stroke-width", 0.5)
              .attr("stroke", "#9ca3af");
          })
          .merge(countryPaths)
          .transition()
          .duration(600)
          .attr("fill", d => {
            const iso = featureIso3(d).toUpperCase();
            const val = medalsByIso.get(iso) || 0;
            return val > 0 ? color(val) : "#f3f4f6";
          });

        countryPaths.exit().remove();

        // ---------- BAR CHART: top 10 medal countries ---------------------
        const medalsByCountry = d3
          .rollups(
            filtered,
            v => d3.sum(v, r => r.Medal_Count || 1),
            d => d.Country_Name || d.Country || d.NOC || "Unknown"
          )
          .sort((a, b) => d3.descending(a[1], b[1]))
          .slice(0, 10);

        xScale.domain([
          0,
          d3.max(medalsByCountry, d => d[1]) || 1
        ]);
        yScale.domain(medalsByCountry.map(d => d[0]));

        const bars = barG
          .selectAll("rect.bar")
          .data(medalsByCountry, d => d[0]);

        bars
          .enter()
          .append("rect")
          .attr("class", "bar")
          .attr("x", 0)
          .attr("y", d => yScale(d[0]))
          .attr("height", yScale.bandwidth())
          .attr("width", 0)
          .transition()
          .duration(600)
          .attr("width", d => xScale(d[1]));

        bars
          .transition()
          .duration(600)
          .attr("y", d => yScale(d[0]))
          .attr("height", yScale.bandwidth())
          .attr("width", d => xScale(d[1]));

        bars.exit().remove();

        const labels = barG
          .selectAll("text.bar-label")
          .data(medalsByCountry, d => d[0]);

        labels
          .enter()
          .append("text")
          .attr("class", "bar-label")
          .attr("x", d => xScale(d[1]) + 6)
          .attr(
            "y",
            d =>
              (yScale(d[0]) || 0) +
              yScale.bandwidth() / 2 +
              4
          )
          .text(d => d[1])
          .merge(labels)
          .transition()
          .duration(600)
          .attr("x", d => xScale(d[1]) + 6)
          .attr(
            "y",
            d =>
              (yScale(d[0]) || 0) +
              yScale.bandwidth() / 2 +
              4
          )
          .text(d => d[1]);

        labels.exit().remove();

        xAxisG.call(
          d3.axisBottom(xScale).ticks(5).tickSizeOuter(0)
        );
        yAxisG.call(
          d3.axisLeft(yScale).tickSizeOuter(0)
        );

        xAxisG
          .selectAll("text")
          .attr("class", "axis-text");
        yAxisG
          .selectAll("text")
          .attr("class", "axis-text");
        xAxisG.selectAll("path,line").attr("class", "axis-line");
        yAxisG.selectAll("path,line").attr("class", "axis-line");

        // ---------- GENDER SUMMARY --------------------------------------
        const genderCounts = d3
          .rollups(
            filtered,
            v => d3.sum(v, r => r.Medal_Count || 1),
            d => d.Gender || d.Sex || "Unknown"
          )
          .sort((a, b) => d3.descending(a[1], b[1]));

        const summaryText =
          (currentYear === "All"
            ? "All years combined: "
            : `Year ${currentYear}: `) +
          (genderCounts.length
            ? genderCounts
                .map(d => `${d[0]}: ${d[1]} medals`)
                .join(" · ")
            : "no data.");

        genderSummary.text(summaryText);
      }

      // Initial render
      updateAll();
    })
    .catch(err => {
      console.error("Error loading data files:", err);
    });
});
