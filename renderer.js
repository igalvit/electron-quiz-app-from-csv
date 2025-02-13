// renderer.js
//
// This module handles the main logic for the Electron Quiz App from CSV's renderer process.
// It performs the following tasks:
//   - Parses a CSV file to load quiz questions.
//   - Displays the current question and its options in the DOM.
//   - Checks the user's answer and provides visual feedback.
//   - Tracks the score (correct and incorrect answers) and updates a combined counter display.
//   - Handles IPC communication with the main process for selecting a CSV file.
//   - Prevents multiple CSV file dialogs from opening concurrently.

// -----------------------------------------------------------------------------
// Import Node.js modules.
// -----------------------------------------------------------------------------
const fs = require('fs');             // File system module used to read CSV files.
const path = require('path');         // Module for handling file paths.
const csv = require('csv-parser');    // Library for parsing CSV file contents.

// -----------------------------------------------------------------------------
// Import ipcRenderer from Electron for IPC communication.
// -----------------------------------------------------------------------------
const { ipcRenderer } = require('electron');

// -----------------------------------------------------------------------------
// Module-level variables for storing quiz data and score.
// -----------------------------------------------------------------------------
let questions = [];                   // Array to hold the currently filtered quiz questions.
let allQuestions = [];                // Array to hold all loaded quiz questions (for filtering).
let currentQuestionIndex = 0;         // Index of the currently displayed question.
let correctCount = 0;                 // Counter for correct answers.
let incorrectCount = 0;               // Counter for incorrect answers.

// -----------------------------------------------------------------------------
// Constant for mapping answer indices to letters.
// For example, index 0 maps to 'A', index 1 to 'B', etc.
// -----------------------------------------------------------------------------
const letters = ['A', 'B', 'C', 'D'];

// -----------------------------------------------------------------------------
// State Object
//
// We wrap the dialog flag in an object so that we export a live reference.
// This allows external modules/tests to see changes to the flag.
// -----------------------------------------------------------------------------
const state = {
  isDialogOpen: false
};

// -----------------------------------------------------------------------------
// Function: loadQuestions
//
// This function parses a CSV file to load quiz questions.
// Expected CSV row format (without headers):
//    questionText,option1,option2,option3,option4,correctAnswer,group
//
// The function clears the existing questions, resets the score counters, and updates the combined counter display.
// It returns a Promise that resolves with the questions array once CSV parsing completes.
// -----------------------------------------------------------------------------
function loadQuestions(csvPath) {
  return new Promise((resolve, reject) => {
    // Clear existing questions and reset current question index.
    questions.splice(0, questions.length);
    allQuestions = [];
    currentQuestionIndex = 0;
    // Reset score counters.
    correctCount = 0;
    incorrectCount = 0;
    updateCounter(); // Update combined counter display.

    // Define expected headers (note the added 'group' column) and valid answer letters.
    const headers = ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'group'];
    const validAnswers = ['A', 'B', 'C', 'D'];

    // Create a read stream for the CSV file and pipe it to the CSV parser.
    fs.createReadStream(csvPath)
      .pipe(csv({ headers, skipLines: 0 }))
      .on('data', (row) => {
        // Check if all required fields are present.
        if (
          !row.questionText ||
          !row.option1 ||
          !row.option2 ||
          !row.option3 ||
          !row.option4 ||
          !row.correctAnswer
        ) {
          console.error("CSV row missing required fields:", row);
          return; // Skip this row.
        }
        // Standardize the correct answer.
        const correct = row.correctAnswer.trim().toUpperCase();
        // Validate the correct answer.
        if (!validAnswers.includes(correct)) {
          console.error("CSV row has invalid correct answer value:", row.correctAnswer);
          return; // Skip this row.
        }
        // Add the valid question to the questions array.
        // Use the 'group' column if provided, or default to "All".
        questions.push({
          questionText: row.questionText.trim(),
          options: [
            row.option1.trim(),
            row.option2.trim(),
            row.option3.trim(),
            row.option4.trim()
          ],
          correctAnswer: correct,
          group: row.group ? row.group.trim() : "All"
        });
      })
      .on('end', () => {
        if (questions.length === 0) {
          console.error("No valid questions found in CSV file.");
          const feedbackDiv = document.getElementById('feedback');
          if (feedbackDiv) {
            feedbackDiv.innerHTML = '<p style="color:red;">No valid questions found in CSV file. Please check the file format.</p>';
          }
          resolve(questions);
          return;
        }
        console.log("CSV file processed successfully with", questions.length, "valid questions.");
        // Save a copy of all questions for filtering.
        allQuestions = questions.slice();
        // Populate the group filter dropdown.
        populateGroupDropdown(allQuestions);
        // Display the first question.
        displayQuestion(currentQuestionIndex);
        resolve(questions);
      })
      .on('error', (err) => {
        console.error("Error reading CSV file:", err);
        reject(err);
      });
  });
}

