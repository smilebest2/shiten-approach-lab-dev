# Osaka street data — OpenStreetMap

© OpenStreetMap contributors.

This directory contains a geographically limited extract and a transformed database derived from OpenStreetMap, distributed under the [Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

[OSM copyright and contributors](https://www.openstreetmap.org/copyright).

The derivative database is provided in its editable form as the JSON chunks and manifest in this directory. The complete downloaded source extract is also available as [source.json.gz](source.json.gz). The conversion process is published in [prepare-osaka.mjs](../prepare-osaka.mjs). The query is preserved in [query.txt](query.txt). No raw data or transformed database is behind a paywall.

Source: https://overpass-api.de/api/interpreter ; OSM snapshot 2026-09-19T00:45:16Z. Extent: latitude 34.661–34.708, longitude 135.491–135.510. This is not all of Osaka.

Changes: coordinates projected to a local metre grid, rounded to 1cm; divided into 250m chunks; incomplete and underground geometry filtered; polygon holes preserved where supplied; height from `height`, otherwise `building:levels × 3.2m`, otherwise an explicitly estimated 12m. Height display capped at 350m. Road widths and generic lane/facade patterns are approximate. Terrain is a flat datum. The virtual travel path follows OSM nodes of Midosuji and permits both directions irrespective of traffic restrictions.

The attribution applies to geographic data, not the application code. Three.js has its separate MIT licence. OpenStreetMap and its contributors do not endorse this project. Data may be incomplete or outdated. Do not use this prototype for navigation.
