# Python scraper sidecar — FastAPI + Playwright Chromium
# Build context is main-project/server/python-scraper/

FROM python:3.11-slim

WORKDIR /app

# Install OS deps for Playwright Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Playwright's managed Chromium binary into the image
RUN playwright install chromium

# Copy app source
COPY . .

EXPOSE 8001

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
