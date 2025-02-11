# Electron Quiz App from CSV

**Electron Quiz App from CSV** is a desktop quiz application built using Electron that loads quiz questions from a CSV file. The app features a modern, responsive user interface with immediate visual feedback and a combined counter that displays the current question number, total questions, and the number of correct and incorrect answers.

## Features

- **CSV File Loading:**  
  The app loads quiz questions from a CSV file (without headers). Each row is validated to ensure all required fields are present and that the correct answer is one of **A**, **B**, **C**, or **D**.

- **Modern UI:**  
  A clean, responsive design that uses [Google Fonts (Roboto)](https://fonts.google.com/specimen/Roboto) and intuitive navigation.

- **Quiz Functionality:**  
  - Displays questions and multiple-choice answer options.
  - Provides immediate visual feedback:
    - Correct answers are highlighted in green.
    - Incorrect answers are highlighted in red (with the correct answer indicated).
  - Shows a combined counter in the format:  
    `Current: X | Total: Y -- Correct: Z | Incorrect: W`

- **IPC File Dialog:**  
  Uses Electron’s IPC mechanism to open a native file dialog for CSV file selection, while preventing multiple dialogs from opening concurrently.

- **Automated Testing:**  
  Uses Mocha, Chai, JSDOM, and Proxyquire to thoroughly test the renderer module, with code coverage measured by NYC.

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

## How to Run

Start the application in development mode by running:

```bash
npm start
```

This command launches the Electron Quiz App from CSV. In the app window, click the **Select CSV File** button to open the file dialog and load your quiz questions from a CSV file.

## How to Test

The test suite uses Mocha, Chai, JSDOM, and Proxyquire to simulate a browser environment and stub Electron’s IPC functionality. To run the tests (with coverage), execute:

```bash
npm test
```

NYC will generate a code coverage report in your terminal. While 100% coverage is a goal, focus on testing the most critical parts of your application.

## How to Build

You can package the Electron Quiz App from CSV into a standalone executable using [electron-builder](https://www.electron.build/).

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

## Project Structure

```
electron-quiz-app/
├── main.js                # Main process: creates the app window and sets up IPC.
├── index.html             # HTML file that defines the UI structure.
├── style.css              # CSS file for a modern, responsive UI design.
├── renderer.js            # Renderer process: handles CSV parsing, question display, answer checking, score tracking, and IPC.
├── test/
│   └── renderer.test.js   # Automated tests for the renderer module.
├── package.json           # Project metadata, scripts, dependencies, and build configuration.
└── README.md              # This documentation file.
```

## Increasing Test Coverage

While achieving 100% test coverage can be challenging and isn’t always necessary, comprehensive tests help ensure your application's reliability. Focus on covering critical behavior and edge cases, including:
- Error conditions (e.g., CSV parsing errors).
- Edge cases when DOM elements or IPC objects are missing.
- All branches in your conditional logic.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with improvements or bug fixes. Follow standard GitHub contribution guidelines.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- [Electron](https://www.electronjs.org/) for enabling cross-platform desktop applications.
- [csv-parser](https://www.npmjs.com/package/csv-parser) for simple CSV file parsing.
- [Mocha](https://mochajs.org/), [Chai](https://www.chaijs.com/), [JSDOM](https://github.com/jsdom/jsdom), and [Proxyquire](https://www.npmjs.com/package/proxyquire) for testing.
- [NYC](https://github.com/istanbuljs/nyc) for code coverage reporting.
- [electron-builder](https://www.electron.build/) for packaging the application.