// renderer.js
//
// This module handles the main logic for the Electron Quiz App from CSV's renderer process.
// It performs the following tasks:
//   - Parses a CSV file to load quiz questions (including filtering by a "group" column).
//   - Displays the current question and its options in the DOM.
//   - Provides a modern card-style UI with responsive design for score tracking.
//   - Implements a timer that starts with the first question and tracks quiz duration.
//   - Checks the user's answer and provides visual feedback via a floating message.
//   - Tracks the score (correct and incorrect answers) and updates the score display.
//   - Stops the timer only when all questions in the current group have been answered.
//   - Resets and restarts the timer when the group filter changes.
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
let allQuestions = [];                // Array to hold all loaded quiz questions (used for filtering).
let currentQuestionIndex = 0;         // Index of the currently displayed question.
let correctCount = 0;                 // Counter for correct answers.
let incorrectCount = 0;               // Counter for incorrect answers.

// -----------------------------------------------------------------------------
// Constant for mapping answer indices to letters.
// -----------------------------------------------------------------------------
const letters = ['A', 'B', 'C', 'D'];

// -----------------------------------------------------------------------------
// State Object
//
// This state object holds flags used within the module (such as whether a CSV file dialog is open).
// Wrapping the flag in an object allows external modules and tests to always have access to the live reference.
// -----------------------------------------------------------------------------
const state = {
  isDialogOpen: false
};

// -----------------------------------------------------------------------------
// Timer-related variables
//
// These variables track the timer state for the quiz.
// timerInterval - Holds the interval ID for the active timer.
// timerStart    - Timestamp of when the timer was started (used for calculating elapsed time).
// timerElapsed  - Tracks the total elapsed seconds.
// -----------------------------------------------------------------------------
let timerInterval = null;
let timerStart = null;
let timerElapsed = 0;

/**
 * getQuestions and getCurrentQuestionIndex
 * --------------------------------------
 * Helper functions that provide access to module-level variables.
 * 
 * These functions ensure that module exports are given precedence over local variables
 * when needed (particularly during testing). This maintains consistent context between
 * the application and test environment.
 */
function getQuestions() {
  if (typeof module !== 'undefined' && module.exports && module.exports.questions) return module.exports.questions;
  return questions;
}
function getCurrentQuestionIndex() {
  if (typeof module !== 'undefined' && module.exports && typeof module.exports.currentQuestionIndex === 'number') return module.exports.currentQuestionIndex;
  return currentQuestionIndex;
}

/**
 * startTimer
 * ----------
 * Initializes and starts the quiz timer.
 * 
 * This function resets any existing timer, sets the start time to the current timestamp,
 * resets the elapsed time counter, and begins updating the timer display every second.
 * The timer is automatically started when:
 *   1. The first question of a group is displayed
 *   2. The group filter is changed
 */
function startTimer() {
  stopTimer();
  timerStart = Date.now();
  timerElapsed = 0;
  updateTimerDisplay(0);
  timerInterval = setInterval(() => {
    timerElapsed = Math.floor((Date.now() - timerStart) / 1000);
    updateTimerDisplay(timerElapsed);
  }, 1000);
}

/**
 * stopTimer
 * ---------
 * Halts the currently running timer.
 * 
 * This function clears the interval used for the timer and resets the interval reference.
 * The timer is automatically stopped only when all questions in the current group have been answered,
 * which is tracked using the userAnswered property on each question.
 */
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * resetTimer
 * ----------
 * Completely resets the timer.
 * 
 * This function stops the timer, clears the elapsed time, and updates the timer display
 * to show 00:00. Used when restarting quizzes or changing question groups.
 */
function resetTimer() {
  stopTimer();
  timerElapsed = 0;
  updateTimerDisplay(0);
}

/**
 * updateTimerDisplay
 * -----------------
 * Updates the timer display in the DOM with the current elapsed time.
 * 
 * This function creates a timer container if one doesn't exist, then updates it
 * with the formatted time (MM:SS format). The timer is displayed at the top of the quiz
 * container with a modern styled interface (styled via CSS).
 * 
 * @param {number} seconds - The number of seconds to display on the timer.
 */
function updateTimerDisplay(seconds) {
  let timerDiv = document.getElementById('timerContainer');
  if (!timerDiv) {
    timerDiv = document.createElement('div');
    timerDiv.id = 'timerContainer';
    timerDiv.className = 'timer-container';
    const quizContainer = document.getElementById('quiz-container');
    if (quizContainer) {
      quizContainer.insertBefore(timerDiv, quizContainer.firstChild);
    } else {
      document.body.insertBefore(timerDiv, document.body.firstChild);
    }
  }
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  timerDiv.innerHTML = `<span class="timer-label">Time:</span> <span class="timer-value">${mins}:${secs}</span>`;
}

