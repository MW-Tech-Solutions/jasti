JASTI Frontend Deployment

1. Upload the contents of this folder to your web root and unzip them.
2. Open the `.env` file in the same folder.
3. Set `VITE_API_URL` to the correct backend API URL for your server.
   Example:
   VITE_API_URL=https://your-domain.com/api
4. Do not edit the built JavaScript files for API changes.
5. If your frontend is served from a subfolder instead of the domain root, set `VITE_APP_BASE_PATH` before building a new package.

This package reads `VITE_API_URL` at runtime through `runtime-config.php` so API changes can be made from `.env` after deployment.