// -----------------------------------------------------------------------------
// Function: populateGroupDropdown
//
// Populates the group <select> element with unique group values from the loaded questions.
// When the user selects a group, the questions array is filtered accordingly and the quiz resets.
// -----------------------------------------------------------------------------
function populateGroupDropdown(questionsArray) {
  if (!document) return;
  const groupSelect = document.getElementById('groupSelect');
  if (!groupSelect) return;

  // Clear existing options.
  groupSelect.innerHTML = '';
  // Add the default "All" option.
  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'All';
  groupSelect.appendChild(allOption);

  // Collect unique groups from the questions.
  const uniqueGroups = new Set();
  questionsArray.forEach(q => {
    if (q.group) {
      uniqueGroups.add(q.group);
    }
  });

  // Add each unique group as an option.
  uniqueGroups.forEach(groupName => {
    const opt = document.createElement('option');
    opt.value = groupName;
    opt.textContent = groupName;
    groupSelect.appendChild(opt);
  });

  // Add an event listener to filter questions when a group is selected.
  groupSelect.addEventListener('change', function() {
    const selectedGroup = groupSelect.value;
    if (selectedGroup === 'All') {
      questions.splice(0, questions.length, ...allQuestions);
    } else {
      questions.splice(0, questions.length, ...allQuestions.filter(q => q.group === selectedGroup));
    }
    currentQuestionIndex = 0;
    resetScore();
    displayQuestion(currentQuestionIndex);
  });

}

// -----------------------------------------------------------------------------
// Function: displayQuestion
//
// Renders the current quiz question and its answer options into the DOM.
// It clears previous content and then creates the question text and buttons for each answer.
// It also updates the combined counter display by calling updateCounter().
// 
// @param {number} index - The index of the question to display.
// -----------------------------------------------------------------------------
function displayQuestion(index) {
  if (!document) return;
  const questionDiv = document.getElementById('question');
  const optionsDiv = document.getElementById('options');
  const feedbackDiv = document.getElementById('feedback');

  // Clear any existing content.
  questionDiv.innerHTML = '';
  optionsDiv.innerHTML = '';
  feedbackDiv.innerHTML = '';

  // If the provided index is out of bounds, do nothing.
  if (index < 0 || index >= questions.length) return;
  const question = questions[index];
  // Display the question text.
  questionDiv.innerHTML = `<h2>${question.questionText}</h2>`;

  // Update the combined counter.
  updateCounter();

  // (Optional) Update a separate counter element if present.
  const counterDiv = document.getElementById("counter");
  if (counterDiv) {
    counterDiv.innerHTML = `${currentQuestionIndex + 1} / ${questions.length}`;
  }

  // Create a button for each answer option.
  question.options.forEach((option, i) => {
    const btn = document.createElement('button');
    btn.classList.add('option-button');
    btn.dataset.letter = letters[i];
    btn.innerText = `${letters[i]}) ${option}`;
    // Add an event listener to check the answer when the button is clicked.
    btn.addEventListener('click', () => {
      checkAnswer(letters[i], question.correctAnswer);
    });
    optionsDiv.appendChild(btn);
  });
}

// -----------------------------------------------------------------------------
// Function: updateCounter
//
// Updates the combined counter display in the DOM.
// The counter shows the current question number, total questions,
// and the score in the format: "Current: X | Total: Y -- Correct: Z | Incorrect: W".
// -----------------------------------------------------------------------------
function updateCounter() {
  const counterContainer = document.getElementById("counterContainer");
  if (counterContainer) {
    counterContainer.innerHTML = `Current: ${currentQuestionIndex + 1} | Total: ${questions.length} -- Correct: ${correctCount} | Incorrect: ${incorrectCount}`;
  }
}

