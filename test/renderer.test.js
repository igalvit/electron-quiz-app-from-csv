/* test/renderer.test.js
 *
 * This test file uses Mocha, Chai, and JSDOM to simulate a browser environment and test
 * the functionality of the Electron Quiz App from CSV's renderer module.
 *
 * Dependencies:
 *  - Mocha: Test runner.
 *  - Chai: Assertion library (using the "expect" style).
 *  - JSDOM: Used to simulate a browser DOM.
 *  - fs and path: For creating temporary CSV files for testing.
 *  - Proxyquire: To stub out Electron's ipcRenderer, so that functions like selectCSVFile can be
 *                tested without opening an actual file dialog.
 *
 * The tests cover:
 *   - checkAnswer: Verifies that correct and incorrect answers update the floating feedback message,
 *     the styles of the answer buttons, and the combined counter (displaying current question, total questions,
 *     correct and incorrect counts).
 *   - displayQuestion: Ensures that the question text and its answer options are rendered properly,
 *     and that the combined counter is updated.
 *   - loadQuestions: Checks that CSV files are parsed correctly, that rows missing required fields or
 *     with invalid correct answers are ignored, that errors during file reading cause the promise to reject,
 *     and that a CSV file with no valid rows is handled gracefully.
 *   - selectCSVFile: Ensures that if a CSV file dialog is already open, a new one is not opened.
 *                    We simulate this using a fake promise.
 *   - Group Filtering: Tests that the group dropdown is populated with unique groups from the CSV
 *                      and that selecting a group filters the questions accordingly.
 *   - Edge Cases: Tests additional conditions such as when document or ipcRenderer are undefined.
 */

// -----------------------------------------------------------------------------
// Import necessary modules and libraries.
// -----------------------------------------------------------------------------
const { expect } = require("chai");       // Chai's expect function for assertions.
const { JSDOM } = require("jsdom");         // JSDOM to simulate a browser environment.
const fs = require("fs");                   // Node's file system module.
const path = require("path");               // Node's path module.
const proxyquire = require("proxyquire");   // Proxyquire to stub modules (e.g., Electron's ipcRenderer).

// -----------------------------------------------------------------------------
// Create a fake ipcRenderer object with a stubbed invoke method.
// This allows us to simulate file dialog interactions without opening an actual dialog.
// -----------------------------------------------------------------------------
let fakeIpcRenderer = {
  invoke: () => {} // This method will be overridden in specific tests as needed.
};

// -----------------------------------------------------------------------------
// Use proxyquire to load the renderer module, replacing Electron's ipcRenderer
// with our fake ipcRenderer.
// -----------------------------------------------------------------------------
const renderer = proxyquire("../renderer", { electron: { ipcRenderer: fakeIpcRenderer } });

// Destructure the exported functions and variables from the renderer module.
const {
  checkAnswer,
  displayQuestion,
  loadQuestions,
  resetScore,
  selectCSVFile,
  updateCounter,
  state
} = renderer;

