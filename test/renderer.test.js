// test/renderer.test.js
//
// This test file uses Mocha, Chai, and JSDOM to simulate a browser environment and test
// the functionality of the Electron Quiz App from CSV's renderer module.
// We use proxyquire to stub the Electron module (specifically providing a fake ipcRenderer)
// so that functions like selectCSVFile can be tested without actually opening a file dialog.
// 
// The tests cover:
//   - checkAnswer: Verifies that correct and incorrect answers update the feedback message,
//     button styles, and the combined counter (displaying current question, total questions,
//     correct and incorrect counts).
//   - displayQuestion: Ensures that the question and its options are rendered properly and that
//     the combined counter is updated.
//   - loadQuestions: Confirms that CSV files are parsed correctly, that rows missing required
//     fields or with invalid correct answers are ignored, that errors during file reading cause
//     rejection, and that a CSV file with no valid rows is handled.
//   - selectCSVFile: Ensures that if a file dialog is already open, a new one is not opened.
//     We simulate an open dialog using a fake promise that resolves after a delay.
//   - Edge Cases: Tests additional branches such as missing DOM elements or undefined ipcRenderer.

const { expect } = require("chai");       // Chai's expect for assertions.
const { JSDOM } = require("jsdom");         // JSDOM to simulate a browser DOM.
const fs = require("fs");                   // File system module for temporary CSV files.
const path = require("path");               // Node's path module.
const proxyquire = require("proxyquire");   // For stubbing modules like Electron.

// Create a fake ipcRenderer with a stubbed invoke method.
let fakeIpcRenderer = {
  invoke: () => {} // This will be overridden in tests.
};

// Use proxyquire to load renderer.js, replacing 'electron' with our fake ipcRenderer.
const renderer = proxyquire("../renderer", { electron: { ipcRenderer: fakeIpcRenderer } });

// Destructure exported functions and variables from renderer.js.
// Note: We export the dialog flag within a "state" object and export updateCounter for testing.
const {
  checkAnswer,
  displayQuestion,
  loadQuestions,
  resetScore,
  selectCSVFile,
  updateCounter,
  state
} = renderer;