// -----------------------------------------------------------------------------
// Function: checkAnswer
//
// Checks whether the user's selected answer is correct.
// It disables all answer buttons, updates their background colors,
// increments the appropriate score counter, updates feedback, and then updates the combined counter.
// 
// @param {string} selected - The letter of the selected answer.
// @param {string} correct - The letter of the correct answer.
// -----------------------------------------------------------------------------
function checkAnswer(selected, correct) {
  if (!document) return;
  const feedbackDiv = document.getElementById('feedback');
  const buttons = document.querySelectorAll('.option-button');

  // Disable all buttons and apply appropriate styles.
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.letter === correct) {
      btn.style.backgroundColor = 'lightgreen';
    }
    if (btn.dataset.letter === selected && selected !== correct) {
      btn.style.backgroundColor = 'lightcoral';
    }
  });

  // Update score counters and provide feedback.
  if (selected === correct) {
    correctCount++;
    feedbackDiv.innerHTML = '<p style="color: green;">Correct!</p>';
  } else {
    incorrectCount++;
    const correctIndex = letters.indexOf(correct);
    const correctText = questions[currentQuestionIndex].options[correctIndex];
    feedbackDiv.innerHTML = `<p style="color: red;">Incorrect. The correct answer is: ${correct}) ${correctText}</p>`;
  }
  // Update the combined counter.
  updateCounter();
}

// -----------------------------------------------------------------------------
// Variable: isDialogOpen (exported as part of state)
//
// This flag tracks whether a CSV file dialog is currently open.
// It prevents multiple dialogs from being opened concurrently.
// -----------------------------------------------------------------------------
let isDialogOpen = false;
// We export the flag as part of the state object so that it remains a live reference.
const stateObj = {
  isDialogOpen
};

// -----------------------------------------------------------------------------
// Function: selectCSVFile
//
// Opens a CSV file dialog using IPC. If a file is selected, it loads quiz questions
// by calling loadQuestions with the selected file path.
// It prevents multiple dialogs from opening by checking the isDialogOpen flag.
// -----------------------------------------------------------------------------
async function selectCSVFile() {
  if (typeof ipcRenderer !== 'undefined') {
    // If a dialog is already open, do nothing.
    if (stateObj.isDialogOpen) {
      console.log("A CSV file dialog is already open.");
      return;
    }
    
    // Mark the dialog as open.
    stateObj.isDialogOpen = true;
    try {
      const filePath = await ipcRenderer.invoke('select-csv-file');
      console.log("Selected CSV file:", filePath);
      if (filePath) {
        loadQuestions(filePath);
      }
    } catch (error) {
      console.error("Error during IPC invocation:", error);
    } finally {
      // Reset the dialog flag.
      stateObj.isDialogOpen = false;
    }
  }
}

// -----------------------------------------------------------------------------
// Function: initialize
//
// Attaches event listeners to UI elements once the DOM content is loaded.
// This includes the CSV selection button and navigation buttons.
// -----------------------------------------------------------------------------
function initialize() {
  if (document) {
    const selectCsvBtn = document.getElementById('selectCsvBtn');
    if (selectCsvBtn) {
      selectCsvBtn.addEventListener('click', selectCSVFile);
    }
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
          currentQuestionIndex--;
          displayQuestion(currentQuestionIndex);
        }
      });
    }
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < questions.length - 1) {
          currentQuestionIndex++;
          displayQuestion(currentQuestionIndex);
        }
      });
    }
  }
}

// -----------------------------------------------------------------------------
// DOMContentLoaded Listener
//
// When running in a browser, initialize the app after the DOM content has loaded.
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined' && document) {
  window.addEventListener('DOMContentLoaded', initialize);
}

// -----------------------------------------------------------------------------
// Function: resetScore
//
// Resets the correct and incorrect score counters to zero and updates the combined counter.
// This is useful when starting a new quiz session.
// -----------------------------------------------------------------------------
function resetScore() {
  correctCount = 0;
  incorrectCount = 0;
  updateCounter();
}

// -----------------------------------------------------------------------------
// Module Exports
//
// Export functions and variables for use by other modules and for testing.
// We export the questions array (without reassigning it) so that external modules see its current state.
// -----------------------------------------------------------------------------
if (typeof module !== 'undefined') {
  module.exports = {
    checkAnswer,
    displayQuestion,
    loadQuestions,
    initialize,
    resetScore,
    selectCSVFile,
    updateCounter,    // Export updateCounter for testing purposes.
    questions,
    currentQuestionIndex,
    state: stateObj   // Export the state object so that tests can access state.isDialogOpen.
  };
}
