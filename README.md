# Amsterdam 2030 Map

A 3D map viewer for Amsterdam using 3D Tiles and React.

## Prerequisites

- Node.js (v18 or later recommended)
- Python 3.x

## Setup

1.  **Install Dependencies**

    ```bash
    npm install
    ```

2.  **Configure Environment Variables**

    Create a `.env` file in the root directory with the following variables. You will need Cloudflare R2 credentials to upload the map tiles.

    ```dotenv
    # URL where tiles will be hosted (e.g. your R2 bucket public URL)
    VITE_TILE_HOST=https://pub-b7e9f888ec4543df94637d8bae9ce3c5.r2.dev

    # Cloudflare R2 Credentials (required for setup script to upload tiles)
    R2_ACCOUNT_ID=your_account_id
    R2_ACCESS_KEY_ID=your_access_key_id
    R2_SECRET_ACCESS_KEY=your_secret_access_key
    ```

3.  **Run Setup Script**

    This script will download the necessary map data (Basemap, LOD 2.2, LOD 1.2/1.3) and upload it to your configured R2 bucket.

    ```bash
    python3 scripts/setup.py
    ```

    *Note: This script checks for the required environment variables before proceeding.*

## Development

To start the development server:

```bash
npm run dev
```

## Build

To build for production:

```bash
npm run build
```
