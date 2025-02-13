// test/setup.js
//
// This file sets up a minimal DOM environment using JSDOM so that tests can run
// in a simulated browser environment. This is especially useful for testing DOM-dependent
// code from our Electron Quiz App, without requiring an actual browser.

// ---------README.md--------------------------------------------------------------------
// Import JSDOM from the jsdom module.
// JSDOM is a JavaScript implementation of the DOM and HTML standards,
// which allows Node.js code to simulate a browser environment.
const { JSDOM } = require("jsdom");

// -----------------------------------------------------------------------------
// Create a new JSDOM instance with the minimal HTML structure required for our tests.
// The HTML structure includes the essential elements used by the app, such as:
//   - A feedback area to display messages.
//   - A container for the quiz question.
//   - A container for the answer options.
//   - Buttons for selecting a CSV file and for navigating between questions.
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
  <body>
    <!-- Feedback area: displays messages to the user (e.g., error or success notifications) -->
    <div id="feedback"></div>
    <!-- Container for the quiz question text -->
    <div id="question"></div>
    <!-- Container for the quiz answer options -->
    <div id="options"></div>
    <!-- Button to select a CSV file; triggers file selection dialog -->
    <button id="selectCsvBtn">Select CSV File</button>
    <!-- Navigation buttons for moving between quiz questions -->
    <button id="prevBtn">Previous</button>
    <button id="nextBtn">Next</button>
  </body>
</html>
`);

// -----------------------------------------------------------------------------
// Expose the JSDOM window and document objects globally.
// This allows any module under test to access 'window' and 'document' as if it were running in a real browser.
// Without this, DOM-dependent code in our tests would not function properly.
global.window = dom.window;
global.document = dom.window.document;
