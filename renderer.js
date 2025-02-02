// renderer.js
//
// This module handles the main logic for the Electron Quiz App's renderer process.
// It is responsible for:
// - Parsing a CSV file to load quiz questions.
// - Displaying the current question and its options in the DOM.
// - Checking the user's answer and providing visual feedback.
// - Handling IPC communication with the main process for selecting a CSV file.

// -----------------------------------------------------------------------------
// Import Node.js modules.
// -----------------------------------------------------------------------------
const fs = require('fs');             // File system module to read CSV files.
const path = require('path');         // Module for handling file paths.
const csv = require('csv-parser');    // CSV parsing library to parse CSV file contents.

// -----------------------------------------------------------------------------
// Import ipcRenderer for IPC communication with the main process.
// -----------------------------------------------------------------------------
const { ipcRenderer } = require('electron');

// -----------------------------------------------------------------------------
// Module-level variables to store quiz data.
// -----------------------------------------------------------------------------
let questions = [];                   // Array to hold all loaded quiz questions.  
                                    // (This array is exported so that tests can access and update it.)
let currentQuestionIndex = 0;         // Index of the currently displayed question.

// -----------------------------------------------------------------------------
// Constant for mapping answer indices to letters (e.g., 0 -> 'A', 1 -> 'B', etc.).
// -----------------------------------------------------------------------------
const letters = ['A', 'B', 'C', 'D'];

