(function () {
  "use strict";

  const CHICO = { lat: 39.7285, lon: -121.8375 };

  function escapeText(value) {
    return String(value == null ? "" : value);
  }

  function duplicateOffsets(data) {
    const groups = new Map();
    data.forEach((agency) => {
      const key = agency.lat.toFixed(5) + "," + agency.lon.toFixed(5);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(agency);
    });

    groups.forEach((group) => {
      group
        .sort((a, b) => a.agency.localeCompare(b.agency))
        .forEach((agency, index) => {
          if (group.length === 1) {
            agency.offsetX = 0;
            agency.offsetY = 0;
            return;
          }
          const angle = index * 2.399963229728653;
          const radius = 5.5 * Math.sqrt(index + 0.45);
          agency.offsetX = Math.cos(angle) * radius;
          agency.offsetY = Math.sin(angle) * radius;
        });
    });
  }

  async function loadAgencies(root) {
    if (Array.isArray(window.CHICOSOL_ALPR_DATA)) {
      return window.CHICOSOL_ALPR_DATA.map((row) => ({ ...row }));
    }
    const dataUrl = root.dataset.agenciesUrl;
    if (!dataUrl) throw new Error("Missing agencies data URL.");
    const response = await fetch(dataUrl, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not load agency data.");
    return response.json();
  }

  async function init(root) {
    const stage = root.querySelector(".cs-alpr-map__stage");
    const svgElement = root.querySelector(".cs-alpr-map__svg");
    const countElement = root.querySelector("[data-agency-count]");
    const listElement = root.querySelector("[data-agency-list]");
    const popup = root.querySelector(".cs-alpr-map__popup");
    const popupName = root.querySelector(".cs-alpr-map__popup-name");
    const popupMeta = root.querySelector(".cs-alpr-map__popup-meta");
    const popupClose = root.querySelector(".cs-alpr-map__popup-close");
    const status = root.querySelector(".cs-alpr-map__status");

    try {
      const [agencies, us] = await Promise.all([
        loadAgencies(root),
        d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
      ]);

      if (agencies.length !== 308) {
        console.warn("Expected 308 agencies; loaded", agencies.length);
      }

      countElement.textContent = agencies.length.toLocaleString();
      duplicateOffsets(agencies);

      agencies
        .slice()
        .sort((a, b) => a.agency.localeCompare(b.agency))
        .forEach((agency) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "cs-alpr-map__list-item";
          button.innerHTML =
            '<span class="cs-alpr-map__list-name"></span>' +
            '<span class="cs-alpr-map__list-meta"></span>';
          button.querySelector(".cs-alpr-map__list-name").textContent = agency.agency;
          button.querySelector(".cs-alpr-map__list-meta").textContent =
            agency.type + " · " + agency.state;
          button.addEventListener("click", () => focusAgency(agency));
          listElement.appendChild(button);
        });

      const width = 975;
      const height = 610;
      const svg = d3.select(svgElement).attr("viewBox", `0 0 ${width} ${height}`);

      const stateFeatures = topojson.feature(us, us.objects.states);
      const nationFeature = topojson.feature(us, us.objects.nation);
      const projection = d3
        .geoAlbersUsa()
        .fitExtent(
          [
            [34, 24],
            [941, 583],
          ],
          nationFeature
        );
      const path = d3.geoPath(projection);

      const mapLayer = svg.append("g").attr("class", "cs-alpr-map__map-layer");
      mapLayer
        .selectAll("path.cs-alpr-map__state")
        .data(stateFeatures.features)
        .join("path")
        .attr("class", "cs-alpr-map__state")
        .attr("d", path);

      mapLayer
        .append("path")
        .datum(nationFeature)
        .attr("class", "cs-alpr-map__nation")
        .attr("d", path);

      agencies.forEach((agency) => {
        agency.basePoint = projection([agency.lon, agency.lat]);
      });
      const chicoBase = projection([CHICO.lon, CHICO.lat]);

      const lineLayer = svg.append("g").attr("class", "cs-alpr-map__line-layer");
      const lines = lineLayer
        .selectAll("line")
        .data(agencies, (d) => d.id)
        .join("line")
        .attr("class", "cs-alpr-map__line");

      const pinLayer = svg.append("g").attr("class", "cs-alpr-map__pin-layer");
      const pins = pinLayer
        .selectAll("g.cs-alpr-map__pin")
        .data(agencies, (d) => d.id)
        .join("g")
        .attr("class", "cs-alpr-map__pin")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr(
          "aria-label",
          (d) => `${d.agency}, ${d.type}, ${d.state}`
        );

      pins.append("circle").attr("class", "cs-alpr-map__pin-hit").attr("r", 11);
      pins.append("circle").attr("class", "cs-alpr-map__pin-outer").attr("r", 5.8);
      pins.append("circle").attr("class", "cs-alpr-map__pin-inner").attr("r", 2.2);

      const chicoLayer = svg.append("g").attr("class", "cs-alpr-map__chico");
      chicoLayer.append("circle").attr("class", "cs-alpr-map__chico-outer").attr("r", 9);
      chicoLayer.append("circle").attr("class", "cs-alpr-map__chico-inner").attr("r", 4);
      chicoLayer
        .append("text")
        .attr("class", "cs-alpr-map__chico-label")
        .attr("x", 13)
        .attr("y", 4)
        .text("CHICO");

      let transform = d3.zoomIdentity;
      let activeAgency = null;

      function screenPoint(agency) {
        if (!agency.basePoint) return null;
        const p = transform.apply(agency.basePoint);
        return [p[0] + agency.offsetX, p[1] + agency.offsetY];
      }

      function renderPositions() {
        mapLayer.attr("transform", transform.toString());

        const chicoScreen = transform.apply(chicoBase);
        chicoLayer.attr("transform", `translate(${chicoScreen[0]},${chicoScreen[1]})`);

        lines
          .attr("x1", chicoScreen[0])
          .attr("y1", chicoScreen[1])
          .attr("x2", (d) => {
            const p = screenPoint(d);
            return p ? p[0] : -100;
          })
          .attr("y2", (d) => {
            const p = screenPoint(d);
            return p ? p[1] : -100;
          });

        pins.attr("transform", (d) => {
          const p = screenPoint(d);
          return p ? `translate(${p[0]},${p[1]})` : "translate(-100,-100)";
        });

        if (activeAgency) positionPopup(activeAgency);
      }

      function positionPopup(agency) {
        const p = screenPoint(agency);
        if (!p || window.matchMedia("(max-width: 680px)").matches) return;

        const svgRect = svgElement.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const scaleX = svgRect.width / width;
        const scaleY = svgRect.height / height;
        const pinX = svgRect.left - stageRect.left + p[0] * scaleX;
        const pinY = svgRect.top - stageRect.top + p[1] * scaleY;

        const popupWidth = popup.offsetWidth || 285;
        const popupHeight = popup.offsetHeight || 90;
        let left = pinX + 14;
        let top = pinY - popupHeight / 2;

        if (left + popupWidth > stage.clientWidth - 10) {
          left = pinX - popupWidth - 14;
        }
        left = Math.max(10, left);
        top = Math.max(10, Math.min(stage.clientHeight - popupHeight - 10, top));

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.right = "auto";
        popup.style.bottom = "auto";
      }

      function closePopup() {
        activeAgency = null;
        popup.hidden = true;
        pins.classed("is-active", false);
        lines.classed("is-active", false);
      }

      function openPopup(agency) {
        activeAgency = agency;
        popupName.textContent = escapeText(agency.agency);
        popupMeta.textContent = `${agency.type} · ${agency.state}`;
        popup.hidden = false;
        pins.classed("is-active", (d) => d.id === agency.id);
        lines.classed("is-active", (d) => d.id === agency.id);
        status.textContent = `${agency.agency}, ${agency.type}, ${agency.state}`;
        requestAnimationFrame(() => positionPopup(agency));
      }

      function focusAgency(agency) {
        const targetScale = Math.max(transform.k, 4.5);
        const point = agency.basePoint;
        const next = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(targetScale)
          .translate(-point[0], -point[1]);

        svg
          .transition()
          .duration(450)
          .call(zoom.transform, next)
          .on("end", () => {
            openPopup(agency);
            const node = pins.filter((d) => d.id === agency.id).node();
            if (node) node.focus();
          });
      }

      pins
        .on("click", function (event, agency) {
          event.stopPropagation();
          openPopup(agency);
        })
        .on("keydown", function (event, agency) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPopup(agency);
          } else if (event.key === "Escape") {
            closePopup();
          }
        });

      popupClose.addEventListener("click", closePopup);
      svg.on("click", closePopup);

      const zoom = d3
        .zoom()
        .scaleExtent([1, 12])
        .on("zoom", (event) => {
          transform = event.transform;
          renderPositions();
        });

      svg.call(zoom).on("dblclick.zoom", null);

      root.querySelector('[data-map-action="zoom-in"]').addEventListener("click", () => {
        svg.transition().duration(180).call(zoom.scaleBy, 1.45);
      });
      root.querySelector('[data-map-action="zoom-out"]').addEventListener("click", () => {
        svg.transition().duration(180).call(zoom.scaleBy, 1 / 1.45);
      });
      root.querySelector('[data-map-action="reset"]').addEventListener("click", () => {
        closePopup();
        svg.transition().duration(280).call(zoom.transform, d3.zoomIdentity);
      });

      window.addEventListener("resize", () => {
        if (activeAgency) requestAnimationFrame(() => positionPopup(activeAgency));
      });

      renderPositions();
      status.textContent = `${agencies.length} agencies loaded.`;
    } catch (error) {
      console.error(error);
      stage.innerHTML =
        '<p class="cs-alpr-map__error">The map could not load. Check that D3, TopoJSON and the agency data file are reachable.</p>';
    }
  }

  function boot() {
    document.querySelectorAll(".cs-alpr-map").forEach((root) => {
      if (!root.dataset.initialized) {
        root.dataset.initialized = "true";
        init(root);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();