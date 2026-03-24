# WordGuess - Deployment Guide 🚀

Follow these steps to make your game live and accessible to anyone, even when your laptop is turned off!

## 1. Hosting on Render.com (Recommended Free Choice)

Render is great for this project because it support WebSockets (Socket.io) out of the box.

### Step-by-Step Instructions:
1. **Create a GitHub Repository**:
   - Go to [GitHub.com](https://github.com) and create a new private or public repository.
   - Upload all your files (except `node_modules`, which is blocked by the `.gitignore` I added).

2. **Connect to Render**:
   - Go to [Render.com](https://render.com) and sign up with your GitHub account.
   - Click **New +** and select **Web Service**.
   - Connect the repository you just created.

3. **Configure Settings**:
   - **Name**: `wordguess-game` (or any name you like).
   - **Environment**: `Node`.
   - **Build Command**: `npm install`.
   - **Start Command**: `npm start`.

4. **Select Free Tier**:
   - Choose the **Free** instance type.

5. **Deploy**:
   - Click **Create Web Service**. 
   - Wait 1-2 minutes for the "Live" status. Your website will be available at something like `https://wordguess-game.onrender.com`.

## 2. Important Notes
- **Cold Starts**: On the free tier, the first visit after a long break might take 30 seconds to load. This is normal!
- **Domain**: You can use the free `.onrender.com` address forever. If you want a custom domain (like `mygame.com`), you can add it in the Render settings later.
- **Scaling**: Your current code is optimized to handle up to 1000 players at once!

Enjoy your global launch! 🎮
