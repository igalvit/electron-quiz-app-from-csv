# Quiz App from CSV file

**Quiz App from CSV file** is a desktop quiz application built with Electron. It loads quiz questions from a CSV file, displays them in a modern, responsive user interface, and provides immediate visual feedback on answers. This project demonstrates how to use IPC for file selection, parse CSV files using the [csv-parser](https://www.npmjs.com/package/csv-parser) library, and test DOM-dependent code with JSDOM, Mocha, and Chai.

---

## Features

- **CSV File Loading:**  
  Loads quiz questions from a CSV file (without headers). Each row is validated to ensure that all required fields are present and that the correct answer is one of **A**, **B**, **C**, or **D**.

- **Modern UI:**  
  A clean and responsive design using [Google Fonts (Roboto)](https://fonts.google.com/specimen/Roboto) with smooth transitions and intuitive navigation.

- **Quiz Functionality:**  
  - Displays questions and answer options.
  - Provides navigation using "Previous" and "Next" buttons.
  - Immediately displays visual feedback:
    - Correct answers are highlighted in green.
    - Incorrect answers are highlighted in red, with the correct answer also indicated.

- **File Dialog via IPC:**  
  Uses Electron’s IPC mechanism to open a native file dialog so that users can select a CSV file containing quiz questions.

- **Automated Testing:**  
  Uses Mocha, Chai, and JSDOM to test the core functions (such as CSV parsing, question display, and answer checking) in a simulated browser environment.

---

## Requirements

- [Node.js](https://nodejs.org/) (v12+ recommended)
- [Electron](https://www.electronjs.org/)
- The following Node.js modules (installed via npm):
  - `csv-parser`
  - `electron`
  
For testing and development, you also need:
  - `mocha`
  - `chai`
  - `jsdom`

---

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/igalvit/electron-quiz-app-from-csv.git
   cd quiz-app-from-csv
   ```

2. **Install Dependencies:**

   Make sure you have [Node.js](https://nodejs.org/) installed, then run:

   ```bash
   npm install
   ```

---

## Running the Application

To run the Electron Quiz App in development mode, use:

```bash
npm start
```

This command launches the Electron application. Once the window opens, click the **Select CSV File** button at the bottom to open a file dialog and choose your CSV file.

---

## Running Tests

The project uses Mocha, Chai, and JSDOM for automated testing. The tests cover key functions such as:

- **checkAnswer:** Verifies the visual feedback for correct and incorrect answers.
- **displayQuestion:** Confirms that questions and answer options are rendered correctly.
- **loadQuestions:** Ensures that the CSV file is parsed properly and that the quiz questions are loaded.

To run the tests:

1. **Install the Development Test Dependencies (if not already installed):**

   ```bash
   npm install --save-dev mocha chai jsdom
   ```

2. **Update the Test Script (if needed):**  
   Your `package.json` should include a test script such as:

   ```json
   "scripts": {
     "test": "mocha"
   }
   ```

3. **Run the Tests:**

   ```bash
   npm test
   ```

---

## Packaging for Distribution

This project can be packaged into a standalone application for Windows, macOS, or Linux using [electron-builder](https://www.electron.build/).

1. **Install electron-builder as a Dev Dependency:**

   ```bash
   npm install --save-dev electron-builder
   ```

2. **Configure `package.json`:**  
   Ensure that your `package.json` contains a build section similar to the following:

   ```json
   "build": {
     "appId": "es.igalvit.electronquizappfromcsv",
     "productName": "Electron Quiz App from CSV",
     "files": [
       "**/*"
     ],
     "directories": {
       "buildResources": "build"
     },
     "win": {
       "target": "nsis"
     },
     "mac": {
       "target": "dmg"
     },
     "linux": {
       "target": "AppImage"
     }
   },
   "scripts": {
     "start": "electron .",
     "pack": "electron-builder --dir",
     "dist": "electron-builder"
   }
   ```

3. **Build the Application:**

   For a distribution package (installer), run:

   ```bash
   npm run dist
   ```

This command creates a packaged version of your app for your current platform.

---

## Project Structure

```
electron-quiz-app/
├── main.js            # Main process: creates the window and sets up IPC for file selection.
├── index.html         # Main HTML file that defines the UI structure.
├── style.css          # CSS file for the modern, responsive UI design.
├── renderer.js        # Renderer process: handles CSV parsing, question display, answer checking, and IPC communication.
├── test/
│   ├── renderer.test.js  # Automated tests for the core functions.
│   └── setup.js          # (Optional) Test setup file that configures a DOM environment using JSDOM.
├── package.json       # Project metadata, scripts, dependencies, and build configuration.
└── README.md          # This file.
```

---

## Contributing

Contributions are welcome! If you have suggestions, improvements, or bug fixes, please open an issue or submit a pull request. Please follow standard GitHub contribution guidelines.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- [Electron](https://www.electronjs.org/) for making cross-platform desktop applications possible.
- [csv-parser](https://www.npmjs.com/package/csv-parser) for easy CSV parsing.
- [Mocha](https://mochajs.org/), [Chai](https://www.chaijs.com/), and [JSDOM](https://github.com/jsdom/jsdom) for robust testing of DOM-dependent code.