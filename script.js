// Task 1: Load olympics_clean.csv + world.geojson
// and build an interactive map + bar chart + gender summary.

document.addEventListener("DOMContentLoaded", () => {
  console.log("Olympics visualization site loaded.");

  if (!window.d3) {
    console.error("D3 library (d3.v7) is not loaded.");
    return;
  }

  Promise.all([
    d3.csv("data/olympics_clean.csv"),
    d3.json("data/world.geojson")
  ])
    .then(([data, world]) => {
      // ---- 1. Clean / parse data -----------------------------------------
      data.forEach(d => {
        d.Year = +d.Year;
        if (d.Population) d.Population = +d.Population;
        if (d["GDP per Capita"]) d["GDP per Capita"] = +d["GDP per Capita"];
      });

      console.log("Loaded olympics_clean.csv rows:", data.length);
      console.log("Sample row:", data[0]);
      console.log(
        "World features:",
        world.features ? world.features.length : "no features"
      );

      const years = Array.from(new Set(data.map(d => d.Year))).sort(
        (a, b) => a - b
      );
      let currentYear = years[years.length - 1]; // latest year

      // Helper: how many medals does one row represent?
      function medalWeight(d) {
        const tm =
          d.Total_Medals ||
          d.Medals ||
          d.MedalCount ||
          d.MedalCountTotal;
        return tm ? +tm : 1; // fallback: each row = 1 medal
      }

      // Helper: normalize Olympic codes to ISO-3 used in world.geojson
      function normalizedIso(d) {
        const raw = (d.ISO_Code || d.NOC || d.Country || "").toUpperCase();

        const overrides = {
          URS: "RUS",
          EUN: "RUS",
          GDR: "DEU",
          FRG: "DEU",
          YUG: "SRB",
          TCH: "CZE",
          BOH: "CZE",
          RUS: "RUS",
          GER: "DEU"
        };

        return overrides[raw] || raw;
      }

      // ---- 2. Controls (Year dropdown) -----------------------------------
      const mapContainer = d3.select("#world-map");

      const controls = mapContainer
        .insert("div", ":first-child")
        .attr("class", "viz-controls");

      controls
        .append("label")
        .attr("for", "year-select")
        .text("Year:");

      const yearSelect = controls
        .append("select")
        .attr("id", "year-select")
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

      // ---- 3. World map setup --------------------------------------------
      const mapWidth = 750;
      const mapHeight = 380;

      const svgMap = mapContainer
        .append("svg")
        .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
        .style("width", "100%")
        .style("height", "100%");

      const projection = d3
        .geoNaturalEarth1()
        .fitSize([mapWidth, mapHeight], world);

      const path = d3.geoPath(projection);

      const countries = world.features || world.geometries || [];
      const mapG = svgMap.append("g");

      // ---- 4. Bar chart ("Top Countries Over Time") ----------------------
      const barContainer = d3.select("#bar-race");
      const barWidth = 750;
      const barHeight = 380;

      const svgBar = barContainer
        .append("svg")
        .attr("viewBox", `0 0 ${barWidth} ${barHeight}`)
        .style("width", "100%")
        .style("height", "100%");

      const barMargin = { top: 40, right: 40, bottom: 40, left: 160 };
      const barInnerWidth = barWidth - barMargin.left - barMargin.right;
      const barInnerHeight = barHeight - barMargin.top - barMargin.bottom;

      const barG = svgBar
        .append("g")
        .attr("transform", `translate(${barMargin.left},${barMargin.top})`);

      const xScale = d3.scaleLinear().range([0, barInnerWidth]);
      const yScale = d3.scaleBand().range([0, barInnerHeight]).padding(0.2);

      const xAxisG = barG
        .append("g")
        .attr("transform", `translate(0,${barInnerHeight})`)
        .attr("class", "axis axis-x");

      const yAxisG = barG.append("g").attr("class", "axis axis-y");

      svgBar
        .append("text")
        .attr("x", barWidth / 2)
        .attr("y", 24)
        .attr("text-anchor", "middle")
        .attr("fill", "#e5e7eb")
        .attr("font-size", "16px")
        .attr("font-weight", "600")
        .text("Top Countries by Medal Count");

      // ---- 5. Gender summary block ---------------------------------------
      const genderContainer = d3.select("#gender-dashboard");
      const genderSummary = genderContainer
        .append("div")
        .attr("class", "gender-summary");

      // ---- 6. Helper to get filtered data --------------------------------
      function computeFilteredData() {
        if (currentYear === "All") {
          return data;
        }
        return data.filter(d => d.Year === currentYear);
      }

      // ---- 7. Main update function (map + bars + gender) -----------------
      function updateAll() {
        const filtered = computeFilteredData();

        // If there is no data for this year / range, show a friendly message
        if (!filtered.length) {
          mapG
            .selectAll("path.country")
            .transition()
            .duration(300)
            .attr("fill", "#050814");

          barG.selectAll("rect.bar").remove();
          barG.selectAll("text.bar-label").remove();
          xAxisG.call(d3.axisBottom(xScale).ticks(0));
          yAxisG.call(d3.axisLeft(yScale).tickValues([]));

          genderSummary.text(
            currentYear === "All"
              ? "No data available in this dataset for the selected range."
              : `Year ${currentYear}: no data available in this dataset.`
          );

          return;
        }

        // --- map aggregation: medals per ISO code (or NOC / Country fallback)
        const medalsByIso = d3.rollup(
          filtered,
          v => d3.sum(v, medalWeight),
          d => normalizedIso(d)
        );

        const maxMedals = d3.max(Array.from(medalsByIso.values())) || 0;

        const color = d3
          .scaleLinear()
          .domain([0, maxMedals || 1])
          .range(["#e5f0ff", "#1d4ed8"]);

        const countryPaths = mapG
          .selectAll("path.country")
          .data(
            countries,
            d => d.properties && (d.properties.ISO_A3 || d.id || d.properties.name)
          );

        countryPaths
          .enter()
          .append("path")
          .attr("class", "country")
          .attr("d", path)
          .attr("stroke", "#d1d5db")
          .attr("stroke-width", 0.6)
          .attr("fill", "#e5f0ff")
          .on("mouseover", function () {
            d3.select(this)
              .attr("stroke", "#111827")
              .attr("stroke-width", 1.2);
          })
          .on("mouseout", function () {
            d3.select(this)
              .attr("stroke", "#d1d5db")
              .attr("stroke-width", 0.6);
          })
          .merge(countryPaths)
          .transition()
          .duration(600)
          .attr("fill", d => {
            const iso =
              (d.properties &&
                (d.properties.ISO_A3 || d.id || d.properties.name)) ||
              "";
            const val = medalsByIso.get(iso) || 0;
            return color(val);
          });

        countryPaths.exit().remove();

        // --- bar chart: top 10 countries in this year --------------------
        const medalsByCountry = d3
          .rollups(
            filtered,
            v => d3.sum(v, medalWeight),
            d => d.Country_Name || d.Country
          )
          .filter(d => d[0]) // drop blank names
          .sort((a, b) => d3.descending(a[1], b[1]))
          .slice(0, 10);

        // quick sanity check in console
        console.log(`Top countries for ${currentYear}:`, medalsByCountry);

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
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", "#38bdf8")
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
          .attr("fill", "#e5e7eb")
          .attr("font-size", "11px")
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
          d3.axisBottom(xScale).ticks(4).tickSizeOuter(0)
        );
        yAxisG.call(
          d3.axisLeft(yScale).tickSizeOuter(0)
        );

        xAxisG
          .selectAll("text")
          .attr("fill", "#9ca3af")
          .attr("font-size", "10px");
        yAxisG
          .selectAll("text")
          .attr("fill", "#e5e7eb")
          .attr("font-size", "11px");
        xAxisG
          .selectAll("path,line")
          .attr("stroke", "#4b5563");
        yAxisG
          .selectAll("path,line")
          .attr("stroke", "#4b5563");

        // --- gender summary ----------------------------------------------
        const genderCounts = d3
          .rollups(
            filtered,
            v => d3.sum(v, medalWeight),
            d => d.Gender || d.Sex
          )
          .sort((a, b) =>
            d3.descending(a[1], b[1])
          );

        const summaryText =
          (currentYear === "All"
            ? "All years combined: "
            : `Year ${currentYear}: `) +
          (genderCounts.length
            ? genderCounts
                .map(d => `${d[0]}: ${d[1]} medals`)
                .join(" · ")
            : "no data");

        genderSummary.text(summaryText);
      }

      // initial render
      updateAll();
    })
    .catch(err => {
      console.error("Error loading data files:", err);
    });
});
