<div align="center">
  <img src="https://img.shields.io/badge/Lumynati-F472B6?style=for-the-badge&logo=react&logoColor=white" alt="Lumynati Banner" />
  <h1>✨ Lumynati ✨</h1>
  <p><strong>A modern, glassmorphic, real-time drawing & guessing game!</strong></p>
  
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
  [![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)](#)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
</div>

<br />

Welcome to **Lumynati**, a beautiful and highly customizable real-time drawing game built for endless fun with your friends. Whether you want a relaxed Pictionary experience or absolute chaos, Lumynati has the perfect mode for you!

**Play Now:** [https://hoverboard-game.onrender.com/](https://hoverboard-game.onrender.com/)

## 🌟 Features

### 🎨 The Ultimate Drawing Experience
- **Liquid Glass Design:** Built entirely on a premium, responsive glassmorphic UI that adapts perfectly from mobile devices to ultrawide desktop monitors.
- **Mobile First "Instagram" Layout:** A brand new immersive mobile experience! Featuring a bottom navigation bar, smooth slide-up glassmorphism bottom sheets for chat and settings, and vertical pop-up emoji reactions—all designed so nothing obstructs your canvas.
- **Smart Drawing Tools:** Features a true BFS (Breadth-First Search) Flood Fill algorithm to perfectly fill your shapes, and a rock-solid Undo/Redo stack that saves your strokes perfectly.
- **Hoverboard Pixel Grid:** A completely seamless, lag-free CSS grid drawing board where you paint by hovering (or swiping on mobile!). Don't like pixels? Switch to the **Plain White Canvas** in the room settings.
- **Emojis & Reactions:** React to drawings in real-time with floating emojis. Use the Custom Emoji panel to swap out your favorites from a massive emoji arsenal!
- **Fireworks!** Watch beautiful confetti explode across your screen when you correctly guess the word.

### ⚙️ Unmatched Customizability
When creating a room, the host has ultimate control:
- **Custom Draw Mode:** Sick of random words? Toggle this on, and the artist can type whatever they want to draw instead!
- **Word Categories:** Choose from 10+ built-in categories or input your own comma-separated custom words. 
- **Word Repetition:** Toggle whether words can repeat or if they should be filtered out once guessed.
- **Penalty Mode:** Toggle *Negative Points* to punish players who spam the chat with incorrect guesses!
- **Chaos Mutators:**
  - 🔄 **Symmetry Mode:** Everything you draw is perfectly mirrored across the canvas.
  - 🙈 **Blindfold Mode:** You have 5 seconds to look at your drawing before the canvas turns invisible!
  - 🙃 **Upside Down Mode:** The canvas flips 180 degrees. Good luck coordinating your mouse!

### 💡 Smart Game Logic
- **Fuzzy Matching:** Don't lose your mind over spaces. "icecream" matches "ice cream". We strip out all the annoying formatting to make sure your right guesses actually count.
- **Close Guess Detection:** If you are just a typo away, the chat will subtly let you know you are *very close*.
- **Spectator Mode:** Join the game as a passive observer. Watch the art, chat with the players, but stay out of the drawing rotation!
- **Bulletproof Reconnection:** Accidentally closed the tab? Lumynati holds your spot and score for up to 60 seconds so you can seamlessly rejoin your match, even if the room is technically "full"!

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Dishu223/Hoverboard-Project.git
   cd Hoverboard-Project
   ```

2. **Start the Backend Server:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The backend will run on `http://localhost:3001` (or your configured `PORT`).

3. **Start the Frontend App:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   The frontend will spin up using Vite. Click the local link to start playing!

---

## 🛠️ Built With
- **Frontend:** React, Vite, CSS Modules, Canvas-Confetti, Lucide-React
- **Backend:** Node.js, Express, Socket.io
- **Design Philosophy:** `#UI/UX Pro Max` (Dark mode ready, minimal, elegant typography, fluid transitions, mobile-first bottom nav)

---

<div align="center">
  <p>Made with ❤️ for endless game nights.</p>
</div>
