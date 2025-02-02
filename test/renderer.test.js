// test/renderer.test.js
//
// This file contains a series of tests for the Electron Quiz App's renderer
// functions, including checkAnswer, displayQuestion, and loadQuestions.
// The tests use Mocha and Chai for assertions, and JSDOM to simulate a browser
// environment so that DOM-dependent code can be tested.
// Additionally, the fs and path modules are used to create a temporary CSV file
// for testing the loadQuestions function.

// Import the Chai expect assertion function.
const { expect } = require("chai");
// Import JSDOM from jsdom to simulate a browser DOM.
const { JSDOM } = require("jsdom");
// Import Node.js modules for file system and path operations.
const fs = require("fs");
const path = require("path");

// Import functions and module-level variables from renderer.js.
// These functions include checkAnswer, displayQuestion, and loadQuestions.
// The module-level variables (questions, currentQuestionIndex) are updated via
// methods like splice (to clear contents) so that the same array reference is maintained.
const renderer = require("../renderer");
const { checkAnswer, displayQuestion, loadQuestions } = renderer;

describe("Electron Quiz App - Additional Tests", function () {
  let dom, document;

  // beforeEach hook: runs before each test to set up a new DOM environment.
  beforeEach(function () {
    // Create a new DOM using JSDOM with the minimal HTML structure required by the app.
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Feedback area for displaying result messages -->
          <div id="feedback"></div>
          <!-- Container for the quiz question text -->
          <div id="question"></div>
          <!-- Container for the quiz options (answer buttons) -->
          <div id="options"></div>
          <!-- Button to trigger CSV file selection -->
          <button id="selectCsvBtn">Select CSV File</button>
          <!-- Navigation buttons for moving between questions -->
          <button id="prevBtn">Previous</button>
          <button id="nextBtn">Next</button>
        </body>
      </html>
    `);
    // Extract the document object from the JSDOM instance.
    document = dom.window.document;
    // Set the global document and window objects so that the renderer code can access them.
    global.document = document;
    global.window = dom.window;
  });

  // afterEach hook: cleans up after each test by closing the JSDOM window.
  afterEach(function () {
    dom.window.close();
  });

  // Tests for the checkAnswer function.
  describe("checkAnswer", function () {
    it("should display correct feedback for a correct answer", function () {
      // Set up option buttons in the DOM by injecting HTML into the #options container.
      const optionsDiv = document.getElementById("options");
      optionsDiv.innerHTML = `
        <button class="option-button" data-letter="A">A) Option 1</button>
        <button class="option-button" data-letter="B">B) Option 2</button>
        <button class="option-button" data-letter="C">C) Option 3</button>
        <button class="option-button" data-letter="D">D) Option 4</button>
      `;

      // Simulate a user selecting the correct answer:
      // "A" is selected, and the correct answer is also "A".
      checkAnswer("A", "A");

      // Get the feedback text and verify that it contains the word "Correct!".
      const feedbackText = document.getElementById("feedback").textContent;
      expect(feedbackText).to.contain("Correct!");

      // Verify that the correct option button (with data-letter "A") is highlighted in lightgreen.
      const correctBtn = document.querySelector('button[data-letter="A"]');
      expect(correctBtn.style.backgroundColor).to.equal("lightgreen");
    });

    it("should display correct feedback for an incorrect answer", function () {
      // Set up the option buttons.
      const optionsDiv = document.getElementById("options");
      optionsDiv.innerHTML = `
        <button class="option-button" data-letter="A">A) Option 1</button>
        <button class="option-button" data-letter="B">B) Option 2</button>
        <button class="option-button" data-letter="C">C) Option 3</button>
        <button class="option-button" data-letter="D">D) Option 4</button>
      `;

      // Prepare a test question by clearing and updating the module-level questions array.
      // Use splice to clear the array so that the exported reference remains the same.
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "Test question",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;

      // Simulate an incorrect answer: user selects "B" while the correct answer is "A".
      checkAnswer("B", "A");

      // Verify that the feedback text indicates an incorrect answer.
      const feedbackText = document.getElementById("feedback").textContent;
      expect(feedbackText).to.contain("Incorrect");

      // Check that the button for the selected (incorrect) answer ("B") is highlighted in lightcoral.
      const selectedBtn = document.querySelector('button[data-letter="B"]');
      // And the correct answer button ("A") is highlighted in lightgreen.
      const correctBtn = document.querySelector('button[data-letter="A"]');
      expect(selectedBtn.style.backgroundColor).to.equal("lightcoral");
      expect(correctBtn.style.backgroundColor).to.equal("lightgreen");
    });
  });

  // Tests for the displayQuestion function.
  describe("displayQuestion", function () {
    it("should display the question text and options correctly", function () {
      // Prepare a test question in the module-level questions array.
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "What is the capital of France?",
        options: ["Paris", "Berlin", "Rome", "Madrid"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;

      // Call displayQuestion to render the question and its options in the DOM.
      displayQuestion(0);

      // Verify that the question text is correctly displayed in the #question element.
      const questionDiv = document.getElementById("question");
      expect(questionDiv.innerHTML).to.contain("What is the capital of France?");

      // Verify that four option buttons are created in the #options container.
      const optionsDiv = document.getElementById("options");
      const buttons = optionsDiv.querySelectorAll("button.option-button");
      expect(buttons.length).to.equal(4);
      // Check that each button's innerText contains the expected option text.
      expect(buttons[0].innerText).to.contain("A) Paris");
      expect(buttons[1].innerText).to.contain("B) Berlin");
      expect(buttons[2].innerText).to.contain("C) Rome");
      expect(buttons[3].innerText).to.contain("D) Madrid");
    });
  });

  // Tests for the loadQuestions function.
  describe("loadQuestions", function () {
    it("should load questions from a valid CSV file", async function () {
      // Increase the timeout for this test to allow enough time for CSV parsing.
      this.timeout(5000);

      // Create a temporary CSV file with two questions.
      const tmpFile = path.join(__dirname, "temp.csv");
      // CSV content with a trailing newline to ensure the parser processes the final record.
      const csvContent = `What is 2+2?,1,2,3,4,B
What is the capital of Italy?,Rome,Paris,Berlin,Madrid,A
`;
      // Write the CSV content to the temporary file.
      fs.writeFileSync(tmpFile, csvContent, "utf8");

      // Clear any existing questions in the module-level array using splice.
      renderer.questions.splice(0, renderer.questions.length);

      // Call loadQuestions and await its Promise resolution.
      await loadQuestions(tmpFile);

      // Log the questions loaded for debugging purposes.
      console.log("Questions loaded:", renderer.questions);

      // Assert that the questions array now contains 2 questions.
      expect(renderer.questions.length).to.equal(2);
      // Check that the first question's text and correct answer match the expected values.
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      expect(renderer.questions[0].correctAnswer).to.equal("B");
      // Check that the second question's text and correct answer match the expected values.
      expect(renderer.questions[1].questionText).to.equal("What is the capital of Italy?");
      expect(renderer.questions[1].correctAnswer).to.equal("A");

      // Remove the temporary CSV file.
      fs.unlinkSync(tmpFile);
    });
  });
});
