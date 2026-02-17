# RSVP Speed Reader

A lightweight web app that lets you upload an EPUB and read using a Rapid Serial Visual Presentation (RSVP) flow: one word at a time at your chosen words-per-minute pace.

## Features

- Upload `.epub` files locally in the browser.
- Parse and combine text from EPUB spine documents.
- Pick a starting word index.
- Choose your reading speed (WPM).
- Start, pause, and reset playback.

## Run locally (no Docker)

No build step is required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in your browser.

## Run with Docker

Build the image:

```bash
docker build -t rsvp-speed-reader .
```

Run the container:

```bash
docker run --rm -p 8080:8080 rsvp-speed-reader
```

Open `http://localhost:8080` in your browser.
