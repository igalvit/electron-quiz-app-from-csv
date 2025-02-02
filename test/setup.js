// test/setup.js
//
// This file sets up a minimal DOM environment using JSDOM so that tests can run
// in a simulated browser environment. It is especially useful for testing DOM-dependent
// code from our Electron Quiz App.

const { JSDOM } = require("jsdom");

// Create a JSDOM instance with the minimal HTML structure required by the app.
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
  <body>
    <!-- Feedback area: displays messages to the user -->
    <div id="feedback"></div>
    <!-- Container for the quiz question -->
    <div id="question"></div>
    <!-- Container for answer options -->
    <div id="options"></div>
    <!-- Button to select a CSV file -->
    <button id="selectCsvBtn">Select CSV File</button>
    <!-- Navigation buttons -->
    <button id="prevBtn">Previous</button>
    <button id="nextBtn">Next</button>
  </body>
</html>
`);

// Expose JSDOM's window and document objects globally so that modules under test
// can use them as if running in a browser.
global.window = dom.window;
global.document = dom.window.document;
