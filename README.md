# RSVP Speed Reader

A lightweight web app that lets you upload an EPUB and read using a Rapid Serial Visual Presentation (RSVP) flow: one word at a time at your chosen words-per-minute pace.

## Features

- Upload `.epub` files locally in the browser.
- Parse and combine text from EPUB spine documents.
- Pick a starting word index.
- Choose your reading speed (WPM).
- Start, pause, and reset playback.

## EPUB parsing notes

- Chapter content is extracted from each spine document's rendered body text.
- The parser reads `document.body.innerText` (falling back to `textContent`) so block-level boundaries are preserved.
- This avoids merged boundaries such as a heading and first paragraph being joined into one token (for example `Chapter1FirstWord`).

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

Or use the included sample Compose file:

```bash
cp docker-compose.sample.yml docker-compose.yml
docker compose up --build
```

Open `http://localhost:8080` in your browser.

### Pull and run from Docker Hub

After your GitHub Actions publish job has pushed the image, pull it with:

```bash
docker pull <dockerhub-username>/rsvp-speed-reader:latest
```

Run the pulled image:

```bash
docker run --rm -p 8080:8080 <dockerhub-username>/rsvp-speed-reader:latest
```

If you want a specific immutable version, replace `latest` with the commit SHA tag shown in the workflow output.

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
- Add secrets:
  - `DOCKERHUB_USERNAME` = your Docker Hub username
  - `DOCKERHUB_TOKEN` = your Docker Hub access token
- (Optional) Add repository variable:
  - `DOCKERHUB_REPOSITORY` = full Docker Hub repo path, e.g. `your-org/your-repo`
  - If omitted, workflow defaults to `${DOCKERHUB_USERNAME}/rsvp-speed-reader`

### 4) Push to `main`

When a commit lands on `main`, GitHub Actions will:

- log in to Docker Hub
- build the image from your `Dockerfile`
- push tags:
  - `latest`
  - commit SHA tag (for immutable deploys)

You can also trigger the workflow manually from the **Actions** tab via `workflow_dispatch`.


### Troubleshooting: workflow is green but image is missing

If the action completes successfully but you cannot find your image:

- Check the **Build and publish Docker image** run summary. It now lists the exact tags pushed.
- Verify the repository path used by the workflow:
  - default: `${DOCKERHUB_USERNAME}/rsvp-speed-reader`
  - override with `DOCKERHUB_REPOSITORY` if your Docker Hub repo has a different name/org
- Ensure you are checking the same Docker Hub account/org as `DOCKERHUB_USERNAME` (or `DOCKERHUB_REPOSITORY`).
- Confirm the workflow ran from `main` (or manual dispatch) in the repository where secrets are configured.