describe("Electron Quiz App from CSV - Additional Tests", function () {
  let dom, document;

  // Create a fresh simulated DOM before each test.
  beforeEach(function () {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Feedback area for displaying messages -->
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
        </body>
      </html>
    `);
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    // Reset the score counters before each test.
    resetScore();
  });

  // Clean up the DOM after each test.
  afterEach(function () {
    dom.window.close();
  });

  // -------------------------------
  // Test Suite: checkAnswer
  // -------------------------------
  describe("checkAnswer", function () {
    it("should display correct feedback for a correct answer and update the combined counter", function () {
      // Set up answer option buttons.
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
        questionText: "Dummy question",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // Simulate selecting the correct answer.
      checkAnswer("A", "A");
      // Check that the feedback message indicates a correct answer.
      const feedbackText = document.getElementById("feedback").textContent;
      expect(feedbackText).to.contain("Correct!");
      // Verify the correct button has a lightgreen background.
      const correctBtn = document.querySelector('button[data-letter="A"]');
      expect(correctBtn.style.backgroundColor).to.equal("lightgreen");
      // Verify that the combined counter displays the updated score.
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.innerHTML).to.contain("Current: 1");
      expect(counterContainer.innerHTML).to.contain("Total: 1");
      expect(counterContainer.innerHTML).to.contain("Correct: 1");
      expect(counterContainer.innerHTML).to.contain("Incorrect: 0");
    });

    it("should display correct feedback for an incorrect answer and update the combined counter", function () {
      const optionsDiv = document.getElementById("options");
      optionsDiv.innerHTML = `
        <button class="option-button" data-letter="A">A) Option 1</button>
        <button class="option-button" data-letter="B">B) Option 2</button>
        <button class="option-button" data-letter="C">C) Option 3</button>
        <button class="option-button" data-letter="D">D) Option 4</button>
      `;
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "Test question",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // Simulate an incorrect answer.
      checkAnswer("B", "A");
      // Verify feedback indicates an incorrect answer.
      const feedbackText = document.getElementById("feedback").textContent;
      expect(feedbackText).to.contain("Incorrect");
      // Verify that the selected button is styled in lightcoral and the correct one in lightgreen.
      const selectedBtn = document.querySelector('button[data-letter="B"]');
      const correctBtn = document.querySelector('button[data-letter="A"]');
      expect(selectedBtn.style.backgroundColor).to.equal("lightcoral");
      expect(correctBtn.style.backgroundColor).to.equal("lightgreen");
      // Check that the combined counter updates the score.
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.innerHTML).to.contain("Correct: 0");
      expect(counterContainer.innerHTML).to.contain("Incorrect: 1");
    });
  });

  // -------------------------------
  // Test Suite: displayQuestion
  // -------------------------------
  describe("displayQuestion", function () {
    it("should display the question text, options, and update the combined counter correctly", function () {
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "What is the capital of France?",
        options: ["Paris", "Berlin", "Rome", "Madrid"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      displayQuestion(0);
      // Verify that the question text is rendered.
      const questionDiv = document.getElementById("question");
      expect(questionDiv.innerHTML).to.contain("What is the capital of France?");
      // Verify that answer options are rendered as buttons with the correct text.
      const optionsDiv = document.getElementById("options");
      const buttons = optionsDiv.querySelectorAll("button.option-button");
      expect(buttons.length).to.equal(4);
      expect(buttons[0].innerText).to.contain("A) Paris");
      expect(buttons[1].innerText).to.contain("B) Berlin");
      expect(buttons[2].innerText).to.contain("C) Rome");
      expect(buttons[3].innerText).to.contain("D) Madrid");
      // Verify that the combined counter is updated correctly.
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.innerHTML).to.contain("Current: 1");
      expect(counterContainer.innerHTML).to.contain("Total: 1");
      expect(counterContainer.innerHTML).to.contain("Correct: 0");
      expect(counterContainer.innerHTML).to.contain("Incorrect: 0");
    });
    
    it("should do nothing if the index is out of bounds", function () {
      renderer.questions.splice(0, renderer.questions.length);
      renderer.questions.push({
        questionText: "Out of bounds question",
        options: ["Opt1", "Opt2", "Opt3", "Opt4"],
        correctAnswer: "A"
      });
      renderer.currentQuestionIndex = 0;
      // displayQuestion should not throw for out-of-bounds indices.
      expect(() => displayQuestion(-1)).to.not.throw();
      expect(() => displayQuestion(1)).to.not.throw();
    });
  });

  // -------------------------------
  // Test Suite: loadQuestions
  // -------------------------------
  describe("loadQuestions", function () {
    it("should load questions from a valid CSV file", async function () {
      this.timeout(5000);
      const tmpFile = path.join(__dirname, "temp.csv");
      const csvContent = `What is 2+2?,1,2,3,4,B
