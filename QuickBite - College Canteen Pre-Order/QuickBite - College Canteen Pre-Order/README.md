## QuickBite - College Canteen Pre-Order

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

To run the devserver:
```
npm install
npm run dev
```

## Firebase auth (dev)
If you see "Firebase: Error (auth/unauthorized-domain)" when signing in, add your dev host to the Firebase project's **Authorized domains**:

1. Open Firebase Console → Authentication → Sign-in method → Authorized domains
2. Add `localhost`, `127.0.0.1`, any LAN IP you use (e.g. `192.168.1.10`) or any tunnel hostname (e.g. `abcd.ngrok.io`)

After adding the domain, restart the dev server and try signing in again.

**Run on LAN / Network**
- Start the dev server bound to the network interface: `npm run dev:lan` (this runs `vite --host`).
- Find your machine's LAN IP (Windows: `ipconfig` → look for IPv4 address) and open `http://<LAN-IP>:5173` (or your configured port). If you used a different port (e.g., `5176`), use that port in the URL.
- Make sure your OS firewall allows incoming connections on the dev port (e.g. 5173/5176) so other devices on the network can reach it.

**Network hosts note:** If you access the app via your LAN IP (e.g. `http://192.168.1.5:5176`) Firebase's **Authorized domains** should contain the host only (e.g. `192.168.1.5` — do **not** add the port). Additionally, add the full origin (`http://192.168.1.5:5176`) and the redirect URI (`http://192.168.1.5:5176/__/auth/handler`) to your Google OAuth client in the Google Cloud Console under **APIs & Services → Credentials → OAuth 2.0 Client IDs**.
