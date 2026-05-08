# Python scraper sidecar — FastAPI + Playwright Chromium
# Build context is main-project/server/python-scraper/

FROM python:3.11-slim

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Playwright's managed Chromium + all its OS dependencies.
# --with-deps handles libasound2, libnss3, libgtk-3-0, etc. automatically
# and is Debian-version-aware (avoids libasound2 vs libasound2t64 mismatch).
RUN playwright install --with-deps chromium

# Copy app source
COPY . .

EXPOSE 8001

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