// -----------------------------------------------------------------------------
// Function: loadQuestions
//
// Parses a CSV file and populates the questions array with quiz questions.
// The CSV file should have rows in the following format (without headers):
// "Question,Option1,Option2,Option3,Option4,CorrectAnswer"
//
// Instead of reassigning the questions array, we clear its contents using splice,
// so that the exported array reference remains the same.
//
// This function returns a Promise that resolves when CSV parsing is complete.
//
// @param {string} csvPath - Absolute path to the CSV file.
// @returns {Promise} - Resolves with the updated questions array.
// -----------------------------------------------------------------------------
function loadQuestions(csvPath) {
  return new Promise((resolve, reject) => {
    // Clear the existing questions array without reassigning the variable.
    questions.splice(0, questions.length);
    currentQuestionIndex = 0;  // Reset the current question index.

    // Define the expected CSV headers.
    const headers = ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctAnswer'];
    // Define the set of valid answer letters.
    const validAnswers = ['A', 'B', 'C', 'D'];

    // Create a read stream for the CSV file and pipe it through the CSV parser.
    fs.createReadStream(csvPath)
      .pipe(csv({ headers, skipLines: 0 }))
      .on('data', (row) => {
        // Validate that the row contains all required fields.
        if (
          !row.questionText ||
          !row.option1 ||
          !row.option2 ||
          !row.option3 ||
          !row.option4 ||
          !row.correctAnswer
        ) {
          console.error("CSV row missing required fields:", row);
          return; // Skip this row if validation fails.
        }
        // Standardize the correct answer to uppercase.
        const correct = row.correctAnswer.trim().toUpperCase();
        // Validate that the correct answer is one of the allowed letters.
        if (!validAnswers.includes(correct)) {
          console.error("CSV row has invalid correct answer value:", row.correctAnswer);
          return; // Skip this row if validation fails.
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
          correctAnswer: correct
        });
      })
      .on('end', () => {
        // If no questions were loaded, log an error and update the feedback area.
        if (questions.length === 0) {
          console.error("No valid questions found in CSV file.");
          const feedbackDiv = document.getElementById('feedback');
          if (feedbackDiv) {
            feedbackDiv.innerHTML = '<p style="color:red;">No valid questions found in CSV file. Please check the file format.</p>';
          }
          resolve(questions);
          return;
        }
        // Log a success message and optionally display the first question.
        console.log("CSV file processed successfully with", questions.length, "valid questions.");
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
// Function: displayQuestion
//
// Renders the current quiz question and its options into the DOM.
// It clears previous content and then creates the question text and answer buttons.
// Each answer button gets an event listener to handle answer selection.
// 
// @param {number} index - The index of the question to display.
// -----------------------------------------------------------------------------
function displayQuestion(index) {
  if (!document) return;
  const questionDiv = document.getElementById('question');
  const optionsDiv = document.getElementById('options');
  const feedbackDiv = document.getElementById('feedback');

  // Clear any previous content.
  questionDiv.innerHTML = '';
  optionsDiv.innerHTML = '';
  feedbackDiv.innerHTML = '';

  // Validate the index.
  if (index < 0 || index >= questions.length) return;
  const question = questions[index];
  // Render the question text.
  questionDiv.innerHTML = `<h2>${question.questionText}</h2>`;

  // Update the counter element with the current question number and total questions.
  const counterDiv = document.getElementById("counter");
  if (counterDiv) {
    counterDiv.innerHTML = `${currentQuestionIndex + 1} / ${questions.length}`;
  }

  // Create buttons for each answer option.
  question.options.forEach((option, i) => {
    const btn = document.createElement('button');
    btn.classList.add('option-button');
    btn.dataset.letter = letters[i]; // Set the answer letter (A, B, C, or D).
    btn.innerText = `${letters[i]}) ${option}`; // Display the letter and option text.
    // Attach an event listener: when the button is clicked, check the answer.
    btn.addEventListener('click', () => {
      checkAnswer(letters[i], question.correctAnswer);
    });
    // Add the button to the options container.
    optionsDiv.appendChild(btn);
  });
}

// -----------------------------------------------------------------------------
// Function: checkAnswer
//
// Compares the user's selected answer with the correct answer,
// disables further input (by disabling all option buttons),
// and provides visual feedback by changing the button colors and updating the feedback text.
// 
// @param {string} selected - The letter of the selected answer.
// @param {string} correct - The letter of the correct answer.
// -----------------------------------------------------------------------------
function checkAnswer(selected, correct) {
  if (!document) return;
  const feedbackDiv = document.getElementById('feedback');
  const buttons = document.querySelectorAll('.option-button');

  // Disable all answer buttons and set the background colors.
  buttons.forEach(btn => {
    btn.disabled = true;
    // Highlight the correct answer in lightgreen.
    if (btn.dataset.letter === correct) {
      btn.style.backgroundColor = 'lightgreen';
    }
    // If the selected answer is incorrect, highlight it in lightcoral.
    if (btn.dataset.letter === selected && selected !== correct) {
      btn.style.backgroundColor = 'lightcoral';
    }
  });

  // Update the feedback area with the result.
  if (selected === correct) {
    feedbackDiv.innerHTML = '<p style="color: green;">Correct!</p>';
  } else {
    // Determine the index of the correct answer and get its text.
    const correctIndex = letters.indexOf(correct);
    const correctText = questions[currentQuestionIndex].options[correctIndex];
    feedbackDiv.innerHTML = `<p style="color: red;">Incorrect. The correct answer is: ${correct}) ${correctText}</p>`;
  }
}
/**
 * Flag to track whether a file dialog is already open.
 * This prevents opening multiple dialogs concurrently.
 */
let isDialogOpen = false;

/**
 * selectCSVFile - Uses IPC to open a native file dialog for CSV selection.
 * If a CSV file is selected, it calls loadQuestions to load the quiz questions.
 * This function prevents opening a second dialog while one is already active.
 */
async function selectCSVFile() {
  if (typeof ipcRenderer !== 'undefined') {
    // If a dialog is already open, do nothing.
    if (isDialogOpen) {
      console.log("A CSV file dialog is already open.");
      return;
    }
    
    // Mark that the dialog is open.
    isDialogOpen = true;
    try {
      const filePath = await ipcRenderer.invoke('select-csv-file');
      console.log("Selected CSV file:", filePath);
      if (filePath) {
        loadQuestions(filePath);
      }
    } catch (error) {
      console.error("Error during IPC invocation:", error);
    } finally {
      // Reset the flag once the dialog operation is complete.
      isDialogOpen = false;
    }
  }
}

// -----------------------------------------------------------------------------
// Function: initialize
//
// Attaches event listeners to the UI elements once the DOM content is fully loaded.
// This includes the CSV selection button and navigation buttons.
// -----------------------------------------------------------------------------
function initialize() {
  if (document) {
    // Attach the CSV selection event listener.
    const selectCsvBtn = document.getElementById('selectCsvBtn');
    if (selectCsvBtn) {
      selectCsvBtn.addEventListener('click', selectCSVFile);
    }
    // Attach the Previous button event listener.
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
          currentQuestionIndex--;
          displayQuestion(currentQuestionIndex);
        }
      });
    }
    // Attach the Next button event listener.
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
// Initialize the application once the DOM is ready.
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined' && document) {
  window.addEventListener('DOMContentLoaded', initialize);
}

// -----------------------------------------------------------------------------
// Module Exports
//
// Export functions and module-level variables so they can be accessed by other
// modules and used in testing. Note that we export the questions array without
// reassigning it later, so that tests that hold a reference to this array
// always see the current contents.
// -----------------------------------------------------------------------------
if (typeof module !== 'undefined') {
  module.exports = {
    checkAnswer,
    displayQuestion,
    loadQuestions,
    initialize,
    questions,            // Export the questions array.
    currentQuestionIndex  // Export the current question index.
  };
}
