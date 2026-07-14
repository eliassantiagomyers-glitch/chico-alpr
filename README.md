# ChicoSol ALPR Sharing Map

This package contains a responsive, zoomable U.S. map for the 308 agencies in the uploaded
**Detection sharing: Sharing** report. It includes all 22 federal entries.

## Recommended WordPress installation

1. In WordPress, go to **Plugins → Add New → Upload Plugin**.
2. Upload `chicosol-alpr-map-plugin.zip`.
3. Activate **ChicoSol ALPR Sharing Map**.
4. Add this shortcode to the story or page:

   `[chicosol_alpr_map]`

The shortcode loads the local agency data plus D3, TopoJSON and the U.S. state outline from jsDelivr.

## Other files

- `standalone.html` — open in a browser for a preview.
- `wordpress-custom-html-snippet.html` — an alternative for administrators whose WordPress setup allows scripts in Custom HTML blocks.
- `assets/agencies.json` — all 308 map records; edit or replace this file when the dataset changes.
- `agency-location-audit.xlsx` and `.csv` — row-by-row source-to-map location audit.
- `validation-report.txt` — automated inclusion and count checks.

## Map behavior

- Every agency is an individual keyboard- and touch-accessible pin; there is no clustering.
- Every pin has a light dotted line back to Chico.
- Pins that share a city centroid are separated in a small spiral so each remains clickable.
- Selecting a pin opens a minimal popup: agency name, type and state.
- Zoom, pan, reset and mobile layouts are included.
- The complete list beneath the map provides a second way to confirm that all agencies are present.

## Location method

The source report contains agency names and states but no street addresses.

- Municipal agencies: city named in the agency title.
- County agencies: county-seat/headquarters city.
- State, federal, regional, campus, transit, tribal and task-force accounts: identified or best-fit headquarters/office city.
- Coordinates: 2024 U.S. Census Gazetteer place centroids.

The audit workbook marks manual special-agency mappings as **Medium** confidence. These are the rows most worth an editorial review before publication, because the vendor account name sometimes identifies a broad organization rather than a particular field office.