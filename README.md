🌈 Interactive Light-Grid Canvas
An immersive, interactive grid where your mouse movement creates vibrant trails of light. This project has evolved from a simple hoverboard into a customizable visualizer with dynamic color palettes, adjustable grid density, and persistence controls.

<img width="1603" height="872" alt="image" src="https://github.com/user-attachments/assets/1e5c06f5-15fd-4d5b-b8a1-5a49435dbffc" />

🚀 Features
The latest version includes a comprehensive control header to customize your experience in real-time:

Dynamic Palettes: Choose between pre-set color themes like Neon, Ocean, and Fire (shown in the preview) to change the mood of the canvas instantly.

Draw Modes:
  Draw: Add colors to the grid.

  Overwrite: Replace existing colors with new ones from the current palette.

  Rainbow: A special mode that cycles through the full spectrum.

  Precision Grid Control: Adjust the Grid Size (up to 2000 squares) via a slider to change the resolution of your "digital canvas."

  Trail Persistence: Use the Trail slider to determine how long the colors stay lit after your mouse leaves the square (currently set to 2.0s in the preview).

  Interaction Modes: Toggle Click Mode for manual placement or use the default hover interaction for fluid movement.

  Instant Reset: A dedicated Clear button to wipe the canvas clean.

🛠️ Installation & Usage
Download the Files: Copy index.html, style.css, and script.js into a single project folder.

Launch with VS Code:

Open the folder in VS Code.

Right-click index.html and select Open with Live Server (or use the Show Preview command).

Interact: Move your mouse over the grid to start generating light trails.

🎨 Customization
You can still tweak the core settings directly in script.js:

Changing the Grid
Modify the squares variable to set the default density:

JavaScript
const squares = 2000; // Adjust for more or fewer blocks
Adding Custom Palettes
Update the colors array with hex codes from your favorite tools like Coolors:

JavaScript
const colors = ['#FF5733', '#C70039', '#900C3F', '#581845'];
📅 Roadmap
[x] Glow Effect & Neon Aesthetics

[x] Color Palette Selection UI

[ ] Light/Dark Mode Switch

[ ] Save Canvas as Image

[ ] Touch Support for Mobile
