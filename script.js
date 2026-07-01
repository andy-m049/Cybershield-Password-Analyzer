// --- Step 1: Grab the HTML elements we need to read from or write to ---
const passwordInput = document.getElementById("password");
const toggleButton = document.getElementById("togglePassword");
const strengthText = document.getElementById("strengthText");
const strengthBar = document.getElementById("strengthBar");
const generateButton = document.getElementById("generateBtn");

// An object grouping all five checklist elements together,
// so we can loop through them or reference them by name.
const checklistItems = {
  length: document.getElementById("lengthCheck"),
  upper: document.getElementById("upperCheck"),
  lower: document.getElementById("lowerCheck"),
  number: document.getElementById("numberCheck"),
  symbol: document.getElementById("symbolCheck")
};

const entropyText = document.getElementById("entropy");
const onlineTime = document.getElementById("onlineTime");
const offlineTime = document.getElementById("offlineTime");

// A short list of passwords that are too common to be safe.
// If the user's password matches one of these, we flag it as weak
// even if it technically passes the other checks.
const commonPasswords = ["password", "123456", "qwerty", "letmein", "admin"];

// Assumed attacker guess rates. These are estimates, not guarantees -
// real speed depends on the attacker's hardware and how the password
// is stored (e.g. bcrypt is much slower to crack than an unsalted MD5 hash).
const ONLINE_GUESSES_PER_SECOND = 10;               // rate-limited login form
const OFFLINE_GUESSES_PER_SECOND = 100_000_000_000; // stolen hash, cracked on GPUs

// --- Step 2: Tell the page what to do when things happen ---
// "input" fires every time the user types/deletes a character
passwordInput.addEventListener("input", checkPassword);
toggleButton.addEventListener("click", toggleVisibility);
generateButton.addEventListener("click", generatePassword);

// --- Step 3: The main function that runs every time the password changes ---
function checkPassword() {
  const password = passwordInput.value;

  // Regular expressions test whether a pattern exists in the string.
  // /[A-Z]/.test(password) asks: "does this password contain at least
  // one character between A and Z?"
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password); // "not a letter or number"
  const isCommon = commonPasswords.includes(password.toLowerCase());

  // Update each line of the checklist to show a checkmark or an X
  updateItem(checklistItems.length, hasLength, "At least 8 characters");
  updateItem(checklistItems.upper, hasUpper, "Uppercase letter");
  updateItem(checklistItems.lower, hasLower, "Lowercase letter");
  updateItem(checklistItems.number, hasNumber, "Number");
  updateItem(checklistItems.symbol, hasSymbol, "Special character");

  // Count how many of the 5 rules were passed
  let passedCount = 0;
  if (hasLength) passedCount++;
  if (hasUpper) passedCount++;
  if (hasLower) passedCount++;
  if (hasNumber) passedCount++;
  if (hasSymbol) passedCount++;

  updateStrengthDisplay(passedCount, password.length, isCommon);

  // --- Entropy and crack-time estimates ---
  const entropy = calculateEntropy(password);
  entropyText.textContent = entropy.toFixed(1);

  const onlineSeconds = estimateCrackTime(entropy, ONLINE_GUESSES_PER_SECOND);
  const offlineSeconds = estimateCrackTime(entropy, OFFLINE_GUESSES_PER_SECOND);

  onlineTime.textContent = formatOnlineTime(onlineSeconds);
  offlineTime.textContent = formatTime(offlineSeconds);
}

// Real login forms lock accounts, add delays, or require a CAPTCHA
// after a handful of failed attempts - so a raw "years to crack" number
// assumes something that would never actually be allowed to happen.
// Past a realistic threshold, we say that plainly instead of printing
// a huge, technically-true-but-meaningless number.
const REALISTIC_ONLINE_LIMIT_SECONDS = 100 * 31536000; // 100 years

function formatOnlineTime(seconds) {
  if (seconds !== null && isFinite(seconds) && seconds > REALISTIC_ONLINE_LIMIT_SECONDS) {
    return "Not practically guessable online (rate-limiting would stop this long before it finished)";
  }
  return formatTime(seconds);
}

// Entropy (in bits) measures how large the "search space" of possible
// passwords is. Each extra bit doubles the number of guesses an
// attacker would need to try. Formula: length * log2(pool size).
function calculateEntropy(password) {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^A-Za-z0-9]/.test(password)) poolSize += 33;

  if (password.length === 0 || poolSize === 0) return 0;

  return password.length * Math.log2(poolSize);
}

// Converts entropy into an estimated crack time at a given guess rate.
// 2^entropy = the total number of possible passwords in this keyspace.
// On average, an attacker finds the password after searching HALF the
// keyspace (not all of it) - that's why we divide by 2 before dividing
// by the guess rate.
function estimateCrackTime(entropy, guessesPerSecond) {
  if (entropy === 0) return null;

  const totalPossiblePasswords = Math.pow(2, entropy);
  const averageGuessesNeeded = totalPossiblePasswords / 2;

  return averageGuessesNeeded / guessesPerSecond;
}

// Turns a number of seconds into a human-readable estimate
function formatTime(seconds) {
  if (seconds === null || !isFinite(seconds) || seconds <= 0) {
    return "Not enough data";
  }
  if (seconds < 1) return "Less than 1 second";
  if (seconds < 60) return `About ${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `About ${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `About ${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `About ${Math.round(seconds / 86400)} days`;
  if (seconds < 3153600000) return `About ${Math.round(seconds / 31536000)} years`;
  return "Centuries or more";
}

// Updates one checklist line: sets its text and its CSS class
// (the CSS class controls whether it shows green or red)
function updateItem(element, passed, label) {
  element.textContent = (passed ? "✓ " : "✖ ") + label;
  element.className = passed ? "pass" : "fail";
}

// Decides the overall strength label and updates the bar's width/color
function updateStrengthDisplay(passedCount, length, isCommon) {
  if (length === 0) {
    strengthText.textContent = "Strength: —";
    strengthBar.style.width = "0%";
    strengthBar.style.background = "grey";
    return;
  }

  if (isCommon) {
    strengthText.textContent = "Strength: Weak (common password)";
    strengthBar.style.width = "20%";
    strengthBar.style.background = "red";
    return;
  }

  if (passedCount <= 2) {
    strengthText.textContent = "Strength: Weak";
    strengthBar.style.width = "33%";
    strengthBar.style.background = "red";
  } else if (passedCount <= 4) {
    strengthText.textContent = "Strength: Medium";
    strengthBar.style.width = "66%";
    strengthBar.style.background = "orange";
  } else {
    strengthText.textContent = "Strength: Strong";
    strengthBar.style.width = "100%";
    strengthBar.style.background = "green";
  }
}

// Switches the input between hidden (dots) and visible (plain text)
function toggleVisibility() {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleButton.textContent = "Hide";
  } else {
    passwordInput.type = "password";
    toggleButton.textContent = "Show";
  }
}

// Builds a random 12-character password from a fixed set of characters
function generatePassword() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let newPassword = "";

  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    newPassword += characters[randomIndex];
  }

  passwordInput.value = newPassword;
  checkPassword(); // re-run the checks so the UI updates for the new password
}