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

## Auto-publish to Docker Hub on push to `main`

A GitHub Actions workflow is included at `.github/workflows/docker-publish.yml`. It builds and pushes your image when code is pushed to `main`.

### 1) Create a Docker Hub repository

Create a repo in Docker Hub, for example:

- `DOCKERHUB_USERNAME/rsvp-speed-reader`

### 2) Create a Docker Hub access token

In Docker Hub:

- Go to **Account Settings** → **Personal access tokens**
- Create a token with write permissions

### 3) Add GitHub repository secrets

In GitHub:

- Go to **Settings** → **Secrets and variables** → **Actions**
- Add:
  - `DOCKERHUB_USERNAME` = your Docker Hub username
  - `DOCKERHUB_TOKEN` = your Docker Hub access token

### 4) Push to `main`

When a commit lands on `main`, GitHub Actions will:

- log in to Docker Hub
- build the image from your `Dockerfile`
- push tags:
  - `latest`
  - commit SHA tag (for immutable deploys)

You can also trigger the workflow manually from the **Actions** tab via `workflow_dispatch`.