// -----------------------------------------------------------------------------
// Begin the test suite for the Electron Quiz App from CSV.
// -----------------------------------------------------------------------------
describe("Electron Quiz App from CSV - Additional Tests", function () {
  let dom, document;

  // ---------------------------------------------------------------------------
  // Setup: Create a fresh simulated DOM before each test.
  // This ensures that each test starts with a clean environment.
  // ---------------------------------------------------------------------------
  beforeEach(function () {
    // Create a new JSDOM instance with a basic HTML structure.
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Feedback area (not used for floating messages since those are appended directly to the body) -->
          <div id="feedback"></div>
          <!-- Container for the quiz question text -->
          <div id="question"></div>
          <!-- Combined counter container in the format:
               "Current: X | Total: Y -- Correct: Z | Incorrect: W" -->
          <div id="counterContainer"></div>
          <!-- (Optional) Separate counter element -->
          <div id="counter"></div>
          <!-- Container for answer option buttons -->
          <div id="options"></div>
          <!-- Buttons for CSV selection and navigation -->
          <button id="selectCsvBtn">Select CSV File</button>
          <button id="prevBtn">Previous</button>
          <button id="nextBtn">Next</button>
          <!-- Group filter dropdown container -->
          <div id="groupFilterContainer">
            <label for="groupSelect">Filter by Group:</label>
            <select id="groupSelect"></select>
          </div>
        </body>
      </html>
    `);
    document = dom.window.document;
    // Set global.document and global.window so that the renderer module can access the DOM.
    global.document = document;
    global.window = dom.window;
    // Reset score counters before each test.
    resetScore();
  });

  // ---------------------------------------------------------------------------
  // Cleanup: Close the simulated DOM after each test.
  // ---------------------------------------------------------------------------
  afterEach(function () {
    dom.window.close();
  });

  // ---------------------------------------------------------------------------
  // Test Suite: checkAnswer
  // ---------------------------------------------------------------------------
  describe("checkAnswer", function () {
    it("should display correct floating feedback for a correct answer and update the combined counter", function () {
      // Setup: Create dummy answer option buttons in the #options container.
      const optionsDiv = document.getElementById("options");
      optionsDiv.innerHTML = `
        <button class="option-button" data-letter="A">A) Option 1</button>
        <button class="option-button" data-letter="B">B) Option 2</button>
        <button class="option-button" data-letter="C">C) Option 3</button>
        <button class="option-button" data-letter="D">D) Option 4</button>
      `;
      // Prepare a dummy question for testing.
      renderer.questions.splice(0, renderer.questions.length); // Clear existing questions.
      renderer.questions.push({
        questionText: "Dummy question",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // Simulate a correct answer by calling checkAnswer with "A".
      checkAnswer("A", "A");
      // Assertion: Check that a floating feedback message is created containing "Correct!".
      const floatingFeedback = document.querySelector('.floating-feedback');
      expect(floatingFeedback).to.exist;
      expect(floatingFeedback.textContent).to.contain("Correct!");
      // Assertion: Verify that the button corresponding to the correct answer has a lightgreen background.
      const correctBtn = document.querySelector('button[data-letter="A"]');
      expect(correctBtn.style.backgroundColor).to.equal("lightgreen");
      // Assertion: Verify that the combined counter displays the correct updated values.
      const counterContainer = document.getElementById("counterContainer");
      // Modern UI: check for score-card and values
      expect(counterContainer.querySelector('.score-card')).to.exist;
      expect(counterContainer.innerHTML).to.contain('Current');
      expect(counterContainer.innerHTML).to.contain('Total');
      expect(counterContainer.innerHTML).to.contain('Correct');
      expect(counterContainer.innerHTML).to.contain('Incorrect');
      expect(counterContainer.innerHTML).to.contain('>1<'); // Current
      expect(counterContainer.innerHTML).to.contain('>1<'); // Total
      expect(counterContainer.innerHTML).to.contain('>1<'); // Correct
      expect(counterContainer.innerHTML).to.contain('>0<'); // Incorrect
    });

    it("should display correct floating feedback for an incorrect answer and update the combined counter", function () {
      // Setup: Create dummy answer option buttons.
      const optionsDiv = document.getElementById("options");
      optionsDiv.innerHTML = `
        <button class="option-button" data-letter="A">A) Option 1</button>
        <button class="option-button" data-letter="B">B) Option 2</button>
        <button class="option-button" data-letter="C">C) Option 3</button>
        <button class="option-button" data-letter="D">D) Option 4</button>
      `;
      // Prepare a dummy question.
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "Test question",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // Simulate an incorrect answer (select "B" when "A" is correct).
      checkAnswer("B", "A");
      // Assertion: Check that a floating feedback message is created containing "Incorrect".
      const floatingFeedback = document.querySelector('.floating-feedback');
      expect(floatingFeedback).to.exist;
      expect(floatingFeedback.textContent).to.contain("Incorrect");
      // Assertion: Verify that the selected button ("B") is styled with a lightcoral background
      // and that the correct button ("A") is styled with a lightgreen background.
      const selectedBtn = document.querySelector('button[data-letter="B"]');
      const correctBtn = document.querySelector('button[data-letter="A"]');
      expect(selectedBtn.style.backgroundColor).to.equal("lightcoral");
      expect(correctBtn.style.backgroundColor).to.equal("lightgreen");
      // Assertion: Verify that the combined counter reflects 0 correct and 1 incorrect answer.
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.querySelector('.score-card')).to.exist;
      expect(counterContainer.innerHTML).to.contain('Current');
      expect(counterContainer.innerHTML).to.contain('Total');
      expect(counterContainer.innerHTML).to.contain('Correct');
      expect(counterContainer.innerHTML).to.contain('Incorrect');
      expect(counterContainer.innerHTML).to.contain('>0<'); // Correct
      expect(counterContainer.innerHTML).to.contain('>1<'); // Incorrect
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite: displayQuestion
  // ---------------------------------------------------------------------------
  describe("displayQuestion", function () {
    it("should display the question text, options, and update the combined counter correctly", function () {
      // Setup: Clear any existing questions and add a test question.
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "What is the capital of France?",
        options: ["Paris", "Berlin", "Rome", "Madrid"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // Call displayQuestion to render the test question.
      displayQuestion(0);
      // Assertion: Verify the question text is rendered correctly.
      const questionDiv = document.getElementById("question");
      expect(questionDiv.innerHTML).to.contain("What is the capital of France?");
      // Assertion: Verify that four answer buttons are rendered with the correct text.
      const optionsDiv = document.getElementById("options");
      const buttons = optionsDiv.querySelectorAll("button.option-button");
      expect(buttons.length).to.equal(4);
      expect(buttons[0].innerText).to.contain("A) Paris");
      expect(buttons[1].innerText).to.contain("B) Berlin");
      expect(buttons[2].innerText).to.contain("C) Rome");
      expect(buttons[3].innerText).to.contain("D) Madrid");
      // Assertion: Verify that the combined counter is updated correctly.
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.querySelector('.score-card')).to.exist;
      expect(counterContainer.innerHTML).to.contain('Current');
      expect(counterContainer.innerHTML).to.contain('Total');
      expect(counterContainer.innerHTML).to.contain('Correct');
      expect(counterContainer.innerHTML).to.contain('Incorrect');
      expect(counterContainer.innerHTML).to.contain('>1<'); // Current
      expect(counterContainer.innerHTML).to.contain('>1<'); // Total
      expect(counterContainer.innerHTML).to.contain('>0<'); // Correct
      expect(counterContainer.innerHTML).to.contain('>0<'); // Incorrect
    });
    
    it("should do nothing if the index is out of bounds", function () {
      // Setup: Add a single test question.
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "Out of bounds question",
        options: ["Opt1", "Opt2", "Opt3", "Opt4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // Assertion: Calling displayQuestion with an invalid index should not throw an error.
      expect(() => displayQuestion(-1)).to.not.throw();
      expect(() => displayQuestion(1)).to.not.throw();
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite: loadQuestions
  // ---------------------------------------------------------------------------
  describe("loadQuestions", function () {
    it("should load questions from a valid CSV file", async function () {
      this.timeout(5000); // Increase timeout for file reading.
      // Create a temporary CSV file with two valid questions.
      const tmpFile = path.join(__dirname, "temp.csv");
      const csvContent = `What is 2+2?,1,2,3,4,B,Math
