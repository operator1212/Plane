# NF-9 Serac

An original concept design document for a fictional next-generation fighter aircraft.

- `index.html` is the document. Open it in a browser; it loads fonts from Google Fonts and images from `img/`.
- `img/` holds the render plates.
- `source/` holds the pipeline that produced them. `geometry.js` defines the aircraft's outer mould line, `details.js` defines panel lines and markings, `scene.js` renders the plates with three.js in headless Chromium (`npm install && node run.js out hero low rear canopy plan`), and `build.js` regenerates the orthographic drawings and inlines them into `doc.template.html` to produce `index.html`.

Northfell Aerosystems and the NF-9 Serac are fictional.