/**
 * loadQuestions
 * -------------
 * Parses a CSV file to load quiz questions. The CSV is expected to have rows with the following
 * fields (without headers): questionText, option1, option2, option3, option4, correctAnswer, group.
 *
 * This function:
 * - Clears any previously loaded questions
 * - Resets the quiz score, question index, and userAnswered flags
 * - Detects CSV separator automatically (comma or semicolon)
 * - Validates rows for required fields and correct answer format
 * - Populates the group dropdown filter with unique group values 
 * - Displays the first question and prepares for the quiz to start
 * - Ensures the modern UI score card is properly initialized
 *
 * @param {string} csvPath - The absolute path to the CSV file.
 * @returns {Promise<Array>} A promise that resolves with the array of valid quiz questions.
 */
function loadQuestions(csvPath) {
  return new Promise((resolve, reject) => {
    // Clear existing questions and reset quiz state.
    questions.splice(0, questions.length);
    allQuestions = [];
    currentQuestionIndex = 0;
    correctCount = 0;
    incorrectCount = 0;
    updateCounter(); // Refresh the counter display.
    // Clear userAnswered flags for all questions (for tests and UI)
    if (questions) questions.forEach(q => delete q.userAnswered);

    // Define expected headers (including the 'group' column) and valid answer letters.
    const headers = ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'group'];
    const validAnswers = ['A', 'B', 'C', 'D'];

    // Create a read stream for the CSV file and pipe it through the CSV parser.
    // Detect separator: if the file contains semicolons, use ';', else use ','
    let fileContent;
    try {
      fileContent = fs.readFileSync(csvPath, 'utf8');
    } catch (err) {
      reject(err);
      return;
    }
    let separator = fileContent.includes(';') ? ';' : ',';
    fs.createReadStream(csvPath)
      .pipe(csv({ headers, skipLines: 0, separator, trim: true }))
      .on('data', (row) => {
        // Verify that all required fields are present.
        if (
          !row.questionText ||
          !row.option1 ||
          !row.option2 ||
          !row.option3 ||
          !row.option4 ||
          !row.correctAnswer
        ) {
          console.error("CSV row missing required fields:", row);
          return; // Skip invalid rows.
        }
        // Standardize and validate the correct answer.
        const correct = row.correctAnswer.trim().toUpperCase();
        if (!validAnswers.includes(correct)) {
          console.error("CSV row has invalid correct answer value:", row.correctAnswer);
          return; // Skip rows with invalid correct answer.
        }
        // Add the valid question to the questions array.
        questions.push({
          questionText: row.questionText.trim(),
          options: [
            row.option1.trim(),
            row.option2.trim(),
            row.option3.trim(),
            row.option4.trim()
          ],
          correctAnswer: correct,
          group: row.group ? row.group.trim() : "All"  // Default to "All" if no group provided.
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

/**
 * populateGroupDropdown
 * -----------------------
 * Populates the group filter dropdown (<select id="groupSelect">) with unique group values extracted
 * from the provided questions array. The "All" option is always added as the first option.
 *
 * When a user selects a group, this function filters the questions to show only those in the selected group,
 * resets the quiz state (including the score), updates the display, and restarts the timer.
 * This ensures a clean quiz experience when switching between different question categories.
 * 
 * @param {Array} questionsArray - The array of questions to extract group values from.
 */
function populateGroupDropdown(questionsArray) {
  if (!document) return;
  const groupSelect = document.getElementById('groupSelect');
  if (!groupSelect) return;

  // Clear any existing options.
  groupSelect.innerHTML = '';
  
  // Add the default "All" option first.
  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'All';
  groupSelect.appendChild(allOption);

  // Collect unique groups from the questions, excluding "All".
  const uniqueGroups = new Set();
  questionsArray.forEach(q => {
    if (q.group && q.group !== 'All') {
      uniqueGroups.add(q.group);
    }
  });

  // Append each unique group as an option in the dropdown.
  uniqueGroups.forEach(groupName => {
    const opt = document.createElement('option');
    opt.value = groupName;
    opt.textContent = groupName;
    groupSelect.appendChild(opt);
  });

  // Add an event listener to filter questions when the selected group changes.
  groupSelect.addEventListener('change', function() {
    const selectedGroup = groupSelect.value;
    if (selectedGroup === 'All') {
      // Restore the full set of questions.
      questions.splice(0, questions.length, ...allQuestions);
    } else {
      // Filter questions to only those that belong to the selected group.
      questions.splice(0, questions.length, ...allQuestions.filter(q => q.group === selectedGroup));
    }
    // Reset quiz state and update the display.
    currentQuestionIndex = 0;
    resetScore();
    displayQuestion(currentQuestionIndex);
    startTimer();
  });
}

/**
 * displayQuestion
 * ----------------
 * Renders the quiz question and its answer options in the DOM based on the provided index.
 *
 * This function clears any existing question, options, and feedback in the UI, then displays the question text.
 * It creates a button for each answer option and attaches an event listener to check the answer when clicked.
 * The score card is updated to reflect the current state of the quiz.
 * 
 * If this is the first question (index 0), the function will automatically start the timer.
 * This way, the timer begins only when users start answering questions, not during setup.
 *
 * @param {number} index - The index of the question to display.
 */
function displayQuestion(index) {
  if (!document) return;
  const questionDiv = document.getElementById('question');
  const optionsDiv = document.getElementById('options');
  const feedbackDiv = document.getElementById('feedback');

  // Clear any existing content in the relevant DOM elements.
  questionDiv.innerHTML = '';
  optionsDiv.innerHTML = '';
  feedbackDiv.innerHTML = '';

  // Do nothing if the index is out of bounds.
  if (index < 0 || index >= questions.length) return;
  const question = questions[index];
  
  // Display the question text inside an <h2> element.
  questionDiv.innerHTML = `<h2>${question.questionText}</h2>`;

  // Update the combined counter display.
  updateCounter();

  // Optionally update a separate counter if available.
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
    // When a button is clicked, check whether the answer is correct.
    btn.addEventListener('click', () => {
      checkAnswer(letters[i], question.correctAnswer);
    });
    optionsDiv.appendChild(btn);
  });

  // If this is the first question, start the timer
  if (index === 0) {
    startTimer();
  }
}

/**
 * updateCounter
 * -------------
 * Updates the modern card-style score display in the DOM.
 *
 * This function creates a responsive, modern UI score card with four sections:
 * - Current question number
 * - Total question count
 * - Correct answers count
 * - Incorrect answers count
 * 
 * Each section is styled using CSS for a clean, card-based layout with proper spacing,
 * borders, and visual hierarchy to improve readability.
 */
function updateCounter() {
  const counterContainer = document.getElementById("counterContainer");
  if (counterContainer) {
    counterContainer.innerHTML = `
      <div class="score-card">
        <div class="score-section">
          <span class="score-label">Current</span>
          <span class="score-value">${currentQuestionIndex + 1}</span>
        </div>
        <div class="score-section">
          <span class="score-label">Total</span>
          <span class="score-value">${questions.length}</span>
        </div>
        <div class="score-section">
          <span class="score-label">Correct</span>
          <span class="score-value correct-score">${correctCount}</span>
        </div>
        <div class="score-section">
          <span class="score-label">Incorrect</span>
          <span class="score-value incorrect-score">${incorrectCount}</span>
        </div>
      </div>
    `;
  }
}

/**
 * showFloatingMessage
 * ---------------------
 * Creates and displays a floating feedback message for a short duration.
 *
 * The message indicates whether the user's answer was correct or incorrect. It appears centered
 * at the top of the viewport and automatically fades out after 2 seconds.
 *
 * @param {string} message - The text message to display.
 * @param {boolean} isCorrect - If true, the message indicates a correct answer; otherwise, incorrect.
 */
function showFloatingMessage(message, isCorrect) {
  if (!document) return;
  const floatingDiv = document.createElement('div');
  floatingDiv.classList.add('floating-feedback');
  floatingDiv.textContent = message;
  // Set background color based on whether the answer was correct.
  floatingDiv.style.backgroundColor = isCorrect ? 'green' : 'red';
  document.body.appendChild(floatingDiv);
  
  // Trigger the CSS transition by forcing a reflow.
  void floatingDiv.offsetWidth;
  floatingDiv.classList.add('show');
  
  // After 2 seconds, fade out and then remove the floating message.
  setTimeout(() => {
    floatingDiv.classList.remove('show');
    setTimeout(() => {
      if (floatingDiv.parentNode) {
        floatingDiv.parentNode.removeChild(floatingDiv);
      }
    }, 500);
  }, 2000);
}

/**
 * checkAnswer
 * ------------
 * Checks if the selected answer is correct, updates score counters,
 * applies visual feedback to answer buttons, and shows a floating feedback message.
 *
 * Disables all answer option buttons to prevent multiple selections.
 * If the selected answer is correct, increments the correctCount;
 * otherwise, increments the incorrectCount and shows the correct answer in the message.
 * 
 * Marks the current question as answered by setting a userAnswered flag.
 * This tracking is crucial for the timer functionality - the timer will only stop
 * when ALL questions in the current set have been answered (userAnswered is true for all).
 *
 * @param {string} selected - The letter corresponding to the user's selected answer.
 * @param {string} correct - The letter corresponding to the correct answer.
 */
function checkAnswer(selected, correct) {
  if (!document) return;
  const buttons = document.querySelectorAll('.option-button');
  const qs = getQuestions();
  const idx = getCurrentQuestionIndex();
  // Disable all buttons and apply styling based on whether they are the correct answer.
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.letter === correct) {
      btn.style.backgroundColor = 'lightgreen';
    }
    if (btn.dataset.letter === selected && selected !== correct) {
      btn.style.backgroundColor = 'lightcoral';
    }
  });
  // Update score counters and show floating feedback.
  if (selected === correct) {
    correctCount++;
    showFloatingMessage("Correct!", true);
  } else {
    incorrectCount++;
    // Determine the text of the correct option.
    const correctIndex = letters.indexOf(correct);
    const correctText = qs[idx].options[correctIndex];
    showFloatingMessage(`Incorrect. The correct answer is: ${correct}) ${correctText}`, false);
  }
  // Refresh the combined counter display.
  updateCounter();
  // Stop timer only if ALL questions have been answered (i.e., every question has a selected answer)
  // We'll track answers by adding a property to each question when answered
  qs[idx].userAnswered = true;
  const allAnswered = qs.length > 0 && qs.every(q => q.userAnswered);
  if (allAnswered) {
    stopTimer();
  }
}

/**
 * selectCSVFile
 * ---------------
 * Opens a CSV file selection dialog via IPC and loads the selected CSV file.
 *
 * This function uses Electron's ipcRenderer.invoke to open a native file dialog.
 * It prevents multiple dialogs from opening concurrently by checking the state.isDialogOpen flag.
 *
 * If a file is selected, it calls loadQuestions to parse and load the quiz questions.
 */
async function selectCSVFile() {
  if (typeof ipcRenderer !== 'undefined') {
    if (state.isDialogOpen) {
      console.log("A CSV file dialog is already open.");
      return;
    }
    state.isDialogOpen = true;
    try {
      const filePath = await ipcRenderer.invoke('select-csv-file');
      console.log("Selected CSV file:", filePath);
      if (filePath) {
        loadQuestions(filePath);
      }
    } catch (error) {
      console.error("Error during IPC invocation:", error);
    } finally {
      state.isDialogOpen = false;
    }
  }
}

/**
 * initialize
 * ------------
 * Attaches event listeners to UI elements once the DOM content is loaded.
 *
 * This includes setting up the event handlers for:
 *   - The CSV selection button.
 *   - The Previous button (to navigate to the previous question).
 *   - The Next button (to navigate to the next question).
 * 
 * The timer will automatically start when the first question is displayed,
 * and will continue until all questions have been answered.
 */
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

/**
 * resetScore
 * ----------
 * Resets the quiz score counters (correctCount and incorrectCount) to zero
 * and updates the modern UI score card display accordingly.
 * Used when starting a new quiz or when changing question groups.
 */
function resetScore() {
  correctCount = 0;
  incorrectCount = 0;
  updateCounter();
}

// -----------------------------------------------------------------------------
// Module Exports
//
// Exports functions and variables for use by other modules and for testing.
// The timer-related functions are exported to support testing the timer functionality
// to ensure it starts, stops, and resets correctly during quiz interactions.
// -----------------------------------------------------------------------------
if (typeof module !== 'undefined') {
  module.exports = {
    checkAnswer,
    displayQuestion,
    loadQuestions,
    initialize,
    resetScore,
    selectCSVFile,
    updateCounter,
    questions,
    currentQuestionIndex,
    state,
    // Timer-related exports for testing
    startTimer,
    stopTimer,
    resetTimer,
    updateTimerDisplay,
    get timerInterval() { return timerInterval; }
  };
}