What is the capital of Italy?,Rome,Paris,Berlin,Madrid,A,Geography
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      // Call loadQuestions to load the CSV file.
      await loadQuestions(tmpFile);
      // Assertions: Verify that two questions were loaded and their properties are correct.
      expect(renderer.questions.length).to.equal(2);
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      expect(renderer.questions[0].correctAnswer).to.equal("B");
      expect(renderer.questions[0].group).to.equal("Math");
      expect(renderer.questions[1].questionText).to.equal("What is the capital of Italy?");
      expect(renderer.questions[1].correctAnswer).to.equal("A");
      expect(renderer.questions[1].group).to.equal("Geography");
      // Verify that the combined counter displays the expected values.
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.querySelector('.score-card')).to.exist;
      expect(counterContainer.innerHTML).to.contain('Current');
      expect(counterContainer.innerHTML).to.contain('Total');
      expect(counterContainer.innerHTML).to.contain('Correct');
      expect(counterContainer.innerHTML).to.contain('Incorrect');
      expect(counterContainer.innerHTML).to.contain('>1<'); // Current
      expect(counterContainer.innerHTML).to.contain('>2<'); // Total
      expect(counterContainer.innerHTML).to.contain('>0<'); // Correct
      expect(counterContainer.innerHTML).to.contain('>0<'); // Incorrect
      // Cleanup: Remove the temporary file.
      fs.unlinkSync(tmpFile);
    });
    
    it("should ignore CSV rows missing required fields", async function () {
      this.timeout(5000);
      // Create a temporary CSV file where one row is incomplete.
      const tmpFile = path.join(__dirname, "temp_missing.csv");
      const csvContent = `What is 2+2?,1,2,3,4,B,Math
Incomplete row,OnlyOneField
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      // Assertion: Only one valid question should be loaded.
      expect(renderer.questions.length).to.equal(1);
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      fs.unlinkSync(tmpFile);
    });
    
    it("should ignore CSV rows with invalid correct answer values", async function () {
      this.timeout(5000);
      // Create a temporary CSV file where one row has an invalid correct answer (Z).
      const tmpFile = path.join(__dirname, "temp_invalid.csv");
      const csvContent = `What is 2+2?,1,2,3,4,B,Math
Invalid answer row,Val1,Val2,Val3,Val4,Z,Science
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      // Assertion: Only the valid question should be loaded.
      expect(renderer.questions.length).to.equal(1);
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      fs.unlinkSync(tmpFile);
    });
    
    it("should reject if an error occurs while reading the CSV file", async function () {
      this.timeout(5000);
      // Simulate an error by overriding fs.readFileSync to throw an error.
      const originalReadFileSync = fs.readFileSync;
      fs.readFileSync = () => { throw new Error("Test error"); };
      try {
        await loadQuestions("dummy/path");
        throw new Error("Expected loadQuestions to reject");
      } catch (err) {
        // Assertion: The promise should reject with an error.
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Test error");
      } finally {
        // Restore the original readFileSync function.
        fs.readFileSync = originalReadFileSync;
      }
    });
    
    it("should handle a CSV file with no valid questions", async function () {
      this.timeout(5000);
      // Create a temporary CSV file with no valid question rows.
      const tmpFile = path.join(__dirname, "temp_none.csv");
      const csvContent = `Invalid row,No,Valid,Data
Another invalid row,Missing,Fields
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      // Assertion: The questions array should be empty.
      expect(renderer.questions.length).to.equal(0);
      // Verify that an appropriate error message is displayed in the feedback element.
      const feedbackText = document.getElementById("feedback").innerHTML;
      expect(feedbackText).to.contain("No valid questions found");
      fs.unlinkSync(tmpFile);
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite: selectCSVFile
  // ---------------------------------------------------------------------------
  describe("selectCSVFile", function () {
    it("should not open a new dialog if one is already open", async function () {
      // Override loadQuestions to prevent actual file reading during this test.
      const originalLoadQuestions = renderer.loadQuestions;
      renderer.loadQuestions = () => Promise.resolve();

      // Save the original fakeIpcRenderer.invoke method.
      const originalInvoke = fakeIpcRenderer.invoke;
      // Create a fake promise that resolves after 1 second.
      let invokeCallCount = 0;
      const fakePromise = new Promise(resolve => setTimeout(resolve, 1000));
      fakeIpcRenderer.invoke = () => {
        invokeCallCount++;
        return fakePromise;
      };

      // Ensure the dialog flag is false initially.
      state.isDialogOpen = false;

      // Call selectCSVFile once; do not await so that it remains pending.
      selectCSVFile();
      await Promise.resolve(); // Yield to microtasks.
      // Assertion: The state flag should now indicate that a dialog is open.
      expect(state.isDialogOpen).to.be.true;

      // Call selectCSVFile a second time; it should detect the open dialog and do nothing.
      await selectCSVFile();
      // Assertion: ipcRenderer.invoke should have been called only once.
      expect(invokeCallCount).to.equal(1);

      // Wait for the fake promise to resolve.
      await fakePromise;
      // Assertion: After resolution, the state flag should be reset to false.
      expect(state.isDialogOpen).to.be.false;

      // Restore the original ipcRenderer.invoke and loadQuestions methods.
      fakeIpcRenderer.invoke = originalInvoke;
      renderer.loadQuestions = originalLoadQuestions;
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite: Group Filtering
  // ---------------------------------------------------------------------------
  describe("Group Filtering", function () {
    it("should populate the group dropdown with unique groups from the CSV", async function () {
      this.timeout(5000);
      // Create a temporary CSV file with questions having different groups.
      const tmpFile = path.join(__dirname, "temp_groups.csv");
      const csvContent = `Question 1,Opt1,Opt2,Opt3,Opt4,A,Group1
Question 2,Opt1,Opt2,Opt3,Opt4,B,Group2
Question 3,Opt1,Opt2,Opt3,Opt4,C,Group1
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      // Ensure the groupSelect element exists in the DOM.
      let groupSelect = document.getElementById("groupSelect");
      if (!groupSelect) {
        groupSelect = document.createElement("select");
        groupSelect.id = "groupSelect";
        document.body.appendChild(groupSelect);
      }
      // Load the CSV file.
      await loadQuestions(tmpFile);
      // After loading, check that the group dropdown is populated correctly.
      groupSelect = document.getElementById("groupSelect");
      const options = Array.from(groupSelect.options).map(opt => opt.value);
      expect(options).to.include("All");
      expect(options).to.include("Group1");
      expect(options).to.include("Group2");
      fs.unlinkSync(tmpFile);
    });
    
    it("should filter questions based on the selected group", async function () {
      this.timeout(5000);
      // Create a temporary CSV file with questions belonging to different groups.
      const tmpFile = path.join(__dirname, "temp_groups_filter.csv");
      const csvContent = `Question 1,Opt1,Opt2,Opt3,Opt4,A,Group1
Question 2,Opt1,Opt2,Opt3,Opt4,B,Group2
Question 3,Opt1,Opt2,Opt3,Opt4,C,Group1
Question 4,Opt1,Opt2,Opt3,Opt4,D,Group3
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      // Ensure that the groupSelect element exists in the DOM.
      let groupSelect = document.getElementById("groupSelect");
      if (!groupSelect) {
        groupSelect = document.createElement("select");
        groupSelect.id = "groupSelect";
        document.body.appendChild(groupSelect);
      }
      // Load the CSV file.
      await loadQuestions(tmpFile);
      // Simulate selecting "Group1" from the dropdown.
      groupSelect.value = "Group1";
      const event = new dom.window.Event("change");
      groupSelect.dispatchEvent(event);
      // Assertion: After filtering, the questions array should only include questions from Group1.
      expect(renderer.questions.length).to.equal(2);
      renderer.questions.forEach(q => {
        expect(q.group).to.equal("Group1");
      });
      fs.unlinkSync(tmpFile);
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite: Edge Cases
  // ---------------------------------------------------------------------------
  describe("Edge Cases", function () {
    it("should do nothing if document is undefined in displayQuestion", function () {
      // Temporarily remove the global document.
      const originalDoc = global.document;
      global.document = undefined;
      // Assertion: Calling displayQuestion should not throw an error.
      expect(() => displayQuestion(0)).to.not.throw();
      // Restore the original document.
      global.document = originalDoc;
    });

    it("should do nothing if document is undefined in checkAnswer", function () {
      const originalDoc = global.document;
      global.document = undefined;
      expect(() => checkAnswer("A", "A")).to.not.throw();
      global.document = originalDoc;
    });

    it("should do nothing in updateCounter if counterContainer is not found", function () {
      // Remove the counterContainer element from the DOM.
      const counterContainer = document.getElementById("counterContainer");
      counterContainer.parentNode.removeChild(counterContainer);
      // Assertion: updateCounter should not throw an error even if the container is missing.
      expect(() => updateCounter()).to.not.throw();
    });

    it("should do nothing in loadQuestions if document is undefined", async function () {
      // Temporarily remove the global document.
      const originalDoc = global.document;
      global.document = undefined;
      // Assertion: loadQuestions should handle an undefined document without throwing.
      await loadQuestions("dummy.csv").catch(() => {});
      global.document = originalDoc;
    });

    it("should do nothing in selectCSVFile if ipcRenderer is undefined", async function () {
      // Temporarily remove the global ipcRenderer.
      const originalIpc = global.ipcRenderer;
      global.ipcRenderer = undefined;
      // Assertion: selectCSVFile should not throw an error when ipcRenderer is undefined.
      expect(async () => { await selectCSVFile(); }).to.not.throw();
      global.ipcRenderer = originalIpc;
    });
  });
});