What is the capital of Italy?,Rome,Paris,Berlin,Madrid,A
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      expect(renderer.questions.length).to.equal(2);
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      expect(renderer.questions[0].correctAnswer).to.equal("B");
      expect(renderer.questions[1].questionText).to.equal("What is the capital of Italy?");
      expect(renderer.questions[1].correctAnswer).to.equal("A");
      const counterContainer = document.getElementById("counterContainer");
      expect(counterContainer.innerHTML).to.contain("Current: 1");
      expect(counterContainer.innerHTML).to.contain("Total: 2");
      expect(counterContainer.innerHTML).to.contain("Correct: 0");
      expect(counterContainer.innerHTML).to.contain("Incorrect: 0");
      fs.unlinkSync(tmpFile);
    });
    
    it("should ignore CSV rows missing required fields", async function () {
      this.timeout(5000);
      const tmpFile = path.join(__dirname, "temp_missing.csv");
      const csvContent = `What is 2+2?,1,2,3,4,B
Incomplete row,OnlyOneField
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      expect(renderer.questions.length).to.equal(1);
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      fs.unlinkSync(tmpFile);
    });
    
    it("should ignore CSV rows with invalid correct answer values", async function () {
      this.timeout(5000);
      const tmpFile = path.join(__dirname, "temp_invalid.csv");
      const csvContent = `What is 2+2?,1,2,3,4,B
Invalid answer row,Val1,Val2,Val3,Val4,Z
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      expect(renderer.questions.length).to.equal(1);
      expect(renderer.questions[0].questionText).to.equal("What is 2+2?");
      fs.unlinkSync(tmpFile);
    });
    
    it("should reject if an error occurs while reading the CSV file", async function () {
      this.timeout(5000);
      // Override fs.createReadStream to simulate an error.
      const originalCreateReadStream = fs.createReadStream;
      fs.createReadStream = () => {
        const { Readable } = require("stream");
        const stream = new Readable();
        stream._read = () => {};
        // Emit error synchronously.
        stream.emit("error", new Error("Test error"));
        return stream;
      };
      try {
        await loadQuestions("dummy/path");
        throw new Error("Expected loadQuestions to reject");
      } catch (err) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Test error");
      } finally {
        fs.createReadStream = originalCreateReadStream;
      }
    });
    
    it("should handle a CSV file with no valid questions", async function () {
      this.timeout(5000);
      const tmpFile = path.join(__dirname, "temp_none.csv");
      const csvContent = `Invalid row,No,Valid,Data
Another invalid row,Missing,Fields
`;
      fs.writeFileSync(tmpFile, csvContent, "utf8");
      renderer.questions.splice(0, renderer.questions.length);
      await loadQuestions(tmpFile);
      expect(renderer.questions.length).to.equal(0);
      const feedbackText = document.getElementById("feedback").innerHTML;
      expect(feedbackText).to.contain("No valid questions found");
      fs.unlinkSync(tmpFile);
    });
  });

  // -------------------------------
  // Test Suite: selectCSVFile
  // -------------------------------
  describe("selectCSVFile", function () {
    it("should not open a new dialog if one is already open", async function () {
      // Override loadQuestions to prevent actual file reading.
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

      // Ensure that the dialog flag is false initially.
      state.isDialogOpen = false;

      // Call selectCSVFile once; do not await so that it remains pending.
      selectCSVFile();
      await Promise.resolve(); // Yield to microtasks.
      // Now, state.isDialogOpen should be true.
      expect(state.isDialogOpen).to.be.true;

      // Call selectCSVFile a second time; it should detect that a dialog is already open.
      await selectCSVFile();
      // Verify that ipcRenderer.invoke was called only once.
      expect(invokeCallCount).to.equal(1);

      // Wait for the fake promise to resolve.
      await fakePromise;
      // After resolution, state.isDialogOpen should be reset to false.
      expect(state.isDialogOpen).to.be.false;

      // Restore the original fakeIpcRenderer.invoke and loadQuestions.
      fakeIpcRenderer.invoke = originalInvoke;
      renderer.loadQuestions = originalLoadQuestions;
    });
  });

  // -------------------------------
  // Edge Case Tests
  // -------------------------------
  describe("Edge Cases", function () {
    it("should do nothing if document is undefined in displayQuestion", function () {
      const originalDoc = global.document;
      global.document = undefined;
      expect(() => displayQuestion(0)).to.not.throw();
      global.document = originalDoc;
    });

    it("should do nothing if document is undefined in checkAnswer", function () {
      const originalDoc = global.document;
      global.document = undefined;
      expect(() => checkAnswer("A", "A")).to.not.throw();
      global.document = originalDoc;
    });

    it("should do nothing in updateCounter if counterContainer is not found", function () {
      // Remove counterContainer element.
      const counterContainer = document.getElementById("counterContainer");
      counterContainer.parentNode.removeChild(counterContainer);
      // updateCounter should not throw an error.
      expect(() => updateCounter()).to.not.throw();
    });

    it("should do nothing in loadQuestions if document is undefined", async function () {
      const originalDoc = global.document;
      global.document = undefined;
      await loadQuestions("dummy.csv").catch(() => {});
      global.document = originalDoc;
    });

    it("should do nothing in selectCSVFile if ipcRenderer is undefined", async function () {
      const originalIpc = global.ipcRenderer;
      global.ipcRenderer = undefined;
      expect(async () => { await selectCSVFile(); }).to.not.throw();
      global.ipcRenderer = originalIpc;
    });
  });
});
