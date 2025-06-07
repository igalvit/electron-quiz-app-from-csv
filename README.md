# Electron Quiz App from CSV

**Electron Quiz App from CSV** is a cross-platform desktop quiz application built using Electron. It loads quiz questions from a CSV file and features a modern, responsive user interface with immediate visual feedback. The app tracks the current question, total number of questions, and the score (correct and incorrect answers) with a combined counter.

---

## Features

- **CSV File Loading:**  
  Loads quiz questions from a CSV file (without headers). Each row is validated to ensure that all required fields are present and that the correct answer is one of **A**, **B**, **C**, or **D**. A new "group" column can be used to filter questions.

- **Modern UI:**  
  Clean, responsive design using [Google Fonts (Roboto)](https://fonts.google.com/specimen/Roboto). The UI includes dynamic question display, answer option buttons, a combined counter, and floating feedback messages.

- **Quiz Functionality:**  
  - Displays questions and multiple-choice answer options.
  - Provides immediate visual feedback:
    - Correct answers are highlighted in green.
    - Incorrect answers are highlighted in red (with the correct answer indicated).
  - Shows a combined counter in the format:  
    `Current: X | Total: Y -- Correct: Z | Incorrect: W`

- **Group Filtering:**  
  A dropdown list allows filtering of quiz questions by group.

- **IPC File Dialog:**  
  Uses Electron’s IPC mechanism to open a native file dialog for CSV file selection while preventing multiple dialogs from opening concurrently.

- **Automated Testing:**  
  Uses Mocha, Chai, JSDOM, and Proxyquire to test the renderer module in a simulated browser environment, with code coverage measured by NYC.

---

## Requirements

- [Node.js](https://nodejs.org/) (v12 or higher recommended)
- [Electron](https://www.electronjs.org/)
- npm packages:
  - `csv-parser`
  - `electron`
- For testing and building:
  - `mocha`
  - `chai`
  - `jsdom`
  - `proxyquire`
  - `nyc` (for code coverage)
  - `electron-builder` (for packaging)

---

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/electron-quiz-app.git
   cd electron-quiz-app
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

---

## How to Run

Start the application in development mode by running:

```bash
npm start
```

This command launches the Electron Quiz App from CSV. In the app window, click the **Select CSV File** button to open a file dialog and load your quiz questions from a CSV file.

---

## How to Test

The test suite simulates a browser environment using JSDOM and uses Proxyquire to stub Electron’s IPC functionality. To run the tests (with coverage), execute:

```bash
npm test
```

NYC will generate a code coverage report in your terminal.

---

## How to Build

You can package the Electron Quiz App into a standalone executable using [electron-builder](https://www.electron.build/).

### Build for Your Current Platform

Run the following command:

```bash
npm run dist
```

This command creates a packaged version of your app (installer or executable) in the `dist` folder.

### Building for Windows

- **On Windows:** Simply run `npm run dist`.
- **On macOS/Linux (Cross-Compilation):**
  - Install [Wine](https://www.winehq.org/) if necessary.
  - Configure electron-builder for cross-platform builds.
- **Using CI/CD:**  
  Use a CI/CD service (like GitHub Actions, AppVeyor, or Travis CI) with the appropriate runner for building Windows packages.

---

## Troubleshooting Windows Build Issues

If you encounter errors related to symbolic link creation or code signing (such as `A required privilege is not held by the client`), try the following:

1. **Run as Administrator:**
   - Open your terminal as Administrator and run `npm run dist` again. This often resolves symlink permission issues.

2. **Disable Code Signing for Development:**
   - If you do not need code signing for local builds, add the following to your `package.json` under the `build` section:
     ```json
     "win": {
       "target": "nsis",
       "sign": false
     }
     ```
   - Then try building again.

3. **Manual Test:**
   - You can still test your app by running the unpacked build directly:
     ```
     dist\win-unpacked\Electron Quiz App from CSV.exe
     ```

---

## Project Structure

```
electron-quiz-app/
├── main.js                # Main process: creates the app window and sets up IPC.
├── index.html             # HTML file that defines the UI structure.
├── style.css              # CSS file for a modern, responsive UI design.
├── renderer.js            # Renderer process: handles CSV parsing, question display, answer checking, score tracking, and IPC.
├── test/
│   ├── renderer.test.js   # Automated tests for the renderer module.
│   └── setup.js           # Sets up a DOM environment for testing using JSDOM.
├── package.json           # Project metadata, scripts, dependencies, and build configuration.
└── README.md              # This documentation file.
```

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with improvements or bug fixes. Follow standard GitHub contribution guidelines.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- [Electron](https://www.electronjs.org/) for enabling cross-platform desktop applications.
- [csv-parser](https://www.npmjs.com/package/csv-parser) for simple CSV file parsing.
- [Mocha](https://mochajs.org/), [Chai](https://www.chaijs.com/), [JSDOM](https://github.com/jsdom/jsdom), and [Proxyquire](https://www.npmjs.com/package/proxyquire) for testing.
- [NYC](https://github.com/istanbuljs/nyc) for code coverage reporting.
- [electron-builder](https://www.electron.build/) for packaging the application.
 and requirements to installation, usage, testing, and contribution guidelines. Adjust any details as needed for your project specifics.