// Task 1: Load olympics_clean.csv + world.geojson + ISO_Codes.csv
// and build an interactive map + bar chart + gender summary.

document.addEventListener("DOMContentLoaded", () => {
  console.log("Olympics visualization site loaded.");

  if (!window.d3) {
    console.error("D3 library (d3.v7) is not loaded.");
    return;
  }

  Promise.all([
    d3.csv("data/olympics_clean.csv"),
    d3.json("data/world.geojson"),
    d3.csv("data/ISO_Codes.csv")
  ])
    .then(([data, world, isoTable]) => {
      // --------------------------------------------------------------
      // 0. Build Country -> ISO numeric lookup from ISO_Codes.csv
      // --------------------------------------------------------------
      const countryToIsoId = new Map();

      isoTable.forEach(row => {
        const name = (row.country || "").trim();
        const isoNumRaw = row.iso;
        const isoNum = isoNumRaw !== undefined ? +isoNumRaw : NaN;

        if (!name || Number.isNaN(isoNum)) return;

        // Store ISO numeric as STRING because world.geojson ids are like "36", "840"
        countryToIsoId.set(name, String(isoNum));
      });

      console.log("Sample ISO lookup entries:",
        Array.from(countryToIsoId.entries()).slice(0, 10)
      );

      // --------------------------------------------------------------
      // 1. Clean / parse olympics data and attach isoId
      // --------------------------------------------------------------
      const missingIsoCountries = new Set();

      data.forEach(d => {
        d.Year = +d.Year;
        if (d.Population) d.Population = +d.Population;
        if (d["GDP per Capita"]) d["GDP per Capita"] = +d["GDP per Capita"];

        const countryName = (d.Country || d.country || "").trim();
        d.countryName = countryName;

        const isoId = countryToIsoId.get(countryName);
        if (!isoId) {
          missingIsoCountries.add(countryName);
          d.isoId = null;
        } else {
          d.isoId = isoId; // string like "36", "840"
        }
      });

      console.log("Loaded olympics_clean.csv rows:", data.length);
      console.log("Sample olympics row:", data[0]);
      console.log(
        "Countries with no ISO match (first 15):",
        Array.from(missingIsoCountries).slice(0, 15)
      );

      // --------------------------------------------------------------
      // 2. Basic year handling / controls
      // --------------------------------------------------------------
      const years = Array.from(new Set(data.map(d => d.Year))).sort(
        (a, b) => a - b
      );
      let currentYear = years[years.length - 1]; // latest year

      function computeFilteredData() {
        if (currentYear === "All") return data;
        return data.filter(d => d.Year === currentYear);
      }

      // --------------------------------------------------------------
      // 3. Map container + controls
      // --------------------------------------------------------------
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

      // --------------------------------------------------------------
      // 4. World map SVG + projection
      // --------------------------------------------------------------
      const mapWidth = 750;
      const mapHeight = 380;

      const svgMap = mapContainer
        .append("svg")
        .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
        .classed("world-map-svg", true);

      const projection = d3
        .geoNaturalEarth1()
        .fitSize([mapWidth * 0.8, mapHeight * 0.7], world);

      const path = d3.geoPath(projection);

      const countries = world.features || world.geometries || [];
      console.log(
        "World features count:",
        countries.length,
        "Sample feature:",
        countries[0] && {
          id: countries[0].id,
          name:
            countries[0].properties &&
            (countries[0].properties.name ||
              countries[0].properties.ADMIN ||
              countries[0].properties.country)
        }
      );

      const mapG = svgMap.append("g");

      // --------------------------------------------------------------
      // 5. Bar chart setup ("Top Countries Over Time")
      // --------------------------------------------------------------
      const barContainer = d3.select("#bar-race");
      const barWidth = 750;
      const barHeight = 380;

      const svgBar = barContainer
        .append("svg")
        .attr("viewBox", `0 0 ${barWidth} ${barHeight}`)
        .classed("bar-chart-svg", true);

      const barMargin = { top: 40, right: 40, bottom: 50, left: 150 };
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
        .attr("y", 24)
        .attr("text-anchor", "middle")
        .attr("class", "viz-title-small")
        .text("Top Countries by Medal Count");

      // --------------------------------------------------------------
      // 6. Gender summary block
      // --------------------------------------------------------------
      const genderContainer = d3.select("#gender-dashboard");
      const genderSummary = genderContainer
        .append("div")
        .attr("class", "gender-summary");

      // --------------------------------------------------------------
      // 7. Main update function (map + bars + gender)
      // --------------------------------------------------------------
      function updateAll() {
        const filtered = computeFilteredData();

        // Filter to rows that have an isoId we can join on
        const filteredWithIso = filtered.filter(d => d.isoId);

        // ----- 7a. Build medalsById: isoId -> count ------------------
        const medalsById = d3.rollup(
          filteredWithIso,
          v => v.length,
          d => d.isoId
        );

        const maxMedals = d3.max(medalsById.values()) || 0;

        const color =
          maxMedals > 0
            ? d3
                .scaleLinear()
                .domain([0, maxMedals])
                .range(["#e5f0ff", "#2563eb"])
            : () => "#e5f0ff";

        // ----- 7b. Draw / update world map ---------------------------
        const countryPaths = mapG
          .selectAll("path.country")
          .data(countries, d => d.id);

        const countryEnter = countryPaths
          .enter()
          .append("path")
          .attr("class", "country")
          .attr("d", path)
          .attr("stroke", "#b0c4de")
          .attr("stroke-width", 0.6)
          .on("mouseover", function () {
            d3.select(this)
              .attr("stroke", "#f97316")
              .attr("stroke-width", 1.1);
          })
          .on("mouseout", function () {
            d3.select(this)
              .attr("stroke", "#b0c4de")
              .attr("stroke-width", 0.6);
          });

        countryEnter
          .merge(countryPaths)
          .transition()
          .duration(600)
          .attr("fill", d => {
            // world.geojson id is numeric string like "36", "840"
            const key = String(d.id);
            const val = medalsById.get(key) || 0;
            return color(val);
          });

        countryPaths.exit().remove();

        // ----- 7c. Bar chart: top 10 countries -----------------------
        const medalsByCountry = d3
          .rollups(
            filtered,
            v => v.length,
            d => d.countryName || d.Country
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
          .attr("class", "axis-label");
        yAxisG
          .selectAll("text")
          .attr("class", "axis-label");
        xAxisG
          .selectAll("path,line")
          .attr("class", "axis-line");
        yAxisG
          .selectAll("path,line")
          .attr("class", "axis-line");

        // ----- 7d. Gender summary -----------------------------------
        const genderCounts = d3
          .rollups(
            filtered,
            v => v.length,
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

      // Initial render
      updateAll();
    })
    .catch(err => {
      console.error("Error loading data files:", err);
    });
});
